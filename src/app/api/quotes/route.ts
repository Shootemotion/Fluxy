import { NextRequest, NextResponse } from "next/server";

// Module-level crumb cache (survives across requests in the same process)
let crumbCache: { crumb: string; cookie: string; expiresAt: number } | null = null;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbCache && crumbCache.expiresAt > Date.now()) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }

  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  try {
    // Step 1: get a Yahoo Finance session cookie
    const r1 = await fetch("https://query2.finance.yahoo.com/v1/finance/user-agent-test?action=sign_in_guest", {
      headers: { "User-Agent": ua, "Accept": "*/*" },
      redirect: "follow",
    });

    // Extract the first usable cookie
    const rawCookie = r1.headers.get("set-cookie") ?? "";
    const cookie = rawCookie.split(",").map(c => c.split(";")[0].trim()).filter(Boolean).join("; ");

    if (!cookie) return null;

    // Step 2: fetch crumb using that cookie
    const r2 = await fetch("https://query2.finance.yahoo.com/v1/finance/getCrumb", {
      headers: { "User-Agent": ua, "Cookie": cookie, "Accept": "text/plain,*/*" },
    });

    if (!r2.ok) return null;
    const crumb = (await r2.text()).trim();
    if (!crumb) return null;

    crumbCache = { crumb, cookie, expiresAt: Date.now() + 28 * 60 * 1000 }; // 28 min
    return { crumb, cookie };
  } catch {
    return null;
  }
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Fetch a single ticker via v8/chart as fallback */
async function fetchChart(ticker: string, cookie: string) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Cookie": cookie, "Referer": "https://finance.yahoo.com/" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice;
  const price = meta.regularMarketPrice;
  return {
    ticker,
    shortName: meta.shortName || meta.symbol || ticker,
    price,
    change:        price != null && prev != null ? price - prev : null,
    changePercent: price != null && prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null,
    currency:    meta.currency ?? "USD",
    marketState: meta.marketState ?? "CLOSED",
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow:  meta.regularMarketDayLow  ?? null,
  };
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("tickers");
  if (!raw) return NextResponse.json({ error: "No tickers" }, { status: 400 });

  const tickerList = raw.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);

  const auth = await getYahooCrumb();
  const cookie = auth?.cookie ?? "";
  const crumb  = auth?.crumb  ?? "";

  try {
    // Primary: batch v7/quote with crumb
    const symbolsStr = tickerList.join(",");
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolsStr)}&lang=en-US&region=US${crumb ? `&crumb=${encodeURIComponent(crumb)}` : ""}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json",
        "Referer": "https://finance.yahoo.com/",
        ...(cookie ? { "Cookie": cookie } : {}),
      },
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const json = await res.json();
      const results: any[] = json?.quoteResponse?.result ?? [];
      if (results.length > 0) {
        const quotes = results.map(q => ({
          ticker:        q.symbol,
          shortName:     q.shortName || q.longName || q.symbol,
          price:         q.regularMarketPrice ?? null,
          change:        q.regularMarketChange ?? null,
          changePercent: q.regularMarketChangePercent ?? null,
          currency:      q.currency ?? "USD",
          marketState:   q.marketState ?? "CLOSED",
          dayHigh:       q.regularMarketDayHigh ?? null,
          dayLow:        q.regularMarketDayLow  ?? null,
        }));
        return NextResponse.json(quotes);
      }
    }

    // Fallback: individual chart requests in parallel
    const charts = await Promise.all(tickerList.map(t => fetchChart(t, cookie)));
    const quotes = charts.filter(Boolean);
    return NextResponse.json(quotes);
  } catch (err: any) {
    // Last resort: try charts individually
    try {
      const charts = await Promise.all(tickerList.map(t => fetchChart(t, cookie)));
      return NextResponse.json(charts.filter(Boolean));
    } catch {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
  }
}
