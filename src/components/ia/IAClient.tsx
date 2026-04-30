"use client";

import { useState, useRef } from "react";
import { createMovement, createPasivo, createRecurrente } from "@/lib/actions";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface IAClientProps {
  accounts:   any[];
  goals:      any[];
  categories: any[];
}

// Rule-based NLP parser — receives real accounts/goals for ID matching
function parseNaturalLanguage(text: string, accounts: any[], goals: any[]) {
  const lower = text.toLowerCase();

  // Amount
  const amountMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:pesos?|ars|\$|usd|dólares?|mil|millones|k|m)?/);
  let monto = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : null;
  if (lower.includes("mil ") && monto) monto *= 1000;
  if (lower.includes("millon") && monto) monto *= 1000000;

  // Currency
  const moneda = lower.includes("dólar") || lower.includes("usd") || lower.includes("u$s") ? "USD" : "ARS";

  // Movement type and Action Type
  let tipoAccion: "movimiento" | "pasivo" | "recurrente" = "movimiento";
  let tipo = "gasto";
  let tipoLabel = "Gasto";
  let sistema_amortizacion = "Frances";
  let tasa_interes = 0;
  let cuotas = 1;

  // Detect Loans / Credit Card Installments
  if (lower.includes("prestamo") || lower.includes("préstamo") || lower.includes("crédito") || lower.includes("credito") && !lower.includes("tarjeta")) {
    tipoAccion = "pasivo";
    tipoLabel = "Préstamo (Pasivo)";
    if (lower.includes("uva")) sistema_amortizacion = "UVA";
    if (lower.includes("alem")) sistema_amortizacion = "Aleman";
    if (lower.includes("americano")) sistema_amortizacion = "Americano";
    const tasaMatch = lower.match(/(\d+(?:[.,]\d+)?)%\s*(?:de\s+)?inter/);
    if (tasaMatch) tasa_interes = parseFloat(tasaMatch[1].replace(",", "."));
    const cuotasMatch = lower.match(/(\d+)\s+cuotas/);
    if (cuotasMatch) cuotas = parseInt(cuotasMatch[1]);
  } else if (lower.includes("cuotas") || lower.includes("tarjeta de crédito") || lower.includes("tarjeta de credito") || lower.includes("suscripción") || lower.includes("netflix") || lower.includes("spotify")) {
    tipoAccion = "recurrente";
    tipoLabel = lower.includes("cuotas") ? "Pago en Cuotas" : "Gasto Recurrente";
    tipo = "gasto"; // Base type
    const cuotasMatch = lower.match(/(\d+)\s+cuotas/);
    if (cuotasMatch) cuotas = parseInt(cuotasMatch[1]);
  } else {
    if (lower.includes("cobr") || lower.includes("ingres") || lower.includes("recibi") || lower.includes("sueldo") || lower.includes("entraron")) {
      tipo = "ingreso"; tipoLabel = "Ingreso";
    } else if (lower.includes("fondo") || lower.includes("objetivo") || lower.includes("sum") || lower.includes("apart") || lower.includes("aport")) {
      tipo = "aporte_objetivo"; tipoLabel = "Aporte a Objetivo";
    } else if (lower.includes("pas") || lower.includes("transfer")) {
      tipo = "transferencia"; tipoLabel = "Transferencia";
    }
  }

  // Date
  let fecha = new Date().toISOString().split("T")[0];
  if (lower.includes("ayer")) {
    const d = new Date(); d.setDate(d.getDate() - 1);
    fecha = d.toISOString().split("T")[0];
  }
  const diaMatch = lower.match(/el\s+(\d{1,2})\s+de\s+(\w+)/);
  if (diaMatch) {
    const meses: Record<string, number> = {
      enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
      julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
    };
    const dia = parseInt(diaMatch[1]);
    const mes = meses[diaMatch[2]];
    if (mes !== undefined) {
      const d = new Date(); d.setMonth(mes); d.setDate(dia);
      fecha = d.toISOString().split("T")[0];
    }
  }

  // Guess category name (matched against real categories by name on save)
  let categoriaNombre = "";
  if (lower.includes("alquiler") || lower.includes("expensa")) categoriaNombre = "Vivienda";
  else if (lower.includes("super") || lower.includes("mercado") || lower.includes("comida")) categoriaNombre = "Alimentación";
  else if (lower.includes("nafta") || lower.includes("combustible") || lower.includes("uber") || lower.includes("taxi") || lower.includes("colectivo")) categoriaNombre = "Transporte";
  else if (lower.includes("médico") || lower.includes("farmacia") || lower.includes("salud")) categoriaNombre = "Salud";
  else if (lower.includes("sueldo") || lower.includes("salario")) categoriaNombre = "Sueldo";
  else if (lower.includes("freelance") || lower.includes("proyecto") || lower.includes("cliente")) categoriaNombre = "Freelance";
  else if (lower.includes("tarjeta") || lower.includes("cuotas")) categoriaNombre = "Deudas";

  // Match goal from real goals list
  let objetivoId = "";
  for (const obj of goals) {
    const palabras = obj.nombre.toLowerCase().split(" ");
    if (palabras.some((p: string) => p.length > 3 && lower.includes(p))) {
      objetivoId = obj.id; break;
    }
  }
  if (lower.includes("emergencia")) objetivoId = goals.find((o: any) => o.nombre.toLowerCase().includes("emergencia"))?.id ?? "";
  if (lower.includes("vacacion"))   objetivoId = goals.find((o: any) => o.nombre.toLowerCase().includes("vacacion"))?.id  ?? "";

  // Clean up description
  let descripcion = text
    .replace(/registr[aáa]\s*/i, "").replace(/anot[aáa]\s*/i, "")
    .replace(/sum[aáa]\s*/i, "").replace(/cobr[eé]\s*/i, "")
    .replace(/gast[eé]\s*/i, "").replace(/pas[eé]\s*/i, "")
    .replace(/hoy/i, "").replace(/ayer/i, "").trim();

  return {
    tipoAccion,
    tipo, tipoLabel, monto, moneda, fecha,
    categoriaNombre,
    objetivoId,
    descripcion,
    cuentaId:   accounts[0]?.id   ?? "",
    cuentaNombre: accounts[0]?.nombre ?? "",
    sistema_amortizacion,
    tasa_interes,
    cuotas,
    confianza: monto ? 85 : 45,
  };
}

const EJEMPLOS = [
  "registrá un gasto de 85000 pesos en alquiler hoy",
  "saqué un préstamo francés de 5000000 en 12 cuotas",
  "compré una heladera por 800000 en 6 cuotas con tarjeta",
  "cobré 1000000 de cliente",
  "pasé 200000 del banco al fondo de emergencia",
];

export default function IAClient({ accounts, goals, categories }: IAClientProps) {
  const [texto,    setTexto]    = useState("");
  const [editado,  setEditado]  = useState<ReturnType<typeof parseNaturalLanguage> & { categoriaId: string } | null>(null);
  const [parsed,   setParsed]   = useState<ReturnType<typeof parseNaturalLanguage> | null>(null);
  const [paso,     setPaso]     = useState<"input" | "preview" | "success">("input");
  const [escuchando, setEscuchando] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const recognitionRef = useRef<unknown>(null);

  // Find real category ID by matching name
  function findCategoriaId(nombre: string): string {
    if (!nombre) return "";
    const match = categories.find(
      (c: any) => c.nombre.toLowerCase() === nombre.toLowerCase()
    );
    return match?.id ?? "";
  }

  function handleParse() {
    if (!texto.trim()) return;
    const result = parseNaturalLanguage(texto, accounts, goals);
    const categoriaId = findCategoriaId(result.categoriaNombre);
    setParsed(result);
    setEditado({ ...result, categoriaId });
    setPaso("preview");
  }

  function handleVoz() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Tu navegador no soporta reconocimiento de voz. Usá Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-AR";
    recognition.onresult = (event: any) => {
      setTexto(event.results[0][0].transcript);
      setEscuchando(false);
    };
    recognition.onerror = () => setEscuchando(false);
    recognition.start();
    setEscuchando(true);
    recognitionRef.current = recognition;
  }

  async function handleConfirm() {
    if (!editado || editado.monto == null) return;
    setLoading(true);
    try {
      if (editado.tipoAccion === "pasivo") {
        await createPasivo({
          nombre: editado.descripcion || "Préstamo",
          tipo: "prestamo",
          monto_original: editado.monto,
          saldo_pendiente: editado.monto,
          moneda: editado.moneda,
          tasa_interes: editado.tasa_interes,
          sistema_amortizacion: editado.sistema_amortizacion as any,
          n_cuotas: editado.cuotas,
          fecha_inicio: editado.fecha,
        });
        toast.success("Préstamo registrado automáticamente");
      } else if (editado.tipoAccion === "recurrente") {
        await createRecurrente({
          nombre: editado.descripcion || "Pago en cuotas",
          monto: editado.monto,
          moneda: editado.moneda,
          tipo: "gasto",
          dia_del_mes: parseInt(editado.fecha.split("-")[2]) || 1,
          fecha_inicio: editado.fecha,
          fecha_fin: null,
          categoria_id: editado.categoriaId || null,
          cuenta_id: editado.cuentaId || null,
          tasa_interes: null,
          es_cuotas: editado.cuotas > 1,
          cuotas_totales: editado.cuotas > 1 ? editado.cuotas : null,
          activo: true,
        });
        toast.success("Pago en cuotas registrado automáticamente");
      } else {
        await createMovement({
          tipo:              editado.tipo as any,
          monto:             editado.monto,
          moneda:            editado.moneda,
          fecha:             editado.fecha,
          descripcion:       editado.descripcion || null,
          categoria_id:      editado.categoriaId || null,
          cuenta_origen_id:  editado.cuentaId || null,
          cuenta_destino_id: null,
          objetivo_id:       editado.objetivoId || null,
          tipo_cambio:       null,
          metodo_carga:      "ia",
        });
        toast.success("Movimiento registrado automáticamente");
      }

      setPaso("success");
      setTimeout(() => {
        setPaso("input"); setTexto(""); setParsed(null); setEditado(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      toast.error("Error al guardar. Revisá los datos e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "rgba(255,255,255,0.95)" }}>
          Asistente IA 🤖
        </h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
          Describí tu movimiento en lenguaje natural y yo lo interpreto
        </p>
      </div>

      {/* ── Paso 1: Input ─────────────────────────────────── */}
      {paso === "input" && (
        <div className="space-y-4 animate-fade-in">
          <div className="glass-card p-4">
            <textarea
              className="input-field resize-none text-base"
              placeholder='"gasté 85000 en alquiler hoy" o "cobré 1000000 del cliente"'
              rows={4}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleParse(); }}
              style={{ fontSize: 16 }}
            />
            <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>⌘+Enter para analizar</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleVoz}
              className="btn-secondary flex-1 py-3 rounded-xl"
              style={{
                background: escuchando ? "rgba(239,68,68,0.15)" : undefined,
                borderColor: escuchando ? "#EF4444" : undefined,
                color: escuchando ? "#EF4444" : undefined,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              {escuchando ? "Escuchando... 🔴" : "🎤 Hablar"}
            </button>
            <button
              onClick={handleParse}
              className="btn-primary flex-1 py-3 rounded-xl"
              disabled={!texto.trim()}
            >
              🔍 Analizar
            </button>
          </div>

          <div className="glass-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              Ejemplos que podés probar
            </p>
            <div className="space-y-2">
              {EJEMPLOS.map((ej, i) => (
                <button
                  key={i}
                  onClick={() => setTexto(ej)}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg transition-colors"
                  style={{ color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.04)" }}
                >
                  <span style={{ color: "#6C63FF" }}>→</span> &ldquo;{ej}&rdquo;
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Paso 2: Preview editable ───────────────────────── */}
      {paso === "preview" && editado && (
        <div className="space-y-4 animate-slide-up">
          {/* Texto original */}
          <div className="glass-card p-5" style={{ borderLeft: "3px solid #6C63FF" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🤖</span>
              <p className="font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>Interpreté esto:</p>
              <span className="badge badge-primary text-xs ml-auto">
                Confianza {parsed?.confianza}%
              </span>
            </div>
            <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.5)" }}>
              &ldquo;{texto}&rdquo;
            </p>
          </div>

          {/* Campos editables */}
          <div className="glass-card p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
              Vista previa — editá antes de confirmar
            </p>

            <div className="grid grid-cols-2 gap-4">
              {editado.tipoAccion === "movimiento" && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Tipo</label>
                  <select
                    className="input-field text-sm"
                    value={editado.tipo}
                    onChange={e => setEditado({ ...editado, tipo: e.target.value, tipoLabel: e.target.options[e.target.selectedIndex].text })}
                  >
                    <option value="ingreso">Ingreso</option>
                    <option value="gasto">Gasto</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="aporte_objetivo">Aporte a Objetivo</option>
                    <option value="retiro_objetivo">Retiro de Objetivo</option>
                  </select>
                </div>
              )}
              {editado.tipoAccion === "pasivo" && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Sistema</label>
                  <select
                    className="input-field text-sm"
                    value={editado.sistema_amortizacion}
                    onChange={e => setEditado({ ...editado, sistema_amortizacion: e.target.value })}
                  >
                    <option value="Frances">Francés</option>
                    <option value="Aleman">Alemán</option>
                    <option value="Americano">Americano</option>
                    <option value="UVA">UVA</option>
                  </select>
                </div>
              )}
              {editado.tipoAccion === "recurrente" && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Tipo</label>
                  <input className="input-field text-sm opacity-50" disabled value="Gasto Recurrente / Cuotas" />
                </div>
              )}
              <div>
                <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Monto</label>
                <div className="flex gap-1">
                  <select
                    className="input-field text-sm"
                    style={{ width: 72 }}
                    value={editado.moneda}
                    onChange={e => setEditado({ ...editado, moneda: e.target.value })}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    type="number"
                    className="input-field font-bold"
                    value={editado.monto ?? ""}
                    onChange={e => setEditado({ ...editado, monto: parseFloat(e.target.value) })}
                    onFocus={e => e.target.select()}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Fecha</label>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={editado.fecha}
                  onChange={e => setEditado({ ...editado, fecha: e.target.value })}
                />
              </div>
              {(editado.tipoAccion === "movimiento" || editado.tipoAccion === "recurrente") && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Categoría</label>
                  <select
                    className="input-field text-sm"
                    value={editado.categoriaId}
                    onChange={e => setEditado({ ...editado, categoriaId: e.target.value })}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {(editado.tipoAccion === "pasivo" || editado.tipoAccion === "recurrente") && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Cuotas</label>
                  <input
                    type="number"
                    className="input-field text-sm"
                    value={editado.cuotas}
                    onChange={e => setEditado({ ...editado, cuotas: parseInt(e.target.value) })}
                  />
                </div>
              )}
              
              {editado.tipoAccion === "pasivo" && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Tasa Anual (%)</label>
                  <input
                    type="number"
                    className="input-field text-sm"
                    value={editado.tasa_interes}
                    onChange={e => setEditado({ ...editado, tasa_interes: parseFloat(e.target.value) })}
                  />
                </div>
              )}
              
              <div className="col-span-2">
                <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Descripción</label>
                <input
                  type="text"
                  className="input-field text-sm"
                  value={editado.descripcion}
                  onChange={e => setEditado({ ...editado, descripcion: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Cuenta</label>
                <select
                  className="input-field text-sm"
                  value={editado.cuentaId}
                  onChange={e => setEditado({ ...editado, cuentaId: e.target.value })}
                >
                  {accounts.length === 0 && <option value="">Sin cuentas</option>}
                  {accounts.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
                  ))}
                </select>
              </div>
              {(editado.tipo === "aporte_objetivo" || editado.objetivoId) && goals.length > 0 && (
                <div>
                  <label className="text-xs block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Objetivo</label>
                  <select
                    className="input-field text-sm"
                    value={editado.objetivoId}
                    onChange={e => setEditado({ ...editado, objetivoId: e.target.value })}
                  >
                    <option value="">Sin objetivo</option>
                    {goals.map((o: any) => (
                      <option key={o.id} value={o.id}>{o.icono} {o.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Resumen del monto */}
          {editado.monto != null && (
            <div
              className="glass-card p-4 text-center"
              style={{ background: "rgba(108,99,255,0.08)", borderColor: "rgba(108,99,255,0.2)" }}
            >
              <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>{editado.tipoLabel}</p>
              <p className="text-4xl font-bold" style={{ color: editado.tipo === "ingreso" ? "#10B981" : "#EF4444" }}>
                {formatCurrency(editado.monto, editado.moneda)}
              </p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                {editado.descripcion} 
                {editado.tipoAccion === "pasivo" && ` - ${editado.cuotas} cuotas al ${editado.tasa_interes}%`}
                {editado.tipoAccion === "recurrente" && ` - ${editado.cuotas} cuotas`}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setPaso("input"); setParsed(null); }}
              className="btn-secondary flex-1 py-3 rounded-xl"
              disabled={loading}
            >
              ← Editar texto
            </button>
            <button
              onClick={handleConfirm}
              className="btn-primary flex-1 py-3 rounded-xl"
              disabled={loading || editado.monto == null || !editado.cuentaId}
            >
              {loading ? "Guardando..." : "✅ Confirmar y guardar"}
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 3: Éxito ─────────────────────────────────── */}
      {paso === "success" && (
        <div className="text-center py-16 animate-slide-up">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(16,185,129,0.15)", border: "2px solid #10B981" }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-2xl font-bold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>¡Guardado!</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>El movimiento fue registrado correctamente</p>
        </div>
      )}
    </div>
  );
}
