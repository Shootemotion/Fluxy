import { NextResponse } from "next/server";

// Cache for 1 hour
let tcCache: { blue: number; mep: number; official: number; fecha: string; expiresAt: number } | null = null;

export async function GET() {
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
      official: oficial,
      fecha,
      expiresAt: Date.now() + 60 * 60 * 1000,
    };

    return NextResponse.json(tcCache);
  } catch (err) {
    return NextResponse.json(
      { blue: 1250, mep: 1200, official: 950, error: "Using fallback TC" },
      { status: 200 } // Return 200 with fallbacks to avoid breaking the UI
    );
  }
}
