import { NextResponse } from "next/server";

// Cache UVA value for 6 hours (changes once per business day)
let uvaCache: { valor: number; fecha: string; cerMensual: number | null; expiresAt: number } | null = null;

function calcCerMensual(data: { fecha: string; valor: number }[]): number | null {
  if (data.length < 25) return null; // need at least ~12 months
  const last = data[data.length - 1];
  // Find item closest to 12 months ago
  const target = new Date(last.fecha);
  target.setFullYear(target.getFullYear() - 1);
  const targetStr = target.toISOString().split("T")[0];
  // Find the closest date in the array
  let closest = data[0];
  for (const d of data) {
    if (Math.abs(new Date(d.fecha).getTime() - target.getTime()) <
        Math.abs(new Date(closest.fecha).getTime() - target.getTime())) {
      closest = d;
    }
  }
  if (!closest.valor || !last.valor) return null;
  // Annualized → monthly CER
  const months = (new Date(last.fecha).getTime() - new Date(closest.fecha).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 1) return null;
  return Math.pow(last.valor / closest.valor, 1 / months) - 1;
}

async function bcraFetch(url: string) {
  // BCRA API uses a certificate signed by "Autoridad Certificante Raiz de la
  // Republica Argentina" which is not in Node.js's default trust store.
  // We temporarily bypass SSL verification only for these government API calls.
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
  } finally {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
  }
}

export async function GET() {
  if (uvaCache && uvaCache.expiresAt > Date.now()) {
    return NextResponse.json(uvaCache);
  }

  try {
    const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/uva", {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error("Error en la respuesta de la API");
    }

    const data = await res.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Formato de datos incorrecto");
    }

    // API returns array of { fecha: "YYYY-MM-DD", valor: 123.45 }
    // Get the last item which is the most recent
    const last = data[data.length - 1];
    
    if (!last || !last.valor) {
      throw new Error("No se encontró el valor UVA");
    }

    const cerMensual = calcCerMensual(data);

    uvaCache = {
      valor: last.valor,
      fecha: last.fecha,
      cerMensual,
      expiresAt: Date.now() + 6 * 60 * 60 * 1000, // 6 hours
    };

    return NextResponse.json(uvaCache);
  } catch (err: any) {
    return NextResponse.json(
      { error: "No se pudo obtener el valor del UVA. Podés ingresarlo manualmente." },
      { status: 502 }
    );
  }
}
