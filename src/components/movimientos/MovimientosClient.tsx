"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { updateMovement, deleteMovement } from "@/lib/actions";
import Link from "next/link";

const TIPO_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  ingreso:         { icon: "💰", color: "#10B981", bg: "rgba(16,185,129,0.12)",  label: "Ingreso"    },
  gasto:           { icon: "📤", color: "#EF4444", bg: "rgba(239,68,68,0.12)",   label: "Gasto"      },
  aporte_objetivo: { icon: "🎯", color: "#6C63FF", bg: "rgba(108,99,255,0.12)", label: "Aporte"     },
  transferencia:   { icon: "↔️", color: "#22D3EE", bg: "rgba(34,211,238,0.12)", label: "Transfer."  },
  retiro_objetivo: { icon: "📥", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", label: "Retiro"     },
  compra_activo:   { icon: "🛒", color: "#7C3AED", bg: "rgba(124,58,237,0.12)", label: "Compra"     },
  venta_activo:    { icon: "💹", color: "#2563EB", bg: "rgba(37,99,235,0.12)",  label: "Venta"      },
};

interface MovimientosClientProps {
  initialMovements: any[];
  categories: any[];
}

export default function MovimientosClient({ initialMovements, categories }: MovimientosClientProps) {
  const [movements, setMovements] = useState(initialMovements);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  // Edit state
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]   = useState<string | null>(null);
  const [editTipo, setEditTipo]     = useState("gasto");
  const [editMonto, setEditMonto]   = useState("");
  const [editMoneda, setEditMoneda] = useState("ARS");
  const [editFecha, setEditFecha]   = useState("");
  const [editDesc, setEditDesc]     = useState("");
  const [editCatId, setEditCatId]   = useState<string>("");

  // Delete confirm state
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openEdit(mov: any) {
    setEditingId(mov.id);
    setEditTipo(mov.tipo);
    setEditMonto(String(mov.monto));
    setEditMoneda(mov.moneda || "ARS");
    setEditFecha(mov.fecha);
    setEditDesc(mov.descripcion || "");
    setEditCatId(mov.categoria_id || "");
    setEditError(null);
  }

  function closeEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const updated = await updateMovement(editingId, {
        tipo: editTipo as any,
        monto: parseFloat(editMonto),
        moneda: editMoneda,
        fecha: editFecha,
        descripcion: editDesc,
        categoria_id: editCatId || null,
      });
      setMovements(ms => ms.map(m => m.id === editingId ? { ...m, ...updated } : m));
      closeEdit();
    } catch (err: any) {
      setEditError(err?.message ?? String(err));
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    try {
      await deleteMovement(id);
      setMovements(ms => ms.filter(m => m.id !== id));
      setDeletingId(null);
    } catch (err: any) {
      alert("Error al eliminar: " + (err?.message ?? err));
    } finally {
      setDeleteLoading(false);
    }
  }

  const filtered = movements.filter(m => {
    if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
    if (busqueda && !m.descripcion?.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  const totalIngresos = filtered.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const totalGastos   = filtered.filter(m => m.tipo === "gasto").reduce((s, m) => s + Number(m.monto), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Movimientos</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/app/movimientos/nuevo" className="btn-primary text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.38)" }}>Ingresos</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(totalIngresos, "ARS", true)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.38)" }}>Gastos</p>
          <p className="text-xl font-bold text-rose-400">{formatCurrency(totalGastos, "ARS", true)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            className="input-field pl-10"
            placeholder="Buscar por descripción..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "rgba(255,255,255,0.25)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <select className="input-field sm:w-48" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos los tipos</option>
          <option value="ingreso">Ingresos</option>
          <option value="gasto">Gastos</option>
          <option value="transferencia">Transferencias</option>
          <option value="aporte_objetivo">Aportes a objetivos</option>
          <option value="retiro_objetivo">Retiros de objetivos</option>
        </select>
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-4xl mb-4">🏜️</p>
            <p className="font-medium mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              {busqueda || filtroTipo !== "todos" ? "Sin resultados para ese filtro." : "Sin movimientos aún."}
            </p>
            {!busqueda && filtroTipo === "todos" && (
              <Link href="/app/movimientos/nuevo" className="btn-primary mx-auto mt-4 text-sm">
                Registrar primer movimiento
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                  <th style={{ width: 72 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(mov => {
                  const cfg = TIPO_CONFIG[mov.tipo] || TIPO_CONFIG.gasto;
                  const isDeleting = deletingId === mov.id;
                  return (
                    <tr key={mov.id} className="group">
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                            style={{ background: cfg.bg }}>
                            {cfg.icon}
                          </span>
                          <span className="text-xs font-semibold hidden sm:inline" style={{ color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                      </td>
                      <td className="text-xs font-mono whitespace-nowrap" style={{ color: "rgba(255,255,255,0.38)" }}>
                        {mov.fecha}
                      </td>
                      <td style={{ maxWidth: "220px" }}>
                        <span className="block truncate text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                          {mov.descripcion || "—"}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-muted text-[10px] uppercase tracking-wide">
                          {mov.categorias?.nombre || "Otros"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`font-mono font-bold text-sm ${mov.tipo === "ingreso" ? "text-emerald-400" : "text-rose-400"}`}>
                          {mov.tipo === "ingreso" ? "+" : "−"}{formatCurrency(mov.monto, mov.moneda)}
                        </span>
                      </td>
                      <td>
                        {isDeleting ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(mov.id)}
                              disabled={deleteLoading}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold"
                              style={{ background: "rgba(239,68,68,0.20)", color: "#EF4444" }}
                              title="Confirmar eliminación"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-xs"
                              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}
                              title="Cancelar"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(mov)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg"
                              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
                              title="Editar"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeletingId(mov.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg"
                              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(239,68,68,0.55)" }}
                              title="Eliminar"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm animate-slide-up">
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Editar movimiento</h2>
                <button onClick={closeEdit}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
                  style={{ color: "rgba(255,255,255,0.35)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Tipo</label>
                  <select className="input-field" value={editTipo} onChange={e => setEditTipo(e.target.value)}>
                    <option value="ingreso">Ingreso</option>
                    <option value="gasto">Gasto</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="aporte_objetivo">Aporte a objetivo</option>
                    <option value="retiro_objetivo">Retiro de objetivo</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Monto *</label>
                    <input className="input-field" type="number" step="0.01" min="0" required
                      value={editMonto} onChange={e => setEditMonto(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Moneda</label>
                    <select className="input-field" value={editMoneda} onChange={e => setEditMoneda(e.target.value)}>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Fecha *</label>
                  <input className="input-field" type="date" required
                    value={editFecha} onChange={e => setEditFecha(e.target.value)} />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Descripción</label>
                  <input className="input-field" type="text" placeholder="Ej: Supermercado, Sueldo..."
                    value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Categoría</label>
                  <select className="input-field" value={editCatId} onChange={e => setEditCatId(e.target.value)}>
                    <option value="">Sin categoría</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
                    ))}
                  </select>
                </div>

                {editError && (
                  <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <p className="text-xs" style={{ color: "#EF4444" }}>{editError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeEdit} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={editLoading}>
                    {editLoading ? "Guardando..." : "Guardar"}
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
