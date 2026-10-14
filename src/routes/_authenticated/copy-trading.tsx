import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt, pct, profileQ, useQuotes } from "@/lib/data";
import { COPY_TRADERS, loadCopies, openBasket, saveCopies, type CopyAllocation } from "@/lib/copy-traders";

export const Route = createFileRoute("/_authenticated/copy-trading")({
  head: () => ({
    meta: [
      { title: "Copy trading — stocks365" },
      { name: "description", content: "Paper copy trading marked to live US stock prices." },
    ],
  }),
  component: CopyDesk,
});

const authRoute = getRouteApi("/_authenticated");
const MIN = 100;

function CopyDesk() {
  const { user } = authRoute.useRouteContext();
  const profile = useQuery(profileQ);
  const [copies, setCopies] = useState<CopyAllocation[]>(() => loadCopies(user.id));
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const symbols = useMemo(() => COPY_TRADERS.flatMap((t) => t.symbols), []);
  const quotes = useQuotes(symbols);
  const qmap = useMemo(() => Object.fromEntries((quotes.data ?? []).map((q) => [q.symbol, q])), [quotes.data]);

  const cash = profile.data?.cash ?? 0;
  const allocated = copies.reduce((sum, row) => sum + row.amount, 0);
  const free = Math.max(0, cash - allocated);

  const books = copies.map((copy) => {
    const positions = copy.positions.map((p) => {
      const live = qmap[p.symbol]?.price ?? p.entry;
      const value = live * p.qty;
      return { ...p, live, value, pl: value - p.entry * p.qty };
    });
    const value = positions.reduce((s, p) => s + p.value, 0);
    return { copy, positions, value, pl: value - copy.amount };
  });
  const equity = books.reduce((s, b) => s + b.value, 0);
  const openPL = books.reduce((s, b) => s + b.pl, 0);

  function commit(next: CopyAllocation[]) {
    setCopies(next);
    saveCopies(user.id, next);
  }

  function start(traderId: string) {
    const trader = COPY_TRADERS.find((t) => t.id === traderId);
    if (!trader) return;
    const amount = Number(amounts[traderId]);
    if (!Number.isFinite(amount) || amount < MIN) {
      toast.error(`Enter at least ${fmt(MIN)} to copy this trader.`);
      return;
    }
    if (copies.some((row) => row.traderId === traderId)) {
      toast.error("You are already copying this trader.");
      return;
    }
    if (amount > free + 0.001) {
      toast.error(`Only ${fmt(free)} of paper buying power is still free.`);
      return;
    }
    const positions = openBasket(
      amount,
      trader.symbols.map((symbol) => ({ symbol, price: qmap[symbol]?.price ?? 0 })),
      trader.symbols,
    );
    if (!positions) {
      toast.error("Live prices are not in yet. Wait a moment and try again.");
      return;
    }
    commit([...copies, { traderId, amount: Math.round(amount * 100) / 100, startedAt: new Date().toISOString(), positions }]);
    setAmounts((prev) => ({ ...prev, [traderId]: "" }));
    toast.success(`Paper copy opened for ${trader.name} at the latest prices.`);
  }

  function stop(traderId: string) {
    const book = books.find((b) => b.copy.traderId === traderId);
    commit(copies.filter((row) => row.traderId !== traderId));
    toast.success(book ? `Closed at ${fmt(book.value)} (${book.pl >= 0 ? "+" : ""}${fmt(book.pl)}).` : "Copy stopped.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Copy trading</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paper book only — no real broker. Copies fill at the latest US prices and mark to market about every 15 seconds.
          {quotes.isFetching ? " Updating prices…" : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Paper buying power" value={fmt(cash)} />
        <Stat label="Allocated" value={fmt(allocated)} />
        <Stat label="Copy equity" value={fmt(equity || allocated)} />
        <Stat label="Open P/L" value={`${openPL >= 0 ? "+" : ""}${fmt(openPL)}`} tone={openPL} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {COPY_TRADERS.map((trader) => {
          const book = books.find((b) => b.copy.traderId === trader.id);
          return (
            <article key={trader.id} className="glass flex flex-col rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {trader.name.split(" ").map((part) => part[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{trader.name}</h2>
                  <p className="text-xs text-muted-foreground">{trader.strategy} · {trader.risk}</p>
                </div>
                {book && (
                  <p className={`num text-sm font-semibold ${book.pl >= 0 ? "text-success" : "text-destructive"}`}>
                    {book.pl >= 0 ? "+" : ""}{fmt(book.pl)}
                  </p>
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{trader.bio}</p>
              {book ? (
                <>
                  <table className="mt-4 w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr><th className="pb-1">Symbol</th><th className="pb-1 text-right">Shares</th><th className="pb-1 text-right">Entry</th><th className="pb-1 text-right">Live</th><th className="pb-1 text-right">Value</th></tr>
                    </thead>
                    <tbody className="num">
                      {book.positions.map((p) => (
                        <tr key={p.symbol} className="border-t border-border">
                          <td className="py-1.5 font-sans font-semibold">{p.symbol}</td>
                          <td className="text-right">{p.qty}</td>
                          <td className="text-right">{fmt(p.entry)}</td>
                          <td className={`text-right ${p.live >= p.entry ? "text-success" : "text-destructive"}`}>{fmt(p.live)}</td>
                          <td className="text-right">{fmt(p.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-sm">
                      Now <span className="num font-semibold">{fmt(book.value)}</span>
                      <span className="block text-xs text-muted-foreground">
                        Started {fmt(book.copy.amount)} · {pct(book.copy.amount ? (book.pl / book.copy.amount) * 100 : 0)}
                      </span>
                    </p>
                    <Button type="button" variant="outline" onClick={() => stop(trader.id)}>Close copy</Button>
                  </div>
                </>
              ) : (
                <form
                  className="mt-5 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    start(trader.id);
                  }}
                >
                  <Input
                    inputMode="decimal"
                    placeholder={`Amount (min ${fmt(MIN, 0)})`}
                    value={amounts[trader.id] ?? ""}
                    onChange={(event) => setAmounts((prev) => ({ ...prev, [trader.id]: event.target.value }))}
                    aria-label={`Amount to copy ${trader.name}`}
                  />
                  <Button type="submit" variant="hero" disabled={quotes.isLoading}>Copy</Button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-xl font-semibold ${tone == null ? "" : tone >= 0 ? "text-success" : "text-destructive"}`}>{value}</p>
    </div>
  );
}
