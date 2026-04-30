import { getMovementsForReport } from "@/lib/actions";
import ReportesClient from "@/components/reportes/ReportesClient";

export default async function ReportesPage() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().split("T")[0];
  const end   = today.toISOString().split("T")[0];

  const movements = await getMovementsForReport(start, end);

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Reportes</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
          Análisis de tus finanzas por período
        </p>
      </div>
      <ReportesClient
        initialMovements={movements}
        initialPeriod="6m"
        initialStart={start}
        initialEnd={end}
      />
    </div>
  );
}
