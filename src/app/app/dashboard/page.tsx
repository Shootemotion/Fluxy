import { getDashboardStats, getMovements, getGoals, getMonthlyStats, getRecurrentes, getPasivos } from "@/lib/actions";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MESES_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function parseLocal(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [stats, movements, goals, monthlyStats, recurrentes, pasivos] = await Promise.all([
    getDashboardStats(),
    getMovements(5),
    getGoals(),
    getMonthlyStats(24),
    getRecurrentes(),
    getPasivos(),
  ]);

  // Build projected months (next 24)
  const now = new Date();
  const projected = Array.from({ length: 24 }, (_, i) => {
    // Current projected month
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + i + 2, 0);

    // Filter active recurrentes for this specific month
    const activeGastos = recurrentes.filter((r: any) => {
      if (!r.activo || r.tipo !== "gasto" || r.moneda !== "ARS") return false;
      const start = parseLocal(r.fecha_inicio);
      const end = parseLocal(r.fecha_fin);
      if (start && endOfMonth < start) return false;
      if (end && d > end) return false;
      if (r.es_cuotas && r.cuotas_totales) {
        // If it's cuotas, check if this month is within the total cuotas
        const startMonth = start!.getFullYear() * 12 + start!.getMonth();
        const currentMonth = d.getFullYear() * 12 + d.getMonth();
        if (currentMonth >= startMonth + r.cuotas_totales) return false;
      }
      return true;
    }).reduce((s: number, r: any) => s + Number(r.monto), 0);

    const activeIngresos = recurrentes.filter((r: any) => {
      if (!r.activo || r.tipo === "gasto" || r.moneda !== "ARS") return false; // assuming only 'ingreso' remains
      const start = parseLocal(r.fecha_inicio);
      const end = parseLocal(r.fecha_fin);
      if (start && endOfMonth < start) return false;
      if (end && d > end) return false;
      return true;
    }).reduce((s: number, r: any) => s + Number(r.monto), 0);

    // Pasivos (Loans) usually have cuota_mensual and cuotas_totales, but we don't track start date perfectly here without more data.
    // For now, we keep pasivosFixed constant or attempt to check if they are paid off.
    // We will just use the active pasivos that have saldo > 0.
    const pasivosFixed = pasivos
      .filter((p: any) => p.moneda === "ARS" && (p.saldo === undefined || p.saldo > 0))
      .reduce((s: number, p: any) => s + (Number(p.cuota_mensual) || 0), 0);

    const monthlyFixedGastos = activeGastos + pasivosFixed;

    return {
      mes:       MESES_SHORT[d.getMonth()],
      yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      ingresos:  activeIngresos,
      gastos:    monthlyFixedGastos,
      ahorro:    activeIngresos - monthlyFixedGastos,
      proyectado: true,
    };
  });

  const allMonthlyStats = [
    ...monthlyStats.map((m: any) => ({ ...m, proyectado: false })),
    ...projected,
  ];

  return (
    <DashboardClient
      initialStats={stats}
      initialMovements={movements}
      initialGoals={goals}
      initialMonthlyStats={allMonthlyStats}
      userNombre={user.user_metadata?.nombre || "Usuario"}
    />
  );
}
