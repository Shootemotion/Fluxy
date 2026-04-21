import { NextResponse } from "next/server";

// Cache UVA value for 6 hours (changes once per business day)
let uvaCache: { valor: number; fecha: string; expiresAt: number } | null = null;

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

    uvaCache = {
      valor: last.valor,
      fecha: last.fecha,
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
