"use client";

import { useState, useMemo } from "react";
import { formatCurrency, getProgressColor } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

interface MonthStat {
  mes: string;
  yearMonth?: string;
  ingresos: number;
  gastos: number;
  ahorro: number;
  proyectado?: boolean;
}

function groupByQuarter(data: MonthStat[]): MonthStat[] {
  const map = new Map<string, MonthStat>();
  for (const m of data) {
    if (!m.yearMonth) continue;
    const [yr, mo] = m.yearMonth.split("-").map(Number);
    const q = Math.ceil(mo / 3);
    const key = `${yr}-Q${q}`;
    if (!map.has(key)) {
      map.set(key, { mes: `Q${q}·${yr}`, yearMonth: key, ingresos: 0, gastos: 0, ahorro: 0, proyectado: m.proyectado });
    }
    const e = map.get(key)!;
    e.ingresos += m.ingresos;
    e.gastos   += m.gastos;
    e.ahorro   += m.ahorro;
    if (!m.proyectado) e.proyectado = false;
  }
  return Array.from(map.values());
}

interface DashboardClientProps {
  initialStats: any;
  initialMovements: any[];
  initialGoals: any[];
  initialMonthlyStats: MonthStat[];
  userNombre: string;
}

function KpiCard({
  label, value, color = "#6C63FF", icon, isPercent = false,
}: {
  label: string; value: number; color?: string; icon: string; isPercent?: boolean;
}) {
  const displayValue = isPercent
    ? `${value.toFixed(1)}%`
    : formatCurrency(value, "ARS", true);

  return (
    <div className="kpi-card" style={{ "--accent": color } as React.CSSProperties}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
      <p className="text-2xl font-bold leading-tight" style={{ color: "rgba(255,255,255,0.95)" }}>
        {displayValue}
      </p>
    </div>
  );
}

function CustomTooltip({ active, payload, label, monthStats }: any) {
  if (!active || !payload?.length) return null;
  const isProyectado = monthStats?.find((m: any) => m.mes === label)?.proyectado;
  return (
    <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(20,20,38,0.97)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2 mb-2">
        <p className="font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{label}</p>
        {isProyectado && (
          <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "rgba(108,99,255,0.25)", color: "#A5A0FF" }}>
            Proyectado
          </span>
        )}
      </div>
      {payload.map((p: any) => (
        <p key={p.name} className="font-mono" style={{ color: p.fill }}>
          {p.name === "ingresos" ? "Ingresos" : "Gastos"}:{" "}
          {formatCurrency(p.value, "ARS", true)}
        </p>
      ))}
    </div>
  );
}

const HIST_OPTIONS  = [3, 6, 12, 24] as const;
const FUT_OPTIONS   = [0, 6, 12, 24] as const;
const HIST_LABELS: Record<number, string> = { 3: "3M", 6: "6M", 12: "1A", 24: "2A" };
const FUT_LABELS:  Record<number, string> = { 0: "No", 6: "6M", 12: "1A", 24: "2A" };
type HistRange = typeof HIST_OPTIONS[number];
type FutRange  = typeof FUT_OPTIONS[number];

export default function DashboardClient({
  initialStats, initialMovements, initialGoals, initialMonthlyStats, userNombre,
}: DashboardClientProps) {
  const monthName = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const [histRange,   setHistRange]   = useState<HistRange>(6);
  const [futureRange, setFutureRange] = useState<FutRange>(6);

  const stats = initialStats || { ingresos: 0, gastos: 0, ahorro: 0, tasaAhorro: 0, totalBalance: 0 };
  const hasData = initialMovements.length > 0;
  const tasaAhorro = stats.ingresos > 0 ? ((stats.ingresos - stats.gastos) / stats.ingresos) * 100 : 0;

  const chartData = useMemo(() => {
    const historical = initialMonthlyStats.filter(m => !m.proyectado);
    const projected  = initialMonthlyStats.filter(m => m.proyectado);
    const hist = historical.slice(-histRange);
    const proj = futureRange > 0 ? projected.slice(0, futureRange) : [];
    const combined = [...hist, ...proj];
    return (histRange >= 12 || futureRange >= 12) ? groupByQuarter(combined) : combined;
  }, [histRange, futureRange, initialMonthlyStats]);


  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>
            Hola, {userNombre} 👋
          </h1>
          <p className="text-sm capitalize mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
            {monthName} · Resumen real
          </p>
        </div>
        <Link href="/app/movimientos/nuevo" className="btn-primary hidden sm:flex">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo movimiento
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Ingresos del mes" value={stats.ingresos} color="#10B981" icon="💰" />
        <KpiCard label="Gastos del mes"   value={stats.gastos}   color="#EF4444" icon="📤" />
        <KpiCard label="Ahorro neto"      value={stats.ahorro}   color="#6C63FF" icon="🏦" />
        <KpiCard label="Tasa de ahorro"   value={tasaAhorro}     color="#22D3EE" icon="📈" isPercent />
      </div>

      {/* Balance banner */}
      <div
        className="glass-card p-5 mb-6 flex items-center justify-between gap-4"
        style={{ background: "linear-gradient(135deg, rgba(108,99,255,0.10), rgba(34,211,238,0.06))", borderColor: "rgba(108,99,255,0.2)" }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            Balance total acumulado
          </p>
          <p className="text-3xl font-bold gradient-text">{formatCurrency(stats.totalBalance, "ARS", true)}</p>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wider mb-0.5">Tasa gasto</p>
            <p className="font-bold text-rose-400">
              {stats.ingresos > 0 ? ((stats.gastos / stats.ingresos) * 100).toFixed(1) : 0}%
            </p>
          </div>
          <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wider mb-0.5">Tasa ahorro</p>
            <p className="font-bold text-emerald-400">{tasaAhorro.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="glass-card p-12 text-center my-4">
          <p className="text-5xl mb-4">🚀</p>
          <h2 className="text-xl font-bold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>¡Empezamos con Fluxy!</h2>
          <p className="text-sm max-w-md mx-auto mb-8" style={{ color: "rgba(255,255,255,0.40)" }}>
            Tu base de datos está lista pero todavía no cargaste movimientos.
            Empezá agregando tu sueldo, un gasto o vinculando una cuenta.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/app/cuentas" className="btn-secondary">Configurar mis cuentas</Link>
            <Link href="/app/movimientos/nuevo" className="btn-primary">Cargar mi primer gasto</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Monthly trend chart */}
          {true && (
            <div className="glass-card p-6">
              <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                <h2 className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  Tendencia y proyección
                </h2>
                <div className="flex flex-wrap gap-3 items-center">
                  {/* Historial pills */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.28)" }}>Historial</span>
                    <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
                      {HIST_OPTIONS.map(n => (
                        <button key={n} onClick={() => setHistRange(n)}
                          className="px-2.5 py-1.5 text-xs font-medium transition-all"
                          style={{ background: histRange === n ? "#6C63FF" : "transparent", color: histRange === n ? "white" : "rgba(255,255,255,0.40)" }}>
                          {HIST_LABELS[n]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Futuro pills */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.28)" }}>+ Futuro</span>
                    <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
                      {FUT_OPTIONS.map(n => (
                        <button key={n} onClick={() => setFutureRange(n)}
                          className="px-2.5 py-1.5 text-xs font-medium transition-all"
                          style={{ background: futureRange === n ? "rgba(34,211,238,0.5)" : "transparent", color: futureRange === n ? "white" : "rgba(255,255,255,0.40)" }}>
                          {FUT_LABELS[n]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="mes"
                    interval={chartData.length > 12 ? Math.floor(chartData.length / 8) : 0}
                    tick={({ x, y, payload, index }: any) => (
                      <text x={x} y={y + 12} textAnchor="middle" fontSize={11}
                        fill={chartData[index]?.proyectado ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.38)"}>
                        {payload.value}
                      </text>
                    )}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    width={44}
                  />
                  <Tooltip
                    content={<CustomTooltip monthStats={chartData} />}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="ingresos" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.proyectado ? "rgba(16,185,129,0.32)" : "#10B981"} />
                    ))}
                  </Bar>
                  <Bar dataKey="gastos" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.proyectado ? "rgba(239,68,68,0.32)" : "#EF4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-5 mt-3 justify-center flex-wrap">
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                  <span className="w-3 h-3 rounded-sm" style={{ background: "#10B981" }} /> Ingresos
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                  <span className="w-3 h-3 rounded-sm" style={{ background: "#EF4444" }} /> Gastos
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>
                  <span className="w-3 h-3 rounded-sm" style={{ background: "rgba(255,255,255,0.15)" }} /> Proyectado (fijo)
                </span>
              </div>
            </div>
          )}

          {/* Movimientos + Objetivos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Movimientos recientes */}
            <div className="glass-card p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
                  Movimientos recientes
                </h2>
                <Link href="/app/movimientos" className="text-xs font-medium" style={{ color: "#6C63FF" }}>
                  Ver todos →
                </Link>
              </div>
              <div className="space-y-1">
                {initialMovements.map(m => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 py-3 border-b last:border-0"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>
                        {m.descripcion || "Sin descripción"}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.38)" }}>
                        {m.fecha} · {m.categorias?.nombre || "Otros"}
                      </p>
                    </div>
                    <p className={`font-mono font-bold flex-shrink-0 text-sm ${m.tipo === "ingreso" ? "text-emerald-400" : "text-rose-400"}`}>
                      {m.tipo === "ingreso" ? "+" : "−"}{formatCurrency(m.monto, m.moneda)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Objetivos */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>Mis Objetivos</h2>
                <Link href="/app/objetivos" className="text-xs font-medium" style={{ color: "#6C63FF" }}>
                  Ver todos →
                </Link>
              </div>
              {initialGoals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">🎯</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No tenés objetivos definidos</p>
                  <Link href="/app/objetivos" className="btn-secondary text-xs mt-4 mx-auto">Crear objetivo</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {initialGoals.map(o => {
                    const pct = Math.min(100, o.monto_objetivo > 0 ? (o.saldo_actual / o.monto_objetivo) * 100 : 0);
                    const color = getProgressColor(pct);
                    return (
                      <div key={o.id}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="truncate mr-2" style={{ color: "rgba(255,255,255,0.65)" }}>
                            {o.icono} {o.nombre}
                          </span>
                          <span className="font-bold flex-shrink-0" style={{ color }}>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="progress-bar h-1.5">
                          <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
