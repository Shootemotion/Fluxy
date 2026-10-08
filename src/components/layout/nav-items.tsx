import type { ReactNode } from "react";

/**
 * Definición única de la navegación.
 *
 * La comparten el Sidebar (desktop) y el menú lateral de mobile. Antes el
 * BottomNav tenía su propia lista con 4 destinos y el resto de la app quedaba
 * inalcanzable desde un teléfono; teniendo una sola fuente, agregar una
 * sección la deja disponible en los dos lados.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const ico = (d: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export const NAV_PRINCIPAL: NavItem[] = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    icon: ico(<>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </>),
  },
  {
    href: "/app/movimientos",
    label: "Movimientos",
    icon: ico(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />),
  },
  {
    href: "/app/objetivos",
    label: "Objetivos",
    icon: ico(<>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </>),
  },
  {
    href: "/app/cartera",
    label: "Patrimonio",
    icon: ico(<>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>),
  },
  {
    href: "/app/reportes",
    label: "Reportes",
    icon: ico(<>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>),
  },
];

export interface ExtraItem {
  href: string;
  label: string;
  icon: string;
}

export const NAV_EXTRA: ExtraItem[] = [
  { href: "/app/cuentas",       label: "Cuentas",       icon: "💳" },
  { href: "/app/recurrentes",   label: "Periódicos",    icon: "🔁" },
  { href: "/app/categorias",    label: "Categorías",    icon: "🏷️" },
  { href: "/app/ia",            label: "Asistente IA",  icon: "🤖" },
  { href: "/app/importar",      label: "Importar",      icon: "📥" },
  { href: "/app/pulir",         label: "Pulir",         icon: "✨" },
  { href: "/app/alertas",       label: "Alertas",       icon: "🔔" },
  { href: "/app/configuracion", label: "Configuración", icon: "⚙️" },
];

/** True si `href` es la sección activa para el pathname dado. */
export function esActivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
