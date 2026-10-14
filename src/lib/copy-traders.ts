export type Risk = "Conservative" | "Moderate" | "Aggressive";

export type Trader = {
  id: string;
  name: string;
  strategy: string;
  return12m: number;
  winRate: number;
  risk: Risk;
  bio: string;
  symbols: string[];
};

export const COPY_TRADERS: Trader[] = [
  { id: "lisa-anderson", name: "Lisa Anderson", strategy: "Large-cap growth", return12m: 38.4, winRate: 71, risk: "Moderate", bio: "Twelve years trading NYSE large caps. Focuses on earnings momentum and disciplined position sizing.", symbols: ["AAPL", "MSFT", "GOOGL", "AMZN"] },
  { id: "james-carter", name: "James Carter", strategy: "Dividend income", return12m: 19.2, winRate: 78, risk: "Conservative", bio: "Builds steady income portfolios from dividend aristocrats and utility leaders.", symbols: ["JNJ", "PG", "KO", "XOM"] },
  { id: "michael-bennett", name: "Michael Bennett", strategy: "Tech momentum", return12m: 52.7, winRate: 64, risk: "Aggressive", bio: "Rides semiconductor and software trends with tight stop-loss discipline.", symbols: ["NVDA", "AVGO", "AMD", "META"] },
  { id: "david-sullivan", name: "David Sullivan", strategy: "Index swing", return12m: 24.1, winRate: 69, risk: "Moderate", bio: "Trades S&P 500 and Nasdaq-100 ETFs around macro events and seasonality.", symbols: ["SPY", "QQQ", "IWM"] },
  { id: "robert-hayes", name: "Robert Hayes", strategy: "Value & financials", return12m: 16.8, winRate: 74, risk: "Conservative", bio: "Former bank analyst hunting undervalued financials and industrial names.", symbols: ["JPM", "BAC", "CAT", "UNH"] },
];

export type CopyPosition = { symbol: string; qty: number; entry: number };
export type CopyAllocation = { traderId: string; amount: number; startedAt: string; positions: CopyPosition[] };

/** Equal-weight legs for an amount given live prices. */
export function openBasket(
  amount: number,
  legs: { symbol: string; price: number }[],
  _symbols?: string[],
): { symbol: string; qty: number }[] | null {
  if (!(amount > 0) || !legs.length) return null;
  const per = amount / legs.length;
  const out: { symbol: string; qty: number }[] = [];
  for (const leg of legs) {
    if (!(leg.price > 0)) return null;
    const qty = Math.floor((per / leg.price) * 10000) / 10000;
    if (qty <= 0) return null;
    out.push({ symbol: leg.symbol, qty });
  }
  return out;
}

function key(userId: string) {
  return `stocks365.copy.${userId}`;
}

export function loadCopies(userId: string): CopyAllocation[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CopyAllocation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        COPY_TRADERS.some((t) => t.id === row.traderId) &&
        row.amount > 0 &&
        Array.isArray(row.positions) &&
        row.positions.length > 0,
    );
  } catch {
    return [];
  }
}

export function saveCopies(userId: string, rows: CopyAllocation[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key(userId), JSON.stringify(rows));
}
