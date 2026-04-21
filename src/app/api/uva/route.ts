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

  const today     = new Date().toISOString().split("T")[0];
  const tenAgo    = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    // Step 1: discover UVA variable ID dynamically
    let uvaVarId: number | null = null;
    try {
      const varRes = await bcraFetch("https://api.bcra.gob.ar/estadisticas/v2.0/principalesvariables");
      if (varRes.ok) {
        const varData = await varRes.json();
        const results: any[] = varData?.results ?? [];
        const entry = results.find((v: any) => /\buva\b/i.test(v.descripcion) && !/uvt/i.test(v.descripcion));
        if (entry) uvaVarId = entry.idVariable;
      }
    } catch { /* variable discovery is optional */ }

    // Step 2: try known IDs (UVA is typically 4 or 31 in BCRA series)
    const ids = uvaVarId ? [uvaVarId, 4, 31, 27, 19] : [4, 31, 27, 19];

    for (const id of ids) {
      try {
        const res = await bcraFetch(
          `https://api.bcra.gob.ar/estadisticas/v2.0/datosVariable/${id}/${tenAgo}/${today}`
        );
        if (!res.ok) continue;
        const data = await res.json();
        const rows: any[] = data?.results ?? [];
        if (!rows.length) continue;

        const last  = rows[rows.length - 1];
        const valor = Number(last.valor ?? last.v ?? last.value);
        if (!valor || valor < 100) continue; // UVA > 100 ARS since 2024

        uvaCache = {
          valor,
          fecha: last.fecha ?? last.d ?? today,
          expiresAt: Date.now() + 6 * 60 * 60 * 1000,
        };
        return NextResponse.json(uvaCache);
      } catch { continue; }
    }

    return NextResponse.json(
      { error: "No se pudo obtener el valor del UVA desde el BCRA. Podés ingresarlo manualmente." },
      { status: 502 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
