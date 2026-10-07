export type Quote = {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  currency: string;
};

const UA = { "User-Agent": "Mozilla/5.0 (compatible; stocks365/1.0)" };
const intervals: Record<string, string> = {
  "1d": "5m",
  "5d": "30m",
  "1mo": "1d",
  "6mo": "1d",
  "1y": "1wk",
  "5y": "1mo",
};

async function yahoo(symbol: string, range: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${intervals[range] ?? "1d"}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Quote lookup failed (${res.status})`);
  const json = (await res.json()) as any;
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error("Symbol not found");
  return r;
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  const r = await yahoo(symbol, "1d");
  const m = r.meta;
  const price = Number(m.regularMarketPrice);
  const prev = Number(m.chartPreviousClose ?? m.previousClose ?? price);
  return {
    symbol: m.symbol,
    name: m.shortName ?? m.longName ?? m.symbol,
    price,
    prevClose: prev,
    change: price - prev,
    changePct: prev ? ((price - prev) / prev) * 100 : 0,
    currency: m.currency ?? "USD",
  };
}

export async function fetchChart(symbol: string, range: string) {
  const r = await yahoo(symbol, range);
  const ts: number[] = r.timestamp ?? [];
  const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
  return ts
    .map((t, i) => ({ t: t * 1000, c: closes[i] }))
    .filter((p): p is { t: number; c: number } => typeof p.c === "number");
}
