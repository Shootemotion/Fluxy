import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

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
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-right" theme="dark" toastOptions={{ style: { background: 'var(--bg-card)', border: '1px solid var(--bd)', color: 'var(--fg-1)' } }} />
      </body>
    </html>
  );
}
