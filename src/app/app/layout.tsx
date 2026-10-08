import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import MobileHeader from "@/components/layout/MobileHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen overflow-x-hidden" style={{ background: "var(--bg)" }}>
      {/* Navegación de escritorio */}
      <Sidebar />

      {/* Barra superior + menú lateral, sólo en pantallas chicas. Sin esto el
          teléfono no tiene forma de llegar a la mayoría de las secciones. */}
      <MobileHeader />

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 transition-all duration-300">
          <div className="app-content max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav: accesos rápidos en mobile, oculto en desktop vía CSS. */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
