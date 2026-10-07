import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceChart } from "@/components/PriceChart";
import { placeTrade } from "@/lib/account.functions";
import { fmt, pct, holdingsQ, profileQ, watchQ, useQuotes } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Trade — stocks365" }, { name: "description", content: "Your portfolio and live markets." }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const profile = useQuery(profileQ);
  const holdings = useQuery(holdingsQ);
  const watch = useQuery(watchQ);
  const symbols = useMemo(() => [...(holdings.data ?? []).map((h) => h.symbol), ...(watch.data ?? [])], [holdings.data, watch.data]);
  const quotes = useQuotes(symbols);
  const qmap = useMemo(() => Object.fromEntries((quotes.data ?? []).map((q) => [q.symbol, q])), [quotes.data]);
  const [selected, setSelected] = useState("AAPL");
  const [addSym, setAddSym] = useState("");

  const cash = profile.data?.cash ?? 0;
  const rows = (holdings.data ?? []).map((h) => {
    const q = qmap[h.symbol];
    const price = q?.price ?? h.avg_cost;
    return { ...h, price, value: price * h.qty, pl: (price - h.avg_cost) * h.qty, day: (q?.change ?? 0) * h.qty };
  });
  const invested = rows.reduce((s, r) => s + r.value, 0);
  const totalPL = rows.reduce((s, r) => s + r.pl, 0);
  const dayPL = rows.reduce((s, r) => s + r.day, 0);

  async function addWatch(e: React.FormEvent) {
    e.preventDefault();
    const s = addSym.trim().toUpperCase();
    if (!s) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("watchlist").insert({ user_id: u.user!.id, symbol: s });
    if (error) toast.error(error.code === "23505" ? "Already on your watchlist" : error.message);
    setAddSym("");
    qc.invalidateQueries({ queryKey: ["watchlist"] });
  }
  async function removeWatch(s: string) {
    await supabase.from("watchlist").delete().eq("symbol", s);
    qc.invalidateQueries({ queryKey: ["watchlist"] });
  }

  const sel = qmap[selected];
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back{profile.data?.full_name ? `, ${profile.data.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-sm text-muted-foreground">Prices refresh every 15 seconds.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total value" value={fmt(cash + invested)} />
        <Stat label="Buying power" value={fmt(cash)} />
        <Stat label="Invested" value={fmt(invested)} sub={`${totalPL >= 0 ? "+" : ""}${fmt(totalPL)} all time`} tone={totalPL} />
        <Stat label="Today" value={`${dayPL >= 0 ? "+" : ""}${fmt(dayPL)}`} tone={dayPL} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="text-xl font-semibold">{selected}</h2>
              <p className="text-sm text-muted-foreground">{sel?.name ?? ""}</p>
            </div>
            {sel && (
              <div className="text-right">
                <div className="num text-2xl">{fmt(sel.price)}</div>
                <div className={`num text-sm ${sel.change >= 0 ? "text-success" : "text-destructive"}`}>{pct(sel.changePct)}</div>
              </div>
            )}
          </div>
          <PriceChart symbol={selected} />
        </div>
        <TradeTicket symbol={selected} onSymbol={setSelected} price={sel?.price} cash={cash} owned={rows.find((r) => r.symbol === selected)?.qty ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass overflow-x-auto rounded-2xl p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Holdings</h2>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No positions yet — buy your first stock with the order ticket.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="pb-2">Symbol</th><th className="pb-2 text-right">Shares</th><th className="pb-2 text-right">Avg cost</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Value</th><th className="pb-2 text-right">P/L</th></tr>
              </thead>
              <tbody className="num">
                {rows.map((r) => (
                  <tr key={r.symbol} onClick={() => setSelected(r.symbol)} className="cursor-pointer border-t border-border hover:bg-accent/40">
                    <td className="py-2.5 font-sans font-semibold">{r.symbol}</td>
                    <td className="text-right">{r.qty}</td>
                    <td className="text-right">{fmt(r.avg_cost)}</td>
                    <td className="text-right">{fmt(r.price)}</td>
                    <td className="text-right">{fmt(r.value)}</td>
                    <td className={`text-right ${r.pl >= 0 ? "text-success" : "text-destructive"}`}>{fmt(r.pl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="glass rounded-2xl p-6">
          <h2 className="mb-4 font-semibold">Watchlist</h2>
          <form onSubmit={addWatch} className="mb-3 flex gap-2">
            <Input placeholder="Add symbol e.g. GOOGL" value={addSym} onChange={(e) => setAddSym(e.target.value)} />
            <Button size="icon" type="submit" aria-label="Add"><Plus className="h-4 w-4" /></Button>
          </form>
          <ul className="space-y-1">
            {(watch.data ?? []).map((s) => {
              const q = qmap[s];
              return (
                <li key={s} className="group flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent/40">
                  <button className="flex-1 text-left font-semibold" onClick={() => setSelected(s)}>{s}</button>
                  <span className="num text-sm">{q ? fmt(q.price) : "—"}</span>
                  <span className={`num ml-3 w-16 text-right text-xs ${q && q.change >= 0 ? "text-success" : "text-destructive"}`}>{q ? pct(q.changePct) : ""}</span>
                  <button onClick={() => removeWatch(s)} className="ml-2 opacity-0 group-hover:opacity-100" aria-label={`Remove ${s}`}><X className="h-3.5 w-3.5" /></button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`num mt-1 text-2xl ${tone === undefined ? "" : tone >= 0 ? "text-success" : "text-destructive"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function TradeTicket({ symbol, onSymbol, price, cash, owned }: { symbol: string; onSymbol: (s: string) => void; price?: number; cash: number; owned: number }) {
  const qc = useQueryClient();
  const trade = useServerFn(placeTrade);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("1");
  const [sym, setSym] = useState(symbol);
  const [busy, setBusy] = useState(false);
  const n = Number(qty) || 0;
  const est = price ? n * price : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await trade({ data: { symbol, side, qty: n } });
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${n} ${r.symbol} at ${fmt(r.price)}`);
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass flex flex-col gap-4 rounded-2xl p-6">
      <h2 className="font-semibold">Place order</h2>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button type="button" key={s} onClick={() => setSide(s)} className={`rounded-md py-1.5 text-sm capitalize ${side === s ? (s === "buy" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground") : "text-muted-foreground"}`}>{s}</button>
        ))}
      </div>
      <label className="text-xs text-muted-foreground">Symbol
        <Input className="mt-1 uppercase" value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} onBlur={() => sym && onSymbol(sym.trim())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSymbol(sym.trim()); } }} />
      </label>
      <label className="text-xs text-muted-foreground">Shares
        <Input className="mt-1 num" type="number" min="0.0001" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
      </label>
      <div className="space-y-1 text-sm">
        <Row k="Market price" v={price ? fmt(price) : "—"} />
        <Row k="Estimated total" v={fmt(est)} />
        <Row k={side === "buy" ? "Buying power" : "Shares owned"} v={side === "buy" ? fmt(cash) : String(owned)} />
      </div>
      <Button type="submit" variant={side === "buy" ? "success" : "destructive"} disabled={busy || n <= 0 || sym !== symbol}>
        {busy ? "Submitting…" : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
      </Button>
      <p className="text-[11px] text-muted-foreground">Market orders fill instantly at the live price. Practice money only.</p>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="num">{v}</span></div>;
}
