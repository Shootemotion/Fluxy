"use client";

import { useState } from "react";
import { formatCurrency, formatDateToLocalISO } from "@/lib/utils";
import { createRecurrente, updateRecurrente, createMovement, deleteRecurrente } from "@/lib/actions";
import { toast } from "sonner";

interface RecurrentesClientProps {
  initialRecurrentes: any[];
  accounts: any[];
  categories: any[];
  movements: any[];
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

function parseLocal(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function upcomingMonths(rec: any, n = 4) {
  const now = new Date();
  const tasa = rec.es_cuotas ? 0 : (rec.tasa_interes || 0);
  const periods = [];
  
  if (rec.es_cuotas && rec.cuotas_totales) {
    // Generate all cuotas
    const start = parseLocal(rec.fecha_inicio)!;
    let baseDate = new Date(start.getFullYear(), start.getMonth(), rec.dia_del_mes);
    if (baseDate <= start) {
      baseDate.setMonth(baseDate.getMonth() + 1);
    }
    for (let i = 0; i < rec.cuotas_totales; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, rec.dia_del_mes);
      const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      periods.push({
        label: `${MESES[d.getMonth()]} ${d.getFullYear()} (C${i + 1}/${rec.cuotas_totales})`,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        fecha: formatDateToLocalISO(d),
        montoProyectado: rec.monto,
        isPast,
        isCuota: true
      });
    }
  } else {
    // Generate past and future months
    const start = parseLocal(rec.fecha_inicio)!;
    const end = parseLocal(rec.fecha_fin);
    let monthsToNow = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (monthsToNow < 0) monthsToNow = 0;

    const totalPeriodsToGenerate = monthsToNow + n;

    for (let i = 0; i < totalPeriodsToGenerate; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, rec.dia_del_mes);
      
      if (end && d > end) continue;
      
      const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());

      periods.push({
        label: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        fecha: formatDateToLocalISO(d),
        montoProyectado: proyectarMonto(rec.monto, tasa, i),
        isPast,
        isCuota: false
      });
    }
  }
  return periods;
}

export default function RecurrentesClient({ initialRecurrentes, accounts, categories, movements }: RecurrentesClientProps) {
  const [recs, setRecs]           = useState(initialRecurrentes);
  const [showModal, setShowModal]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [formError, setFormError]   = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [showPastFor, setShowPastFor]= useState<Record<string, boolean>>({});
  const [registeredPeriods, setRegisteredPeriods] = useState<Record<string, { registered: boolean, monto?: number }>>({});

  const toggleShowPast = (id: string) => setShowPastFor(prev => ({ ...prev, [id]: !prev[id] }));

  // Form state
  const [nombre,       setNombre]       = useState("");
  const [tipo,         setTipo]         = useState<"gasto"|"ingreso">("gasto");
  const [monto,        setMonto]        = useState("");
  const [moneda,       setMoneda]       = useState("ARS");
  const [tasaInteres,  setTasaInteres]  = useState("");
  const [categoriaId,  setCategoriaId]  = useState("");
  const [cuentaId,     setCuentaId]     = useState("");
  const [diaDelMes,    setDiaDelMes]    = useState("1");
  const [fechaInicio,  setFechaInicio]  = useState(formatDateToLocalISO(new Date()));
  const [fechaFin,     setFechaFin]     = useState("");
  const [esCuotas,     setEsCuotas]     = useState(false);
  const [cuotasTotales,setCuotasTotales]= useState("12");
  const [montoTotal,   setMontoTotal]   = useState("");

  // Confirm-month modal
  const [confirmRec,    setConfirmRec]    = useState<any>(null);
  const [confirmPeriod, setConfirmPeriod] = useState<any>(null);
  const [confirmMonto,  setConfirmMonto]  = useState("");
  const [confirmFecha,  setConfirmFecha]  = useState("");

  function resetForm() {
    setNombre(""); setTipo("gasto"); setMonto(""); setMoneda("ARS"); setTasaInteres("");
    setCategoriaId(""); setCuentaId(""); setDiaDelMes("1");
    setFechaInicio(formatDateToLocalISO(new Date())); setFechaFin("");
    setEsCuotas(false); setCuotasTotales("12"); setMontoTotal("");
    setEditingId(null); setFormError(null);
  }

  function openCreate() { resetForm(); setShowModal(true); }

  function openEdit(rec: any) {
    setNombre(rec.nombre); setTipo(rec.tipo); setMonto(String(rec.monto));
    setMoneda(rec.moneda); setTasaInteres(rec.tasa_interes ? String(rec.tasa_interes) : "");
    setCategoriaId(rec.categoria_id || ""); setCuentaId(rec.cuenta_id || "");
    setDiaDelMes(String(rec.dia_del_mes)); setFechaInicio(rec.fecha_inicio);
    setFechaFin(rec.fecha_fin || ""); 
    setEsCuotas(rec.es_cuotas || false);
    setCuotasTotales(rec.cuotas_totales ? String(rec.cuotas_totales) : "12");
    setMontoTotal(rec.es_cuotas && rec.cuotas_totales ? String(rec.monto * rec.cuotas_totales) : "");
    setEditingId(rec.id); setFormError(null); setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setFormError(null);
    try {
      let finalMonto = parseFloat(monto);
      let finalFechaFin = fechaFin || null;

      if (esCuotas && montoTotal && cuotasTotales) {
        const interes = tasaInteres ? parseFloat(tasaInteres) : 0;
        const totalConInteres = parseFloat(montoTotal) * (1 + interes / 100);
        finalMonto = totalConInteres / parseInt(cuotasTotales);
        
        // Calcular fecha fin automáticamente
        const inicio = new Date(fechaInicio + "T12:00:00"); // Avoid UTC shift
        inicio.setMonth(inicio.getMonth() + parseInt(cuotasTotales));
        finalFechaFin = formatDateToLocalISO(inicio);
      }

      const payload: any = {
        nombre, tipo, monto: finalMonto, moneda,
        tasa_interes: tasaInteres ? parseFloat(tasaInteres) : null,
        categoria_id: categoriaId || null,
        cuenta_id: cuentaId || null,
        dia_del_mes: parseInt(diaDelMes),
        fecha_inicio: fechaInicio,
        fecha_fin: finalFechaFin,
        es_cuotas: esCuotas,
        cuotas_totales: esCuotas ? parseInt(cuotasTotales) : null,
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
      toast.success("Guardado correctamente");
    } catch (err: any) {
      setFormError(err?.message ?? String(err));
      toast.error("Error: " + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function toggleActivo(rec: any) {
    try {
      const updated = await updateRecurrente(rec.id, { activo: !rec.activo });
      setRecs(prev => prev.map(r => r.id === rec.id ? { ...r, ...updated } : r));
    } catch (err: any) { toast.error("Error: " + (err?.message ?? err)); }
  }

  function handleDelete(id: string) {
    toast("¿Eliminar este registro periódico?", {
      description: "Los movimientos de dinero pasados no se borrarán.",
      action: {
        label: "Eliminar",
        onClick: async () => {
          try {
            await deleteRecurrente(id);
            setRecs(rs => rs.filter(r => r.id !== id));
            setExpanded(null);
            toast.success("Eliminado");
          } catch (err: any) { toast.error("Error al eliminar: " + (err?.message ?? err)); }
        }
      },
      cancel: { label: "Cancelar", onClick: () => {} }
    });
  }

  function openConfirm(rec: any, period: any) {
    setConfirmRec(rec);
    setConfirmPeriod(period);
    setConfirmMonto(String(period.montoProyectado));
    setConfirmFecha(period.fecha);
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
        fecha:             confirmFecha,
        descripcion:       `${confirmRec.nombre} (${confirmPeriod.label})`,
        categoria_id:      confirmRec.categoria_id || null,
        cuenta_origen_id:  confirmRec.tipo === "gasto"   ? (confirmRec.cuenta_id || null) : null,
        cuenta_destino_id: confirmRec.tipo === "ingreso" ? (confirmRec.cuenta_id || null) : null,
        objetivo_id:       null,
        tipo_cambio:       null,
        metodo_carga:      "manual",
      });
      setRegisteredPeriods(prev => ({ ...prev, [`${confirmRec.id}-${confirmPeriod.fecha}`]: { registered: true, monto: parseFloat(confirmMonto) } }));
      setShowConfirm(false);
      toast.success("Movimiento registrado");
    } catch (err: any) {
      toast.error("Error al registrar: " + (err?.message ?? err));
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
              const periods = upcomingMonths(rec);
              const pagadas = rec.es_cuotas ? periods.filter(p => p.isPast).length : 0;
              const pctCuotas = rec.cuotas_totales ? (pagadas / rec.cuotas_totales) * 100 : 0;
              
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
                        {rec.es_cuotas && rec.cuotas_totales && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>
                            {rec.cuotas_totales} cuotas
                          </span>
                        )}
                        {!rec.es_cuotas && tasa > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
                            +{tasa}%/mes
                          </span>
                        )}
                      </p>
                      {rec.es_cuotas && rec.cuotas_totales && (
                        <div className="mt-2.5 max-w-[200px]">
                          <div className="flex justify-between items-end mb-1">
                            <span className="text-[9px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
                              Pagadas: {pagadas}/{rec.cuotas_totales}
                            </span>
                            <span className="text-[10px] font-bold" style={{ color: "#3B82F6" }}>
                              {pctCuotas.toFixed(0)}%
                            </span>
                          </div>
                          <div className="progress-bar h-1.5" style={{ background: "rgba(0,0,0,0.2)", borderRadius: "999px", overflow: "hidden" }}>
                            <div className="progress-fill h-full" style={{ width: `${pctCuotas}%`, background: `linear-gradient(90deg, #3B82F6, #60A5FA)`, borderRadius: "999px" }} />
                          </div>
                        </div>
                      )}
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
                      <button onClick={() => handleDelete(rec.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(239,68,68,0.70)" }}
                        title="Eliminar periódico">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-4 pt-1">
                      <p className="text-xs font-semibold uppercase mb-2" style={{ color: "rgba(255,255,255,0.28)" }}>
                        Próximos vencimientos {tasa > 0 ? `(proyectado con +${tasa}%/mes)` : ""}
                      </p>
                      <div className="flex gap-2 flex-wrap max-h-48 overflow-y-auto custom-scrollbar">
                        {(() => {
                          const pastPeriods = periods.filter(p => p.isPast);
                          const futurePeriods = periods.filter(p => !p.isPast);
                          const showPast = showPastFor[rec.id];
                          const displayPeriods = showPast || rec.es_cuotas ? periods : futurePeriods;

                          return (
                            <>
                              {pastPeriods.length > 0 && !rec.es_cuotas && (
                                <button
                                  onClick={() => toggleShowPast(rec.id)}
                                  className="w-full py-2 mb-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors border border-dashed"
                                  style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }}
                                >
                                  {showPast ? "Ocultar anteriores" : `Ver anteriores (${pastPeriods.length} pendientes)`}
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                       style={{ transform: showPast ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                                    <polyline points="6 9 12 15 18 9"/>
                                  </svg>
                                </button>
                              )}
                              {displayPeriods.map(period => {
                                // Match against local state first (for immediate feedback)
                                const regData = registeredPeriods[`${rec.id}-${period.fecha}`];
                                
                                // Match against DB movements (more robust matching)
                                const matchedMovement = movements.find(m => 
                                  m.descripcion?.startsWith(rec.nombre) && 
                                  m.descripcion?.includes(period.label) &&
                                  m.fecha === period.fecha
                                ) || movements.find(m => 
                                  m.descripcion === rec.nombre && 
                                  m.fecha === period.fecha
                                );
                                
                                const isRegistered = !!regData?.registered || !!matchedMovement;
                                const finalMonto = matchedMovement ? matchedMovement.monto : (isRegistered && regData?.monto !== undefined ? regData.monto : period.montoProyectado);
                                
                                const isDisabled = (period.isPast && rec.es_cuotas) || isRegistered;
                                return (
                                  <button
                                    key={period.label}
                                    onClick={() => !isDisabled && openConfirm(rec, period)}
                                    className={`flex flex-col items-center px-3 py-2.5 rounded-xl text-xs transition-all ${period.isPast || isRegistered ? (rec.es_cuotas || isRegistered ? "opacity-40 grayscale cursor-default" : "hover:scale-105 border-dashed cursor-pointer") : "hover:scale-105"}`}
                                    style={{ background: `${color}15`, border: `1px solid ${color}${(period.isPast && !rec.es_cuotas) || isRegistered ? '40' : '30'}`, color: "rgba(255,255,255,0.75)" }}
                                    disabled={isDisabled}
                                  >
                                    <span className="font-semibold text-center">{period.label}</span>
                                    <span className="text-[11px] mt-1 font-mono font-bold" style={{ color }}>
                                      {rec.moneda === "USD" ? `U$S ${finalMonto.toLocaleString()}` : formatCurrency(finalMonto, "ARS", true)}
                                    </span>
                                    {!period.isCuota && tasa > 0 && finalMonto !== rec.monto && !isRegistered && (
                                      <span className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.30)" }}>
                                        proyectado
                                      </span>
                                    )}
                                    <span className="text-[10px] mt-1" style={{ color: isDisabled ? "rgba(255,255,255,0.3)" : `${color}99` }}>
                                      {isDisabled ? "Pagado" : "Registrar →"}
                                    </span>
                                  </button>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>
                      <div className="mt-3 text-[10px]" style={{ color: "var(--fg-6)" }}>
                        💡 <span style={{ opacity: 0.8 }}>Para deshacer un pago o ver tu historial de pagos, ve a la sección de </span>
                        <a href="/app/movimientos" className="font-semibold underline" style={{ color: color }}>Movimientos</a>.
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
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Tipo de periódico</label>
                    <select className="input-field" value={esCuotas ? "cuotas" : tipo} onChange={e => {
                      if (e.target.value === "cuotas") {
                        setEsCuotas(true);
                        setTipo("gasto");
                      } else {
                        setEsCuotas(false);
                        setTipo(e.target.value as any);
                      }
                    }}>
                      <option value="gasto">Gasto fijo</option>
                      <option value="ingreso">Ingreso fijo</option>
                      <option value="cuotas">Pago en cuotas (Tarjeta)</option>
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

                {esCuotas ? (
                  <div className="rounded-xl p-4 space-y-4" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.20)" }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Monto Total Compra *</label>
                        <input className="input-field font-mono" type="number" placeholder="Ej: 150000"
                          value={montoTotal} onChange={e => setMontoTotal(e.target.value)} required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Cantidad Cuotas *</label>
                        <input className="input-field font-mono" type="number" min="2" max="72"
                          value={cuotasTotales} onChange={e => setCuotasTotales(e.target.value)} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                          Recargo Total % <span className="font-normal normal-case opacity-70">(opcional)</span>
                        </label>
                        <input className="input-field font-mono" type="number" step="0.01" min="0" placeholder="Ej: 20"
                          value={tasaInteres} onChange={e => setTasaInteres(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Día pago de cuota</label>
                        <input className="input-field" type="number" min="1" max="28"
                          value={diaDelMes} onChange={e => setDiaDelMes(e.target.value)} required />
                      </div>
                    </div>
                    {montoTotal && cuotasTotales && (
                      <div className="pt-3 border-t mt-4" style={{ borderColor: "rgba(59,130,246,0.2)" }}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Monto total a pagar:</span>
                          <span className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                            {formatCurrency(parseFloat(montoTotal) * (1 + (tasaInteres ? parseFloat(tasaInteres) / 100 : 0)), "ARS", true)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-blue-500/10 -mx-2 px-2 py-2 rounded-lg">
                          <span className="text-sm font-semibold text-blue-400">Valor de cada cuota:</span>
                          <span className="font-mono text-lg font-bold text-blue-300">
                            {formatCurrency((parseFloat(montoTotal) * (1 + (tasaInteres ? parseFloat(tasaInteres) / 100 : 0))) / parseInt(cuotasTotales), "ARS", true)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Monto base *</label>
                      <input className="input-field font-mono" type="number" placeholder="0"
                        value={monto} onChange={e => setMonto(e.target.value)}
                        onFocus={e => e.target.select()} required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                        Interés mensual % <span className="font-normal normal-case opacity-70">(opcional)</span>
                      </label>
                      <input className="input-field font-mono" type="number" step="0.01" min="0" max="100"
                        placeholder="Ej: 5"
                        value={tasaInteres} onChange={e => setTasaInteres(e.target.value)}
                        onFocus={e => e.target.select()} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Día del mes</label>
                      <input className="input-field" type="number" min="1" max="28"
                        value={diaDelMes} onChange={e => setDiaDelMes(e.target.value)} required />
                    </div>
                  </div>
                )}

                {/* Preview with interest for fixed recurring */}
                {!esCuotas && tasaInteres && parseFloat(tasaInteres) > 0 && monto && (
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
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Categoría</label>
                    <select className="input-field" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
                      <option value="">Sin categoría</option>
                      {categories.filter((c: any) => c.activa).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
                      ))}
                    </select>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Desde</label>
                    <input className="input-field" type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} required />
                  </div>
                  {!esCuotas && (
                    <div>
                      <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                        Hasta <span className="font-normal normal-case">(opcional)</span>
                      </label>
                      <input className="input-field" type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
                    </div>
                  )}
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
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                  Fecha del movimiento
                </label>
                <input className="input-field" type="date"
                  value={confirmFecha} onChange={e => setConfirmFecha(e.target.value)} />
                <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Por defecto sugerimos la fecha del periodo ({confirmPeriod.label}), pero podés cambiarla a hoy si preferís.
                </p>
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
