"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart,
} from "recharts";
import { getMovementsForReport } from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";

type ReportMovement = {
  id: string;
  fecha: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  moneda: string;
  descripcion: string | null;
  categorias: { nombre: string; icono: string | null; color: string } | null;
  cuenta_origen: { nombre: string; icono: string | null } | null;
};

type Period = "30d" | "90d" | "6m" | "1y" | "ytd" | "custom";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "30d",    label: "30 días" },
  { value: "90d",    label: "3 meses" },
  { value: "6m",     label: "6 meses" },
  { value: "1y",     label: "12 meses" },
  { value: "ytd",    label: "Este año" },
  { value: "custom", label: "Personalizado" },
];

const CAT_COLORS = [
  "#6C63FF", "#22D3EE", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#3B82F6", "#14B8A6", "#F97316",
];

function getPeriodDates(period: Period, customFrom?: string, customTo?: string): { start: string; end: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());

  switch (period) {
    case "30d":    return { start: fmt(addDays(today, -30)), end: fmt(today) };
    case "90d":    return { start: fmt(addDays(today, -90)), end: fmt(today) };
    case "6m":     return { start: fmt(addMonths(today, -6)), end: fmt(today) };
    case "1y":     return { start: fmt(addMonths(today, -12)), end: fmt(today) };
    case "ytd":    return { start: `${today.getFullYear()}-01-01`, end: fmt(today) };
    case "custom": return { start: customFrom || fmt(addMonths(today, -1)), end: customTo || fmt(today) };
  }
}

function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

interface Props {
  initialMovements: ReportMovement[];
  initialPeriod: Period;
  initialStart: string;
  initialEnd: string;
}

export default function ReportesClient({ initialMovements, initialPeriod, initialStart, initialEnd }: Props) {
  const [period, setPeriod]           = useState<Period>(initialPeriod);
  const [customFrom, setCustomFrom]   = useState(initialStart);
  const [customTo, setCustomTo]       = useState(initialEnd);
  const [movements, setMovements]     = useState<ReportMovement[]>(initialMovements);
  const [loading, setLoading]         = useState(false);

  const loadData = useCallback(async (p: Period, from?: string, to?: string) => {
    const { start, end } = getPeriodDates(p, from, to);
    setLoading(true);
    try {
      const data = await getMovementsForReport(start, end);
      setMovements(data as ReportMovement[]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handlePeriod(p: Period) {
    setPeriod(p);
    if (p !== "custom") loadData(p);
  }

  function handleCustomApply() {
    loadData("custom", customFrom, customTo);
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const { ingresos, gastos, ahorro, tasaAhorro } = useMemo(() => {
    const ingresos = movements.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
    const gastos   = movements.filter(m => m.tipo === "gasto").reduce((s, m) => s + Number(m.monto), 0);
    const ahorro   = ingresos - gastos;
    const tasaAhorro = ingresos > 0 ? (ahorro / ingresos) * 100 : 0;
    return { ingresos, gastos, ahorro, tasaAhorro };
  }, [movements]);

  // ── Monthly evolution ─────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<string, { mes: string; yearMonth: string; ingresos: number; gastos: number }> = {};
    for (const m of movements) {
      const key = m.fecha.substring(0, 7);
      if (!map[key]) {
        const d = new Date(key + "-15");
        map[key] = {
          yearMonth: key,
          mes: d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
          ingresos: 0,
          gastos: 0,
        };
      }
      if (m.tipo === "ingreso") map[key].ingresos += Number(m.monto);
      if (m.tipo === "gasto")   map[key].gastos   += Number(m.monto);
    }
    return Object.values(map)
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
      .map(r => ({ ...r, ahorro: r.ingresos - r.gastos }));
  }, [movements]);

  // ── Category breakdown ────────────────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map: Record<string, { nombre: string; icono: string; color: string; total: number; count: number }> = {};
    for (const m of movements.filter(mv => mv.tipo === "gasto")) {
      const cat = m.categorias;
      const key = cat?.nombre || "Sin categoría";
      if (!map[key]) map[key] = { nombre: key, icono: cat?.icono || "📂", color: cat?.color || "#6C63FF", total: 0, count: 0 };
      map[key].total += Number(m.monto);
      map[key].count++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [movements]);

  const pieData = useMemo(() => {
    const top6 = categoryData.slice(0, 6);
    const rest = categoryData.slice(6);
    const otroTotal = rest.reduce((s, c) => s + c.total, 0);
    const items = top6.map((c, i) => ({ ...c, fill: CAT_COLORS[i] }));
    if (otroTotal > 0) items.push({ nombre: "Otros", icono: "📦", color: "#6B7280", total: otroTotal, count: 0, fill: "#6B7280" });
    return items;
  }, [categoryData]);

  // ── Top expenses ──────────────────────────────────────────────────────────
  const topGastos = useMemo(() =>
    movements.filter(m => m.tipo === "gasto").slice(0, 15),
    [movements]
  );

  // ── CSV export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const header = "Fecha,Tipo,Monto,Moneda,Categoría,Cuenta,Descripción";
    const rows = movements.map(m =>
      [
        m.fecha, m.tipo, m.monto, m.moneda,
        m.categorias?.nombre || "",
        m.cuenta_origen?.nombre || "",
        `"${(m.descripcion || "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isEmpty = movements.length === 0;

  return (
    <div className="space-y-6">
      {/* Period selector + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.value}
              onClick={() => handlePeriod(p.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: period === p.value ? "#6C63FF" : "rgba(255,255,255,0.06)",
                color: period === p.value ? "white" : "rgba(255,255,255,0.55)",
                border: period === p.value ? "1px solid #6C63FF" : "1px solid transparent",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          disabled={isEmpty}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: "rgba(16,185,129,0.12)",
            color: "#10B981",
            border: "1px solid rgba(16,185,129,0.3)",
            opacity: isEmpty ? 0.4 : 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="glass-card p-4 flex flex-wrap items-end gap-3 animate-fade-in">
          <div>
            <label className="block text-xs text-white/40 mb-1.5 font-semibold uppercase tracking-wider">Desde</label>
            <input type="date" className="input-field text-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5 font-semibold uppercase tracking-wider">Hasta</label>
            <input type="date" className="input-field text-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
          <button onClick={handleCustomApply} className="btn-primary px-4 py-2 text-sm">Aplicar</button>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && isEmpty && (
        <div className="glass-card p-12 text-center">
          <p className="text-3xl mb-3">📊</p>
          <p className="font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Sin datos para el período</p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Registrá movimientos para ver tus reportes</p>
        </div>
      )}

      {!loading && !isEmpty && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Ingresos" value={ingresos} color="#10B981" icon="💰" />
            <KpiCard label="Gastos" value={gastos} color="#EF4444" icon="📤" />
            <KpiCard
              label="Ahorro neto"
              value={ahorro}
              color={ahorro >= 0 ? "#10B981" : "#EF4444"}
              icon={ahorro >= 0 ? "✅" : "⚠️"}
            />
            <KpiCard
              label="Tasa de ahorro"
              value={tasaAhorro}
              color={tasaAhorro >= 20 ? "#10B981" : tasaAhorro >= 0 ? "#F59E0B" : "#EF4444"}
              icon="📈"
              isPercent
            />
          </div>

          {/* Monthly evolution chart */}
          {monthlyData.length > 1 && (
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: "rgba(255,255,255,0.75)" }}>
                Evolución mensual
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="mes" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip
                    contentStyle={{ background: "#1E1B3A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 4 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: any, name: string) => [
                      formatCurrency(Number(value ?? 0), "ARS"),
                      name === "ingresos" ? "Ingresos" : name === "gastos" ? "Gastos" : "Ahorro",
                    ]) as any}
                  />
                  <Legend
                    formatter={(value) => value === "ingresos" ? "Ingresos" : value === "gastos" ? "Gastos" : "Ahorro"}
                    wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}
                  />
                  <Bar dataKey="ingresos" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={36} fillOpacity={0.85} />
                  <Bar dataKey="gastos"   fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={36} fillOpacity={0.85} />
                  <Line type="monotone" dataKey="ahorro" stroke="#6C63FF" strokeWidth={2} dot={{ r: 3, fill: "#6C63FF" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category breakdown + Top expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut + legend */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: "rgba(255,255,255,0.75)" }}>
                Gastos por categoría
              </h2>
              {pieData.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>Sin gastos en el período</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="total"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#1E1B3A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={((value: any, _: string, props: any) => [
                          formatCurrency(Number(value ?? 0), "ARS"),
                          props.payload.nombre,
                        ]) as any}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {pieData.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.fill }} />
                          <span style={{ color: "rgba(255,255,255,0.6)" }}>{c.icono} {c.nombre}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {gastos > 0 ? ((c.total / gastos) * 100).toFixed(1) : "0"}%
                          </span>
                          <span className="font-semibold text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
                            {formatCurrency(c.total, "ARS")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category bar chart */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: "rgba(255,255,255,0.75)" }}>
                Top categorías de gasto
              </h2>
              {categoryData.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>Sin gastos en el período</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={categoryData.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtShort} tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={90}
                      tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1E1B3A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                      formatter={((value: any) => [formatCurrency(Number(value ?? 0), "ARS"), "Total"]) as any}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {categoryData.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top expenses table */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "rgba(255,255,255,0.75)" }}>
              Mayores gastos del período
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Fecha", "Descripción", "Categoría", "Cuenta", "Monto"].map(h => (
                      <th key={h} className="text-left pb-2 px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topGastos.map(m => (
                    <tr
                      key={m.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 px-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {new Date(m.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="py-2.5 px-2 max-w-[200px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                        <span className="block truncate">{m.descripcion || "—"}</span>
                      </td>
                      <td className="py-2.5 px-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {m.categorias ? `${m.categorias.icono || ""} ${m.categorias.nombre}` : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {m.cuenta_origen?.nombre || "—"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-xs" style={{ color: "#EF4444" }}>
                        {formatCurrency(Number(m.monto), m.moneda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary stats footer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill label="Movimientos" value={movements.length.toString()} />
            <StatPill label="Categorías únicas" value={categoryData.length.toString()} />
            <StatPill label="Promedio diario" value={formatCurrency(gastos / Math.max(getDaySpan(movements), 1), "ARS")} />
            <StatPill label="Mayor gasto" value={formatCurrency(Math.max(0, ...movements.filter(m => m.tipo === "gasto").map(m => Number(m.monto))), "ARS")} />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, icon, isPercent }: { label: string; value: number; color: string; icon: string; isPercent?: boolean }) {
  return (
    <div className="glass-card p-4" style={{ borderLeft: `3px solid ${color}40` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.38)" }}>{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <p className="text-xl font-bold leading-none" style={{ color }}>
        {isPercent
          ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
          : formatCurrency(value, "ARS")}
      </p>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card px-4 py-3 flex items-center justify-between gap-2">
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>{value}</span>
    </div>
  );
}

function getDaySpan(movements: ReportMovement[]): number {
  if (movements.length === 0) return 1;
  const dates = movements.map(m => new Date(m.fecha).getTime());
  return Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86_400_000) + 1);
}
