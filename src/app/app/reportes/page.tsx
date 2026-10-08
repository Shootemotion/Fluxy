import { getMovementsForReport, getPosiciones, getPlazos, getAccountsWithBalances, getLatestValuations, getLatestTCUSD } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ReportesClient from "@/components/reportes/ReportesClient";

export default async function ReportesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split("T")[0];
  const end   = today.toISOString().split("T")[0];

  const [movements, posiciones, plazos, accounts, tcUsd, valuaciones] = await Promise.all([
    getMovementsForReport(start, end),
    getPosiciones(),
    getPlazos(),
    getAccountsWithBalances(),
    getLatestTCUSD(),
    getLatestValuations(),
  ]);

  const portfolioData = {
    posiciones,
    plazos,
    valuaciones,
    accounts,
    tcUsd,
  };

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--fg-hi)" }}>Reportes</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--fg-5)" }}>
          Análisis histórico · distinto del Dashboard que muestra el estado actual y proyecciones
        </p>
      </div>
      <ReportesClient
        initialMovements={movements}
        initialPeriod="6m"
        initialStart={start}
        initialEnd={end}
        portfolioData={portfolioData}
      />
    </div>
  );
}
