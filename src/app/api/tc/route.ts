import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

// Cache for 1 hour
let tcCache: { blue: number; mep: number; oficial: number; fecha: string; expiresAt: number } | null = null;

export async function GET() {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  if (tcCache && tcCache.expiresAt > Date.now()) {
    return NextResponse.json(tcCache);
  }

  try {
    // Fetch multiple rates from ArgentinaDatos
    const res = await fetch("https://api.argentinadatos.com/v1/finanzas/cotizaciones/dolar", {
      cache: "no-store"
    });

    if (!res.ok) throw new Error("Error fetching TC");

    const data = await res.json();
    
    // Array of { casa: "oficial"|"blue"|"mep"..., compra: number, venta: number, fecha: "..." }
    const oficial = data.find((d: any) => d.casa === "oficial")?.venta || 1000;
    const blue = data.find((d: any) => d.casa === "blue")?.venta || 1200;
    const mep = data.find((d: any) => d.casa === "mep" || d.casa === "bolsa")?.venta || 1150;
    const fecha = data[0]?.fecha || new Date().toISOString();

    tcCache = {
      blue,
      mep,
      oficial,
      fecha,
      expiresAt: Date.now() + 60 * 60 * 1000,
    };

    return NextResponse.json(tcCache);
  } catch {
    // A stale rate is still a real rate; invented numbers are not. Serving
    // hardcoded values with a 200 silently corrupts every USD conversion in
    // the app, so fail loudly and let the UI say the rate is unavailable.
    if (tcCache) {
      return NextResponse.json({ ...tcCache, stale: true });
    }
    return NextResponse.json(
      { error: "No se pudo obtener la cotización del dólar." },
      { status: 502 }
    );
  }
}
