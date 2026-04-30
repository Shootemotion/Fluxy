"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { updateMovement, updateMovementsCategoryBulk, createCategory } from "@/lib/actions";

const EMOJIS = ["🛒","🚗","🏠","🍔","💊","🎬","✈️","📱","💻","👕","🎓","⚕️","🐾","💡","💧","🔥","💳","💰","🎁","🚌","☕","🍺","💪","🎮"];

interface Props {
  movements: any[];
  categories: any[];
}

function findSimilarIds(current: any, rest: any[]): string[] {
  if (!current?.descripcion) return [];
  const noise = /\b(compra|pago|debito|credito|transferencia|envio|cobro|comision|en|de|a|la|el|con|tarjeta|visa|master)\b/gi;
  const clean = current.descripcion.toLowerCase().replace(noise, "").replace(/\s+/g, " ").trim();
  const key = clean.split(/\s+/).slice(0, 3).join(" ");
  if (!key || key.length < 4) return [];
  return rest.filter(m => m.descripcion?.toLowerCase().includes(key)).map(m => m.id);
}

export default function PulirClient({ movements: initial, categories: initialCats }: Props) {
  const [movements, setMovements] = useState(initial);
  const [categories, setCategories] = useState(initialCats);
  const [applyToSimilar, setApplyToSimilar] = useState(true);
  const [loading, setLoading] = useState(false);

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🛒");
  const [newCatLoading, setNewCatLoading] = useState(false);

  const total = initial.length;
  const current = movements[0];
  const done = movements.length === 0;

  const similarIds = useMemo(() => findSimilarIds(current, movements.slice(1)), [current, movements]);

  const catGastos  = categories.filter((c: any) => c.tipo === "gasto");
  const catIngresos = categories.filter((c: any) => c.tipo === "ingreso");
  const relevantCats = current?.tipo === "ingreso" ? catIngresos : catGastos;

  async function assign(categoriaId: string) {
    if (!current || loading) return;
    setLoading(true);
    const idsToUpdate = [current.id, ...(applyToSimilar ? similarIds : [])];
    // Optimistic remove
    setMovements(prev => prev.filter(m => !idsToUpdate.includes(m.id)));
    try {
      if (idsToUpdate.length === 1) {
        await updateMovement(current.id, { categoria_id: categoriaId });
      } else {
        await updateMovementsCategoryBulk(idsToUpdate, categoriaId);
      }
      toast.success(
        idsToUpdate.length > 1
          ? `✅ ${idsToUpdate.length} movimientos categorizados`
          : "✅ Categorizado"
      );
    } catch (e: any) {
      toast.error(e.message);
      // Rollback
      setMovements(prev => [current, ...prev]);
    } finally {
      setLoading(false);
    }
  }

  function skip() {
    setMovements(prev => [...prev.slice(1), prev[0]]);
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    setNewCatLoading(true);
    try {
      const newCat = await createCategory({
        nombre: newCatName,
        tipo: current.tipo as "ingreso" | "gasto",
        icono: newCatIcon,
        color: "#6C63FF",
        activa: true,
        orden: 100,
      });
      setCategories(prev => [...prev, newCat]);
      setShowNewCat(false);
      setNewCatName("");
      setNewCatIcon("🛒");
      await assign(newCat.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setNewCatLoading(false);
    }
  }

  // ── Done state ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 animate-fade-in">
        <div className="text-7xl mb-5">🎉</div>
        <p className="text-2xl font-bold mb-2" style={{ color: "rgba(255,255,255,0.92)" }}>¡Todo prolijo!</p>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
          No quedan movimientos sin categoría. El dashboard y los reportes están al día.
        </p>
        <div className="flex gap-3 justify-center">
          <a href="/app/movimientos" className="btn-secondary" style={{ padding: "10px 20px" }}>Ver Movimientos</a>
          <a href="/app/dashboard" className="btn-primary" style={{ padding: "10px 20px" }}>Ir al Dashboard</a>
        </div>
      </div>
    );
  }

  const progress = total > 0 ? ((total - movements.length) / total) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">

      {/* Progress */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
            Progreso
          </span>
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>
            {movements.length} restantes de {total}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #6C63FF, #22D3EE)" }}
          />
        </div>
      </div>

      {/* Movement card */}
      <div className="glass-card p-6 animate-slide-up" key={current.id}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
              {current.fecha}
            </span>
            {current.cuentas?.nombre && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }}>
                {current.cuentas.nombre}
              </span>
            )}
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${current.tipo === "ingreso" ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"}`}>
            {current.tipo === "ingreso" ? "Ingreso" : "Gasto"}
          </span>
        </div>

        <p className="text-base font-medium leading-snug mb-4" style={{ color: "rgba(255,255,255,0.88)" }}>
          {current.descripcion || <span style={{ color: "rgba(255,255,255,0.3)" }}>(sin descripción)</span>}
        </p>

        <div className="flex items-end justify-between">
          <span className={`text-3xl font-bold font-mono ${current.tipo === "ingreso" ? "text-emerald-400" : "text-rose-400"}`}>
            {current.tipo === "ingreso" ? "+" : "-"}${Math.abs(current.monto).toLocaleString("es-AR")}
            <span className="text-sm font-normal ml-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {current.moneda || "ARS"}
            </span>
          </span>
          {applyToSimilar && similarIds.length > 0 && (
            <span className="text-xs text-right" style={{ color: "rgba(255,255,255,0.3)" }}>
              +{similarIds.length} similar{similarIds.length > 1 ? "es" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Apply to similar */}
      {similarIds.length > 0 && (
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={applyToSimilar}
            onChange={e => setApplyToSimilar(e.target.checked)}
            className="w-4 h-4 rounded accent-[#6C63FF]"
          />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            Aplicar también a {similarIds.length} movimiento{similarIds.length > 1 ? "s" : ""} con descripción similar
          </span>
        </label>
      )}

      {/* Category grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          Elegí una categoría
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {relevantCats.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => assign(cat.id)}
              disabled={loading}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:scale-[1.04] active:scale-95 disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span className="text-2xl">{cat.icono || "🏷️"}</span>
              <span className="text-[10px] text-center leading-tight line-clamp-2" style={{ color: "rgba(255,255,255,0.65)" }}>
                {cat.nombre}
              </span>
            </button>
          ))}

          {/* Nueva categoría */}
          <button
            onClick={() => setShowNewCat(true)}
            disabled={loading}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:scale-[1.04] active:scale-95 disabled:opacity-50"
            style={{
              background: "rgba(108,99,255,0.06)",
              border: "1px dashed rgba(108,99,255,0.35)",
            }}
          >
            <span className="text-2xl" style={{ color: "rgba(108,99,255,0.8)" }}>+</span>
            <span className="text-[10px] text-center" style={{ color: "rgba(108,99,255,0.7)" }}>Nueva</span>
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-between items-center pt-1">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          Podés saltar y volver más tarde
        </span>
        <button
          onClick={skip}
          disabled={loading}
          className="text-sm px-4 py-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Saltar →
        </button>
      </div>

      {/* New category modal */}
      {showNewCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm p-6 animate-slide-up">
            <h2 className="text-xl font-bold mb-1" style={{ color: "rgba(255,255,255,0.9)" }}>Nueva Categoría</h2>
            <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
              Se creará como categoría de tipo <b>{current.tipo}</b> y se asignará al movimiento actual.
            </p>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Nombre</label>
                <input
                  className="input-field"
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Suscripciones"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Ícono</label>
                <div className="grid grid-cols-6 gap-2">
                  {EMOJIS.map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNewCatIcon(em)}
                      className={`text-xl p-2 rounded-lg flex items-center justify-center transition-colors ${newCatIcon === em ? "bg-[#6C63FF]/30 border border-[#6C63FF]" : "bg-black/20 hover:bg-black/40 border border-transparent"}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewCat(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={newCatLoading}
                >
                  {newCatLoading ? "Guardando..." : "Crear y asignar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
