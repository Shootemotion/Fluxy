import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Fluxy — Gestión Financiera Personal",
  description:
    "Controlá tu dinero, seguí tus objetivos de ahorro y gestioná tu cartera de inversiones con Fluxy.",
  keywords: "finanzas personales, ahorro, inversiones, presupuesto, control de gastos",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F0F1A",
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale a propósito: fijarlo en 1 impide hacer pinch-zoom, que es
  // justo lo que alguien necesita para leer un monto o una fila de tabla en un
  // teléfono. Evitar el zoom automático al enfocar un input se resuelve con
  // font-size >= 16px en los campos, no bloqueando el gesto.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`dark ${inter.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-right" theme="dark" toastOptions={{ style: { background: 'var(--bg-card)', border: '1px solid var(--bd)', color: 'var(--fg-1)' } }} />
      </body>
    </html>
  );
}
