import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { placeTrade } from "@/lib/account.functions";
import { fmt, pct, profileQ, useQuotes } from "@/lib/data";
import { COPY_TRADERS, openBasket, type CopyAllocation } from "@/lib/copy-traders";
import { deleteCopyAllocation, listCopyAllocations, upsertCopyAllocation } from "@/lib/copy.functions";

export const Route = createFileRoute("/_authenticated/copy-trading")({
  head: () => ({
    meta: [
      { title: "Copy trading — stocks365" },
      {
        name: "description",
        content: "Allocate cash to copy traders; buys and sells update your wallet and holdings.",
      },
    ],
  }),
  component: CopyDesk,
});

const authRoute = getRouteApi("/_authenticated");
const MIN = 100;

function CopyDesk() {
  const { user } = authRoute.useRouteContext();
  const qc = useQueryClient();
  const trade = useServerFn(placeTrade);
  const listCopies = useServerFn(listCopyAllocations);
  const saveCopy = useServerFn(upsertCopyAllocation);
  const removeCopy = useServerFn(deleteCopyAllocation);
  const profile = useQuery(profileQ);

  const copiesQ = useQuery({
    queryKey: ["copy-allocations", user.id],
    queryFn: () => listCopies(),
  });
  const copies = copiesQ.data ?? [];

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const symbols = useMemo(() => COPY_TRADERS.flatMap((t) => t.symbols), []);
  const quotes = useQuotes(symbols);
  const qmap = useMemo(
    () => Object.fromEntries((quotes.data ?? []).map((q) => [q.symbol, q])),
    [quotes.data],
  );

  const cash = profile.data?.cash ?? 0;

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
  const allocated = copies.reduce((sum, row) => sum + row.amount, 0);

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["copy-allocations"] }),
      qc.invalidateQueries({ queryKey: ["profile"] }),
      qc.invalidateQueries({ queryKey: ["holdings"] }),
      qc.invalidateQueries({ queryKey: ["transactions"] }),
    ]);
  }

  async function start(traderId: string) {
    const trader = COPY_TRADERS.find((t) => t.id === traderId);
    if (!trader || busy) return;
    const amount = Number(amounts[traderId]);
    if (!Number.isFinite(amount) || amount < MIN) {
      toast.error(`Enter at least ${fmt(MIN)} to copy this trader.`);
      return;
    }
    if (copies.some((row) => row.traderId === traderId)) {
      toast.error("You are already copying this trader.");
      return;
    }
    if (amount > cash + 0.001) {
      toast.error(`Only ${fmt(cash)} cash is available.`);
      return;
    }
    const planned = openBasket(
      amount,
      trader.symbols.map((symbol) => ({ symbol, price: qmap[symbol]?.price ?? 0 })),
      trader.symbols,
    );
    if (!planned) {
      toast.error("Live prices are not in yet. Wait a moment and try again.");
      return;
    }

    setBusy(traderId);
    const filled: CopyAllocation["positions"] = [];
    try {
      for (const leg of planned) {
        const result = await trade({ data: { symbol: leg.symbol, side: "buy", qty: leg.qty } });
        filled.push({ symbol: result.symbol, qty: leg.qty, entry: result.price });
      }
      const spent = Math.round(filled.reduce((s, p) => s + p.entry * p.qty, 0) * 100) / 100;
      const allocation: CopyAllocation = {
        traderId,
        amount: spent,
        startedAt: new Date().toISOString(),
        positions: filled,
      };
      await saveCopy({
        data: {
          traderId: allocation.traderId,
          amount: allocation.amount,
          startedAt: allocation.startedAt,
          positions: allocation.positions,
        },
      });
      setAmounts((prev) => ({ ...prev, [traderId]: "" }));
      await refreshAll();
      toast.success(`Copy opened for ${trader.name}. ${fmt(spent)} invested into your holdings.`);
    } catch (err) {
      for (const leg of filled) {
        try {
          await trade({ data: { symbol: leg.symbol, side: "sell", qty: leg.qty } });
        } catch {
          /* leave partial holdings if unwind fails */
        }
      }
      await refreshAll();
      toast.error((err as Error).message || "Could not open copy.");
    } finally {
      setBusy(null);
    }
  }

  async function stop(traderId: string) {
    const book = books.find((b) => b.copy.traderId === traderId);
    if (!book || busy) return;
    if (!window.confirm("Sell all positions in this copy and remove it from your book?")) return;
    setBusy(traderId);
    let proceeds = 0;
    try {
      for (const leg of book.positions) {
        const result = await trade({ data: { symbol: leg.symbol, side: "sell", qty: leg.qty } });
        proceeds += result.price * leg.qty;
      }
      proceeds = Math.round(proceeds * 100) / 100;
      const pl = proceeds - book.copy.amount;
      await removeCopy({ data: { traderId } });
      await refreshAll();
      toast.success(`Closed at ${fmt(proceeds)} (${pl >= 0 ? "+" : ""}${fmt(pl)}). Cash and holdings updated.`);
    } catch (err) {
      await refreshAll();
      toast.error((err as Error).message || "Could not close copy.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Copy trading</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Allocations are saved to your account (not only this browser). Opening a copy buys the basket into your
          wallet; closing sells those shares back to cash.
          {quotes.isFetching ? " Updating prices…" : ""}
        </p>
      </div>

      {copiesQ.isError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {(copiesQ.error as Error).message}. If this mentions a missing table, run the{" "}
          <code className="text-foreground">copy_allocations</code> SQL in Lovable.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Available cash" value={fmt(cash)} />
        <Stat label="Copy cost basis" value={fmt(allocated)} />
        <Stat label="Copy equity" value={fmt(equity || allocated)} />
        <Stat label="Open P/L" value={`${openPL >= 0 ? "+" : ""}${fmt(openPL)}`} tone={openPL} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {COPY_TRADERS.map((trader) => {
          const book = books.find((b) => b.copy.traderId === trader.id);
          const working = busy === trader.id;
          return (
            <article key={trader.id} className="glass flex flex-col rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {trader.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{trader.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {trader.strategy} · {trader.risk}
                  </p>
                </div>
                {book && (
                  <p className={`num text-sm font-semibold ${book.pl >= 0 ? "text-success" : "text-destructive"}`}>
                    {book.pl >= 0 ? "+" : ""}
                    {fmt(book.pl)}
                  </p>
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{trader.bio}</p>
              <p className="mt-2 text-xs text-muted-foreground">Basket: {trader.symbols.join(", ")}</p>
              {book ? (
                <>
                  <table className="mt-4 w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-1">Symbol</th>
                        <th className="pb-1 text-right">Shares</th>
                        <th className="pb-1 text-right">Entry</th>
                        <th className="pb-1 text-right">Live</th>
                        <th className="pb-1 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {book.positions.map((p) => (
                        <tr key={p.symbol} className="border-t border-border">
                          <td className="py-1.5 font-sans font-semibold">{p.symbol}</td>
                          <td className="text-right">{p.qty}</td>
                          <td className="text-right">{fmt(p.entry)}</td>
                          <td className={`text-right ${p.live >= p.entry ? "text-success" : "text-destructive"}`}>
                            {fmt(p.live)}
                          </td>
                          <td className="text-right">{fmt(p.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-sm">
                      Now <span className="num font-semibold">{fmt(book.value)}</span>
                      <span className="block text-xs text-muted-foreground">
                        Started {fmt(book.copy.amount)} ·{" "}
                        {pct(book.copy.amount ? (book.pl / book.copy.amount) * 100 : 0)}
                      </span>
                    </p>
                    <Button type="button" variant="outline" disabled={!!busy} onClick={() => void stop(trader.id)}>
                      {working ? "Closing…" : "Close copy"}
                    </Button>
                  </div>
                </>
              ) : (
                <form
                  className="mt-5 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void start(trader.id);
                  }}
                >
                  <Input
                    inputMode="decimal"
                    placeholder={`Amount (min ${fmt(MIN, 0)})`}
                    value={amounts[trader.id] ?? ""}
                    onChange={(event) => setAmounts((prev) => ({ ...prev, [trader.id]: event.target.value }))}
                    aria-label={`Amount to copy ${trader.name}`}
                    disabled={!!busy}
                  />
                  <Button type="submit" variant="hero" disabled={!!busy || quotes.isLoading || copiesQ.isLoading}>
                    {working ? "Buying…" : "Copy"}
                  </Button>
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
      <p className={`num mt-1 text-xl font-semibold ${tone == null ? "" : tone >= 0 ? "text-success" : "text-destructive"}`}>
        {value}
      </p>
    </div>
  );
}
