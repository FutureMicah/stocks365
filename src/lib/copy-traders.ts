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
    strategy: "Large-cap growth",
    return12m: 38.4,
    winRate: 71,
    risk: "Moderate",
    bio: "Twelve years trading NYSE large caps. Focuses on earnings momentum and disciplined position sizing.",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN"],
  },
  {
    id: "james-carter",
    name: "James Carter",
    strategy: "Dividend income",
    return12m: 19.2,
    winRate: 78,
    risk: "Conservative",
    bio: "Builds steady income portfolios from dividend aristocrats and utility leaders.",
    symbols: ["JNJ", "PG", "KO", "XOM"],
  },
  {
    id: "michael-bennett",
    name: "Michael Bennett",
    strategy: "Tech momentum",
    return12m: 52.7,
    winRate: 64,
    risk: "Aggressive",
    bio: "Rides semiconductor and software trends with tight stop-loss discipline.",
    symbols: ["NVDA", "AVGO", "AMD", "META"],
  },
  {
    id: "david-sullivan",
    name: "David Sullivan",
    strategy: "Index swing",
    return12m: 24.1,
    winRate: 69,
    risk: "Moderate",
    bio: "Trades S&P 500 and Nasdaq-100 ETFs around macro events and seasonality.",
    symbols: ["SPY", "QQQ", "IWM"],
  },
  {
    id: "robert-hayes",
    name: "Robert Hayes",
    strategy: "Value & financials",
    return12m: 16.8,
    winRate: 74,
    risk: "Conservative",
    bio: "Former bank analyst hunting undervalued financials and industrial names.",
    symbols: ["JPM", "BAC", "CAT", "UNH"],
  },
];

export type CopyPosition = {
  symbol: string;
  qty: number;
  entry: number;
};

export type CopyAllocation = {
  traderId: string;
  amount: number;
  startedAt: string;
  positions: CopyPosition[];
};

/** Build equal-weight basket from trader id + amount + price map. */
export function openBasket(
  traderId: string,
  amount: number,
  prices: Record<string, number>,
): CopyAllocation | null {
  const trader = COPY_TRADERS.find((t) => t.id === traderId);
  if (!trader || !(amount > 0)) return null;
  const per = amount / trader.symbols.length;
  const positions: CopyPosition[] = [];
  for (const symbol of trader.symbols) {
    const entry = prices[symbol];
    if (!(entry > 0)) return null;
    const qty = Math.floor((per / entry) * 10000) / 10000;
    if (qty <= 0) return null;
    positions.push({ symbol, qty, entry });
  }
  return {
    traderId,
    amount,
    startedAt: new Date().toISOString(),
    positions,
  };
}
