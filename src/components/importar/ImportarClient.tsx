"use client";

import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { toast } from "sonner";
import { getMovementsForDeduplication, createMovementsBulk, uploadImportFile, createCategory, createRecurrente, aprenderCategoria, olvidarReglaCategorizacion } from "@/lib/actions";
import { inferirCategoria, mismoNombre, sinAcentos, clavePatron, CATEGORIA_FALLBACK } from "@/lib/categorizacion";

const PASOS = ["Subir archivo", "Mapear columnas", "Preview", "Importar"];

const EMOJIS = ["🛒","🚗","🏠","🍔","💊","🎬","✈️","📱","💻","👕","🎓","⚕️","🐾","💡","💧","🔥","💳","💰","🎁","🚌","☕","🍺","💪","🎮"];

const COLUMNS_SISTEMA = [
  { value: "fecha",             label: "📅 Fecha" },
  { value: "descripcion",       label: "📝 Descripción / Establecimiento" },
  { value: "monto",             label: "💲 Monto cuota / mensual" },
  { value: "monto_total",       label: "💲 Monto total de la compra" },
  { value: "monto_restante",    label: "💲 Monto restante a pagar" },
  { value: "cuotas",            label: "🔢 Info de cuotas combinada (ej. 2/6)" },
  { value: "cuotas_totales",    label: "🔢 Plan / Total de cuotas" },
  { value: "cuotas_pendientes", label: "🔢 Cuotas pendientes / restantes" },
  { value: "moneda",            label: "🌐 Moneda" },
  { value: "referencia",        label: "🔖 Referencia / Comprobante" },
  { value: "ignorar",           label: "— Ignorar columna —" },
];

/**
 * Interpreta un importe de resumen bancario.
 *
 * El signo puede venir adelante, entre paréntesis, o detrás: los resúmenes
 * argentinos usan el sufijo ("7.863,79-") para devoluciones.
 */
function parseMonto(val: any): number {
  if (val == null || String(val).trim() === "" || String(val).trim() === "-") return NaN;
  let str = String(val).trim();
  const isNeg = str.startsWith("-") || str.startsWith("(") || str.endsWith("-");
  str = str.replace(/-\s*$/, "").replace(/[()$€\s]/g, "");
  // Distingue el separador de miles del decimal: 10.118,69 vs 10,118.69
  const lastDot = str.lastIndexOf(".");
  const lastComma = str.lastIndexOf(",");
  str = lastComma > lastDot
    ? str.replace(/\./g, "").replace(",", ".")
    : str.replace(/,/g, "");
  const n = parseFloat(str);
  return isNeg ? -Math.abs(n) : n;
}

/** Normaliza cualquier fecha a YYYY-MM-DD. */
function parseDate(val: any): string {
  if (!val) return "";
  const str = String(val).trim();
  // Número de serie de Excel
  if (/^\d{5}$/.test(str)) {
    const d = new Date(Math.round((parseInt(str) - 25569) * 86400 * 1000));
    return d.toISOString().split("T")[0];
  }
  const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); // DD/MM/YYYY
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  const m2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/); // YYYY-MM-DD
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  const m3 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/); // DD/MM/YY
  if (m3) {
    const yy = parseInt(m3[3]) > 50 ? `19${m3[3]}` : `20${m3[3]}`;
    return `${yy}-${m3[2].padStart(2, "0")}-${m3[1].padStart(2, "0")}`;
  }
  return str;
}

/** Columnas de la vista previa del mapeo, en el orden en que se muestran. */
const PREVIEW_COLUMNS = [
  { campo: "fecha",       label: "Fecha",       requerida: true,  mono: true  },
  { campo: "descripcion", label: "Descripción", requerida: true,  mono: false },
  { campo: "monto",       label: "Monto",       requerida: true,  mono: true  },
  { campo: "moneda",      label: "Moneda",      requerida: false, mono: false },
  { campo: "cuotas",      label: "Cuotas",      requerida: false, mono: true  },
  { campo: "referencia",  label: "Referencia",  requerida: false, mono: true  },
] as const;

interface ImportarClientProps {
  accounts: any[];
  categories: any[];
  /** Correcciones que el usuario ya hizo antes; ver aprenderCategoria. */
  reglas?: any[];
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
  isPastInstallment?: boolean;
  comentario?: string;
  originalData?: any;
}

export default function ImportarClient({ accounts, categories, reglas = [] }: ImportarClientProps) {
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
  const [monedaDefault, setMonedaDefault] = useState("ARS");
  const [tipoDefault, setTipoDefault] = useState<"gasto" | "ingreso" | "auto">("auto");

  // Tipo de resumen y fecha cierre (tarjeta)
  const [tipoResumen, setTipoResumen] = useState<"cuenta" | "tarjeta" | null>(null);
  const [fechaCierre, setFechaCierre] = useState("");

  // Correcciones que el usuario ya hizo antes, indexadas por patrón. Empieza
  // con lo que trajo el servidor y se va llenando con lo que corrija acá.
  const [reglasAprendidas, setReglasAprendidas] = useState<Map<string, string>>(
    () => new Map<string, string>((reglas || []).map((r: any) => [r.patron, r.categoria_id]))
  );
  const [reglasGuardadas, setReglasGuardadas] = useState<any[]>(reglas || []);
  const [mostrarReglas, setMostrarReglas] = useState(false);

  async function olvidarRegla(regla: any) {
    setReglasGuardadas(prev => prev.filter(r => r.id !== regla.id));
    setReglasAprendidas(prev => {
      const next = new Map(prev);
      next.delete(regla.patron);
      return next;
    });
    try {
      await olvidarReglaCategorizacion(regla.id);
    } catch {
      toast.error("No se pudo olvidar la regla");
      setReglasGuardadas(prev => [...prev, regla]);
      setReglasAprendidas(prev => new Map(prev).set(regla.patron, regla.categoria_id));
    }
  }

  // Campos obligatorios que todavía no están asignados a ninguna columna.
  const mapeoFaltante = useMemo(() => {
    const asignados = new Set(Object.values(mapeo));
    const falta: string[] = [];
    if (!asignados.has("fecha")) falta.push("Fecha");
    if (!asignados.has("descripcion")) falta.push("Descripción");
    if (!asignados.has("monto") && !asignados.has("monto_total") && !asignados.has("monto_restante")) {
      falta.push("Monto");
    }
    return falta;
  }, [mapeo]);

  /**
   * Primeras filas leídas con el mapeo elegido, para poder verlo antes de
   * avanzar. Usa los mismos parsers que la importación real, así que si acá
   * una fecha sale mal o un monto se corta, va a salir igual de mal después.
   */
  const previewMapeo = useMemo(() => {
    const col = (destino: string) => Object.keys(mapeo).find(k => mapeo[k] === destino);
    const cFecha = col("fecha");
    const cDesc = col("descripcion");
    const cMonto = col("monto") ?? col("monto_total") ?? col("monto_restante");
    const cMoneda = col("moneda");
    const cCuotas = col("cuotas");
    const cCuotasTot = col("cuotas_totales");
    const cRef = col("referencia");

    const fmt = (n: number) =>
      isNaN(n) ? "" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return rawRows.slice(0, 5).map(r => {
      const cuotasRaw = cCuotas ? String(r[cCuotas] ?? "").trim() : "";
      const totalesRaw = cCuotasTot ? String(r[cCuotasTot] ?? "").trim() : "";
      return {
        fecha: cFecha ? parseDate(r[cFecha]) : "",
        descripcion: cDesc ? String(r[cDesc] ?? "").trim() : "",
        monto: cMonto ? fmt(parseMonto(r[cMonto])) : "",
        moneda: cMoneda ? String(r[cMoneda] ?? "").trim().toUpperCase() : monedaDefault,
        cuotas: cuotasRaw || (totalesRaw ? `de ${totalesRaw}` : ""),
        referencia: cRef ? String(r[cRef] ?? "").trim() : "",
      } as Record<string, string>;
    });
  }, [rawRows, mapeo, monedaDefault]);

  /**
   * Guarda una corrección hecha a mano en el preview. Es best-effort: si el
   * guardado falla, la fila ya quedó con la categoría correcta igual, así que
   * no tiene sentido interrumpir la importación por esto.
   */
  function recordarCorreccion(descripcion: string, categoriaId: string) {
    const patron = clavePatron(descripcion || "");
    if (!patron || !categoriaId) return;

    setReglasAprendidas(prev => new Map(prev).set(patron, categoriaId));
    aprenderCategoria(patron, categoriaId).catch(() => {});
  }

  /**
   * Resuelve la categoría de un consumo contra las categorías del usuario.
   *
   * Primero manda lo que el usuario ya corrigió alguna vez: si dijo que
   * "SAGOSA" es Hogar, ninguna heurística tiene derecho a contradecirlo.
   * Recién después entra el diccionario de @/lib/categorizacion.
   *
   * Cuando no se pudo inferir nada devuelve id null a propósito, en vez de
   * empujarlo a "Otros": un movimiento sin categoría aparece después en
   * /app/pulir, mientras que uno con categoría "Otros" queda escondido ahí
   * para siempre. No saber y decir "Otros" no es lo mismo.
   */
  function guessCategory(desc: string) {
    const aprendida = reglasAprendidas.get(clavePatron(desc));
    if (aprendida) {
      const cat = localCategories.find((c: any) => c.id === aprendida);
      // Si la categoría fue borrada después de aprender la regla, se ignora.
      if (cat) return { id: cat.id as string, nombre: cat.nombre as string };
    }

    const catName = inferirCategoria(desc);
    if (catName === CATEGORIA_FALLBACK) {
      return { id: null as string | null, nombre: "" };
    }

    const cat =
      localCategories.find((c: any) => mismoNombre(c.nombre, catName)) ??
      localCategories.find((c: any) => sinAcentos(c.nombre).includes(sinAcentos(catName)));

    // Si la categoría inferida todavía no existe en la cuenta, el nombre viaja
    // igual para que la fila ofrezca crearla de un click.
    return { id: (cat?.id as string | undefined) ?? null, nombre: cat?.nombre ?? catName };
  }

  // Auto map columns heuristically
  function autoMapColumns(headers: string[], firstRow: any) {
    const newMapeo: Record<string, string> = {};
    headers.forEach(h => {
      const lowerH = h.toLowerCase().trim();
      const val    = String(firstRow?.[h] || "").toLowerCase().trim();

      // ── Fecha ──────────────────────────────────────────────────────────
      if (lowerH.includes("fecha") || lowerH === "date" ||
          val.match(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/) ||
          val.match(/^\d{4}-\d{2}-\d{2}$/)) {
        newMapeo[h] = "fecha";

      // ── Descripción / establecimiento ──────────────────────────────────
      } else if (
        lowerH.includes("establec") || lowerH.includes("comercio") ||
        lowerH.includes("desc") || lowerH.includes("concepto") ||
        lowerH.includes("detalle") || lowerH.includes("movimiento") ||
        lowerH.includes("nombre") || lowerH.includes("local") ||
        lowerH === "beneficiario"
      ) {
        newMapeo[h] = "descripcion";

      // ── Cuotas pendientes / restantes ──────────────────────────────────
      } else if (
        (lowerH.includes("pendiente") || lowerH.includes("restante")) &&
        (lowerH.includes("cuota") || lowerH.includes("plan") || !isNaN(parseFloat(val)))
        && !lowerH.includes("importe") && !lowerH.includes("monto") && !lowerH.includes("saldo")
      ) {
        newMapeo[h] = "cuotas_pendientes";

      // ── Plan / total de cuotas ─────────────────────────────────────────
      } else if (
        lowerH === "cuotas" ||
        lowerH.includes("plan") ||
        (lowerH.includes("cuota") && !lowerH.includes("pendiente") && !lowerH.includes("restante") && !lowerH.includes("monto") && !lowerH.includes("importe"))
      ) {
        // If value looks like "2/6" or "02/06" → combined cuotas field
        if (val.match(/^\d{1,2}\/\d{1,2}$/)) {
          newMapeo[h] = "cuotas";
        } else {
          newMapeo[h] = "cuotas_totales";
        }

      // ── Moneda ─────────────────────────────────────────────────────────
      } else if (lowerH === "moneda" || lowerH === "currency" || lowerH === "divisa") {
        newMapeo[h] = "moneda";

      // ── Referencia / comprobante ───────────────────────────────────────
      } else if (
        lowerH.includes("comprobante") || lowerH.includes("voucher") ||
        lowerH.includes("referencia") || lowerH === "nro" || lowerH === "número" ||
        lowerH.includes("operacion") || lowerH.includes("transaccion")
      ) {
        newMapeo[h] = "referencia";

      // ── Montos ────────────────────────────────────────────────────────
      } else if (
        lowerH.includes("monto") || lowerH.includes("importe") ||
        lowerH.includes("amount") || lowerH.includes("valor") ||
        lowerH.includes("total") ||
        (!isNaN(parseFloat(val)) && parseFloat(val) > 0 && !lowerH.includes("saldo") && !lowerH.includes("id"))
      ) {
        if (lowerH.includes("restante") || lowerH.includes("pendiente") || lowerH.includes("saldo")) {
          newMapeo[h] = "monto_restante";
        } else if (lowerH.includes("total") || lowerH.includes("original")) {
          newMapeo[h] = "monto_total";
        } else if (!Object.values(newMapeo).includes("monto")) {
          newMapeo[h] = "monto";
        } else {
          newMapeo[h] = "ignorar";
        }

      } else {
        newMapeo[h] = "ignorar";
      }
    });

    // Fallback: si no se detectó fecha/desc/monto, asignar por posición
    if (!Object.values(newMapeo).includes("fecha") && headers[0])
      newMapeo[headers[0]] = "fecha";
    if (!Object.values(newMapeo).includes("descripcion") && headers[1])
      newMapeo[headers[1]] = "descripcion";
    if (!Object.values(newMapeo).includes("monto") &&
        !Object.values(newMapeo).includes("monto_restante") &&
        !Object.values(newMapeo).includes("monto_total") && headers[2])
      newMapeo[headers[2]] = "monto";

    setMapeo(newMapeo);
  }

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (tipoResumen === "tarjeta" && !fechaCierre) {
      toast.error("Ingresá la fecha de cierre del resumen antes de subir el archivo.");
      return;
    }
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
        // xlsx is ~130 kB — load it only when an .xlsx is actually dropped,
        // so opening the page (or importing a CSV) doesn't pay for it.
        import("xlsx").then(XLSX => {
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
        }).catch(err => {
          console.error("No se pudo cargar el lector de Excel:", err);
          toast.error("No se pudo leer el archivo Excel");
        });
      } else {
        toast.error("Formato no soportado. Usá .csv o .xlsx");
      }
    };

    if (file.name.endsWith('.csv')) reader.readAsText(file);
    else reader.readAsBinaryString(file);
    // Must depend on the guard's inputs: with an empty array this closure kept
    // the mount-time values (tipoResumen === null), so the check never fired.
  }, [tipoResumen, fechaCierre]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
  });

  // Convert raw rows to standardized ProcessedRows
  const buildProcessedRows = () => {
    const colFecha           = Object.keys(mapeo).find(k => mapeo[k] === "fecha");
    const colDesc            = Object.keys(mapeo).find(k => mapeo[k] === "descripcion");
    const colMonto           = Object.keys(mapeo).find(k => mapeo[k] === "monto");
    const colMontoTotal      = Object.keys(mapeo).find(k => mapeo[k] === "monto_total");
    const colMontoRestante   = Object.keys(mapeo).find(k => mapeo[k] === "monto_restante");
    const colCuotas          = Object.keys(mapeo).find(k => mapeo[k] === "cuotas");
    const colCuotasTotales   = Object.keys(mapeo).find(k => mapeo[k] === "cuotas_totales");
    const colCuotasPend      = Object.keys(mapeo).find(k => mapeo[k] === "cuotas_pendientes");
    const colMoneda          = Object.keys(mapeo).find(k => mapeo[k] === "moneda");

    if (!colFecha || !colDesc || (!colMonto && !colMontoTotal && !colMontoRestante)) {
      toast.error("Necesitás mapear Fecha, Descripción y al menos un Monto.");
      return null;
    }

    // Robust number parser: handles "10.118,69" (ES) and "10,118.69" (EN) and negatives
    const rows: ProcessedRow[] = [];

    for (const r of rawRows) {
      const valFecha = r[colFecha];
      if (!valFecha) continue;

      const parsedDate = parseDate(valFecha);
      if (!parsedDate) continue;

      const desc = String(r[colDesc] || "").trim();
      if (!desc) continue;

      // ── Cuotas info ───────────────────────────────────────────────────
      let isCuota    = false;
      let cActual    = 1;
      let cTotales   = 1;
      let cPendientes: number | null = null;

      // Case A: separate columns for total & pending
      if (colCuotasTotales || colCuotasPend) {
        const rawTotal = colCuotasTotales ? parseMonto(r[colCuotasTotales]) : NaN;
        const rawPend  = colCuotasPend    ? parseMonto(r[colCuotasPend])    : NaN;
        if (!isNaN(rawTotal) && rawTotal > 1) {
          isCuota    = true;
          cTotales   = Math.round(rawTotal);
          cPendientes = !isNaN(rawPend) ? Math.round(rawPend) : null;
          cActual    = cPendientes != null ? cTotales - cPendientes + 1 : 1;
        } else if (!isNaN(rawPend) && rawPend > 0) {
          isCuota    = true;
          cPendientes = Math.round(rawPend);
          cTotales   = cPendientes;
          cActual    = 1;
        }
      }

      // Case B: combined cuota column (e.g. "2/6", "02 de 06")
      if (!isCuota && colCuotas) {
        const cuotaStr = String(r[colCuotas] || "").trim();
        const match = cuotaStr.match(/(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})/i);
        if (match) {
          isCuota  = true;
          cActual  = parseInt(match[1]);
          cTotales = parseInt(match[2]);
          cPendientes = cTotales - cActual + 1;
        }
      }

      // Case C: cuota info embedded in description
      // Disabled for bank statements (tipoResumen === "cuenta") because bank
      // descriptions commonly contain dates like "24/04/2026" that produce false positives.
      if (!isCuota && tipoResumen !== "cuenta") {
        const match = desc.match(/(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})/i);
        if (match) {
          const ca = parseInt(match[1]);
          const ct = parseInt(match[2]);
          // Reject date-like false positives (e.g. 24/04) and unrealistic plans
          if (ca >= 1 && ct >= 2 && ct <= 60 && ca <= ct) {
            isCuota  = true;
            cActual  = ca;
            cTotales = ct;
            cPendientes = cTotales - cActual + 1;
          }
        }
      }

      // ── Montos ────────────────────────────────────────────────────────
      const rawMonto        = colMonto        ? r[colMonto]        : null;
      const rawMontoTotal   = colMontoTotal   ? r[colMontoTotal]   : null;
      const rawMontoRest    = colMontoRestante? r[colMontoRestante]: null;

      const mNormal   = parseMonto(rawMonto);
      const mTotal    = parseMonto(rawMontoTotal);
      const mRestante = parseMonto(rawMontoRest);

      let finalMontoNum   = NaN;
      let finalMontoTotal: number | undefined = undefined;

      if (isCuota) {
        const pendientes = cPendientes ?? (cTotales - cActual + 1);
        if (!isNaN(mNormal) && !isNaN(mTotal)) {
          finalMontoNum  = Math.abs(mNormal);
          finalMontoTotal = Math.abs(mTotal);
        } else if (!isNaN(mRestante) && pendientes > 0) {
          // "Importe restante" ÷ cuotas pendientes = cuota mensual
          finalMontoNum  = Math.abs(mRestante) / pendientes;
          finalMontoTotal = finalMontoNum * cTotales;
        } else if (!isNaN(mTotal)) {
          finalMontoTotal = Math.abs(mTotal);
          finalMontoNum  = finalMontoTotal / cTotales;
        } else if (!isNaN(mNormal)) {
          finalMontoNum  = Math.abs(mNormal);
          finalMontoTotal = finalMontoNum * cTotales;
        }
      } else {
        finalMontoNum = Math.abs(
          !isNaN(mNormal) ? mNormal : (!isNaN(mTotal) ? mTotal : mRestante)
        );
      }

      finalMontoNum = parseFloat((finalMontoNum || 0).toFixed(2));
      if (finalMontoTotal !== undefined)
        finalMontoTotal = parseFloat(finalMontoTotal.toFixed(2));
      if (isNaN(finalMontoNum) || finalMontoNum <= 0) continue;

      // ── Para tarjeta: recalcular cuota actual usando fecha cierre ────────
      // La fecha de compra es parsedDate; la fecha del movimiento real es el cierre
      let fechaMovimiento = parsedDate;
      if (tipoResumen === "tarjeta" && fechaCierre && isCuota) {
        // Cuántos meses pasaron desde la compra hasta el cierre
        const dCompra = new Date(parsedDate + "T12:00:00");
        const dCierre = new Date(fechaCierre + "T12:00:00");
        const mesesTranscurridos =
          (dCierre.getFullYear() - dCompra.getFullYear()) * 12 +
          (dCierre.getMonth() - dCompra.getMonth());
        // La cuota que aparece en este resumen = meses transcurridos + 1
        const cuotaDelResumen = Math.max(1, mesesTranscurridos + 1);
        if (cuotaDelResumen > cTotales) continue; // ya pagada completamente → skip
        cActual = cuotaDelResumen;
        // Si tenemos cuotas_pendientes del archivo las respetamos, sino las calculamos
        if (cPendientes == null) cPendientes = cTotales - cActual + 1;
        fechaMovimiento = fechaCierre; // el débito ocurre en la fecha de cierre
      }

      // ── Tipo (ingreso / gasto) ────────────────────────────────────────
      // Un importe negativo es una devolución o una nota de crédito. Los
      // resúmenes las traen con el signo pegado al final ("7.863,79-") y más
      // abajo el monto se toma en valor absoluto, así que el signo hay que
      // leerlo acá o se pierde y la devolución se importa como un consumo.
      const hasNeg = [rawMonto, rawMontoTotal, rawMontoRest].some(v => {
        if (v == null) return false;
        const s = String(v).trim();
        return s.startsWith("-") || s.startsWith("(") || s.endsWith("-");
      });

      let tipo: "ingreso" | "gasto";
      if (hasNeg) {
        // El signo del archivo gana incluso sobre el tipo forzado a mano: ese
        // menú resuelve las filas ambiguas, no invierte un signo explícito.
        // En una tarjeta todo suma deuda salvo las devoluciones, que la bajan;
        // en una cuenta bancaria un importe negativo es plata que sale.
        tipo = tipoResumen === "tarjeta" ? "ingreso" : "gasto";
      } else if (tipoDefault !== "auto") {
        tipo = tipoDefault;
      } else if (tipoResumen === "tarjeta") {
        tipo = "gasto";
      } else {
        tipo = "ingreso";
      }

      // ── Moneda ────────────────────────────────────────────────────────
      const moneda = colMoneda && r[colMoneda]
        ? String(r[colMoneda]).trim().toUpperCase()
        : monedaDefault;

      // ── Descripción con info de cuotas ────────────────────────────────
      let finalDesc = desc;
      if (isCuota) {
        const pendStr = cPendientes != null ? ` · ${cPendientes} pend.` : "";
        finalDesc = `💳 ${desc} (${cActual}/${cTotales}${pendStr})`;
      }

      const cat = guessCategory(desc);

      // crearRecurrente solo si quedan cuotas FUTURAS (después de la actual)
      const cuotasFuturas = cPendientes != null ? cPendientes - 1 : cTotales - cActual;
      const debeCrearRecurrente = isCuota && cuotasFuturas > 0;

      // Generate past installments (C1 to C_current-1) in chronological order
      if (isCuota && cActual > 1) {
        for (let pastN = 1; pastN < cActual; pastN++) {
          const pastDate = new Date(fechaMovimiento + "T12:00:00");
          pastDate.setMonth(pastDate.getMonth() - (cActual - pastN));
          rows.push({
            fecha: pastDate.toISOString().split("T")[0],
            descripcion: `💳 ${desc} (${pastN}/${cTotales})`,
            monto: finalMontoNum,
            tipo,
            moneda,
            categoria_id: cat.id,
            categoria_nombre: cat.nombre,
            cuenta_origen_id: cuentaId,
            selected: true,
            isCuota: true,
            cuotaActual: pastN,
            cuotasTotales: cTotales,
            montoTotal: finalMontoTotal,
            crearRecurrente: false,
            isPastInstallment: true,
            originalData: { ...r, _fechaCompra: parsedDate, _cuotasFuturas: 0 },
          });
        }
      }

      rows.push({
        fecha: fechaMovimiento,
        descripcion: finalDesc,
        monto: finalMontoNum,
        tipo,
        moneda,
        categoria_id: cat.id,
        categoria_nombre: cat.nombre,
        cuenta_origen_id: cuentaId,
        selected: true,
        isCuota,
        cuotaActual: cActual,
        cuotasTotales: cTotales,
        montoTotal: finalMontoTotal,
        crearRecurrente: debeCrearRecurrente,
        originalData: { ...r, _fechaCompra: parsedDate, _cuotasFuturas: cuotasFuturas },
      });
    }
    return rows;
  };

  const handlePreview = async () => {
    if (!cuentaId) {
      toast.error("Seleccioná una cuenta para importar");
      return;
    }
    if (tipoResumen === "tarjeta" && !fechaCierre) {
      toast.error("La fecha de cierre es obligatoria para resúmenes de tarjeta");
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
    const toImport = processedRows.filter(r => r.selected).map(r => ({
      ...r,
      descripcion: r.comentario?.trim() ? `${r.descripcion} · ${r.comentario.trim()}` : r.descripcion,
    }));
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

      // 3. Crear recurrentes para cuotas FUTURAS (las que vienen después de este resumen)
      const recurrentesToCreate = toImport.filter(r => r.isCuota && r.crearRecurrente);
      for (const r of recurrentesToCreate) {
        try {
          const cuotasFuturas: number = r.originalData?._cuotasFuturas ?? (r.cuotasTotales! - r.cuotaActual!);
          if (cuotasFuturas <= 0) continue;

          const nombreLimpio = r.descripcion
            .replace(/💳\s*/g, "")
            .replace(/\(\d{1,3}\/\d{1,3}[^)]*\)/g, "")
            .trim();

          // Recurrente covers the FULL plan: starts at C1, ends at C_total
          const cActualNum = r.cuotaActual || 1;
          const c1Date = new Date(r.fecha + "T12:00:00");
          c1Date.setMonth(c1Date.getMonth() - (cActualNum - 1));
          c1Date.setDate(Math.min(c1Date.getDate(), 28));
          const cnDate = new Date(c1Date.getTime());
          cnDate.setMonth(cnDate.getMonth() + (r.cuotasTotales! - 1));

          await createRecurrente({
            nombre: `💳 ${nombreLimpio}`,
            tipo: "gasto",
            monto: r.monto,
            moneda: r.moneda || "ARS",
            categoria_id: r.categoria_id || null,
            cuenta_id: r.cuenta_origen_id,
            dia_del_mes: c1Date.getDate(),
            fecha_inicio: c1Date.toISOString().split("T")[0],
            fecha_fin: cnDate.toISOString().split("T")[0],
            es_cuotas: true,
            cuotas_totales: r.cuotasTotales ?? null,
            tasa_interes: null,
            activo: true,
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

      // Crear una categoría para este comercio es la corrección más explícita
      // que existe, así que también se recuerda.
      recordarCorreccion(row.descripcion, newCat.id);

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
        <h1 className="text-2xl font-bold" style={{ color: "var(--fg-hi)" }}>Importar datos</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--fg-5)" }}>Importá tu resumen bancario o de billeteras en CSV o Excel</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {PASOS.map((p, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i === paso ? "text-white" : i < paso ? "text-white" : ""}`}
                style={{
                  background: i === paso ? "#6C63FF" : i < paso ? "#10B981" : "var(--bg-hover)",
                  color: i > paso ? "var(--fg-5)" : undefined,
                }}>
                {i < paso ? "✓" : i + 1}
              </div>
              <span className="text-sm" style={{ color: i === paso ? "var(--fg-1)" : "var(--fg-5)" }}>{p}</span>
            </div>
            {i < PASOS.length - 1 && <div className="w-8 h-px" style={{ background: "var(--bg-strong)" }} />}
          </div>
        ))}
      </div>

      {/* Step 0: Tipo de resumen + Upload */}
      {paso === 0 && (
        <div className="animate-fade-in space-y-5">

          {/* A: Elegir tipo de resumen */}
          {!tipoResumen ? (
            <div>
              <p className="text-sm font-semibold mb-4" style={{ color: "var(--fg-3)" }}>
                ¿Qué tipo de archivo vas a importar?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    key: "cuenta" as const,
                    icon: "🏦",
                    title: "Resumen de cuenta",
                    desc: "Caja de ahorro, cuenta corriente, billetera virtual. Cada fila es un movimiento real.",
                  },
                  {
                    key: "tarjeta" as const,
                    icon: "💳",
                    title: "Resumen de tarjeta de crédito",
                    desc: "Cada fila puede ser una cuota de una compra en cuotas. Se usa la fecha de cierre para calcular pagos pasados y futuros.",
                  },
                ].map(opt => (
                  <button key={opt.key} onClick={() => {
                    setTipoResumen(opt.key);
                    if (opt.key === "tarjeta") {
                      setTipoDefault("gasto");
                    } else {
                      setTipoDefault("auto");
                    }
                  }}
                    className="glass-card p-5 text-left transition-all hover:border-purple-500/40"
                    style={{ border: "1px solid var(--bd)" }}>
                    <div className="text-3xl mb-3">{opt.icon}</div>
                    <p className="font-semibold text-sm mb-1" style={{ color: "var(--fg-1)" }}>{opt.title}</p>
                    <p className="text-xs" style={{ color: "var(--fg-5)" }}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Indicador tipo seleccionado + cambiar */}
              <div className="flex items-center gap-3">
                <span className="text-lg">{tipoResumen === "tarjeta" ? "💳" : "🏦"}</span>
                <p className="text-sm font-semibold" style={{ color: "var(--fg-2)" }}>
                  {tipoResumen === "tarjeta" ? "Resumen de tarjeta de crédito" : "Resumen de cuenta"}
                </p>
                <button onClick={() => { setTipoResumen(null); setFechaCierre(""); }}
                  className="text-xs px-2 py-0.5 rounded-lg ml-auto" style={{ background: "var(--bg-hover)", color: "var(--fg-5)" }}>
                  Cambiar
                </button>
              </div>

              {/* Fecha cierre (solo tarjeta) */}
              {tipoResumen === "tarjeta" && (
                <div className="glass-card p-4 space-y-3" style={{ border: "1px solid rgba(108,99,255,0.25)" }}>
                  <p className="text-xs font-semibold uppercase" style={{ color: "#A5A0FF" }}>Datos del resumen</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--fg-5)" }}>
                        Fecha de cierre *
                      </label>
                      <input type="date" className="input-field" value={fechaCierre}
                        onChange={e => setFechaCierre(e.target.value)} required />
                      <p className="text-[10px] mt-1" style={{ color: "var(--fg-6)" }}>
                        Es la fecha en que cerró el período del resumen. Se usa para calcular qué cuota es la actual y cuáles ya se pagaron.
                      </p>
                    </div>
                    <div className="rounded-xl p-3 text-xs space-y-1.5" style={{ background: "rgba(108,99,255,0.06)", border: "1px solid rgba(108,99,255,0.15)" }}>
                      <p className="font-semibold" style={{ color: "#A5A0FF" }}>¿Cómo funciona?</p>
                      <p style={{ color: "var(--fg-5)" }}>
                        · La &quot;Fecha&quot; del archivo = fecha de compra<br/>
                        · Se calcula qué cuota corresponde al cierre<br/>
                        · Las compras ya totalmente pagas se omiten<br/>
                        · Se crea un periódico solo para cuotas futuras
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className="glass-card p-10 text-center cursor-pointer transition-all"
                style={{
                  border: isDragActive ? "2px dashed #6C63FF" : "2px dashed var(--bd)",
                  background: isDragActive ? "rgba(108,99,255,0.05)" : undefined,
                }}
              >
                <input {...getInputProps()} />
                <div className="text-4xl mb-3">{isDragActive ? "📂" : "📥"}</div>
                <p className="font-semibold mb-1" style={{ color: "var(--fg-2)" }}>
                  {isDragActive ? "Soltá el archivo aquí" : "Arrastrá tu archivo o hacé click"}
                </p>
                <p className="text-xs mb-3" style={{ color: "var(--fg-6)" }}>
                  {tipoResumen === "tarjeta" && !fechaCierre
                    ? "⚠️ Ingresá la fecha de cierre antes de subir el archivo"
                    : "Formatos aceptados: .xlsx · .csv"}
                </p>
                <span className="badge badge-muted text-xs">.xlsx · .csv</span>
              </div>

              {/* Lo que Fluxy aprendió de correcciones anteriores */}
              {reglasGuardadas.length > 0 && (
                <div className="glass-card p-4">
                  <button
                    type="button"
                    onClick={() => setMostrarReglas(v => !v)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fg-5)" }}>
                      🧠 {reglasGuardadas.length} {reglasGuardadas.length === 1 ? "comercio aprendido" : "comercios aprendidos"}
                    </span>
                    <span className="text-xs" style={{ color: "var(--fg-6)" }}>
                      {mostrarReglas ? "Ocultar" : "Ver"}
                    </span>
                  </button>

                  {mostrarReglas && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] mb-2" style={{ color: "var(--fg-6)" }}>
                        Cada vez que corregís una categoría, Fluxy se la guarda y la aplica sola en la próxima importación.
                      </p>
                      {reglasGuardadas.map((r: any) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs"
                          style={{ background: "var(--bg-faint)" }}
                        >
                          <span className="font-mono truncate" style={{ color: "var(--fg-3)" }}>{r.patron}</span>
                          <span className="flex items-center gap-2 flex-shrink-0">
                            <span style={{ color: "var(--fg-4)" }}>
                              {r.categorias?.icono} {r.categorias?.nombre ?? "—"}
                            </span>
                            <button
                              type="button"
                              onClick={() => olvidarRegla(r)}
                              title="Olvidar esta regla"
                              className="px-1.5 rounded hover:opacity-100 opacity-60"
                              style={{ color: "var(--danger)" }}
                            >
                              ✕
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 1: Column mapping */}
      {paso === 1 && archivo && (
        <div className="space-y-4 animate-slide-up">
          <div className="glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <div>
                <p className="font-medium text-sm" style={{ color: "var(--fg-1)" }}>{archivo.name}</p>
                <p className="text-xs" style={{ color: "var(--fg-5)" }}>{(archivo.size / 1024).toFixed(1)} KB · {rawRows.length} filas detectadas</p>
              </div>
            </div>
            
            <div className="flex flex-col items-end">
              <label className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--fg-6)" }}>Cuenta Destino</label>
              <select className="input-field text-sm w-48 bg-[#1A1A24] text-white" value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id} className="bg-[#1A1A24]">{a.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Global defaults */}
          <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--fg-6)" }}>Moneda por defecto</label>
              <select className="input-field text-sm w-32" value={monedaDefault} onChange={e => setMonedaDefault(e.target.value)}>
                <option value="ARS">$ ARS</option>
                <option value="USD">U$S USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--fg-6)" }}>Tipo de movimiento</label>
              <select className="input-field text-sm w-44" value={tipoDefault} onChange={e => setTipoDefault(e.target.value as any)}>
                <option value="auto">Auto-detectar</option>
                <option value="gasto">Todo como Gasto</option>
                <option value="ingreso">Todo como Ingreso</option>
              </select>
            </div>
            <p className="text-xs flex-1" style={{ color: "var(--fg-6)" }}>
              Dejalo en <b>Auto-detectar</b>: en un resumen de tarjeta toma todo como gasto,
              salvo las devoluciones, que las reconoce por el signo negativo.
            </p>
          </div>

          <div className="glass-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--fg-6)" }}>
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
                  <span className="text-sm w-40 truncate font-mono" title={col} style={{ color: "var(--fg-3)" }}>{col}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--fg-6)" }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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

          {/* Cómo quedan las primeras filas con el mapeo elegido */}
          <div className="glass-card p-5">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fg-6)" }}>
                Así se leen tus datos
              </p>
              <span className="text-[10px]" style={{ color: "var(--fg-7)" }}>
                primeras {Math.min(5, rawRows.length)} de {rawRows.length} filas
              </span>
            </div>
            <p className="text-[11px] mb-3" style={{ color: "var(--fg-6)" }}>
              Si alguna columna se ve vacía o con el dato equivocado, corregí el mapeo de arriba.
            </p>

            {mapeoFaltante.length > 0 && (
              <div className="alert-card warning mb-3">
                <span className="text-xs">
                  Falta mapear: <b>{mapeoFaltante.join(", ")}</b>. Sin eso las filas no se pueden importar.
                </span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "var(--fg-6)" }}>
                    {PREVIEW_COLUMNS.map(c => (
                      <th key={c.campo} className="text-left font-semibold uppercase tracking-wider pb-2 pr-4 whitespace-nowrap text-[10px]">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewMapeo.map((fila, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--bd-faint)" }}>
                      {PREVIEW_COLUMNS.map(c => {
                        const v = fila[c.campo];
                        return (
                          <td
                            key={c.campo}
                            className={`py-2 pr-4 whitespace-nowrap ${c.mono ? "font-mono" : ""}`}
                            style={{ color: v ? "var(--fg-2)" : "var(--fg-7)" }}
                          >
                            {v || (c.requerida ? "— falta —" : "—")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  {processedRows.filter(r => hideDuplicates ? !r.isDuplicate : true).map((r) => {
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
                        {r.isPastInstallment ? (
                          <span className="badge badge-muted text-[10px] text-violet-400 bg-violet-400/10 border border-violet-400/20">Cuota pasada</span>
                        ) : r.isDuplicate ? (
                          <span className="badge badge-muted text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20">Duplicado</span>
                        ) : (
                          <span className="badge badge-muted text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">Nuevo</span>
                        )}
                      </td>
                      <td className="text-xs font-mono align-top pt-3">{r.fecha}</td>
                      <td className="align-top pt-3">
                        <div className="text-sm break-words max-w-[340px]" title={r.descripcion}>{r.descripcion}</div>
                        {r.selected && (
                          <input
                            type="text"
                            placeholder="Agregar nota..."
                            value={r.comentario || ""}
                            onChange={e => {
                              const newRows = [...processedRows];
                              newRows[actualIndex].comentario = e.target.value;
                              setProcessedRows(newRows);
                            }}
                            className="mt-1 text-[10px] bg-transparent border-b border-white/10 focus:border-white/30 outline-none text-white/60 focus:text-white/90 w-full placeholder:italic placeholder:text-white/20 transition-colors"
                          />
                        )}

                        {!r.isCuota && !r.isPastInstallment && r.selected && (
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

                        {r.isCuota && !r.isPastInstallment && r.selected && (
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
                              Crear en &quot;Periódicos&quot; automáticamente
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
                              // Corregir acá también enseña: la próxima vez
                              // que aparezca este comercio ya viene resuelto.
                              recordarCorreccion(newRows[actualIndex].descripcion, e.target.value);
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
                        {r.selected && (
                          <button
                            onClick={() => {
                              const newRows = [...processedRows];
                              newRows[actualIndex].tipo = newRows[actualIndex].tipo === "ingreso" ? "gasto" : "ingreso";
                              setProcessedRows(newRows);
                            }}
                            className="block ml-auto mt-1 text-[9px] px-1.5 py-0.5 rounded border transition-colors"
                            style={{
                              borderColor: r.tipo === "ingreso" ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)",
                              color: r.tipo === "ingreso" ? "rgba(16,185,129,0.7)" : "rgba(244,63,94,0.7)",
                            }}
                            title="Cambiar entre Ingreso y Gasto"
                          >
                            {r.tipo === "ingreso" ? "Ingreso ↕" : "Gasto ↕"}
                          </button>
                        )}
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
          <p className="text-2xl font-bold mb-2" style={{ color: "var(--fg-1)" }}>¡Importación exitosa!</p>
          <p className="text-sm mb-6" style={{ color: "var(--fg-5)" }}>Los movimientos han sido registrados y el archivo guardado como resguardo.</p>
          
          <div className="flex gap-4 justify-center">
            <button onClick={() => { setPaso(0); setArchivo(null); setProcessedRows([]); setRawRows([]); setTipoResumen(null); setFechaCierre(""); }} className="btn-secondary">
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
          <div className="glass-card modal-panel w-full max-w-sm p-6 animate-slide-up">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--fg-1)" }}>Nueva Categoría</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--fg-5)" }}>Nombre</label>
                <input className="input-field" type="text" required autoFocus placeholder="Ej: Suscripciones"
                  value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--fg-5)" }}>Ícono</label>
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
