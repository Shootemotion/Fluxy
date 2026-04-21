"use client";

import { useState } from "react";
import { formatCurrency, getProgressColor, getProgressStatus } from "@/lib/utils";
import { createGoal, updateGoal, createMovement } from "@/lib/actions";

interface ObjetivosClientProps {
  initialGoals: any[];
  accounts: any[];
}

const STATUS_CONFIG = {
  "on-track": { label: "En camino",   color: "#10B981", badge: "badge-success" },
  "slow":     { label: "Ritmo lento", color: "#F59E0B", badge: "badge-warning" },
  "behind":   { label: "En riesgo",   color: "#EF4444", badge: "badge-danger"  },
};

const ICONOS = [
  { value: "🎯", label: "Meta" },
  { value: "🏖️", label: "Vacaciones" },
  { value: "🚗", label: "Auto" },
  { value: "🏠", label: "Casa" },
  { value: "💸", label: "Emergencia" },
  { value: "💻", label: "Equipo" },
  { value: "✈️", label: "Viaje" },
  { value: "📚", label: "Educación" },
];

export default function ObjetivosClient({ initialGoals, accounts }: ObjetivosClientProps) {
  const [goals, setGoals]     = useState(initialGoals);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [nombre,   setNombre]   = useState("");
  const [monto,    setMonto]    = useState("");
  const [fecha,    setFecha]    = useState("");
  const [icono,    setIcono]    = useState("🎯");
  const [prioridad, setPrioridad] = useState("media");

  // Aportar state
  const [aportarGoal,    setAportarGoal]    = useState<any>(null);
  const [aportarMonto,   setAportarMonto]   = useState("");
  const [aportarCuentaId, setAportarCuentaId] = useState("");
  const [aportarError,   setAportarError]   = useState<string | null>(null);

  async function handleAportar() {
    if (!aportarGoal || !aportarMonto) return;
    setLoading(true); setAportarError(null);
    try {
      const importe = parseFloat(aportarMonto);
      await createMovement({
        tipo:              "aporte_objetivo",
        monto:             importe,
        moneda:            "ARS",
        fecha:             new Date().toISOString().split("T")[0],
        descripcion:       `Aporte a: ${aportarGoal.nombre}`,
        categoria_id:      null,
        cuenta_origen_id:  aportarCuentaId || null,
        cuenta_destino_id: null,
        objetivo_id:       aportarGoal.id,
        tipo_cambio:       null,
        metodo_carga:      "manual",
      });
      const nuevoSaldo = Number(aportarGoal.saldo_actual) + importe;
      await updateGoal(aportarGoal.id, { saldo_actual: nuevoSaldo });
      setGoals(gs => gs.map(g => g.id === aportarGoal.id ? { ...g, saldo_actual: nuevoSaldo } : g));
      setAportarGoal(null); setAportarMonto(""); setAportarCuentaId("");
    } catch (err: any) {
      setAportarError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setNombre(""); setMonto(""); setFecha("");
    setIcono("🎯"); setPrioridad("media");
    setEditingId(null); setFormError(null);
  }

  function openCreate() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(goal: any) {
    setNombre(goal.nombre);
    setMonto(String(goal.monto_objetivo));
    setFecha(goal.fecha_meta || "");
    setIcono(goal.icono || "🎯");
    setPrioridad(goal.prioridad || "media");
    setEditingId(goal.id);
    setFormError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      const payload = {
        nombre,
        monto_objetivo: parseFloat(monto),
        fecha_meta:     fecha || null,
        icono,
        prioridad:      prioridad as any,
      };

      if (editingId) {
        const updated = await updateGoal(editingId, payload);
        setGoals(goals.map(g => g.id === editingId ? { ...g, ...updated } : g));
      } else {
        const newGoal = await createGoal({
          ...payload,
          saldo_actual: 0,
          color: "#6C63FF",
          activo: true,
          descripcion: null,
          aporte_mensual_sugerido: null,
        });
        setGoals([...goals, newGoal]);
      }
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setFormError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  const totalObjetivo = goals.reduce((s, o) => s + Number(o.monto_objetivo), 0);
  const totalActual   = goals.reduce((s, o) => s + Number(o.saldo_actual), 0);
  const pctGlobal     = totalObjetivo > 0 ? (totalActual / totalObjetivo) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Objetivos de Ahorro</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
            {goals.length} meta{goals.length !== 1 ? "s" : ""} activa{goals.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">+ Nuevo objetivo</button>
      </div>

      {/* Resumen global */}
      {goals.length > 0 && (
        <div className="glass-card p-5" style={{ background: "linear-gradient(135deg, rgba(108,99,255,0.10), rgba(34,211,238,0.06))", borderColor: "rgba(108,99,255,0.18)" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Progreso global</p>
              <p className="text-2xl font-bold gradient-text">{formatCurrency(totalActual, "ARS", true)}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>de {formatCurrency(totalObjetivo, "ARS", true)} meta total</p>
            </div>
            <p className="text-4xl font-bold" style={{ color: getProgressColor(pctGlobal) }}>
              {pctGlobal.toFixed(0)}%
            </p>
          </div>
          <div className="progress-bar h-2">
            <div className="progress-fill" style={{ width: `${pctGlobal}%`, background: `linear-gradient(90deg, #6C63FF, #22D3EE)` }} />
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-5xl mb-4">🎯</p>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>¿Cuál es tu próxima meta?</h3>
          <p className="text-sm max-w-sm mx-auto mb-8" style={{ color: "rgba(255,255,255,0.40)" }}>
            Definí un fondo de emergencia, tus vacaciones soñadas o el auto que querés.
          </p>
          <button onClick={openCreate} className="btn-primary mx-auto">Empezar a ahorrar</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {goals.map(obj => {
            const pct    = Math.min(100, obj.monto_objetivo > 0 ? (obj.saldo_actual / obj.monto_objetivo) * 100 : 0);
            const color  = getProgressColor(pct);
            const status = getProgressStatus(pct);
            const cfg    = STATUS_CONFIG[status];
            const faltan = Math.max(0, obj.monto_objetivo - obj.saldo_actual);

            return (
              <div key={obj.id} className="glass-card p-6 space-y-4" style={{ borderTop: `3px solid ${color}` }}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: `${color}18` }}>
                      {obj.icono || "🎯"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base truncate" style={{ color: "rgba(255,255,255,0.95)" }}>{obj.nombre}</h3>
                      <span className={`badge ${cfg.badge} text-[10px] mt-1`}>{cfg.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setAportarGoal(obj); setAportarMonto(""); setAportarError(null); }}
                      className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold"
                      style={{ background: `${color}22`, color }}
                      title="Agregar aporte"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Aportar
                    </button>
                    <button
                      onClick={() => openEdit(obj)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }}
                      title="Editar objetivo"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.50)" }}>Progreso</span>
                    <span className="text-xl font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="progress-bar h-2.5">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.30)" }}>Tengo</p>
                    <p className="text-sm font-bold text-emerald-400">{formatCurrency(obj.saldo_actual, "ARS", true)}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.30)" }}>Faltan</p>
                    <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.80)" }}>{formatCurrency(faltan, "ARS", true)}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.30)" }}>Meta</p>
                    <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.80)" }}>{formatCurrency(obj.monto_objetivo, "ARS", true)}</p>
                  </div>
                </div>

                {obj.fecha_meta && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>
                    📅 Meta: {new Date(obj.fecha_meta).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear / editar objetivo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md animate-slide-up" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {editingId ? "Editar objetivo" : "Nuevo objetivo de ahorro"}
                </h2>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 flex-shrink-0 ml-2"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.38)" }}>
                {editingId ? "Modificá los datos de tu meta" : "Definí tu próxima meta financiera"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                    ¿Para qué querés ahorrar? *
                  </label>
                  <input type="text" className="input-field"
                    placeholder="Ej: Fondo de Emergencia, Vacaciones 2026..."
                    value={nombre} onChange={e => setNombre(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Monto meta (ARS) *</label>
                    <input type="number" className="input-field" placeholder="0"
                      value={monto} onChange={e => setMonto(e.target.value)}
                      onFocus={e => e.target.select()} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Fecha meta</label>
                    <input type="date" className="input-field"
                      value={fecha} onChange={e => setFecha(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Icono</label>
                    <select className="input-field" value={icono} onChange={e => setIcono(e.target.value)}>
                      {ICONOS.map(i => (
                        <option key={i.value} value={i.value}>{i.value} {i.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Prioridad</label>
                    <select className="input-field" value={prioridad} onChange={e => setPrioridad(e.target.value)}>
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>

                {/* Error message */}
                {formError && (
                  <div className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "#EF4444" }}>No se pudo guardar el objetivo</p>
                    <p className="text-xs" style={{ color: "rgba(239,68,68,0.80)" }}>{formError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary flex-1">
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary flex-1" disabled={loading}>
                    {loading ? "Guardando..." : (editingId ? "Guardar cambios" : "Crear objetivo")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal aportar */}
      {aportarGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm animate-slide-up p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Agregar aporte</h2>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                  {aportarGoal.icono} {aportarGoal.nombre}
                </p>
              </div>
              <button onClick={() => setAportarGoal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="rounded-xl p-3 mb-4 flex items-center justify-between"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>Saldo actual</span>
              <span className="font-mono font-bold text-sm text-emerald-400">
                {formatCurrency(aportarGoal.saldo_actual, "ARS", true)}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                  Monto a aportar (ARS) *
                </label>
                <input
                  className="input-field font-mono text-lg"
                  type="number" min="1" step="1"
                  placeholder="0"
                  value={aportarMonto}
                  onChange={e => setAportarMonto(e.target.value)}
                  onFocus={e => e.target.select()}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                  Sale de la cuenta *
                </label>
                <select
                  className="input-field"
                  value={aportarCuentaId}
                  onChange={e => setAportarCuentaId(e.target.value)}
                  required
                >
                  <option value="">Seleccioná una cuenta</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.icono} {a.nombre}</option>
                  ))}
                </select>
              </div>

              {aportarMonto && parseFloat(aportarMonto) > 0 && (
                <div className="rounded-xl p-3 flex items-center justify-between"
                  style={{ background: "rgba(108,99,255,0.08)", border: "1px solid rgba(108,99,255,0.20)" }}>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Nuevo saldo</span>
                  <span className="font-mono font-bold text-sm" style={{ color: "#A5A0FF" }}>
                    {formatCurrency(Number(aportarGoal.saldo_actual) + parseFloat(aportarMonto), "ARS", true)}
                  </span>
                </div>
              )}

              {aportarError && (
                <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <p className="text-xs" style={{ color: "#EF4444" }}>{aportarError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setAportarGoal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={handleAportar}
                  className="btn-primary flex-1"
                  disabled={loading || !aportarMonto || parseFloat(aportarMonto) <= 0 || !aportarCuentaId}
                >
                  {loading ? "Guardando..." : "✅ Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
