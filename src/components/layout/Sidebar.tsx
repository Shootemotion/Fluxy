"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: "/app/movimientos",
    label: "Movimientos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
      </svg>
    ),
  },
  {
    href: "/app/objetivos",
    label: "Objetivos",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
  },
  {
    href: "/app/cartera",
    label: "Patrimonio",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    href: "/app/reportes",
    label: "Reportes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
];

const extraItems = [
  { href: "/app/cuentas",      label: "Cuentas",       icon: "💳" },
  { href: "/app/recurrentes",  label: "Periódicos",     icon: "🔁" },
  { href: "/app/categorias",   label: "Categorías",     icon: "🏷️" },
  { href: "/app/ia",           label: "Asistente IA",   icon: "🤖" },
  { href: "/app/importar",     label: "Importar",       icon: "📥" },
  { href: "/app/alertas",      label: "Alertas",        icon: "🔔" },
  { href: "/app/configuracion", label: "Configuración", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createClient();
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin via env var so no email is hardcoded in source
  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (!adminEmail) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email === adminEmail) setIsAdmin(true);
    });
  }, [supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <aside className="sidebar hidden lg:flex flex-col" style={{ width: collapsed ? "64px" : "240px", transition: "width 0.3s ease" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 p-5 pb-4">
        <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6C63FF, #22D3EE)" }}>
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M6 22L16 8L26 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 18H22" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
          </svg>
        </div>
        {!collapsed && (
          <span className="text-lg font-bold gradient-text">Fluxy</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: "var(--fg-6)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-2 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

      {/* Main Nav */}
      <nav className="flex-1 py-2 space-y-0.5">
        {!collapsed && (
          <p className="px-5 pb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fg-7)" }}>
            Principal
          </p>
        )}
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={`sidebar-item ${isActive ? "active" : ""}`} title={collapsed ? item.label : undefined}>
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {!collapsed && (
          <p className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fg-7)" }}>
            Más
          </p>
        )}
        {collapsed && <div className="h-4" />}
        {extraItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`sidebar-item ${isActive ? "active" : ""}`} title={collapsed ? item.label : undefined}>
              <span className="text-base">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
        {isAdmin && (
          <Link href="/app/admin" className={`sidebar-item ${pathname === "/app/admin" ? "active" : ""}`} title={collapsed ? "Admin" : undefined}>
            <span className="text-base">👑</span>
            {!collapsed && <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-yellow-500">Admin</span>}
          </Link>
        )}
      </nav>

      {/* Bottom: User logout */}
      <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <button onClick={handleSignOut} className="sidebar-item w-full" style={{ color: "var(--fg-6)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {!collapsed && <span>Salir</span>}
        </button>
      </div>
    </aside>
  );
}
