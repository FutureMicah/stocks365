import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { openLoan, repayLoan } from "@/lib/account.functions";
import { fmt, loansQ, payment } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/lending")({
  head: () => ({ meta: [{ title: "Lending — stocks365" }, { name: "description", content: "HELOC and personal loan calculators." }] }),
  component: Lending,
});

const products = {
  heloc: { name: "Home Equity Line (HELOC)", rate: 7.25, max: 500_000, terms: [60, 120, 180, 240, 360], perks: ["Interest may be tax-deductible", "Draw only what you need", "Variable rate tied to prime"] },
  personal: { name: "Personal Loan", rate: 9.99, max: 100_000, terms: [12, 24, 36, 48, 60], perks: ["Fixed rate & payment", "No collateral required", "Funds in minutes"] },
} as const;

function Lending() {
  const loans = useQuery(loansQ);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lending & credit</h1>
        <p className="text-sm text-muted-foreground">Estimate payments and draw practice funds straight into your cash balance.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Calculator kind="heloc" />
        <Calculator kind="personal" />
      </div>
      <ActiveLoans loans={loans.data ?? []} />
    </div>
  );
}

function Calculator({ kind }: { kind: keyof typeof products }) {
  const p = products[kind];
  const qc = useQueryClient();
  const open = useServerFn(openLoan);
  const [amount, setAmount] = useState(kind === "heloc" ? 50_000 : 15_000);
  const [term, setTerm] = useState<number>(p.terms[2]);
  const [busy, setBusy] = useState(false);
  const pmt = payment(amount, p.rate, term);

  async function draw() {
    setBusy(true);
    try {
      await open({ data: { kind, principal: amount, term } });
      toast.success(`${fmt(amount, 0)} added to your cash balance`);
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass space-y-5 rounded-2xl p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{p.name}</h2>
        <span className="num text-sm text-primary">{p.rate}% APR</span>
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground">{p.perks.map((x) => <li key={x}>• {x}</li>)}</ul>
      <div>
        <div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="num">{fmt(amount, 0)}</span></div>
        <Slider min={1000} max={p.max} step={1000} value={[amount]} onValueChange={(v) => setAmount(v[0] ?? 1000)} />
      </div>
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Term</p>
        <div className="flex flex-wrap gap-2">
          {p.terms.map((t) => (
            <button key={t} onClick={() => setTerm(t)} className={`rounded-md border px-3 py-1 text-xs ${term === t ? "border-primary bg-primary/10" : "border-border"}`}>{t / 12} yr</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-4 text-sm">
        <div><p className="text-muted-foreground">Monthly payment</p><p className="num text-xl">{fmt(pmt)}</p></div>
        <div><p className="text-muted-foreground">Total interest</p><p className="num text-xl">{fmt(pmt * term - amount)}</p></div>
      </div>
      <Button variant="hero" className="w-full" onClick={draw} disabled={busy}>{busy ? "Processing…" : `Draw ${fmt(amount, 0)}`}</Button>
    </div>
  );
}

function ActiveLoans({ loans }: { loans: { id: string; kind: string; principal: number; balance: number; rate: number; monthly_payment: number; status: string; created_at: string }[] }) {
  const qc = useQueryClient();
  const repay = useServerFn(repayLoan);
  const [amt, setAmt] = useState<Record<string, string>>({});
  async function pay(id: string, amount: number) {
    try {
      await repay({ data: { loanId: id, amount } });
      toast.success("Payment applied");
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="mb-4 font-semibold">Your loans</h2>
      {loans.length === 0 ? <p className="text-sm text-muted-foreground">No loans yet.</p> : (
        <ul className="divide-y divide-border">
          {loans.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-4 py-4 text-sm">
              <div className="min-w-40 flex-1">
                <p className="font-semibold uppercase">{l.kind} <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${l.status === "active" ? "bg-primary/15 text-primary" : "bg-success/15 text-success"}`}>{l.status}</span></p>
                <p className="text-xs text-muted-foreground">{fmt(l.principal, 0)} at {l.rate}% · {fmt(l.monthly_payment)}/mo</p>
              </div>
              <div className="num">Balance {fmt(l.balance)}</div>
              {l.status === "active" && (
                <div className="flex gap-2">
                  <Input className="num w-28" type="number" placeholder="Amount" value={amt[l.id] ?? ""} onChange={(e) => setAmt({ ...amt, [l.id]: e.target.value })} />
                  <Button size="sm" variant="secondary" onClick={() => pay(l.id, Number(amt[l.id]) || l.monthly_payment)}>Pay</Button>
                  <Button size="sm" variant="outline" onClick={() => pay(l.id, l.balance)}>Pay off</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
