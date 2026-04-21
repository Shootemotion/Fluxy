"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { createAccount, updateAccount } from "@/lib/actions";

interface CuentasClientProps {
  initialAccounts: any[];
}

const ACCOUNT_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  banco:        { icon: "🏦", color: "#6C63FF", label: "Banco" },
  efectivo:     { icon: "💵", color: "#10B981", label: "Efectivo" },
  billetera:    { icon: "📱", color: "#22D3EE", label: "Billetera digital" },
  broker:       { icon: "📊", color: "#F59E0B", label: "Broker" },
  caja_ahorro:  { icon: "🐷", color: "#EC4899", label: "Caja de ahorro" },
  inversiones:  { icon: "📈", color: "#7C3AED", label: "Inversiones" },
  otro:         { icon: "💳", color: "#6B7280", label: "Otro" },
};

export default function CuentasClient({ initialAccounts }: CuentasClientProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [nombre,       setNombre]       = useState("");
  const [tipo,         setTipo]         = useState("banco");
  const [moneda,       setMoneda]       = useState("ARS");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [color,        setColor]        = useState("#6C63FF");
  const [icono,        setIcono]        = useState("🏦");
  const [cbu,          setCbu]          = useState("");
  const [alias,        setAlias]        = useState("");

  const showBankFields = ["banco", "caja_ahorro", "billetera"].includes(tipo);

  function resetForm() {
    setNombre(""); setSaldoInicial(""); setTipo("banco");
    setMoneda("ARS"); setColor("#6C63FF"); setIcono("🏦");
    setCbu(""); setAlias(""); setEditingId(null); setFormError(null);
  }

  function openCreate() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(cuenta: any) {
    setNombre(cuenta.nombre);
    setTipo(cuenta.tipo);
    setMoneda(cuenta.moneda);
    setSaldoInicial(String(cuenta.saldo_inicial ?? "0"));
    setColor(cuenta.color || ACCOUNT_TYPE_CONFIG[cuenta.tipo]?.color || "#6C63FF");
    setIcono(cuenta.icono || ACCOUNT_TYPE_CONFIG[cuenta.tipo]?.icon || "💳");
    setCbu(cuenta.cbu || "");
    setAlias(cuenta.alias || "");
    setEditingId(cuenta.id);
    setFormError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    try {
      const payload: any = {
        nombre,
        tipo: tipo as any,
        moneda,
        saldo_inicial: parseFloat(saldoInicial || "0"),
        color,
        icono,
        cbu:   cbu.trim()   || null,
        alias: alias.trim() || null,
      };

      if (editingId) {
        const updated = await updateAccount(editingId, payload);
        setAccounts(accounts.map(a => a.id === editingId ? { ...a, ...updated } : a));
      } else {
        const newAcc = await createAccount({ ...payload, activa: true, orden: accounts.length });
        setAccounts([...accounts, newAcc]);
      }
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      // Translate common Supabase errors to friendly messages
      if (msg.includes("cbu") || msg.includes("alias")) {
        setFormError("Error en CBU o Alias. Si acabás de agregar esos campos, ejecutá la migración en Supabase primero.");
      } else if (msg.includes("orden")) {
        setFormError("Error: la columna 'orden' no existe en la tabla. Revisá la migración.");
      } else if (msg.includes("monedas")) {
        setFormError(`Moneda no soportada: seleccioná ARS o USD.`);
      } else {
        setFormError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const totalARS = accounts.reduce((s, a) => a.moneda === "ARS" ? s + Number(a.saldo_inicial) : s, 0);
  const totalUSD = accounts.reduce((s, a) => a.moneda === "USD" ? s + Number(a.saldo_inicial) : s, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Mis Cuentas</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
            {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""} registrada{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">+ Nueva cuenta</button>
      </div>

      {/* Patrimonio consolidado */}
      <div className="glass-card p-5" style={{ background: "linear-gradient(135deg, rgba(108,99,255,0.10), rgba(34,211,238,0.06))", borderColor: "rgba(108,99,255,0.18)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
          Patrimonio consolidado
        </p>
        <div className="flex flex-wrap items-baseline gap-4">
          <p className="text-3xl font-bold gradient-text">{formatCurrency(totalARS, "ARS", true)}</p>
          {totalUSD > 0 && (
            <p className="text-xl font-medium text-emerald-400">
              + U$S {totalUSD.toLocaleString("es-AR")}
            </p>
          )}
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-5xl mb-4">💳</p>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>
            No tenés cuentas registradas
          </h3>
          <p className="text-sm max-w-sm mx-auto mb-8" style={{ color: "rgba(255,255,255,0.40)" }}>
            Agregá tus bancos, billeteras digitales u otros activos para llevar el control de tu patrimonio.
          </p>
          <button onClick={openCreate} className="btn-primary mx-auto">
            Agregar mi primera cuenta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(cuenta => {
            const cfg = ACCOUNT_TYPE_CONFIG[cuenta.tipo] || ACCOUNT_TYPE_CONFIG.otro;
            return (
              <div key={cuenta.id} className="glass-card p-5 relative group">
                {/* Edit button */}
                <button
                  onClick={() => openEdit(cuenta)}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.50)" }}
                  title="Editar cuenta"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${cuenta.color || cfg.color}18`, border: `1px solid ${cuenta.color || cfg.color}30` }}
                  >
                    {cuenta.icono || cfg.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "rgba(255,255,255,0.92)" }}>
                      {cuenta.nombre}
                    </p>
                    <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {cfg.label}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.28)" }}>
                    Saldo
                  </p>
                  <p className="text-xl font-bold" style={{ color: cuenta.moneda === "USD" ? "#84CC16" : "rgba(255,255,255,0.95)" }}>
                    {cuenta.moneda === "USD"
                      ? `U$S ${Number(cuenta.saldo_inicial).toLocaleString("es-AR")}`
                      : formatCurrency(cuenta.saldo_inicial, "ARS", true)}
                  </p>
                  {(cuenta.alias || cuenta.cbu) && (
                    <p className="text-xs mt-1.5 truncate font-mono" style={{ color: "rgba(255,255,255,0.30)" }}>
                      {cuenta.alias ? `✦ ${cuenta.alias}` : cuenta.cbu}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear / editar cuenta */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md animate-slide-up" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {editingId ? "Editar cuenta" : "Nueva cuenta"}
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
                {editingId ? "Modificá los datos de tu cuenta" : "Registrá un banco, billetera o caja de efectivo"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                    Nombre de la cuenta *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej: Galicia Sueldo, Mercado Pago, Efectivo..."
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Tipo</label>
                    <select
                      className="input-field"
                      value={tipo}
                      onChange={e => {
                        const t = e.target.value;
                        setTipo(t);
                        setIcono(ACCOUNT_TYPE_CONFIG[t]?.icon || "💳");
                        setColor(ACCOUNT_TYPE_CONFIG[t]?.color || "#6C63FF");
                      }}
                    >
                      {Object.entries(ACCOUNT_TYPE_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
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

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                    Saldo {editingId ? "actual" : "inicial"}
                  </label>
                  <input
                    type="number"
                    className="input-field font-mono"
                    placeholder="0"
                    value={saldoInicial}
                    onChange={e => setSaldoInicial(e.target.value)}
                    onFocus={e => e.target.select()}
                    min="0"
                  />
                </div>

                {/* CBU / Alias — solo para cuentas bancarias */}
                {showBankFields && (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs font-semibold uppercase" style={{ color: "rgba(255,255,255,0.28)" }}>
                      Datos bancarios <span className="normal-case font-normal">(opcional)</span>
                    </p>
                    <div>
                      <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                        CBU
                      </label>
                      <input
                        type="text"
                        className="input-field font-mono text-sm"
                        placeholder="22 dígitos"
                        value={cbu}
                        onChange={e => setCbu(e.target.value.replace(/\D/g, "").slice(0, 22))}
                        maxLength={22}
                      />
                      {cbu.length > 0 && cbu.length !== 22 && (
                        <p className="text-xs mt-1" style={{ color: "#F59E0B" }}>
                          El CBU debe tener exactamente 22 dígitos ({cbu.length}/22)
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                        Alias
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ej: PERRO.CINE.MATE"
                        value={alias}
                        onChange={e => setAlias(e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>
                )}

                {/* Error message */}
                {formError && (
                  <div className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: "#EF4444" }}>No se pudo guardar la cuenta</p>
                    <p className="text-xs" style={{ color: "rgba(239,68,68,0.80)" }}>{formError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary flex-1" disabled={loading}>
                    {loading ? (editingId ? "Guardando..." : "Creando...") : (editingId ? "Guardar cambios" : "Crear cuenta")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
