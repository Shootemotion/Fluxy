"use client";

import { useState, useMemo, useEffect } from "react";
import { formatCurrency, formatDateToLocalISO } from "@/lib/utils";
import { updateMovement, deleteMovement, getMovements } from "@/lib/actions";
import Link from "next/link";
import { toast } from "sonner";

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
  totalMovements?: number;
  pageSize?: number;
  categories: any[];
  accounts: any[];
}

export default function MovimientosClient({
  initialMovements,
  totalMovements,
  pageSize = 500,
  categories,
  accounts,
}: MovimientosClientProps) {
  const [movements, setMovements] = useState(initialMovements);

  // The server only sends the first page; filters and search below run over
  // what has been loaded, so older movements need to be pulled in explicitly.
  const [loadingMore, setLoadingMore] = useState(false);
  const total = totalMovements ?? initialMovements.length;
  const hasMore = movements.length < total;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await getMovements(pageSize, movements.length);
      if (next.length === 0) return;
      // Guard against duplicates if a movement was added since the first load.
      setMovements(prev => {
        const seen = new Set(prev.map((m: any) => m.id));
        return [...prev, ...next.filter((m: any) => !seen.has(m.id))];
      });
    } catch (err: any) {
      toast.error("No se pudieron cargar más movimientos");
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }

  // Filters
  const [filtroTipo, setFiltroTipo]           = useState("todos");
  const [busqueda, setBusqueda]               = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroCuenta, setFiltroCuenta]       = useState("todas");
  const [filtroMoneda, setFiltroMoneda]       = useState("todas");
  const [filtroDesde, setFiltroDesde]         = useState("");
  const [filtroHasta, setFiltroHasta]         = useState("");
  const [ordenarPor, setOrdenarPor]           = useState("fecha_desc");
  const [agruparPor, setAgruparPor]           = useState("ninguna");
  const [showFilters, setShowFilters]         = useState(false);

  // Edit state
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]     = useState<string | null>(null);
  const [editTipo, setEditTipo]       = useState("gasto");
  const [editMonto, setEditMonto]     = useState("");
  const [editMoneda, setEditMoneda]   = useState("ARS");
  const [editFecha, setEditFecha]     = useState("");
  const [editDesc, setEditDesc]       = useState("");
  const [editCatId, setEditCatId]     = useState<string>("");

  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage]     = useState(1);
  const itemsPerPage = 50;

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

  function closeEdit() { setEditingId(null); setEditError(null); }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditLoading(true); setEditError(null);
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
      toast.success("Movimiento actualizado");
    } catch (err: any) {
      setEditError(err?.message ?? String(err));
      toast.error("Error al guardar");
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
      toast.success("Movimiento eliminado");
    } catch (err: any) {
      toast.error("Error al eliminar: " + (err?.message ?? err));
    } finally {
      setDeleteLoading(false);
    }
  }

  function clearFilters() {
    setFiltroTipo("todos"); setBusqueda(""); setFiltroCategoria("todas");
    setFiltroCuenta("todas"); setFiltroMoneda("todas");
    setFiltroDesde(""); setFiltroHasta("");
  }

  const activeFilterCount = [
    filtroTipo !== "todos", busqueda, filtroCategoria !== "todas",
    filtroCuenta !== "todas", filtroMoneda !== "todas", filtroDesde, filtroHasta,
  ].filter(Boolean).length;

  const filteredAndSorted = useMemo(() => {
    const result = movements.filter(m => {
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
      if (filtroCategoria !== "todas" && m.categoria_id !== filtroCategoria) return false;
      if (filtroCuenta !== "todas" && m.cuenta_origen_id !== filtroCuenta) return false;
      if (filtroMoneda !== "todas" && m.moneda !== filtroMoneda) return false;
      if (busqueda && !m.descripcion?.toLowerCase().includes(busqueda.toLowerCase())) return false;
      if (filtroDesde && m.fecha < filtroDesde) return false;
      if (filtroHasta && m.fecha > filtroHasta) return false;
      return true;
    });

    result.sort((a, b) => {
      switch (ordenarPor) {
        case "fecha_asc":  return a.fecha.localeCompare(b.fecha);
        case "fecha_desc": return b.fecha.localeCompare(a.fecha);
        case "monto_asc":  return Number(a.monto) - Number(b.monto);
        case "monto_desc": return Number(b.monto) - Number(a.monto);
        case "desc_asc":   return (a.descripcion || "").localeCompare(b.descripcion || "");
        default: return 0;
      }
    });
    return result;
  }, [movements, filtroTipo, filtroCategoria, filtroCuenta, filtroMoneda, busqueda, filtroDesde, filtroHasta, ordenarPor]);

  // Reset page when filters change. This is a side effect, so it belongs in
  // useEffect — a useMemo body may be re-run or skipped by React at will.
  useEffect(() => { setCurrentPage(1); },
    [filtroTipo, filtroCategoria, filtroCuenta, filtroMoneda, busqueda, filtroDesde, filtroHasta, ordenarPor, agruparPor]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / itemsPerPage));
  const paginated  = useMemo(() => filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredAndSorted, currentPage]);

  // Totals separated by currency
  const totals = useMemo(() => {
    const map: Record<string, { ingresos: number; gastos: number }> = {};
    for (const m of filteredAndSorted) {
      if (m.tipo !== "ingreso" && m.tipo !== "gasto") continue;
      const cur = m.moneda || "ARS";
      if (!map[cur]) map[cur] = { ingresos: 0, gastos: 0 };
      if (m.tipo === "ingreso") map[cur].ingresos += Number(m.monto);
      if (m.tipo === "gasto")   map[cur].gastos   += Number(m.monto);
    }
    return map;
  }, [filteredAndSorted]);

  const groupedMovements = useMemo(() => {
    if (agruparPor === "ninguna") return null;
    const groups: Record<string, { label: string; items: any[]; ing: number; gas: number }> = {};
    filteredAndSorted.forEach(m => {
      const d = new Date(m.fecha + "T00:00:00");
      const year = d.getFullYear(), month = d.getMonth(), day = d.getDate();
      const monthStr = d.toLocaleString("es-ES", { month: "long" });
      let key = "", label = "";
      if (agruparPor === "mensual") {
        key = `${year}-${month}`; label = `${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} ${year}`;
      } else if (agruparPor === "quincenal") {
        const q = day <= 15 ? 1 : 2; key = `${year}-${month}-q${q}`; label = `${q}º Quincena - ${monthStr} ${year}`;
      } else {
        const dec = day <= 10 ? 1 : day <= 20 ? 2 : 3;
        key = `${year}-${month}-d${dec}`; label = `Días ${dec === 1 ? "1-10" : dec === 2 ? "11-20" : "21+"} - ${monthStr} ${year}`;
      }
      if (!groups[key]) groups[key] = { label, items: [], ing: 0, gas: 0 };
      groups[key].items.push(m);
      if (m.tipo === "ingreso") groups[key].ing += Number(m.monto);
      if (m.tipo === "gasto")   groups[key].gas += Number(m.monto);
    });
    return Object.values(groups);
  }, [filteredAndSorted, agruparPor]);

  function exportCSV() {
    const header = "Fecha,Tipo,Monto,Moneda,Categoría,Cuenta,Descripción";
    const rows = filteredAndSorted.map(m =>
      [m.fecha, m.tipo, m.monto, m.moneda || "ARS",
       m.categorias?.nombre || "",
       accounts.find((a: any) => a.id === m.cuenta_origen_id)?.nombre || "",
       `"${(m.descripcion || "").replace(/"/g, '""')}"`].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos_${formatDateToLocalISO(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Versión en tarjeta para pantallas chicas.
   *
   * La tabla tiene seis columnas y en un teléfono obliga a scrollear de
   * costado para ver el monto. Además sus botones de editar y borrar sólo
   * aparecen con :hover, que en una pantalla táctil no existe — acá están
   * siempre visibles.
   */
  const renderMovimientoCard = (mov: any) => {
    const cfg = TIPO_CONFIG[mov.tipo] || TIPO_CONFIG.gasto;
    const isDeleting = deletingId === mov.id;
    const esIngreso = mov.tipo === "ingreso";

    return (
      <div key={mov.id} className="px-4 py-3 border-b last:border-b-0" style={{ borderColor: "var(--bd-faint)" }}>
        <div className="flex items-start gap-3">
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 mt-0.5"
            style={{ background: cfg.bg }}
          >
            {cfg.icon}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug break-words" style={{ color: "var(--fg-1)" }}>
              {mov.descripcion || "—"}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
              <span className="text-[11px] font-mono" style={{ color: "var(--fg-5)" }}>{mov.fecha}</span>
              <span style={{ color: "var(--fg-7)" }}>·</span>
              <span className="badge badge-muted text-[10px] uppercase tracking-wide">
                {mov.categorias?.nombre || "Otros"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`font-mono font-bold text-sm whitespace-nowrap ${esIngreso ? "text-emerald-400" : "text-rose-400"}`}>
              {esIngreso ? "+" : "−"}{formatCurrency(mov.monto, mov.moneda || "ARS")}
            </span>

            {isDeleting ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => handleDelete(mov.id)} disabled={deleteLoading}
                  aria-label="Confirmar borrado"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold"
                  style={{ background: "rgba(239,68,68,0.20)", color: "#EF4444" }}>✓</button>
                <button onClick={() => setDeletingId(null)} aria-label="Cancelar"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-sm"
                  style={{ background: "var(--bg-hover)", color: "var(--fg-5)" }}>✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(mov)} aria-label="Editar movimiento"
                  className="w-9 h-9 flex items-center justify-center rounded-lg"
                  style={{ background: "var(--bg-hover)", color: "var(--fg-4)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                </button>
                <button onClick={() => setDeletingId(mov.id)} aria-label="Eliminar movimiento"
                  className="w-9 h-9 flex items-center justify-center rounded-lg"
                  style={{ background: "var(--bg-hover)", color: "var(--fg-4)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMovimientoRow = (mov: any) => {
    const cfg = TIPO_CONFIG[mov.tipo] || TIPO_CONFIG.gasto;
    const isDeleting = deletingId === mov.id;
    return (
      <tr key={mov.id} className="group">
        <td>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: cfg.bg }}>
              {cfg.icon}
            </span>
            <span className="text-xs font-semibold hidden sm:inline" style={{ color: cfg.color }}>{cfg.label}</span>
          </div>
        </td>
        <td className="text-xs font-mono whitespace-nowrap" style={{ color: "var(--fg-5)" }}>{mov.fecha}</td>
        <td style={{ maxWidth: "220px" }}>
          <span className="block truncate text-sm font-medium" style={{ color: "var(--fg-1)" }}>
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
            {mov.tipo === "ingreso" ? "+" : "−"}{formatCurrency(mov.monto, mov.moneda || "ARS")}
          </span>
        </td>
        <td>
          {isDeleting ? (
            <div className="flex items-center gap-1">
              <button onClick={() => handleDelete(mov.id)} disabled={deleteLoading}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold"
                style={{ background: "rgba(239,68,68,0.20)", color: "#EF4444" }}>✓</button>
              <button onClick={() => setDeletingId(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-xs"
                style={{ background: "var(--bg-hover)", color: "var(--fg-5)" }}>✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(mov)}
                className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ background: "var(--bg-hover)", color: "var(--fg-5)" }} title="Editar">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </button>
              <button onClick={() => setDeletingId(mov.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ background: "var(--bg-hover)", color: "var(--fg-5)" }} title="Eliminar">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--fg-hi)" }}>Movimientos</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--fg-5)" }}>
            {filteredAndSorted.length} registro{filteredAndSorted.length !== 1 ? "s" : ""}
            {activeFilterCount > 0 && <span className="ml-1.5 text-indigo-400">({activeFilterCount} filtro{activeFilterCount !== 1 ? "s" : ""})</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={filteredAndSorted.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)", opacity: filteredAndSorted.length === 0 ? 0.4 : 1 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            CSV
          </button>
          <Link href="/app/movimientos/nuevo" className="btn-primary text-sm flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nuevo
          </Link>
        </div>
      </div>

      {/* Totals by currency */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(totals).flatMap(([cur, t]) => [
          t.ingresos > 0 && (
            <div key={`ing-${cur}`} className="glass-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-6)" }}>
                Ingresos {cur !== "ARS" ? cur : ""}
              </p>
              <p className="text-lg font-bold text-emerald-400">{formatCurrency(t.ingresos, cur, true)}</p>
            </div>
          ),
          t.gastos > 0 && (
            <div key={`gas-${cur}`} className="glass-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-6)" }}>
                Gastos {cur !== "ARS" ? cur : ""}
              </p>
              <p className="text-lg font-bold text-rose-400">{formatCurrency(t.gastos, cur, true)}</p>
            </div>
          ),
        ]).filter(Boolean)}
        {Object.keys(totals).length === 0 && (
          <>
            <div className="glass-card p-4"><p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-6)" }}>Ingresos</p><p className="text-lg font-bold text-emerald-400">$0</p></div>
            <div className="glass-card p-4"><p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-6)" }}>Gastos</p><p className="text-lg font-bold text-rose-400">$0</p></div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 space-y-3">
        {/* Search + toggle */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input type="text" className="input-field pl-10" placeholder="Buscar por descripción..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--fg-7)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-shrink-0"
            style={{ background: showFilters ? "rgba(108,99,255,0.20)" : "var(--bg-hover)", color: showFilters ? "#A5A0FF" : "var(--fg-4)", border: showFilters ? "1px solid rgba(108,99,255,0.35)" : "1px solid transparent" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filtros{activeFilterCount > 0 && <span className="ml-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold" style={{ background: "#6C63FF", color: "white" }}>{activeFilterCount}</span>}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="px-3 py-2 rounded-lg text-xs transition-all flex-shrink-0"
              style={{ background: "rgba(239,68,68,0.10)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.20)" }}>
              Limpiar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="space-y-3 pt-1 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <select className="input-field text-sm" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                <option value="todos">Todos los tipos</option>
                <option value="ingreso">Ingresos</option>
                <option value="gasto">Gastos</option>
                <option value="transferencia">Transferencias</option>
                <option value="aporte_objetivo">Aportes objetivos</option>
                <option value="retiro_objetivo">Retiros objetivos</option>
              </select>
              <select className="input-field text-sm" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                <option value="todas">Todas las categorías</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select className="input-field text-sm" value={filtroCuenta} onChange={e => setFiltroCuenta(e.target.value)}>
                <option value="todas">Todas las cuentas</option>
                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.icono} {a.nombre}</option>)}
              </select>
              <select className="input-field text-sm" value={filtroMoneda} onChange={e => setFiltroMoneda(e.target.value)}>
                <option value="todas">Todas las monedas</option>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--fg-6)" }}>Desde</label>
                <input type="date" className="input-field text-sm" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--fg-6)" }}>Hasta</label>
                <input type="date" className="input-field text-sm" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select className="input-field text-sm" value={ordenarPor} onChange={e => setOrdenarPor(e.target.value)}>
                <option value="fecha_desc">Recientes primero</option>
                <option value="fecha_asc">Antiguos primero</option>
                <option value="monto_desc">Mayor monto</option>
                <option value="monto_asc">Menor monto</option>
                <option value="desc_asc">Descripción (A-Z)</option>
              </select>
              <select className="input-field text-sm" value={agruparPor} onChange={e => setAgruparPor(e.target.value)}>
                <option value="ninguna">Sin agrupar</option>
                <option value="decenal">Por 10 días</option>
                <option value="quincenal">Por 15 días</option>
                <option value="mensual">Por mes</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-6">
        {filteredAndSorted.length === 0 ? (
          <div className="glass-card py-20 text-center">
            <p className="text-4xl mb-4">🏜️</p>
            <p className="font-medium mb-1" style={{ color: "var(--fg-4)" }}>
              {activeFilterCount > 0 ? "Sin resultados para esos filtros." : "Sin movimientos aún."}
            </p>
            {activeFilterCount === 0 && (
              <Link href="/app/movimientos/nuevo" className="btn-primary mx-auto mt-4 text-sm inline-flex">
                Registrar primer movimiento
              </Link>
            )}
          </div>
        ) : groupedMovements ? (
          groupedMovements.map((group, idx) => (
            <div key={idx} className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ borderColor: "var(--bd-faint)", background: "rgba(0,0,0,0.1)" }}>
                <span className="font-semibold" style={{ color: "var(--fg-1)" }}>{group.label}</span>
                <div className="flex gap-3 text-xs font-mono">
                  {group.ing > 0 && <span className="text-emerald-400">+{formatCurrency(group.ing, "ARS")}</span>}
                  {group.gas > 0 && <span className="text-rose-400">-{formatCurrency(group.gas, "ARS")}</span>}
                </div>
              </div>
              <div className="lg:hidden">
                {group.items.map(mov => renderMovimientoCard(mov))}
              </div>
              <div className="hidden lg:block overflow-x-auto">
                <table className="data-table">
                  <tbody>{group.items.map(mov => renderMovimientoRow(mov))}</tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="lg:hidden">
              {paginated.map(mov => renderMovimientoCard(mov))}
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tipo</th><th>Fecha</th><th>Descripción</th>
                    <th>Categoría</th><th style={{ textAlign: "right" }}>Monto</th><th style={{ width: 72 }}></th>
                  </tr>
                </thead>
                <tbody>{paginated.map(mov => renderMovimientoRow(mov))}</tbody>
              </table>
            </div>
            <div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "var(--bd-faint)" }}>
                  <span className="text-xs" style={{ color: "var(--fg-4)" }}>
                    {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredAndSorted.length)} de {filteredAndSorted.length}
                    {hasMore && ` · ${movements.length} de ${total} cargados`}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="px-3 py-1 text-xs rounded-md"
                      style={{ background: "var(--bg-input)", opacity: currentPage === 1 ? 0.3 : 1 }}>
                      Anterior
                    </button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="px-3 py-1 text-xs rounded-md"
                      style={{ background: "var(--bg-input)", opacity: currentPage === totalPages ? 0.3 : 1 }}>
                      Siguiente
                    </button>
                    {hasMore && (
                      <button onClick={loadMore} disabled={loadingMore}
                        className="px-3 py-1 text-xs rounded-md disabled:opacity-40"
                        style={{ background: "var(--bg-hover)", color: "var(--primary)" }}>
                        {loadingMore ? "Cargando..." : "Cargar más"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card modal-panel w-full max-w-sm animate-slide-up">
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <h2 className="text-xl font-bold" style={{ color: "var(--fg-1)" }}>Editar movimiento</h2>
                <button onClick={closeEdit} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
                  style={{ color: "var(--fg-6)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--fg-5)" }}>Tipo</label>
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
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--fg-5)" }}>Monto *</label>
                    <input className="input-field" type="number" step="0.01" min="0" required
                      value={editMonto} onChange={e => setEditMonto(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--fg-5)" }}>Moneda</label>
                    <select className="input-field" value={editMoneda} onChange={e => setEditMoneda(e.target.value)}>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--fg-5)" }}>Fecha *</label>
                  <input className="input-field" type="date" required value={editFecha} onChange={e => setEditFecha(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--fg-5)" }}>Descripción</label>
                  <input className="input-field" type="text" placeholder="Ej: Supermercado, Sueldo..."
                    value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--fg-5)" }}>Categoría</label>
                  <select className="input-field" value={editCatId} onChange={e => setEditCatId(e.target.value)}>
                    <option value="">Sin categoría</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
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
