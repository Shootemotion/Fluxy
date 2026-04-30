import { getAdminStats } from "@/lib/adminActions";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default async function AdminDashboardPage() {
  let stats;
  try {
    stats = await getAdminStats();
  } catch (err: any) {
    return (
      <div className="p-4 lg:p-8 animate-fade-in flex flex-col items-center justify-center min-h-[50vh]">
        <span className="text-5xl mb-4">⛔</span>
        <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
        <p className="text-muted-foreground">Esta sección es exclusiva para el administrador del sistema.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Monitoreo global de la plataforma Fluxy</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Usuarios Totales" value={stats.totalUsers} icon="👥" color="#3B82F6" />
        <MetricCard title="Movimientos Creados" value={stats.totalMovements} icon="💸" color="#10B981" />
        <MetricCard title="Periódicos Activos" value={stats.totalRecurrentes} icon="🔁" color="#F59E0B" />
        <MetricCard title="Metas & Pasivos" value={stats.totalObjetivos + stats.totalPasivos} icon="🎯" color="#8B5CF6" />
      </div>

      <div className="glass-card mt-8">
        <h3 className="text-lg font-semibold mb-4 px-2">Usuarios Registrados (Últimos 10)</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Fecha de Registro</th>
                <th>Último Acceso</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.map(user => (
                <tr key={user.id}>
                  <td className="font-medium">{user.email}</td>
                  <td className="text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {user.last_sign_in ? formatDistanceToNow(new Date(user.last_sign_in), { addSuffix: true, locale: es }) : "Nunca"}
                  </td>
                </tr>
              ))}
              {stats.recentUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-6 text-muted-foreground">
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color }: { title: string, value: number, icon: string, color: string }) {
  return (
    <div className="glass-card flex items-center p-5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 -mr-10 -mt-10 transition-opacity group-hover:opacity-30" style={{ background: color }} />
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{title}</p>
        <p className="text-3xl font-bold font-mono">{value.toLocaleString()}</p>
      </div>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-white/5 border border-white/10 ml-4">
        {icon}
      </div>
    </div>
  );
}
