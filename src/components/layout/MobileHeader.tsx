"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { NAV_PRINCIPAL, NAV_EXTRA, esActivo } from "./nav-items";

/**
 * Barra superior y menú de navegación para pantallas chicas.
 *
 * El Sidebar está oculto por debajo de lg, y el BottomNav sólo lleva a cuatro
 * secciones: sin esto, en un teléfono no se puede llegar a Reportes, Cuentas,
 * Importar, Configuración ni cerrar sesión.
 */
export default function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [abierto, setAbierto] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (!adminEmail) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email === adminEmail) setIsAdmin(true);
    });
  }, [supabase.auth]);

  // Al navegar se cierra solo: si no, el menú tapa la pantalla recién abierta.
  useEffect(() => { setAbierto(false); }, [pathname]);

  // Con el menú abierto el fondo no debe scrollear.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previo; };
  }, [abierto]);

  // Escape cierra, como cualquier panel modal.
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  const tituloActual =
    [...NAV_PRINCIPAL, ...NAV_EXTRA].find(i => esActivo(pathname, i.href))?.label ?? "Fluxy";

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <>
      <header className="mobile-header lg:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #6C63FF, #22D3EE)" }}
          >
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <path d="M6 22L16 8L26 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 18H22" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            </svg>
          </div>
          <span className="font-semibold text-sm truncate" style={{ color: "var(--fg-1)" }}>
            {tituloActual}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="tap-target"
          style={{ color: "var(--fg-2)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {abierto && (
        <div className="lg:hidden fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
          />

          <nav className="mobile-drawer animate-slide-in-right">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <span className="text-lg font-bold gradient-text">Fluxy</span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="tap-target"
                style={{ color: "var(--fg-5)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-4">
              <p className="px-5 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-7)" }}>
                Principal
              </p>
              {NAV_PRINCIPAL.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`drawer-item ${esActivo(pathname, item.href) ? "active" : ""}`}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}

              <p className="px-5 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-7)" }}>
                Más
              </p>
              {NAV_EXTRA.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`drawer-item ${esActivo(pathname, item.href) ? "active" : ""}`}
                >
                  <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}

              {isAdmin && (
                <Link href="/app/admin" className={`drawer-item ${pathname === "/app/admin" ? "active" : ""}`}>
                  <span className="text-base w-5 text-center flex-shrink-0">👑</span>
                  <span>Admin</span>
                </Link>
              )}
            </div>

            <div className="border-t px-2 py-2" style={{ borderColor: "var(--bd-faint)" }}>
              <button onClick={handleSignOut} className="drawer-item w-full" style={{ color: "var(--fg-5)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Cerrar sesión</span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
