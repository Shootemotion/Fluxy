import { getDashboardStats, getMovements, getGoals, getMonthlyStats, getRecurrentes } from "@/lib/actions";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MESES_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [stats, movements, goals, monthlyStats, recurrentes] = await Promise.all([
    getDashboardStats(),
    getMovements(5),
    getGoals(),
    getMonthlyStats(24),
    getRecurrentes(),
  ]);

  // Compute monthly projected gastos from active recurring expenses
  const monthlyFixedGastos = recurrentes
    .filter((r: any) => r.activo && r.tipo === "gasto" && r.moneda === "ARS")
    .reduce((s: number, r: any) => s + Number(r.monto), 0);

  // Average ingresos from last 3 months with data
  const withData = monthlyStats.filter((m: any) => m.ingresos > 0);
  const avgIngresos = withData.length > 0
    ? withData.slice(-3).reduce((s: number, m: any) => s + m.ingresos, 0) / Math.min(3, withData.length)
    : 0;

  // Build projected months (next 6)
  const now = new Date();
  const projected = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    return {
      mes:       MESES_SHORT[d.getMonth()],
      yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      ingresos:  Math.round(avgIngresos),
      gastos:    monthlyFixedGastos,
      ahorro:    Math.round(avgIngresos) - monthlyFixedGastos,
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
