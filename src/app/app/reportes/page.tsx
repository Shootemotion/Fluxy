import { getMovementsForReport, getPosiciones, getPlazos, getAccounts, getLatestTCUSD } from "@/lib/actions";
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

  const [movements, posiciones, plazos, accounts, tcUsd, valuacionesResult] = await Promise.all([
    getMovementsForReport(start, end),
    getPosiciones(),
    getPlazos(),
    getAccounts(),
    getLatestTCUSD(),
    supabase.from("valuaciones").select("instrumento_nombre, monto, moneda").eq("usuario_id", user.id).eq("es_ultima", true),
  ]);

  const portfolioData = {
    posiciones,
    plazos,
    valuaciones: valuacionesResult.data || [],
    accounts,
    tcUsd,
  };

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Reportes</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
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
