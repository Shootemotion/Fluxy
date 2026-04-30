"use client";

import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { getMovementsForDeduplication, createMovementsBulk, uploadImportFile, createCategory, createRecurrente } from "@/lib/actions";

const PASOS = ["Subir archivo", "Mapear columnas", "Preview", "Importar"];

const EMOJIS = ["🛒","🚗","🏠","🍔","💊","🎬","✈️","📱","💻","👕","🎓","⚕️","🐾","💡","💧","🔥","💳","💰","🎁","🚌","☕","🍺","💪","🎮"];

const COLUMNS_SISTEMA = [
  { value: "fecha", label: "Fecha" },
  { value: "descripcion", label: "Descripción" },
  { value: "monto", label: "Monto (General o Mensual)" },
  { value: "monto_total", label: "Monto Total de la Compra" },
  { value: "monto_restante", label: "Monto Restante a Pagar" },
  { value: "cuotas", label: "Info de Cuotas (Opcional)" },
  { value: "ignorar", label: "— Ignorar columna —" },
];

interface ImportarClientProps {
  accounts: any[];
  categories: any[];
}

interface ParsedRow {
  [key: string]: any;
}

interface ProcessedRow {
  fecha: string;
  descripcion: string;
  monto: number;
  tipo: "ingreso" | "gasto";
  moneda: string;
  categoria_id: string | null;
  categoria_nombre: string;
  cuenta_origen_id: string;
  isDuplicate?: boolean;
  selected?: boolean;
  isCuota?: boolean;
  cuotaActual?: number;
  cuotasTotales?: number;
  montoTotal?: number;
  crearRecurrente?: boolean;
  originalData?: any;
}

export default function ImportarClient({ accounts, categories }: ImportarClientProps) {
  const [paso, setPaso] = useState(0);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  
  const [cuentaId, setCuentaId] = useState<string>(accounts[0]?.id || "");
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
  const [localCategories, setLocalCategories] = useState(categories);

  const [creatingCategoryRow, setCreatingCategoryRow] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🛒");
  const [newCatLoading, setNewCatLoading] = useState(false);

  const [hideDuplicates, setHideDuplicates] = useState(false);

  // Find category by name heuristically
  function guessCategory(desc: string) {
    const lower = desc.toLowerCase();
    let catName = "Otros";
    if (lower.includes("super") || lower.includes("mercado") || lower.includes("carrefour") || lower.includes("coto") || lower.includes("jumbo") || lower.includes("dia ")) catName = "Alimentación";
    else if (lower.includes("uber") || lower.includes("cabify") || lower.includes("taxi") || lower.includes("nafta") || lower.includes("ypf") || lower.includes("shell") || lower.includes("axion")) catName = "Transporte";
    else if (lower.includes("farmacia") || lower.includes("medic") || lower.includes("salud") || lower.includes("obra social")) catName = "Salud";
    else if (lower.includes("netflix") || lower.includes("spotify") || lower.includes("youtube") || lower.includes("suscrip") || lower.includes("cine") || lower.includes("steam")) catName = "Ocio";
    else if (lower.includes("sueldo") || lower.includes("haberes") || lower.includes("honorarios") || lower.includes("aguinaldo")) catName = "Sueldo";
    else if (lower.includes("alquiler") || lower.includes("expensa") || lower.includes("servicios") || lower.includes("luz") || lower.includes("agua") || lower.includes("gas") || lower.includes("internet")) catName = "Vivienda";
    else if (lower.includes("seguro") || lower.includes("patente")) catName = "Impuestos y Seguros";
    else if (lower.match(/cuota\s*\d+\/\d+/i) || lower.match(/c\s*\d+\/\d+/i) || lower.match(/\d{2}\/\d{2}/) || lower.includes("tarjeta")) catName = "Tarjetas";
    
    // Si no encuentra la exacta, busca que la contenga
    let cat = localCategories.find((c: any) => c.nombre.toLowerCase() === catName.toLowerCase());
    if (!cat) cat = localCategories.find((c: any) => c.nombre.toLowerCase().includes(catName.toLowerCase()));
    // Fallback genérico para gastos e ingresos
    if (!cat) cat = localCategories.find((c: any) => c.nombre.toLowerCase() === "varios" || c.nombre.toLowerCase() === "otros");

    return { id: cat?.id || null, nombre: cat?.nombre || catName };
  }

  // Auto map columns heuristically
  function autoMapColumns(headers: string[], firstRow: any) {
    const newMapeo: Record<string, string> = {};
    headers.forEach(h => {
      const lowerH = h.toLowerCase();
      const val = String(firstRow[h] || "").toLowerCase();
      
      if (lowerH.includes("fecha") || lowerH.includes("date") || val.match(/^\d{2,4}[-/]\d{2}[-/]\d{2,4}$/)) {
        newMapeo[h] = "fecha";
      } else if (lowerH.includes("desc") || lowerH.includes("concepto") || lowerH.includes("detalle") || lowerH.includes("movimiento")) {
        newMapeo[h] = "descripcion";
      } else if (lowerH.includes("cuota") || lowerH.includes("plan")) {
        newMapeo[h] = "cuotas";
      } else if (lowerH.includes("monto") || lowerH.includes("importe") || lowerH.includes("amount") || (!isNaN(parseFloat(val)) && !lowerH.includes("saldo") && !lowerH.includes("comprobante") && !lowerH.includes("referencia"))) {
        if (lowerH.includes("total")) {
          newMapeo[h] = "monto_total";
        } else if (lowerH.includes("restante") || lowerH.includes("pendiente")) {
          newMapeo[h] = "monto_restante";
        } else if (!Object.values(newMapeo).includes("monto")) {
          newMapeo[h] = "monto";
        } else {
          newMapeo[h] = "ignorar";
        }
      } else {
        newMapeo[h] = "ignorar";
      }
    });
    
    // Ensure essential columns are mapped, otherwise default to something
    if (!Object.values(newMapeo).includes("fecha")) newMapeo[headers[0]] = "fecha";
    if (!Object.values(newMapeo).includes("descripcion")) newMapeo[headers[1] || headers[0]] = "descripcion";
    if (!Object.values(newMapeo).includes("monto")) newMapeo[headers[2] || headers[0]] = "monto";
    
    setMapeo(newMapeo);
  }

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setArchivo(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) return;

      if (file.name.endsWith('.csv')) {
        Papa.parse(data as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const headers = results.meta.fields || [];
            setRawHeaders(headers);
            setRawRows(results.data as ParsedRow[]);
            autoMapColumns(headers, results.data[0]);
            setPaso(1);
          }
        });
      } else if (file.name.endsWith('.xlsx')) {
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as ParsedRow[];
        if (jsonData.length > 0) {
          const headers = Object.keys(jsonData[0]);
          setRawHeaders(headers);
          setRawRows(jsonData);
          autoMapColumns(headers, jsonData[0]);
          setPaso(1);
        }
      } else {
        toast.error("Formato no soportado. Usá .csv o .xlsx");
      }
    };

    if (file.name.endsWith('.csv')) reader.readAsText(file);
    else reader.readAsBinaryString(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
  });

  // Convert raw rows to standardized ProcessedRows
  const buildProcessedRows = () => {
    const colFecha = Object.keys(mapeo).find(k => mapeo[k] === "fecha");
    const colDesc = Object.keys(mapeo).find(k => mapeo[k] === "descripcion");
    const colMonto = Object.keys(mapeo).find(k => mapeo[k] === "monto");
    const colMontoTotal = Object.keys(mapeo).find(k => mapeo[k] === "monto_total");
    const colMontoRestante = Object.keys(mapeo).find(k => mapeo[k] === "monto_restante");
    const colCuotas = Object.keys(mapeo).find(k => mapeo[k] === "cuotas");

    if (!colFecha || !colDesc || (!colMonto && !colMontoTotal && !colMontoRestante)) {
      toast.error("Debes mapear Fecha, Descripción y al menos un Monto.");
      return null;
    }

    const rows: ProcessedRow[] = [];
    for (const r of rawRows) {
      const valFecha = r[colFecha];
      let valMontoRaw = colMonto ? r[colMonto] : (colMontoTotal ? r[colMontoTotal] : (colMontoRestante ? r[colMontoRestante] : null));
      
      if (!valFecha || valMontoRaw == null) continue;

      const desc = String(r[colDesc] || "").trim();
      const infoCuotasStr = colCuotas ? String(r[colCuotas] || "").trim() : "";
      
      const cat = guessCategory(desc + " " + infoCuotasStr);

      // Search for cuota format (e.g. 02/06 or 2/6 or 2 de 6) in either the specific column or description
      const textToSearch = (infoCuotasStr + " " + desc).toLowerCase();
      const cuotaMatch = textToSearch.match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/);
      let isCuota = false;
      let cActual = 1;
      let cTotales = 1;

      if (cuotaMatch) {
        isCuota = true;
        cActual = parseInt(cuotaMatch[1]);
        cTotales = parseInt(cuotaMatch[2]);
      } else if (textToSearch.includes("cuota")) {
        isCuota = true;
      }

      // Logic for calculating Monto and MontoTotal
      let finalMontoNum = 0;
      let finalMontoTotal: number | undefined = undefined;

      // Check explicit columns
      const rawMonto = colMonto ? r[colMonto] : null;
      const rawMontoTotal = colMontoTotal ? r[colMontoTotal] : null;
      const rawMontoRestante = colMontoRestante ? r[colMontoRestante] : null;

      const parseMonto = (val: any) => {
        if (val == null || String(val).trim() === "") return NaN;
        let str = String(val).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
        if (String(val).split('.').length > 1 && String(val).split(',').length === 1) {
           str = String(val).replace(/[^0-9.-]/g, '');
        }
        return Math.abs(parseFloat(str));
      };

      const mNormal = parseMonto(rawMonto);
      const mTotal = parseMonto(rawMontoTotal);
      const mRestante = parseMonto(rawMontoRestante);

      if (isCuota && cTotales > 0) {
        if (!isNaN(mNormal) && !isNaN(mTotal)) {
          finalMontoNum = mNormal;
          finalMontoTotal = mTotal;
        } else if (!isNaN(mTotal)) {
          finalMontoTotal = mTotal;
          finalMontoNum = mTotal / cTotales;
        } else if (!isNaN(mRestante)) {
          // Calculate installment value from remaining balance
          const cuotasPendientes = (cTotales - cActual) + 1;
          finalMontoNum = cuotasPendientes > 0 ? mRestante / cuotasPendientes : mRestante;
          finalMontoTotal = finalMontoNum * cTotales;
        } else if (!isNaN(mNormal)) {
          finalMontoNum = mNormal;
          finalMontoTotal = mNormal * cTotales;
        }
      } else {
        finalMontoNum = !isNaN(mNormal) ? mNormal : (!isNaN(mTotal) ? mTotal : mRestante);
      }

      // Limitar a 2 decimales
      finalMontoNum = parseFloat(finalMontoNum.toFixed(2));
      if (finalMontoTotal !== undefined) finalMontoTotal = parseFloat(finalMontoTotal.toFixed(2));

      if (isNaN(finalMontoNum)) continue;
      
      const tipo = (rawMonto != null && String(rawMonto).includes('-')) || (rawMontoTotal != null && String(rawMontoTotal).includes('-')) ? "gasto" : "ingreso";

      // Parse date (try to get YYYY-MM-DD)
      let parsedDate = valFecha;
      if (valFecha.includes('/')) {
        const parts = valFecha.split('/');
        if (parts[2]?.length === 4) { // DD/MM/YYYY
          parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      // If description didn't have the cuota text but it's a cuota, append it so it's visible
      let finalDesc = desc;
      if (isCuota && !desc.match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/) && cuotaMatch) {
        finalDesc = `${desc} (${cuotaMatch[1]}/${cuotaMatch[2]})`;
      }

      rows.push({
        fecha: parsedDate,
        descripcion: isCuota && !finalDesc.includes("💳") ? `💳 ${finalDesc}` : finalDesc,
        monto: finalMontoNum,
        tipo,
        moneda: "ARS", // Assuming ARS by default, could be mapped
        categoria_id: cat.id,
        categoria_nombre: cat.nombre,
        cuenta_origen_id: cuentaId,
        selected: true,
        isCuota,
        cuotaActual: cActual,
        cuotasTotales: cTotales,
        montoTotal: finalMontoTotal,
        crearRecurrente: isCuota && cActual === 1, // Suggest creating recurrente if it's cuota 1
        originalData: r
      });
    }
    return rows;
  };

  const handlePreview = async () => {
    if (!cuentaId) {
      toast.error("Seleccioná una cuenta para importar");
      return;
    }
    setLoading(true);
    try {
      const rows = buildProcessedRows();
      if (!rows || rows.length === 0) {
        toast.error("No se pudieron extraer filas válidas.");
        setLoading(false);
        return;
      }

      // Deduplication check
      // 1. Get date range
      const dates = rows.map(r => new Date(r.fecha).getTime()).filter(t => !isNaN(t));
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
        const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
        
        const existing = await getMovementsForDeduplication(cuentaId, minDate, maxDate);
        
        rows.forEach(r => {
          const isDup = existing.some(e => 
            e.fecha === r.fecha && 
            Math.abs(Number(e.monto) - r.monto) < 0.01
          );
          if (isDup) {
            r.isDuplicate = true;
            r.selected = false; // Deselect duplicates by default
          }
        });
      }

      setProcessedRows(rows);
      setPaso(2);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const toImport = processedRows.filter(r => r.selected);
    if (toImport.length === 0) {
      toast.error("No hay filas seleccionadas para importar.");
      return;
    }
    setLoading(true);
    try {
      // 1. Opcionalmente guardar el archivo en Storage
      if (archivo) {
        const formData = new FormData();
        formData.append("file", archivo);
        // Fire and forget, or await. Let's await it to be safe
        await uploadImportFile(formData).catch(e => console.warn("Could not upload file", e));
      }

      // 2. Insertar en bloque
      await createMovementsBulk(toImport);

      // 3. Crear recurrentes si corresponde
      const recurrentesToCreate = toImport.filter(r => r.isCuota && r.crearRecurrente && r.cuotasTotales && r.montoTotal);
      for (const r of recurrentesToCreate) {
        try {
          // Retrocedemos la fecha de inicio tantos meses como cuotas ya hayan pasado
          const cuotasPasadas = (r.cuotaActual || 1) - 1;
          const start = new Date(r.fecha + "T12:00:00");
          start.setMonth(start.getMonth() - cuotasPasadas);
          
          const end = new Date(start.getTime());
          end.setMonth(end.getMonth() + r.cuotasTotales!);
          
          await createRecurrente({
            nombre: r.descripcion.replace(/\(\d{1,2}\s*(?:\/|de)\s*\d{1,2}\)|💳/g, '').trim(),
            tipo: "gasto",
            monto: r.monto,
            moneda: "ARS",
            categoria_id: r.categoria_id || null,
            cuenta_id: r.cuenta_origen_id,
            dia_del_mes: start.getDate(),
            fecha_inicio: start.toISOString().split('T')[0],
            fecha_fin: end.toISOString().split('T')[0],
            es_cuotas: true,
            cuotas_totales: r.cuotasTotales!,
            tasa_interes: null,
            activo: true
          });
        } catch (e) {
          console.warn("Could not create recurrente for", r.descripcion, e);
        }
      }

      toast.success(`${toImport.length} movimientos importados correctamente.`);
      setPaso(3);
    } catch (err: any) {
      toast.error("Error al importar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingCategoryRow === null) return;
    setNewCatLoading(true);
    try {
      const row = processedRows[creatingCategoryRow];
      const newCat = await createCategory({
        nombre: newCatName,
        tipo: row.tipo as "ingreso" | "gasto",
        icono: newCatIcon,
        color: "#6C63FF",
        activa: true,
        orden: 100
      });
      
      const updatedCategories = [...localCategories, newCat];
      setLocalCategories(updatedCategories);

      const newRows = [...processedRows];
      newRows[creatingCategoryRow].categoria_id = newCat.id;
      setProcessedRows(newRows);
      
      setCreatingCategoryRow(null);
      setNewCatName("");
      setNewCatIcon("🛒");
      toast.success("Categoría creada");
    } catch (err: any) {
      toast.error("Error al crear categoría: " + err.message);
    } finally {
      setNewCatLoading(false);
    }
  };

  const toggleRow = (index: number) => {
    const newRows = [...processedRows];
    newRows[index].selected = !newRows[index].selected;
    setProcessedRows(newRows);
  };

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Importar datos</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Importá tu resumen bancario o de billeteras en CSV o Excel</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {PASOS.map((p, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i === paso ? "text-white" : i < paso ? "text-white" : ""}`}
                style={{
                  background: i === paso ? "#6C63FF" : i < paso ? "#10B981" : "rgba(255,255,255,0.08)",
                  color: i > paso ? "rgba(255,255,255,0.4)" : undefined,
                }}>
                {i < paso ? "✓" : i + 1}
              </div>
              <span className="text-sm" style={{ color: i === paso ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)" }}>{p}</span>
            </div>
            {i < PASOS.length - 1 && <div className="w-8 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />}
          </div>
        ))}
      </div>

      {/* Step 0: Upload */}
      {paso === 0 && (
        <div className="animate-fade-in">
          <div
            {...getRootProps()}
            className="glass-card p-12 text-center cursor-pointer transition-all"
            style={{
              border: isDragActive ? "2px dashed #6C63FF" : "2px dashed rgba(255,255,255,0.1)",
              background: isDragActive ? "rgba(108,99,255,0.05)" : undefined,
            }}
          >
            <input {...getInputProps()} />
            <div className="text-5xl mb-4">{isDragActive ? "📂" : "📥"}</div>
            <p className="font-semibold text-lg mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>
              {isDragActive ? "Soltá el archivo aquí" : "Arrastrá tu archivo CSV o Excel"}
            </p>
            <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>O hacé click para seleccionar</p>
            <span className="badge badge-muted text-sm">.xlsx · .csv</span>
          </div>
          
          <div className="mt-6 glass-card p-5 alert-card info">
            <span className="text-xl">💡</span>
            <div>
              <p className="font-semibold text-sm mb-1 text-blue-100">Tips para la importación</p>
              <p className="text-xs text-blue-200/70">
                Asegurate de que tu archivo tenga al menos una columna con la Fecha, otra con el Monto y otra con la Descripción. 
                El sistema detectará automáticamente ingresos (números positivos) y gastos (negativos).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Column mapping */}
      {paso === 1 && archivo && (
        <div className="space-y-4 animate-slide-up">
          <div className="glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <div>
                <p className="font-medium text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{archivo.name}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{(archivo.size / 1024).toFixed(1)} KB · {rawRows.length} filas detectadas</p>
              </div>
            </div>
            
            <div className="flex flex-col items-end">
              <label className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Cuenta Destino</label>
              <select className="input-field text-sm w-48 bg-[#1A1A24] text-white" value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id} className="bg-[#1A1A24]">{a.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="glass-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
              Verificá el mapeo de columnas
            </p>
            
            <div className="flex items-center gap-3 px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
              <div className="w-40">Columnas en tu archivo</div>
              <div className="w-[14px]"></div>
              <div className="flex-1">Mapeos disponibles en Fluxy</div>
            </div>

            <div className="space-y-3">
              {rawHeaders.map((col) => (
                <div key={col} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                  <span className="text-sm w-40 truncate font-mono" title={col} style={{ color: "rgba(255,255,255,0.75)" }}>{col}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  <select
                    className="input-field text-sm flex-1 bg-[#1A1A24] text-white"
                    value={mapeo[col] || "ignorar"}
                    onChange={e => setMapeo({ ...mapeo, [col]: e.target.value })}
                  >
                    {COLUMNS_SISTEMA.map(c => <option key={c.value} value={c.value} className="bg-[#1A1A24]">{c.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setPaso(0)} className="btn-secondary flex-1 py-3" disabled={loading}>← Atrás</button>
            <button onClick={handlePreview} className="btn-primary flex-1 py-3" disabled={loading}>
              {loading ? "Analizando..." : "Revisar duplicados y ver Preview →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {paso === 2 && (
        <div className="space-y-4 animate-slide-up">
          <div className={`alert-card flex justify-between items-center ${processedRows.some(r => r.isDuplicate) ? 'warning' : 'success'}`}>
            <div className="flex gap-3 items-center">
              <span>{processedRows.some(r => r.isDuplicate) ? '⚠️' : '✅'}</span>
              <div>
                <p className="text-sm font-semibold">
                  {processedRows.length} filas analizadas
                </p>
                <p className="text-xs opacity-80">
                  {processedRows.filter(r => r.isDuplicate).length} duplicados detectados. {processedRows.filter(r => r.selected).length} filas listas para importar.
                </p>
              </div>
            </div>
            {processedRows.some(r => r.isDuplicate) && (
              <button 
                onClick={() => setHideDuplicates(!hideDuplicates)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-black/20 hover:bg-black/40 transition-colors"
              >
                {hideDuplicates ? "Mostrar todos" : "Ocultar duplicados"}
              </button>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative custom-scrollbar">
              <table className="data-table text-left">
                <thead className="sticky top-0 bg-[#1A1A24] z-10 shadow-md">
                  <tr>
                    <th className="w-10 text-center">Imp.</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {processedRows.filter(r => hideDuplicates ? !r.isDuplicate : true).map((r, i) => {
                    // Find actual index in processedRows to update state correctly
                    const actualIndex = processedRows.indexOf(r);
                    return (
                    <tr key={actualIndex} className={`group transition-colors hover:bg-white/5 ${!r.selected ? 'opacity-40 grayscale' : ''}`}>
                      <td className="text-center align-top pt-3">
                        <input 
                          type="checkbox" 
                          checked={r.selected} 
                          onChange={() => toggleRow(actualIndex)}
                          className="w-4 h-4 rounded accent-[#6C63FF] cursor-pointer"
                        />
                      </td>
                      <td className="align-top pt-3">
                        {r.isDuplicate ? (
                          <span className="badge badge-muted text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20">Duplicado</span>
                        ) : (
                          <span className="badge badge-muted text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">Nuevo</span>
                        )}
                      </td>
                      <td className="text-xs font-mono align-top pt-3">{r.fecha}</td>
                      <td className="align-top pt-3">
                        <div className="text-sm truncate max-w-[200px]" title={r.descripcion}>{r.descripcion}</div>
                        
                        {!r.isCuota && r.selected && (
                          <button 
                            onClick={() => {
                              const newRows = [...processedRows];
                              newRows[actualIndex].isCuota = true;
                              newRows[actualIndex].cuotasTotales = 1;
                              newRows[actualIndex].montoTotal = newRows[actualIndex].monto;
                              setProcessedRows(newRows);
                            }}
                            className="mt-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100"
                          >
                            + Convertir en Cuota
                          </button>
                        )}

                        {r.isCuota && r.selected && (
                          <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-semibold text-blue-400">💳 Detalle de Cuotas</span>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => {
                                    const newRows = [...processedRows];
                                    const currentMonto = newRows[actualIndex].monto;
                                    const cuotas = newRows[actualIndex].cuotasTotales || 1;
                                    // Make the current Monto the Total, and divide it to get the Monto Cuota
                                    newRows[actualIndex].montoTotal = currentMonto;
                                    newRows[actualIndex].monto = currentMonto / cuotas;
                                    setProcessedRows(newRows);
                                  }}
                                  className="text-[10px] font-semibold text-blue-200 bg-blue-500/20 px-2 py-0.5 rounded hover:bg-blue-500/40 transition-colors"
                                  title="Si el número grande es el Total de la compra, tocá acá para dividirlo en cuotas automáticamente"
                                >
                                  ÷ El Excel trajo el Total
                                </button>
                                <button 
                                  onClick={() => {
                                    const newRows = [...processedRows];
                                    newRows[actualIndex].isCuota = false;
                                    setProcessedRows(newRows);
                                  }}
                                  className="text-[10px] text-white/40 hover:text-red-400"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                            <div className="flex gap-2 text-[10px]">
                              <label className="flex flex-col flex-1">
                                <span className="text-blue-300 opacity-80 mb-0.5">Cuota de:</span>
                                <input type="number" className="bg-black/30 rounded px-1.5 py-1 text-white border border-white/10" 
                                  value={r.cuotasTotales} onChange={e => {
                                    const newRows = [...processedRows];
                                    newRows[actualIndex].cuotasTotales = parseInt(e.target.value);
                                    if(newRows[actualIndex].montoTotal && !newRows[actualIndex].monto) {
                                      newRows[actualIndex].monto = newRows[actualIndex].montoTotal! / parseInt(e.target.value);
                                    } else if (newRows[actualIndex].monto) {
                                      newRows[actualIndex].montoTotal = newRows[actualIndex].monto * parseInt(e.target.value);
                                    }
                                    setProcessedRows(newRows);
                                  }} />
                              </label>
                              <label className="flex flex-col flex-1">
                                <span className="text-blue-300 opacity-80 mb-0.5">Monto Cuota:</span>
                                <input type="number" className="bg-black/30 rounded px-1.5 py-1 text-white border border-white/10" 
                                  value={r.monto} onChange={e => {
                                    const newRows = [...processedRows];
                                    newRows[actualIndex].monto = parseFloat(e.target.value);
                                    if(newRows[actualIndex].cuotasTotales) {
                                      newRows[actualIndex].montoTotal = parseFloat(e.target.value) * newRows[actualIndex].cuotasTotales!;
                                    }
                                    setProcessedRows(newRows);
                                  }} />
                              </label>
                              <label className="flex flex-col flex-1">
                                <span className="text-blue-300 opacity-80 mb-0.5">Monto Total:</span>
                                <input type="number" className="bg-black/30 rounded px-1.5 py-1 text-white border border-white/10" 
                                  value={r.montoTotal || ""} onChange={e => {
                                    const newRows = [...processedRows];
                                    newRows[actualIndex].montoTotal = parseFloat(e.target.value);
                                    if(newRows[actualIndex].cuotasTotales) {
                                      newRows[actualIndex].monto = parseFloat(e.target.value) / newRows[actualIndex].cuotasTotales!;
                                    }
                                    setProcessedRows(newRows);
                                  }} />
                              </label>
                            </div>
                            <label className="flex items-center gap-1.5 text-[10px] cursor-pointer text-blue-300">
                              <input type="checkbox" checked={r.crearRecurrente} onChange={e => {
                                const newRows = [...processedRows];
                                newRows[actualIndex].crearRecurrente = e.target.checked;
                                setProcessedRows(newRows);
                              }} />
                              Crear en "Periódicos" automáticamente
                            </label>
                          </div>
                        )}
                      </td>
                      <td className="align-top pt-3">
                        <select 
                          className="bg-[#1A1A24] text-white text-xs border border-white/20 rounded p-1 w-full"
                          value={r.categoria_id || ""}
                          onChange={(e) => {
                            if (e.target.value === "NEW") {
                              setCreatingCategoryRow(actualIndex);
                            } else {
                              const newRows = [...processedRows];
                              newRows[actualIndex].categoria_id = e.target.value;
                              setProcessedRows(newRows);
                            }
                          }}
                        >
                          <option value="" className="bg-[#1A1A24] italic">Sin categoría</option>
                          <option value="NEW" className="bg-[#1A1A24] font-bold text-[#10B981]">+ Crear nueva...</option>
                          {localCategories.map((c: any) => <option key={c.id} value={c.id} className="bg-[#1A1A24]">{c.nombre}</option>)}
                        </select>
                      </td>
                      <td className="text-right font-mono text-sm align-top pt-3">
                        <span className={r.tipo === "ingreso" ? "text-emerald-400" : "text-rose-400"}>
                          {r.tipo === "ingreso" ? "+" : "-"}${r.monto.toLocaleString("es-AR")}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setPaso(1)} className="btn-secondary flex-1 py-3" disabled={loading}>← Atrás</button>
            <button onClick={handleImport} className="btn-primary flex-1 py-3" disabled={loading}>
              {loading ? "Subiendo archivo e importando..." : `✅ Confirmar importación (${processedRows.filter(r => r.selected).length})`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {paso === 3 && (
        <div className="text-center py-16 animate-slide-up">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(16,185,129,0.15)", border: "2px solid #10B981" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-2xl font-bold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>¡Importación exitosa!</p>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>Los movimientos han sido registrados y el archivo guardado como resguardo.</p>
          
          <div className="flex gap-4 justify-center">
            <button onClick={() => { setPaso(0); setArchivo(null); setProcessedRows([]); setRawRows([]); }} className="btn-secondary">
              Importar otro
            </button>
            <a href="/app/movimientos" className="btn-primary" style={{ padding: "10px 20px" }}>
              Ver Movimientos
            </a>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {creatingCategoryRow !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm p-6 animate-slide-up">
            <h2 className="text-xl font-bold mb-4" style={{ color: "rgba(255,255,255,0.9)" }}>Nueva Categoría</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Nombre</label>
                <input className="input-field" type="text" required autoFocus placeholder="Ej: Suscripciones"
                  value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Ícono</label>
                <div className="grid grid-cols-6 gap-2">
                  {EMOJIS.map(em => (
                    <button key={em} type="button" onClick={() => setNewCatIcon(em)}
                      className={`text-xl p-2 rounded-lg flex items-center justify-center transition-colors ${newCatIcon === em ? 'bg-[#6C63FF]/30 border border-[#6C63FF]' : 'bg-black/20 hover:bg-black/40 border border-transparent'}`}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-emerald-400">
                Se creará como categoría de tipo <b>{processedRows[creatingCategoryRow]?.tipo}</b>.
              </p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCreatingCategoryRow(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={newCatLoading}>
                  {newCatLoading ? "Guardando..." : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
