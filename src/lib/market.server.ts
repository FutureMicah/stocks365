export type Quote = {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  high52: number | null;
  low52: number | null;
  marketTime: number;
  currency: string;
  spark?: number[];
};

const UA = { "User-Agent": "Mozilla/5.0", "Accept": "application/json" };
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
  let res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
  if (!res.ok) res = await fetch(url.replace("query1.", "query2."), { headers: UA, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Quote lookup failed (${res.status})`);
  const json = (await res.json()) as any;
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error("Symbol not found");
  return r;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function toQuote(r: any): Quote {
  const m = r.meta;
  const price = n(m.regularMarketPrice);
  if (price == null || price <= 0) throw new Error("Market price unavailable");
  let changePct = n(m.regularMarketChangePercent);
  let prev = n(m.previousClose) ?? (m.range === "1d" ? n(m.chartPreviousClose) : null);
  if (prev == null && changePct != null) prev = price / (1 + changePct / 100);
  if (prev == null) prev = price;
  if (changePct == null) changePct = prev ? ((price - prev) / prev) * 100 : 0;
  return {
    symbol: m.symbol,
    name: m.longName ?? m.shortName ?? m.symbol,
    exchange: m.fullExchangeName ?? m.exchangeName ?? "",
    price,
    prevClose: prev,
    change: price - prev,
    changePct,
    dayHigh: n(m.regularMarketDayHigh),
    dayLow: n(m.regularMarketDayLow),
    volume: n(m.regularMarketVolume),
    high52: n(m.fiftyTwoWeekHigh),
    low52: n(m.fiftyTwoWeekLow),
    marketTime: (n(m.regularMarketTime) ?? 0) * 1000,
    currency: m.currency ?? "USD",
  };
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  return toQuote(await yahoo(symbol, "1d"));
}

export async function fetchQuoteWithSpark(symbol: string): Promise<Quote> {
  const [q, r] = await Promise.all([fetchQuote(symbol), yahoo(symbol, "1mo").catch(() => null)]);
  if (!r) return q;
  const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
  q.spark = closes.filter((c): c is number => typeof c === "number");
  return q;
}

export async function fetchChart(symbol: string, range: string) {
  const r = await yahoo(symbol, range);
  const ts: number[] = r.timestamp ?? [];
  const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
  return ts
    .map((t, i) => ({ t: t * 1000, c: closes[i] }))
    .filter((p): p is { t: number; c: number } => typeof p.c === "number" && Number.isFinite(p.c));
}
