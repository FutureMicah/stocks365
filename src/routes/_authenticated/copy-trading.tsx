import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt, profileQ } from "@/lib/data";
import { COPY_TRADERS, loadCopies, saveCopies, type CopyAllocation } from "@/lib/copy-traders";

export const Route = createFileRoute("/_authenticated/copy-trading")({
  head: () => ({
    meta: [
      { title: "Copy trading — stocks365" },
      { name: "description", content: "Allocate buying power to featured stock traders." },
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

  const cash = profile.data?.cash ?? 0;
  const allocated = copies.reduce((sum, row) => sum + row.amount, 0);
  const free = Math.max(0, cash - allocated);

  function commit(next: CopyAllocation[]) {
    setCopies(next);
    saveCopies(user.id, next);
  }

  function start(traderId: string) {
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
      toast.error(`Only ${fmt(free)} of buying power is still free.`);
      return;
    }
    commit([...copies, { traderId, amount: Math.round(amount * 100) / 100, startedAt: new Date().toISOString() }]);
    setAmounts((prev) => ({ ...prev, [traderId]: "" }));
    const trader = COPY_TRADERS.find((t) => t.id === traderId);
    toast.success(`Now copying ${trader?.name ?? "trader"}.`);
  }

  function stop(traderId: string) {
    commit(copies.filter((row) => row.traderId !== traderId));
    toast.success("Copy stopped. That allocation is free again.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Copy trading</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set aside buying power for a trader. You can stop at any time and the amount returns to your free cash.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Buying power" value={fmt(cash)} />
        <Stat label="Allocated to copies" value={fmt(allocated)} />
        <Stat label="Still free" value={fmt(free)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {COPY_TRADERS.map((trader) => {
          const active = copies.find((row) => row.traderId === trader.id);
          return (
            <article key={trader.id} className="glass flex flex-col rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {trader.name.split(" ").map((part) => part[0]).join("")}
                </div>
                <div>
                  <h2 className="font-semibold">{trader.name}</h2>
                  <p className="text-xs text-muted-foreground">{trader.strategy} · {trader.risk}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{trader.bio}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Basket: <span className="font-semibold text-foreground">{trader.symbols.join(" · ")}</span>
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">12-month return</dt>
                  <dd className="num font-semibold text-success">+{trader.return12m.toFixed(1)}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Win rate</dt>
                  <dd className="num font-semibold">{trader.winRate}%</dd>
                </div>
              </dl>
              {active ? (
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-sm">
                    Copying <span className="num font-semibold">{fmt(active.amount)}</span>
                    <span className="block text-xs text-muted-foreground">Since {new Date(active.startedAt).toLocaleDateString()}</span>
                  </p>
                  <Button type="button" variant="outline" onClick={() => stop(trader.id)}>Stop copying</Button>
                </div>
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
                  <Button type="submit" variant="hero">Copy</Button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
