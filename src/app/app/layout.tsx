import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen overflow-x-hidden" style={{ background: "var(--bg)" }}>
      {/* Sidebar (Occupies 240px) */}
      <Sidebar />

      {/* Contenedor Principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 transition-all duration-300">
          <div 
            className="max-w-6xl mx-auto w-full"
            style={{ 
              paddingTop: '60px', 
              paddingBottom: '120px',
              paddingLeft: '20px',
              paddingRight: '20px'
            }}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Footer / Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <BottomNav />
      </div>
    </div>
  );
}
