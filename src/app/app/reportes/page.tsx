"use client";

const REPORTES = [
  {
    id: "mensual",
    label: "Resumen mensual",
    icon: "📅",
    descripcion: "Ingresos, gastos y ahorro del mes",
    color: "#6C63FF",
  },
  {
    id: "trimestral",
    label: "Resumen trimestral",
    icon: "📆",
    descripcion: "Flujo del último trimestre",
    color: "#22D3EE",
  },
  {
    id: "anual",
    label: "Resumen anual",
    icon: "📊",
    descripcion: "Balance completo del año",
    color: "#10B981",
  },
  {
    id: "ahorro",
    label: "Evolución del ahorro",
    icon: "💹",
    descripcion: "Tendencia de ahorro en el tiempo",
    color: "#10B981",
  },
  {
    id: "objetivos",
    label: "Objetivos",
    icon: "🎯",
    descripcion: "Estado y progreso de tus metas",
    color: "#6C63FF",
  },
  {
    id: "cartera",
    label: "Cartera de inversiones",
    icon: "💼",
    descripcion: "Valuación y composición",
    color: "#F59E0B",
  },
  {
    id: "categorias-gastos",
    label: "Gastos por categoría",
    icon: "🏷️",
    descripcion: "Desglose detallado de gastos",
    color: "#EF4444",
  },
  {
    id: "categorias-ingresos",
    label: "Ingresos por categoría",
    icon: "💰",
    descripcion: "Fuentes de ingresos",
    color: "#10B981",
  },
  {
    id: "cuentas",
    label: "Flujo por cuenta",
    icon: "💳",
    descripcion: "Movimientos por cuenta bancaria",
    color: "#22D3EE",
  },
  {
    id: "monedas",
    label: "Flujo por moneda",
    icon: "🌍",
    descripcion: "ARS vs USD y otras monedas",
    color: "#F59E0B",
  },
];

export default function ReportesPage() {
  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Reportes</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
            Exportá tus datos en PDF o Excel
          </p>
        </div>
        <span className="badge badge-primary text-xs">Próximamente</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTES.map(r => (
          <div key={r.id} className="glass-card-hover p-5" style={{ borderTop: `3px solid ${r.color}40` }}>
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-4"
              style={{ background: `${r.color}15` }}
            >
              {r.icon}
            </div>
            <h3 className="font-semibold mb-1 text-sm" style={{ color: "rgba(255,255,255,0.90)" }}>
              {r.label}
            </h3>
            <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.42)" }}>
              {r.descripcion}
            </p>
            <div className="flex gap-2">
              <button
                className="btn-secondary text-xs py-1.5 px-3 flex-1 gap-1.5"
                style={{ opacity: 0.6, cursor: "not-allowed" }}
                disabled
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                PDF
              </button>
              <button
                className="btn-secondary text-xs py-1.5 px-3 flex-1 gap-1.5"
                style={{ opacity: 0.6, cursor: "not-allowed" }}
                disabled
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M3 15h18M9 3v18" />
                </svg>
                Excel
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon banner */}
      <div
        className="mt-8 glass-card p-5 flex items-start gap-4"
        style={{ background: "rgba(108,99,255,0.06)", borderColor: "rgba(108,99,255,0.20)" }}
      >
        <span className="text-2xl flex-shrink-0">🚧</span>
        <div>
          <p className="font-semibold mb-1" style={{ color: "rgba(255,255,255,0.90)" }}>
            Exportación PDF/Excel — En desarrollo
          </p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.48)" }}>
            La generación de reportes estará disponible en la próxima versión.
            La UI está lista y conectada con tus datos reales de Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
