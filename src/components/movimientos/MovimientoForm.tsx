"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMovement } from "@/lib/actions";
import { formatDateToLocalISO } from "@/lib/utils";
import Link from "next/link";

const TIPOS_MOVIMIENTO = [
  { value: "ingreso", label: "Ingreso", icon: "💰", color: "#10B981" },
  { value: "gasto", label: "Gasto", icon: "📤", color: "#EF4444" },
  { value: "transferencia", label: "Transferencia", icon: "↔️", color: "#22D3EE" },
  { value: "aporte_objetivo", label: "Aporte a Objetivo", icon: "🎯", color: "#6C63FF" },
  { value: "retiro_objetivo", label: "Retiro de Objetivo", icon: "📥", color: "#F59E0B" },
  { value: "compra_activo", label: "Compra", icon: "🛒", color: "#7C3AED" },
  { value: "venta_activo", label: "Venta", icon: "💹", color: "#2563EB" },
];

interface MovimientoFormProps {
  accounts: any[];
  categories: any[];
  goals: any[];
}

export default function MovimientoForm({ accounts, categories, goals }: MovimientoFormProps) {
  const router = useRouter();
  const [modo, setModo] = useState<"rapido" | "avanzado">("rapido");
  const [tipo, setTipo] = useState("gasto");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(formatDateToLocalISO(new Date()));
  const [categoriaId, setCategoriaId] = useState("");
  const [cuentaId, setCuentaId] = useState(accounts[0]?.id || "");
  const [cuentaDestinoId, setCuentaDestinoId] = useState("");
  const [objetivoId, setObjetivoId] = useState("");
  const [moneda, setMoneda] = useState("ARS");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const categoriasFiltradas = categories.filter(c => {
    if (tipo === "ingreso") return c.tipo === "ingreso";
    if (tipo === "gasto") return c.tipo === "gasto";
    return true;
  });

  const tipoActual = TIPOS_MOVIMIENTO.find(t => t.value === tipo) ?? TIPOS_MOVIMIENTO[1];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!monto || !cuentaId) return;

    setLoading(true);
    try {
      await createMovement({
        tipo: tipo as any,
        monto: parseFloat(monto),
        moneda,
        fecha,
        descripcion: descripcion || null,
        categoria_id: categoriaId || null,
        cuenta_origen_id: cuentaId || null,
        cuenta_destino_id: cuentaDestinoId || null,
        objetivo_id: objetivoId || null,
        tipo_cambio: null,
        metodo_carga: 'manual'
      });
      setSuccess(true);
      setMonto(""); setDescripcion(""); setTipo("gasto"); setObjetivoId("");
      toast.success("Movimiento registrado");
      setTimeout(() => router.push("/app/movimientos"), 1500);
    } catch (err: any) {
      toast.error("Error al guardar el movimiento");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="glass-card p-12 text-center animate-fade-in">
        <p className="text-4xl mb-4">💳</p>
        <h2 className="text-xl font-bold mb-4" style={{ color: "rgba(255,255,255,0.9)" }}>Necesitás una cuenta</h2>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.45)" }}>
          Para registrar movimientos primero tenés que crear al menos una cuenta (ej: Efectivo, Banco, Mercado Pago).
        </p>
        <Link href="/app/cuentas" className="btn-primary">Crear mi primera cuenta</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64 animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(16,185,129,0.15)", border: "2px solid #10B981" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-xl font-bold mb-1" style={{ color: "rgba(255,255,255,0.9)" }}>¡Movimiento registrado!</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>Actualizando tus finanzas...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/app/movimientos" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors" style={{ color: "rgba(255,255,255,0.5)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          </Link>
          <h1 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Nuevo movimiento</h1>
        </div>
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {(["rapido", "avanzado"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className="px-4 py-2 text-sm font-medium transition-all"
              style={{
                background: modo === m ? "#6C63FF" : "transparent",
                color: modo === m ? "white" : "rgba(255,255,255,0.5)",
              }}
            >
              {m === "rapido" ? "⚡" : "🔧"}
            </button>
          ))}
        </div>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {TIPOS_MOVIMIENTO.slice(0, modo === "rapido" ? 4 : 7).map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTipo(t.value)}
            className="p-3 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1.5"
            style={{
              background: tipo === t.value ? `${t.color}20` : "rgba(255,255,255,0.04)",
              border: tipo === t.value ? `1px solid ${t.color}60` : "1px solid transparent",
              color: tipo === t.value ? t.color : "rgba(255,255,255,0.55)",
            }}
          >
            <span className="text-xl">{t.icon}</span>
            <span className="text-[10px] uppercase tracking-tighter truncate w-full text-center block">{t.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <div className="glass-card p-5 space-y-5">
        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/40">Monto *</label>
          <div className="flex gap-2">
            <select
              className="input-field text-sm font-semibold w-24"
              value={moneda}
              onChange={e => setMoneda(e.target.value)}
            >
              <option value="ARS">$ ARS</option>
              <option value="USD">U$S USD</option>
            </select>
            <input
              type="number"
              className="input-field text-3xl font-bold flex-1"
              placeholder="0.00"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              required
              autoFocus
              style={{ color: tipoActual.color }}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/40">Descripción</label>
          <input
            type="text"
            className="input-field"
            placeholder={tipo === "ingreso" ? "Ej: Sueldo, Venta..." : "¿En qué gastaste?"}
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
          />
        </div>

        {/* Date & Category row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/40">Fecha</label>
            <input
              type="date"
              className="input-field"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/40">Categoría</label>
            <select className="input-field" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
              <option value="">Opcional...</option>
              {categoriasFiltradas.map(c => (
                <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Account Row */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/40">
            {tipo === "transferencia" ? "Cuenta origen" : "Cuenta"}
          </label>
          <select className="input-field" value={cuentaId} onChange={e => setCuentaId(e.target.value)} required>
            {accounts.map(c => (
              <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Transfers or Goals */}
        {tipo === "transferencia" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/40">Cuenta destino</label>
            <select className="input-field" value={cuentaDestinoId} onChange={e => setCuentaDestinoId(e.target.value)} required>
              <option value="">Seleccionar cuenta destino...</option>
              {accounts.filter(c => c.id !== cuentaId).map(c => (
                <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {tipo === "aporte_objetivo" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/40">Objetivo</label>
            <select className="input-field" value={objetivoId} onChange={e => setObjetivoId(e.target.value)} required>
              <option value="">Seleccionar objetivo...</option>
              {goals.map(o => (
                <option key={o.id} value={o.id}>{o.icono} {o.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="btn-primary w-full justify-center py-4 text-lg font-bold rounded-xl shadow-lg shadow-indigo-500/20"
        disabled={loading}
        style={{ background: `linear-gradient(135deg, ${tipoActual.color}, ${tipoActual.color}BB)` }}
      >
        {loading ? "Guardando..." : `Guardar ${tipoActual.label}`}
      </button>
    </form>
  );
}
