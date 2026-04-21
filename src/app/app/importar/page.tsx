"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

const PASOS = ["Subir archivo", "Mapear columnas", "Preview", "Importar"];

const COLUMNS_SISTEMA = [
  { value: "fecha", label: "Fecha" },
  { value: "tipo", label: "Tipo de movimiento" },
  { value: "descripcion", label: "Descripción" },
  { value: "monto", label: "Monto" },
  { value: "moneda", label: "Moneda" },
  { value: "categoria", label: "Categoría" },
  { value: "cuenta", label: "Cuenta" },
  { value: "ignorar", label: "— Ignorar columna —" },
];

const PREVIEW_ROWS = [
  { fecha: "2026-04-01", descripcion: "Alquiler", monto: "380000", moneda: "ARS", categoria: "Vivienda" },
  { fecha: "2026-04-02", descripcion: "Super", monto: "95000", moneda: "ARS", categoria: "Alimentación" },
  { fecha: "2026-04-03", descripcion: "Sueldo", monto: "1800000", moneda: "ARS", categoria: "Ingresos" },
];

export default function ImportarPage() {
  const [paso, setPaso] = useState(0);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, string>>({
    fecha: "fecha",
    descripcion: "descripcion",
    monto: "monto",
    moneda: "moneda",
    categoria: "categoria",
  });

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) {
      setArchivo(files[0]);
      setPaso(1);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
  });

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Importar datos</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Importá movimientos desde Excel o CSV</p>
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
        <div>
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

          <div className="mt-6 glass-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              Columnas soportadas en tu archivo
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {["Fecha", "Descripción", "Monto", "Moneda", "Categoría", "Cuenta", "Tipo"].map(c => (
                <span key={c} className="badge badge-muted text-xs">{c}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Column mapping */}
      {paso === 1 && archivo && (
        <div className="space-y-4">
          <div className="glass-card p-4 flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <p className="font-medium text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{archivo.name}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{(archivo.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>

          <div className="glass-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
              Mapeá las columnas de tu archivo
            </p>
            <div className="space-y-3">
              {Object.entries(mapeo).map(([col, val]) => (
                <div key={col} className="flex items-center gap-3">
                  <span className="text-sm w-32" style={{ color: "rgba(255,255,255,0.65)" }}>{col}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  <select
                    className="input-field text-sm flex-1"
                    value={val}
                    onChange={e => setMapeo({ ...mapeo, [col]: e.target.value })}
                  >
                    {COLUMNS_SISTEMA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setPaso(0)} className="btn-secondary flex-1 py-3">← Atrás</button>
            <button onClick={() => setPaso(2)} className="btn-primary flex-1 py-3">Ver preview →</button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {paso === 2 && (
        <div className="space-y-4">
          <div className="alert-card success">
            <span>✅</span>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>3 filas detectadas · 0 errores</p>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Descripción</th><th>Monto</th><th>Moneda</th><th>Categoría</th></tr></thead>
                <tbody>
                  {PREVIEW_ROWS.map((r, i) => (
                    <tr key={i}>
                      <td className="text-sm">{r.fecha}</td>
                      <td className="text-sm">{r.descripcion}</td>
                      <td className="text-sm font-mono">{parseFloat(r.monto).toLocaleString("es-AR")}</td>
                      <td><span className="badge badge-muted text-xs">{r.moneda}</span></td>
                      <td><span className="badge badge-primary text-xs">{r.categoria}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setPaso(1)} className="btn-secondary flex-1 py-3">← Atrás</button>
            <button onClick={() => setPaso(3)} className="btn-primary flex-1 py-3">✅ Confirmar importación</button>
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
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>3 movimientos importados correctamente</p>
          <button onClick={() => setPaso(0)} className="btn-secondary">Importar otro archivo</button>
        </div>
      )}
    </div>
  );
}
