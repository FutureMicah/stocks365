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
  {
    id: "lisa-anderson",
    name: "Lisa Anderson",
    strategy: "SMC · Smart Money Concepts",
    return12m: 41.2,
    winRate: 68,
    risk: "Moderate",
    bio: "Trades institutional order flow: liquidity sweeps, order blocks, and market structure shifts on large-cap tech. Waits for displacement before entering with the smart-money side.",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN"],
  },
  {
    id: "noah-brooks",
    name: "Noah Brooks",
    strategy: "CRT · Candle Range Theory",
    return12m: 33.6,
    winRate: 72,
    risk: "Moderate",
    bio: "Maps prior candle ranges for continuation and reversal. Targets high-probability opens that reclaim or reject the previous session’s high and low on liquid US names.",
    symbols: ["SPY", "QQQ", "IWM", "DIA"],
  },
  {
    id: "michael-bennett",
    name: "Michael Bennett",
    strategy: "SLP · Session Liquidity Play",
    return12m: 48.9,
    winRate: 63,
    risk: "Aggressive",
    bio: "Hunts session open and London/NY liquidity pools in semiconductors and high-beta tech. Scales in after stops are run and structure flips in his direction.",
    symbols: ["NVDA", "AVGO", "AMD", "META"],
  },
  {
    id: "david-sullivan",
    name: "David Sullivan",
    strategy: "MNSR · Momentum & Structure Reversal",
    return12m: 27.4,
    winRate: 70,
    risk: "Moderate",
    bio: "Combines trend momentum with structure-based reversals at key highs and lows. Favors index ETFs when expansion follows a clear break of structure.",
    symbols: ["SPY", "QQQ", "IWM"],
  },
  {
    id: "robert-hayes",
    name: "Robert Hayes",
    strategy: "SLP · Session Liquidity Play",
    return12m: 22.1,
    winRate: 74,
    risk: "Conservative",
    bio: "Applies session liquidity logic to financials and quality cyclicals—fades stop hunts into value zones and holds for the next session’s continuation.",
    symbols: ["JPM", "BAC", "CAT", "UNH"],
  },
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
