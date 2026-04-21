import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const EXCHANGE_LABELS: Record<string, string> = {
  NMS: "NASDAQ", NYQ: "NYSE", BUE: "BCBA", PCX: "NYSE Arca",
  ASE: "AMEX", NCM: "NASDAQ", NGM: "NASDAQ",
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) return NextResponse.json([]);

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=US&quotesCount=10&newsCount=0&enableFuzzyQuery=true&enableCb=false&enableNavLinks=false&enableEnhancedTrivialQuery=true`;

    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json", "Referer": "https://finance.yahoo.com/" },
      next: { revalidate: 60 },
    });

    if (!res.ok) return NextResponse.json([]);

    const json = await res.json();
    const quotes: any[] = json?.quotes ?? [];

    const results = quotes
      .filter(q => q.quoteType === "EQUITY" || q.quoteType === "ETF" || q.quoteType === "CRYPTOCURRENCY" || q.quoteType === "CURRENCY")
      .slice(0, 8)
      .map(q => ({
        ticker:    q.symbol,
        shortName: q.shortname || q.longname || q.symbol,
        exchange:  EXCHANGE_LABELS[q.exchange] ?? q.exchange ?? "",
        type:      q.quoteType,
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
