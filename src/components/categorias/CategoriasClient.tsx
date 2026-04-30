"use client";

import { useState } from "react";
import { createCategory, updateCategory } from "@/lib/actions";
import { toast } from "sonner";

const TIPO_LABELS: Record<string, string> = {
  gasto:         "Gastos",
  ingreso:       "Ingresos",
  transferencia: "Transferencias",
  objetivo:      "Objetivos",
};

const EMOJI_OPCIONES = [
  "🏠","🚗","🛒","🍔","🍕","☕","🍷","💊","🏋️","👕",
  "👟","✈️","🏖️","🎬","🎮","📱","💻","📺","📚","🎓",
  "💼","💰","💸","💳","🏦","📊","🎯","🎁","🔧","🔌",
  "💡","🎵","⚽","🐶","🌱","🚿","🏥","🍼","🐱","🎪",
];

const COLOR_PRESETS = [
  "#6C63FF", "#10B981", "#EF4444", "#F59E0B", "#22D3EE",
  "#EC4899", "#7C3AED", "#F97316", "#84CC16", "#6B7280",
];

interface CategoriasClientProps {
  initialCategories: any[];
}

export default function CategoriasClient({ initialCategories }: CategoriasClientProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [showModal, setShowModal]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [formError, setFormError]   = useState<string | null>(null);

  const [nombre,  setNombre]  = useState("");
  const [tipo,    setTipo]    = useState("gasto");
  const [icono,   setIcono]   = useState("📦");
  const [color,   setColor]   = useState("#6C63FF");

  function resetForm() {
    setNombre(""); setTipo("gasto"); setIcono("📦"); setColor("#6C63FF");
    setEditingId(null); setFormError(null);
  }

  function openCreate() { resetForm(); setShowModal(true); }

  function openEdit(cat: any) {
    setNombre(cat.nombre);
    setTipo(cat.tipo);
    setIcono(cat.icono || "📦");
    setColor(cat.color || "#6C63FF");
    setEditingId(cat.id);
    setFormError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setFormError(null);
    try {
      const payload = { nombre, tipo: tipo as any, icono, color, activa: true, orden: 99 };
      if (editingId) {
        const updated = await updateCategory(editingId, { nombre, icono, color });
        setCategories(cats => cats.map(c => c.id === editingId ? { ...c, ...updated } : c));
      } else {
        const newCat = await createCategory(payload);
        setCategories(cats => [...cats, newCat]);
      }
      setShowModal(false); resetForm();
      toast.success("Categoría guardada");
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  async function toggleActiva(cat: any) {
    try {
      const updated = await updateCategory(cat.id, { activa: !cat.activa });
      setCategories(cats => cats.map(c => c.id === cat.id ? { ...c, ...updated } : c));
      toast.success(updated.activa ? "Categoría activada" : "Categoría desactivada");
    } catch (err: any) {
      toast.error("Error: " + (err?.message ?? err));
    }
  }

  const grouped = Object.entries(TIPO_LABELS).map(([tipo, label]) => ({
    tipo, label,
    items: categories.filter((c: any) => c.tipo === tipo),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Categorías</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
            {categories.filter((c: any) => !c.es_sistema).length} propias · {categories.filter((c: any) => c.es_sistema).length} del sistema
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">+ Nueva categoría</button>
      </div>

      {grouped.map(({ tipo, label, items }) => (
        <div key={tipo} className="glass-card overflow-hidden">
          <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{label}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }}>
              {items.length}
            </span>
          </div>
          <div>
            {items.map((cat: any, idx: number) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 px-5 py-3 group"
                style={{ borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.04)" : "none", opacity: cat.activa ? 1 : 0.45 }}
              >
                {/* Color dot + icon */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: `${cat.color || "#6C63FF"}22`, border: `1px solid ${cat.color || "#6C63FF"}44` }}
                >
                  {cat.icono || "📦"}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.88)" }}>
                    {cat.nombre}
                  </p>
                  {cat.es_sistema && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.30)" }}>
                      sistema
                    </span>
                  )}
                </div>

                {/* Actions — solo para categorías propias */}
                {!cat.es_sistema && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(cat)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)" }}
                      title="Editar"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleActiva(cat)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{ background: "rgba(255,255,255,0.06)", color: cat.activa ? "#EF4444" : "#10B981" }}
                      title={cat.activa ? "Desactivar" : "Activar"}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        {cat.activa
                          ? <path d="M18 6 6 18M6 6l12 12"/>
                          : <polyline points="20 6 9 17 4 12"/>
                        }
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {categories.length === 0 && (
        <div className="glass-card p-16 text-center">
          <p className="text-4xl mb-4">🏷️</p>
          <p className="font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>No hay categorías todavía</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm animate-slide-up">
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {editingId ? "Editar categoría" : "Nueva categoría"}
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
                  <input className="input-field" type="text" placeholder="Ej: Alimentación, Transporte..."
                    value={nombre} onChange={e => setNombre(e.target.value)} required />
                </div>

                {!editingId && (
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Tipo</label>
                    <select className="input-field" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {Object.entries(TIPO_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Icono</label>
                  <div className="grid grid-cols-10 gap-1 p-2 rounded-xl mb-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                    {EMOJI_OPCIONES.map(e => (
                      <button key={e} type="button" onClick={() => setIcono(e)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all hover:scale-110"
                        style={{ background: icono === e ? "rgba(108,99,255,0.30)" : "transparent", outline: icono === e ? "1px solid #6C63FF" : "none" }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <input className="input-field text-sm" type="text" maxLength={4} placeholder="O escribí tu propio emoji..."
                    value={icono} onChange={e => setIcono(e.target.value)} />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map(c => (
                      <button key={c} type="button" onClick={() => setColor(c)}
                        className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                        style={{ background: c, outline: color === c ? `2px solid white` : "none", outlineOffset: 2 }}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                    style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
                    {icono}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.88)" }}>{nombre || "Nombre..."}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{TIPO_LABELS[tipo]}</p>
                  </div>
                </div>

                {formError && (
                  <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <p className="text-xs" style={{ color: "#EF4444" }}>{formError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
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
    </div>
  );
}
