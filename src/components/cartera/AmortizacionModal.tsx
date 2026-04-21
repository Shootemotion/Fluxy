"use client";

import { useState } from "react";
import { registrarPagoPasivo, getPagosPasivo } from "@/lib/actions";

// ── Pure schedule calculator ────────────────────────────────────────────────
export interface CuotaRow {
  nCuota: number;
  fechaVtoStr: string;
  capitalUva: number;
  interesUva: number;
  cuotaUva: number;
  uvaRef: number | null;
  cuotaArs: number | null;
  capitalArs: number | null;
  saldoUva: number;
  pagado: any | null;
  status: "pagada" | "vencida" | "proxima" | "futura";
}

function calcSchedule(
  pasivo: any,
  pagos: any[],
  uvaEfectivo: number | null,
  cerEfectivo: number
): CuotaRow[] {
  const n = Number(pasivo.n_cuotas);
  if (!n) return [];

  const cuotaUva   = Number(pasivo.cuota_uva   || 0);
  const capitalUva = Number(pasivo.capital_uva  || 0);
  const tasaMensual = Number(pasivo.tasa_interes || 0) / 12 / 100;
  const fechaBase  = (pasivo.fecha_inicio || new Date().toISOString().split("T")[0]);

  // Map paid cuotas by cuota_numero
  const pagosMap = new Map<number, any>();
  pagos.forEach(p => { if (p.cuota_numero) pagosMap.set(Number(p.cuota_numero), p); });

  const nextUnpaid = pagos.length + 1; // 1-based cuota number of next unpaid
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let balance = capitalUva;
  const rows: CuotaRow[] = [];

  for (let i = 1; i <= n; i++) {
    const interesUva = tasaMensual > 0 ? balance * tasaMensual : 0;
    const capUva     = Math.max(0, cuotaUva - interesUva);

    const fechaVto = new Date(fechaBase + "T12:00:00");
    fechaVto.setMonth(fechaVto.getMonth() + i - 1);
    const fechaVtoStr = fechaVto.toISOString().split("T")[0];

    const pagado = pagosMap.get(i) || null;

    // UVA projection
    const mesesDesdeHoy =
      (fechaVto.getFullYear() - hoy.getFullYear()) * 12 +
      (fechaVto.getMonth()    - hoy.getMonth());

    let uvaRef: number | null = null;
    if (pagado?.uva_valor) {
      uvaRef = Number(pagado.uva_valor);
    } else if (uvaEfectivo) {
      uvaRef = mesesDesdeHoy <= 0
        ? uvaEfectivo
        : uvaEfectivo * Math.pow(1 + cerEfectivo, mesesDesdeHoy);
    }

    const cuotaArs  = uvaRef ? Math.round(cuotaUva * uvaRef) : null;
    const capitalArs = uvaRef ? Math.round(capUva   * uvaRef) : null;

    let status: CuotaRow["status"];
    if (pagado) {
      status = "pagada";
    } else if (fechaVto < hoy) {
      status = "vencida";
    } else if (i === nextUnpaid) {
      status = "proxima";
    } else {
      status = "futura";
    }

    rows.push({
      nCuota: i, fechaVtoStr,
      capitalUva: capUva, interesUva, cuotaUva,
      uvaRef, cuotaArs, capitalArs,
      saldoUva: Math.max(0, balance - capUva),
      pagado, status,
    });

    balance = Math.max(0, balance - capUva);
  }

  return rows;
}

// ── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pagada:  { bg: "rgba(16,185,129,0.12)",  color: "#10B981", label: "Pagada"   },
  vencida: { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", label: "Vencida"  },
  proxima: { bg: "rgba(245,158,11,0.15)",  color: "#F59E0B", label: "Próxima"  },
  futura:  { bg: "rgba(255,255,255,0.05)", color: "var(--fg-6)", label: "Futura" },
};

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  pasivo: any;
  initialPagos: any[];
  uvaEfectivo: number | null;
  cerEfectivo: number;
  uvaCerMensual: number | null;
  accounts: any[];
  categories: any[];
  onClose: () => void;
  onSaldoUpdated: (pasivoId: string) => void;
}

export default function AmortizacionModal({
  pasivo, initialPagos, uvaEfectivo, cerEfectivo, uvaCerMensual,
  accounts, categories, onClose, onSaldoUpdated,
}: Props) {
  const [pagos, setPagos] = useState(initialPagos);
  const [page, setPage] = useState(() =>
    Math.max(0, Math.floor(initialPagos.length / 10))
  );

  // Payment form
  const [pagoTarget, setPagoTarget] = useState<CuotaRow | null>(null);
  const [pagoMonto, setPagoMonto]   = useState("");
  const [pagoFecha, setPagoFecha]   = useState(new Date().toISOString().split("T")[0]);
  const [pagoCuentaId, setPagoCuentaId] = useState(accounts[0]?.id || "");
  const [pagoDesc, setPagoDesc]     = useState("");
  const [pagoCatId, setPagoCatId]   = useState("");
  const [pagoLoading, setPagoLoading] = useState(false);
  const [pagoError, setPagoError]   = useState("");

  const schedule  = calcSchedule(pasivo, pagos, uvaEfectivo, cerEfectivo);
  const totalPages = Math.ceil(schedule.length / 10);
  const pageRows  = schedule.slice(page * 10, page * 10 + 10);

  const paid    = pagos.length;
  const pending = Number(pasivo.n_cuotas) - paid;
  const saldoUvas = schedule.length > 0 ? schedule[Math.min(paid, schedule.length - 1)].saldoUva : 0;

  function openPago(row: CuotaRow) {
    setPagoTarget(row);
    setPagoMonto(row.cuotaArs ? String(Math.round(row.cuotaArs)) : "");
    setPagoFecha(new Date().toISOString().split("T")[0]);
    setPagoDesc(`Cuota ${row.nCuota} · ${pasivo.nombre}`);
    setPagoError("");
  }

  async function handlePago(e: React.FormEvent) {
    e.preventDefault();
    if (!pagoTarget || !pagoMonto || !pagoCuentaId) return;
    setPagoLoading(true); setPagoError("");
    try {
      await registrarPagoPasivo(
        pasivo.id, parseFloat(pagoMonto), pagoFecha,
        pagoCuentaId || null, pagoDesc || "", pagoCatId || null,
        pagoTarget.uvaRef ?? uvaEfectivo ?? undefined,
      );
      const fresh = await getPagosPasivo(pasivo.id);
      setPagos(fresh);
      setPagoTarget(null);
      onSaldoUpdated(pasivo.id);
    } catch (err: any) {
      setPagoError(err.message);
    } finally {
      setPagoLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
      <div className="glass-card w-full max-w-4xl flex flex-col" style={{ maxHeight: "92vh" }}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between p-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg-hi)" }}>
              Cronograma · {pasivo.nombre}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--fg-6)" }}>
              {paid}/{Number(pasivo.n_cuotas)} cuotas pagadas
              {uvaEfectivo
                ? ` · 1 UVA = $${uvaEfectivo.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`
                : " · Sin UVA actual"}
              {uvaCerMensual
                ? ` · CER ${(uvaCerMensual * 100).toFixed(2)}%/mes`
                : ` · CER ${(cerEfectivo * 100).toFixed(1)}%/mes (est.)`}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 flex-shrink-0"
            style={{ color: "var(--fg-6)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Summary chips ── */}
        <div className="flex gap-3 px-5 pb-3 flex-wrap flex-shrink-0">
          {[
            { label: "Capital original", val: `${Number(pasivo.capital_uva).toLocaleString("es-AR", { maximumFractionDigits: 1 })} UVAs`, color: "var(--fg-4)" },
            { label: "Saldo aprox.", val: uvaEfectivo ? `$${Math.round(saldoUvas * uvaEfectivo).toLocaleString("es-AR")}` : `${saldoUvas.toFixed(1)} UVAs`, color: "#EF4444" },
            { label: "Cuotas restantes", val: String(pending), color: "#F59E0B" },
            { label: "Cuota fija", val: `${Number(pasivo.cuota_uva).toLocaleString("es-AR", { maximumFractionDigits: 2 })} UVAs`, color: "#A5A0FF" },
          ].map(c => (
            <div key={c.label} className="rounded-lg px-3 py-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] uppercase" style={{ color: "var(--fg-6)" }}>{c.label}</p>
              <p className="text-sm font-bold font-mono" style={{ color: c.color }}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto px-5">
          {!uvaEfectivo && (
            <div className="rounded-xl p-3 mb-3 text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.20)", color: "#F59E0B" }}>
              Sin valor UVA actual — los montos en ARS son estimaciones basadas en proyección CER. Las cuotas pagadas muestran el UVA histórico.
            </div>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide" style={{ color: "var(--fg-6)" }}>N°</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide" style={{ color: "var(--fg-6)" }}>Fecha vto.</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide" style={{ color: "#10B981" }}>Cap.UVA</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide" style={{ color: "var(--fg-6)" }}>Int.UVA</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide" style={{ color: "#A5A0FF" }}>Cuota UVA</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide" style={{ color: "var(--fg-5)" }}>UVA ref.</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide" style={{ color: "#22D3EE" }}>Cuota ARS</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide" style={{ color: "var(--fg-6)" }}>Estado</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide" style={{ color: "var(--fg-6)" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row: any) => {
                  const st = STATUS_STYLES[row.status];
                  const isProxima = row.status === "proxima";
                  const isPagada  = row.status === "pagada";
                  return (
                    <tr key={row.nCuota}
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                        background: isProxima ? "rgba(245,158,11,0.05)" : isPagada ? "rgba(16,185,129,0.03)" : undefined,
                      }}>
                      <td className="px-3 py-2 font-mono font-bold" style={{ color: isProxima ? "#F59E0B" : "var(--fg-5)" }}>{row.nCuota}</td>
                      <td className="px-3 py-2" style={{ color: "var(--fg-4)", whiteSpace: "nowrap" }}>
                        {row.fechaVtoStr}
                      </td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: isPagada ? "#10B981" : "var(--fg-4)" }}>
                        {row.capitalUva.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--fg-6)" }}>
                        {row.interesUva.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: "#A5A0FF" }}>
                        {row.cuotaUva.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--fg-6)" }}>
                        {row.uvaRef ? `$${row.uvaRef.toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "#22D3EE" }}>
                        {isPagada
                          ? `$${Number(row.pagado.monto_ars).toLocaleString("es-AR")}`
                          : row.cuotaArs
                            ? `$${row.cuotaArs.toLocaleString("es-AR")}`
                            : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                          style={{ background: st.bg, color: st.color }}>
                          {isPagada && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mr-0.5">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {!isPagada && (
                          <button
                            onClick={() => openPago(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                            style={{ background: isProxima ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)", color: isProxima ? "#F59E0B" : "var(--fg-6)" }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                            Pagar
                          </button>
                        )}
                        {isPagada && row.pagado?.fecha && (
                          <span className="text-[10px]" style={{ color: "var(--fg-7)" }}>{row.pagado.fecha}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div className="flex items-center justify-between mt-3 pb-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--fg-5)" }}>
              ← Anteriores
            </button>
            <span className="text-[11px]" style={{ color: "var(--fg-6)" }}>
              Cuotas {page * 10 + 1}–{Math.min(Number(pasivo.n_cuotas), page * 10 + 10)} de {pasivo.n_cuotas}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--fg-5)" }}>
              Siguientes →
            </button>
          </div>
        </div>

        {/* ── Inline payment form ── */}
        {pagoTarget && (
          <div className="flex-shrink-0 border-t mt-2 p-5 space-y-3" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.20)" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: "var(--fg-hi)" }}>
                Registrar pago — Cuota {pagoTarget.nCuota}
              </p>
              <button onClick={() => setPagoTarget(null)} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--fg-6)" }}>
                Cancelar
              </button>
            </div>
            {pagoTarget.uvaRef && (
              <p className="text-xs" style={{ color: "var(--fg-5)" }}>
                UVA estimado al vto.: <strong style={{ color: "#A5A0FF" }}>${pagoTarget.uvaRef.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</strong>
                {" · "}Cuota estimada: <strong style={{ color: "#22D3EE" }}>
                  ${Math.round(pagoTarget.cuotaUva * pagoTarget.uvaRef).toLocaleString("es-AR")}
                </strong>
              </p>
            )}
            <form onSubmit={handlePago} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: "var(--fg-5)" }}>Monto ARS *</label>
                <input type="number" className="input-field font-mono text-sm" placeholder="0" min="0" step="any"
                  value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} onFocus={e => e.target.select()} required autoFocus />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: "var(--fg-5)" }}>Fecha</label>
                <input type="date" className="input-field text-sm"
                  value={pagoFecha} onChange={e => setPagoFecha(e.target.value)} required />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: "var(--fg-5)" }}>Cuenta *</label>
                <select className="input-field text-sm" value={pagoCuentaId} onChange={e => setPagoCuentaId(e.target.value)} required>
                  <option value="">Elegir…</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: "var(--fg-5)" }}>Categoría</label>
                <select className="input-field text-sm" value={pagoCatId} onChange={e => setPagoCatId(e.target.value)}>
                  <option value="">Sin cat.</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <label className="block text-[10px] font-semibold uppercase mb-1" style={{ color: "var(--fg-5)" }}>Descripción</label>
                <input className="input-field text-sm" value={pagoDesc} onChange={e => setPagoDesc(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={pagoLoading} className="btn-primary w-full text-sm">
                  {pagoLoading ? "…" : "Confirmar"}
                </button>
              </div>
              {pagoError && <p className="col-span-2 sm:col-span-4 text-xs" style={{ color: "#EF4444" }}>{pagoError}</p>}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
