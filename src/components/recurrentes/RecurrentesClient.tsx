"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { createRecurrente, updateRecurrente, createMovement } from "@/lib/actions";

interface RecurrentesClientProps {
  initialRecurrentes: any[];
  accounts: any[];
  categories: any[];
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function monthsFromStart(fechaInicio: string, targetYear: number, targetMonth: number): number {
  const start = new Date(fechaInicio);
  return (targetYear - start.getFullYear()) * 12 + (targetMonth - 1 - start.getMonth());
}

function proyectarMonto(monto: number, tasa: number, meses: number): number {
  if (!tasa || meses <= 0) return monto;
  return Math.round(monto * Math.pow(1 + tasa / 100, meses));
}

function upcomingMonths(rec: any, n = 4) {
  const now = new Date();
  const tasa = rec.tasa_interes || 0;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, rec.dia_del_mes);
    const mesesDesdeInicio = monthsFromStart(rec.fecha_inicio, d.getFullYear(), d.getMonth() + 1);
    return {
      label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      fecha: d.toISOString().split("T")[0],
      montoProyectado: proyectarMonto(rec.monto, tasa, mesesDesdeInicio),
    };
  });
}

export default function RecurrentesClient({ initialRecurrentes, accounts, categories }: RecurrentesClientProps) {
  const [recs, setRecs]           = useState(initialRecurrentes);
  const [showModal, setShowModal]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [formError, setFormError]   = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);

  // Form state
  const [nombre,       setNombre]       = useState("");
  const [tipo,         setTipo]         = useState<"gasto"|"ingreso">("gasto");
  const [monto,        setMonto]        = useState("");
  const [moneda,       setMoneda]       = useState("ARS");
  const [tasaInteres,  setTasaInteres]  = useState("");
  const [categoriaId,  setCategoriaId]  = useState("");
  const [cuentaId,     setCuentaId]     = useState("");
  const [diaDelMes,    setDiaDelMes]    = useState("1");
  const [fechaInicio,  setFechaInicio]  = useState(new Date().toISOString().split("T")[0]);
  const [fechaFin,     setFechaFin]     = useState("");

  // Confirm-month modal
  const [confirmRec,    setConfirmRec]    = useState<any>(null);
  const [confirmPeriod, setConfirmPeriod] = useState<any>(null);
  const [confirmMonto,  setConfirmMonto]  = useState("");

  function resetForm() {
    setNombre(""); setTipo("gasto"); setMonto(""); setMoneda("ARS"); setTasaInteres("");
    setCategoriaId(""); setCuentaId(""); setDiaDelMes("1");
    setFechaInicio(new Date().toISOString().split("T")[0]); setFechaFin("");
    setEditingId(null); setFormError(null);
  }

  function openCreate() { resetForm(); setShowModal(true); }

  function openEdit(rec: any) {
    setNombre(rec.nombre); setTipo(rec.tipo); setMonto(String(rec.monto));
    setMoneda(rec.moneda); setTasaInteres(rec.tasa_interes ? String(rec.tasa_interes) : "");
    setCategoriaId(rec.categoria_id || ""); setCuentaId(rec.cuenta_id || "");
    setDiaDelMes(String(rec.dia_del_mes)); setFechaInicio(rec.fecha_inicio);
    setFechaFin(rec.fecha_fin || ""); setEditingId(rec.id); setFormError(null); setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setFormError(null);
    try {
      const payload: any = {
        nombre, tipo, monto: parseFloat(monto), moneda,
        tasa_interes: tasaInteres ? parseFloat(tasaInteres) : null,
        categoria_id: categoriaId || null,
        cuenta_id: cuentaId || null,
        dia_del_mes: parseInt(diaDelMes),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || null,
        activo: true,
      };
      if (editingId) {
        const updated = await updateRecurrente(editingId, payload);
        setRecs(prev => prev.map(r => r.id === editingId ? { ...r, ...updated } : r));
      } else {
        const newRec = await createRecurrente(payload);
        setRecs(prev => [...prev, newRec]);
      }
      setShowModal(false); resetForm();
    } catch (err: any) {
      setFormError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  async function toggleActivo(rec: any) {
    try {
      const updated = await updateRecurrente(rec.id, { activo: !rec.activo });
      setRecs(prev => prev.map(r => r.id === rec.id ? { ...r, ...updated } : r));
    } catch (err: any) { alert("Error: " + (err?.message ?? err)); }
  }

  function openConfirm(rec: any, period: any) {
    setConfirmRec(rec);
    setConfirmPeriod(period);
    setConfirmMonto(String(period.montoProyectado));
    setShowConfirm(true);
  }

  async function handleConfirm() {
    if (!confirmRec || !confirmPeriod) return;
    setLoading(true);
    try {
      await createMovement({
        tipo:              confirmRec.tipo as any,
        monto:             parseFloat(confirmMonto),
        moneda:            confirmRec.moneda,
        fecha:             confirmPeriod.fecha,
        descripcion:       confirmRec.nombre,
        categoria_id:      confirmRec.categoria_id || null,
        cuenta_origen_id:  confirmRec.tipo === "gasto"   ? (confirmRec.cuenta_id || null) : null,
        cuenta_destino_id: confirmRec.tipo === "ingreso" ? (confirmRec.cuenta_id || null) : null,
        objetivo_id:       null,
        tipo_cambio:       null,
        metodo_carga:      "manual",
      });
      setShowConfirm(false);
    } catch (err: any) {
      alert("Error al registrar: " + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  const gastos   = recs.filter(r => r.tipo === "gasto");
  const ingresos = recs.filter(r => r.tipo === "ingreso");

  const totalMensualGastos   = gastos.filter(r => r.activo && r.moneda === "ARS").reduce((s, r) => s + Number(r.monto), 0);
  const totalMensualIngresos = ingresos.filter(r => r.activo && r.moneda === "ARS").reduce((s, r) => s + Number(r.monto), 0);

  function RecSection({ title, items, color }: { title: string; items: any[]; color: string }) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{title}</h2>
          <span className="text-xs font-mono font-bold" style={{ color }}>
            {formatCurrency(items.filter(r => r.activo && r.moneda === "ARS").reduce((s, r) => s + Number(r.monto), 0), "ARS", true)}/mes base
          </span>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm" style={{ color: "rgba(255,255,255,0.30)" }}>No hay {title.toLowerCase()}.</p>
        ) : (
          <div>
            {items.map((rec, idx) => {
              const cat    = categories.find((c: any) => c.id === rec.categoria_id);
              const isOpen = expanded === rec.id;
              const tasa   = rec.tasa_interes || 0;
              return (
                <div key={rec.id} style={{ borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.04)" : "none", opacity: rec.activo ? 1 : 0.5 }}>
                  <div className="flex items-center gap-3 px-5 py-3.5 group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: `${color}18` }}>
                      {cat?.icono || (rec.tipo === "gasto" ? "📤" : "💰")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.90)" }}>{rec.nombre}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Día {rec.dia_del_mes} · {cat?.nombre || "Sin categoría"}
                        {tasa > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
                            +{tasa}%/mes
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className="text-sm font-bold font-mono" style={{ color }}>
                        {rec.moneda === "USD" ? `U$S ${Number(rec.monto).toLocaleString()}` : formatCurrency(rec.monto, "ARS", true)}
                      </p>
                      {tasa > 0 && (
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.30)" }}>base</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setExpanded(isOpen ? null : rec.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)" }}
                        title="Ver vencimientos">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d={isOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                        </svg>
                      </button>
                      <button onClick={() => openEdit(rec)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)" }}
                        title="Editar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => toggleActivo(rec)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg"
                        style={{ background: "rgba(255,255,255,0.06)", color: rec.activo ? "#EF4444" : "#10B981" }}
                        title={rec.activo ? "Pausar" : "Activar"}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          {rec.activo
                            ? <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
                            : <polygon points="5 3 19 12 5 21 5 3"/>
                          }
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-4 pt-1">
                      <p className="text-xs font-semibold uppercase mb-2" style={{ color: "rgba(255,255,255,0.28)" }}>
                        Próximos vencimientos {tasa > 0 ? `(proyectado con +${tasa}%/mes)` : ""}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {upcomingMonths(rec).map(period => (
                          <button
                            key={period.label}
                            onClick={() => openConfirm(rec, period)}
                            className="flex flex-col items-center px-3 py-2.5 rounded-xl text-xs transition-all hover:scale-105"
                            style={{ background: `${color}15`, border: `1px solid ${color}30`, color: "rgba(255,255,255,0.75)" }}
                          >
                            <span className="font-semibold">{period.label}</span>
                            <span className="text-[11px] mt-1 font-mono font-bold" style={{ color }}>
                              {rec.moneda === "USD" ? `U$S ${period.montoProyectado.toLocaleString()}` : formatCurrency(period.montoProyectado, "ARS", true)}
                            </span>
                            {tasa > 0 && period.montoProyectado !== rec.monto && (
                              <span className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.30)" }}>
                                proyectado
                              </span>
                            )}
                            <span className="text-[10px] mt-1" style={{ color: `${color}99` }}>Registrar →</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Periódicos</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>Gastos e ingresos recurrentes</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">+ Nuevo periódico</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="kpi-card" style={{ "--accent": "#EF4444" } as React.CSSProperties}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.38)" }}>Gastos fijos/mes</p>
          <p className="text-xl font-bold text-rose-400">{formatCurrency(totalMensualGastos, "ARS", true)}</p>
        </div>
        <div className="kpi-card" style={{ "--accent": "#10B981" } as React.CSSProperties}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.38)" }}>Ingresos fijos/mes</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalMensualIngresos, "ARS", true)}</p>
        </div>
      </div>

      <RecSection title="Gastos periódicos"   items={gastos}   color="#EF4444" />
      <RecSection title="Ingresos periódicos" items={ingresos} color="#10B981" />

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md animate-slide-up" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {editingId ? "Editar periódico" : "Nuevo periódico"}
                </h2>
                <button onClick={() => { setShowModal(false); resetForm(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
                  style={{ color: "rgba(255,255,255,0.35)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Nombre *</label>
                  <input className="input-field" type="text" placeholder="Ej: Internet, Sueldo, Netflix..."
                    value={nombre} onChange={e => setNombre(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Tipo</label>
                    <select className="input-field" value={tipo} onChange={e => setTipo(e.target.value as any)}>
                      <option value="gasto">Gasto</option>
                      <option value="ingreso">Ingreso</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Moneda</label>
                    <select className="input-field" value={moneda} onChange={e => setMoneda(e.target.value)}>
                      <option value="ARS">$ ARS</option>
                      <option value="USD">U$S USD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Monto base *</label>
                    <input className="input-field font-mono" type="number" placeholder="0"
                      value={monto} onChange={e => setMonto(e.target.value)}
                      onFocus={e => e.target.select()} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                      Interés mensual %
                      <span className="ml-1 font-normal normal-case" style={{ color: "rgba(255,255,255,0.25)" }}>(opcional)</span>
                    </label>
                    <input className="input-field font-mono" type="number" step="0.01" min="0" max="100"
                      placeholder="Ej: 5 = 5%/mes"
                      value={tasaInteres} onChange={e => setTasaInteres(e.target.value)}
                      onFocus={e => e.target.select()} />
                  </div>
                </div>

                {/* Preview with interest */}
                {tasaInteres && parseFloat(tasaInteres) > 0 && monto && (
                  <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.20)" }}>
                    <p className="text-xs font-semibold" style={{ color: "#F59E0B" }}>Proyección con interés compuesto</p>
                    {[1,2,3,6].map(n => (
                      <div key={n} className="flex justify-between text-xs">
                        <span style={{ color: "rgba(255,255,255,0.45)" }}>Mes {n}:</span>
                        <span className="font-mono font-bold" style={{ color: "rgba(255,255,255,0.75)" }}>
                          {formatCurrency(proyectarMonto(parseFloat(monto), parseFloat(tasaInteres), n), "ARS", true)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Día del mes</label>
                    <input className="input-field" type="number" min="1" max="28"
                      value={diaDelMes} onChange={e => setDiaDelMes(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Categoría</label>
                    <select className="input-field" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
                      <option value="">Sin categoría</option>
                      {categories.filter((c: any) => c.activa).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Cuenta</label>
                  <select className="input-field" value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
                    <option value="">Sin cuenta específica</option>
                    {accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.icono} {a.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Desde</label>
                    <input className="input-field" type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                      Hasta <span className="font-normal normal-case">(opcional)</span>
                    </label>
                    <input className="input-field" type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
                  </div>
                </div>

                {formError && (
                  <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <p className="text-xs" style={{ color: "#EF4444" }}>{formError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={loading}>
                    {loading ? "Guardando..." : (editingId ? "Guardar" : "Crear")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar mes */}
      {showConfirm && confirmRec && confirmPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm animate-slide-up p-6">
            <h2 className="text-lg font-bold mb-1" style={{ color: "rgba(255,255,255,0.9)" }}>
              Registrar {confirmPeriod.label}
            </h2>
            <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.40)" }}>
              {confirmRec.nombre}
            </p>

            {(confirmRec.tasa_interes > 0) && (
              <div className="rounded-xl p-3 mb-4 flex items-center justify-between"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.20)" }}>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Proyectado (+{confirmRec.tasa_interes}%/mes)</span>
                <span className="font-mono font-bold text-sm" style={{ color: "#F59E0B" }}>
                  {formatCurrency(confirmPeriod.montoProyectado, confirmRec.moneda)}
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                  Monto real
                </label>
                <input className="input-field font-mono text-lg" type="number"
                  value={confirmMonto} onChange={e => setConfirmMonto(e.target.value)}
                  onFocus={e => e.target.select()} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleConfirm} className="btn-primary flex-1" disabled={loading}>
                  {loading ? "Registrando..." : "✅ Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
