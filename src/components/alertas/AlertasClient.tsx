"use client";

import { useState, useTransition } from "react";
import {
  marcarAlertaLeida, marcarTodasLeidas,
  createAlertRule, updateAlertRule, deleteAlertRule,
  evaluateAlertRules,
} from "@/lib/actions";

const TIPO_ICON: Record<string, string> = {
  warning: "⚠️", danger: "🔴", success: "✅", info: "💡",
};
const TIPO_COLOR: Record<string, string> = {
  warning: "#F59E0B", danger: "#EF4444", success: "#10B981", info: "#6C63FF",
};

const RULE_TYPES = [
  { value: "gasto_total",      label: "Gasto total del mes",         needsCuenta: false, needsCat: false, needsGoal: false },
  { value: "ingreso_total",    label: "Ingreso total del mes",        needsCuenta: false, needsCat: false, needsGoal: false },
  { value: "gasto_categoria",  label: "Gasto en una categoría",       needsCuenta: false, needsCat: true,  needsGoal: false },
  { value: "saldo_cuenta",     label: "Saldo de una cuenta",          needsCuenta: true,  needsCat: false, needsGoal: false },
  { value: "objetivo_progreso",label: "Progreso de un objetivo (%)",  needsCuenta: false, needsCat: false, needsGoal: true  },
];

const OPERATORS = [
  { value: ">",  label: "es mayor que" },
  { value: ">=", label: "es mayor o igual que" },
  { value: "<",  label: "es menor que" },
  { value: "<=", label: "es menor o igual que" },
];

interface Props {
  initialAlertas: any[];
  initialRules: any[];
  accounts: any[];
  categories: any[];
  goals: any[];
}

export default function AlertasClient({ initialAlertas, initialRules, accounts, categories, goals }: Props) {
  const [tab, setTab] = useState<"notificaciones" | "reglas">("notificaciones");
  const [alertas, setAlertas] = useState(initialAlertas);
  const [rules, setRules] = useState(initialRules);
  const [isPending, startTransition] = useTransition();

  // Rule form state
  const [showForm, setShowForm]         = useState(false);
  const [formNombre, setFormNombre]     = useState("");
  const [formTipo, setFormTipo]         = useState("gasto_total");
  const [formOp, setFormOp]             = useState(">");
  const [formValor, setFormValor]       = useState("");
  const [formCuenta, setFormCuenta]     = useState("");
  const [formCat, setFormCat]           = useState("");
  const [formGoal, setFormGoal]         = useState("");
  const [formLoading, setFormLoading]   = useState(false);
  const [formError, setFormError]       = useState("");

  const noLeidas = alertas.filter(a => !a.leida).length;
  const selectedType = RULE_TYPES.find(t => t.value === formTipo);

  function resetForm() {
    setFormNombre(""); setFormTipo("gasto_total"); setFormOp(">"); setFormValor("");
    setFormCuenta(""); setFormCat(""); setFormGoal(""); setFormError("");
  }

  async function handleMarkRead(id: string) {
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a));
    startTransition(() => marcarAlertaLeida(id));
  }

  async function handleMarkAllRead() {
    setAlertas(prev => prev.map(a => ({ ...a, leida: true })));
    startTransition(() => marcarTodasLeidas());
  }

  async function handleEvaluate() {
    startTransition(async () => {
      const count = await evaluateAlertRules();
      if (count > 0) window.location.reload();
    });
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    if (!formNombre.trim() || !formValor) return;
    if (selectedType?.needsCuenta && !formCuenta) { setFormError("Seleccioná una cuenta"); return; }
    if (selectedType?.needsCat    && !formCat)    { setFormError("Seleccioná una categoría"); return; }
    if (selectedType?.needsGoal   && !formGoal)   { setFormError("Seleccioná un objetivo"); return; }

    setFormLoading(true); setFormError("");
    try {
      const newRule = await createAlertRule({
        nombre:       formNombre.trim(),
        tipo:         formTipo,
        operador:     formOp,
        valor:        parseFloat(formValor),
        cuenta_id:    formCuenta   || null,
        categoria_id: formCat      || null,
        objetivo_id:  formGoal     || null,
      });
      setRules(prev => [...prev, newRule]);
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggleRule(id: string, activa: boolean) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, activa } : r));
    startTransition(() => updateAlertRule(id, { activa }));
  }

  async function handleDeleteRule(id: string) {
    if (!confirm("¿Eliminar esta regla?")) return;
    setRules(prev => prev.filter(r => r.id !== id));
    startTransition(() => deleteAlertRule(id));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Alertas</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
            Notificaciones y reglas personalizadas
          </p>
        </div>
        <button
          onClick={handleEvaluate}
          disabled={isPending}
          className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl"
          style={{ background: "rgba(108,99,255,0.15)", color: "#A5A0FF" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={isPending ? "animate-spin" : ""}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Evaluar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
        {(["notificaciones", "reglas"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-semibold rounded-lg capitalize transition-all relative"
            style={tab === t
              ? { background: "rgba(108,99,255,0.25)", color: "#A5A0FF" }
              : { color: "rgba(255,255,255,0.40)" }}>
            {t === "notificaciones" ? "Notificaciones" : "Mis Reglas"}
            {t === "notificaciones" && noLeidas > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: "#EF4444", color: "white" }}>
                {noLeidas}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Notificaciones ── */}
      {tab === "notificaciones" && (
        <div className="space-y-3">
          {noLeidas > 0 && (
            <div className="flex justify-end">
              <button onClick={handleMarkAllRead}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}>
                Marcar todo leído
              </button>
            </div>
          )}

          {alertas.length === 0 ? (
            <div className="glass-card p-14 text-center">
              <p className="text-4xl mb-3">🔔</p>
              <p className="font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Sin notificaciones</p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                Configurá reglas y presioná "Evaluar" para generar alertas
              </p>
            </div>
          ) : (
            alertas.map(alerta => {
              const color = TIPO_COLOR[alerta.tipo] ?? TIPO_COLOR.info;
              const icon  = TIPO_ICON[alerta.tipo]  ?? TIPO_ICON.info;
              return (
                <div key={alerta.id}
                  className="glass-card p-4 flex items-start gap-3 transition-opacity"
                  style={{ opacity: alerta.leida ? 0.45 : 1 }}>
                  <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
                        {alerta.alert_rules?.nombre ?? "Alerta"}
                      </span>
                      {!alerta.leida && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      )}
                    </div>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.80)" }}>{alerta.mensaje}</p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.28)" }}>
                      {new Date(alerta.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {!alerta.leida && (
                    <button onClick={() => handleMarkRead(alerta.id)}
                      className="text-xs flex-shrink-0 px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}>
                      ✓
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB: Reglas ── */}
      {tab === "reglas" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="btn-primary text-sm">
              + Nueva regla
            </button>
          </div>

          {rules.length === 0 && !showForm && (
            <div className="glass-card p-14 text-center">
              <p className="text-4xl mb-3">⚡</p>
              <p className="font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Sin reglas configuradas</p>
              <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
                Creá condiciones automáticas: si el saldo baja de X, si gastás más de Y en una categoría, etc.
              </p>
            </div>
          )}

          {/* Rule list */}
          {rules.map(rule => {
            const typeLabel = RULE_TYPES.find(t => t.value === rule.tipo)?.label ?? rule.tipo;
            const opLabel   = OPERATORS.find(o => o.value === rule.operador)?.label ?? rule.operador;
            const ref = rule.cuentas?.nombre || rule.categorias?.nombre || rule.objetivos?.nombre;
            return (
              <div key={rule.id} className="glass-card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>
                      {rule.nombre}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "rgba(108,99,255,0.15)", color: "#A5A0FF" }}>
                      {typeLabel}
                    </span>
                    {!rule.activa && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                        Pausada
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                    {typeLabel} {opLabel} {rule.tipo === "objetivo_progreso" ? `${rule.valor}%` : `$${Number(rule.valor).toLocaleString("es-AR")}`}
                    {ref ? ` · ${ref}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle */}
                  <button onClick={() => handleToggleRule(rule.id, !rule.activa)}
                    className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0 overflow-hidden"
                    style={{ background: rule.activa ? "rgba(108,99,255,0.6)" : "rgba(255,255,255,0.12)" }}>
                    <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                      style={{ left: rule.activa ? "22px" : "2px" }} />
                  </button>
                  {/* Delete */}
                  <button onClick={() => handleDeleteRule(rule.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{ color: "rgba(239,68,68,0.6)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {/* New rule form */}
          {showForm && (
            <div className="glass-card p-5 space-y-4">
              <h3 className="font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>Nueva regla</h3>
              <form onSubmit={handleCreateRule} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                    Nombre de la regla
                  </label>
                  <input className="input-field" placeholder="Ej: Alerta gasto alto en restaurantes"
                    value={formNombre} onChange={e => setFormNombre(e.target.value)} required autoFocus />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                      Tipo de condición
                    </label>
                    <select className="input-field" value={formTipo} onChange={e => { setFormTipo(e.target.value); setFormCuenta(""); setFormCat(""); setFormGoal(""); }}>
                      {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                      Operador
                    </label>
                    <select className="input-field" value={formOp} onChange={e => setFormOp(e.target.value)}>
                      {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                    {formTipo === "objetivo_progreso" ? "Porcentaje (%)" : "Monto ($)"}
                  </label>
                  <input className="input-field font-mono" type="number" min="0" step="any"
                    placeholder={formTipo === "objetivo_progreso" ? "Ej: 80" : "Ej: 50000"}
                    value={formValor} onChange={e => setFormValor(e.target.value)} required />
                </div>

                {selectedType?.needsCuenta && (
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Cuenta</label>
                    <select className="input-field" value={formCuenta} onChange={e => setFormCuenta(e.target.value)} required>
                      <option value="">Seleccioná una cuenta...</option>
                      {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                )}
                {selectedType?.needsCat && (
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Categoría</label>
                    <select className="input-field" value={formCat} onChange={e => setFormCat(e.target.value)} required>
                      <option value="">Seleccioná una categoría...</option>
                      {categories.filter((c: any) => c.tipo === "gasto").map((c: any) => (
                        <option key={c.id} value={c.id}>{c.icono ? `${c.icono} ` : ""}{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedType?.needsGoal && (
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Objetivo</label>
                    <select className="input-field" value={formGoal} onChange={e => setFormGoal(e.target.value)} required>
                      <option value="">Seleccioná un objetivo...</option>
                      {goals.map((g: any) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </div>
                )}

                {/* Preview sentence */}
                {formValor && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(108,99,255,0.10)", border: "1px solid rgba(108,99,255,0.20)", color: "rgba(255,255,255,0.70)" }}>
                    🔔 Alertar cuando <strong style={{ color: "#A5A0FF" }}>
                      {RULE_TYPES.find(t => t.value === formTipo)?.label}
                    </strong> {OPERATORS.find(o => o.value === formOp)?.label} <strong style={{ color: "#A5A0FF" }}>
                      {formTipo === "objetivo_progreso" ? `${formValor}%` : `$${Number(formValor).toLocaleString("es-AR")}`}
                    </strong>
                    {(formCuenta || formCat || formGoal) && (
                      <> en <strong style={{ color: "#A5A0FF" }}>
                        {accounts.find((a: any) => a.id === formCuenta)?.nombre ||
                         categories.find((c: any) => c.id === formCat)?.nombre ||
                         goals.find((g: any) => g.id === formGoal)?.nombre}
                      </strong></>
                    )}
                  </div>
                )}

                {formError && <p className="text-xs" style={{ color: "#EF4444" }}>{formError}</p>}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                    className="btn-secondary flex-1 text-sm">Cancelar</button>
                  <button type="submit" className="btn-primary flex-1 text-sm" disabled={formLoading}>
                    {formLoading ? "Guardando..." : "Crear regla"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
