import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Bitcoin, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { moveCash } from "@/lib/account.functions";
import { fmt, profileQ, txQ } from "@/lib/data";
import { getFundingInstructions, type FundingInstructions } from "@/lib/funding.functions";
import { DemoFundsNotice } from "@/components/DemoFundsNotice";

export const Route = createFileRoute("/_authenticated/funds")({
  head: () => ({ meta: [{ title: "Funds — stocks365" }, { name: "description", content: "Deposit and withdraw funds by ACH transfer or crypto." }] }),
  component: Funds,
});

const methods = [
  { id: "ach", label: "ACH transfer", icon: Building2, note: "1–3 business days" },
  { id: "crypto", label: "Crypto deposit", icon: Bitcoin, note: "~30 minutes" },
] as const;

function Funds() {
  const qc = useQueryClient();
  const move = useServerFn(moveCash);
  const profile = useQuery(profileQ);
  const tx = useQuery(txQ);
  const loadInstructions = useServerFn(getFundingInstructions);
  const instructions = useQuery({ queryKey: ["funding-instructions"], queryFn: () => loadInstructions() });
  const reqs = useQuery({ queryKey: ["cash-requests"], queryFn: async () => { const { data, error } = await supabase.from("cash_requests").select("id,type,method,amount,status,note,created_at").order("created_at", { ascending: false }).limit(20); if (error) throw error; return data; } });
  const [type, setType] = useState<"deposit" | "withdrawal">("deposit");
  const [method, setMethod] = useState<(typeof methods)[number]["id"]>("ach");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const cash = profile.data?.cash ?? 0;
  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= 1 && value <= 10_000_000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001 && (type === "deposit" || value <= cash);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !valid) return;
    setMessage("");
    setBusy(true);
    try {
      await move({ data: { type, method, amount: Number(amount) } });
      toast.success("Request sent for administrator approval");
      setMessage(`${type === "deposit" ? "Deposit" : "Withdrawal"} request of ${fmt(value)} submitted. Your balance updates once an administrator approves it.`);
      setAmount("");
      await Promise.all([qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["transactions"] }), qc.invalidateQueries({ queryKey: ["cash-requests"] })]);
    } catch (err) {
      toast.error((err as Error).message);
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cashTx = (tx.data ?? []).filter((t) => ["deposit", "withdrawal"].includes(t.type)).slice(0, 15);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Deposit & withdraw</h1>
        <p className="text-sm text-muted-foreground">Available cash: <span className="num text-foreground">{fmt(profile.data?.cash ?? 0)}</span></p>
      </div>
      <form onSubmit={submit} className="glass space-y-5 rounded-lg p-6">
        <div className="grid w-full max-w-64 grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["deposit", "withdrawal"] as const).map((t) => (
            <Button type="button" key={t} disabled={busy} aria-pressed={type === t} variant={type === t ? "default" : "ghost"} onClick={() => { setType(t); setMessage(""); }} className="capitalize">{t === "withdrawal" ? "Withdraw" : "Deposit"}</Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {methods.map((m) => (
            <Button type="button" variant="outline" key={m.id} disabled={busy} aria-pressed={method === m.id} onClick={() => setMethod(m.id)} className={`h-auto flex-col items-start whitespace-normal rounded-lg border p-4 text-left transition ${method === m.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40"}`}>
              <m.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-semibold">{m.label}</p>
              <span className="text-xs text-muted-foreground">{m.note}</span>
            </Button>
          ))}
        </div>
        {type === "deposit" && <DepositDetails method={method} q={instructions} />}
        <div className="flex max-w-md flex-wrap gap-3">
          <Input aria-label="Amount (USD)" type="number" min="1" max={type === "withdrawal" ? cash : 10_000_000} step="0.01" required placeholder="Amount (USD)" className="num min-w-0 flex-1" disabled={busy} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button type="submit" variant="hero" disabled={busy || !valid || profile.isLoading || profile.isError}>{busy ? "Processing…" : type === "deposit" ? "Deposit" : "Withdraw"}</Button>
        </div>
        {type === "withdrawal" && value > cash && <p className="text-sm text-destructive">Amount exceeds your available cash.</p>}
        {message && <p role="status" className="text-sm">{message}</p>}
        {profile.isError && <p role="alert" className="text-sm text-destructive">Unable to load your balance. Refresh before transferring.</p>}
        <p className="text-xs text-muted-foreground">Every deposit and withdrawal is reviewed and approved by an administrator before your balance changes.</p>
      </form>
      <div className="glass rounded-2xl p-6">
        <h2 className="mb-4 font-semibold">Your requests</h2>
        {reqs.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !reqs.data?.length ? <p className="text-sm text-muted-foreground">No requests yet.</p> : (
          <ul className="divide-y divide-border">{reqs.data.map((r) => <li key={r.id} className="flex justify-between gap-3 py-3 text-sm"><div><p className="capitalize">{r.type} · <span className="uppercase text-muted-foreground">{r.method}</span></p><p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}{r.note ? ` · ${r.note}` : ""}</p></div><div className="text-right"><p className="num">{fmt(Number(r.amount))}</p><p className={`text-xs capitalize ${r.status === "approved" ? "text-success" : r.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>{r.status}</p></div></li>)}</ul>
        )}
      </div>
      <div className="glass rounded-2xl p-6">
        <h2 className="mb-4 font-semibold">Completed transfers</h2>
        {tx.isLoading ? <p className="text-sm text-muted-foreground">Loading transfers…</p> : tx.isError ? <p role="alert" className="text-sm text-destructive">Unable to load transfer history.</p> : cashTx.length === 0 ? <p className="text-sm text-muted-foreground">No transfers yet.</p> : (
          <ul className="divide-y divide-border">
            {cashTx.map((t) => (
              <li key={t.id} className="flex justify-between py-3 text-sm">
                <div><p className="capitalize">{t.type} · <span className="uppercase text-muted-foreground">{t.method}</span></p><p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p></div>
                <span className={`num ${t.amount >= 0 ? "text-success" : "text-destructive"}`}>{t.amount >= 0 ? "+" : ""}{fmt(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DepositDetails({ method, q }: { method: "ach" | "crypto"; q: { data: FundingInstructions | undefined; isLoading: boolean; isError: boolean } }) {
  if (q.isLoading) return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  if (q.isError || !q.data) return <p role="alert" className="text-sm text-destructive">Unable to load deposit instructions.</p>;
  const rows: [string, string][] = method === "ach"
    ? [["Bank name", q.data.ach.bankName], ["Account holder", q.data.ach.accountName], ["Routing number", q.data.ach.routingNumber], ["Account number", q.data.ach.accountNumber]]
    : [["Asset", q.data.crypto.asset], ["Network", q.data.crypto.network], ["Wallet address", q.data.crypto.address]];
  const note = method === "ach" ? q.data.ach.instructions : q.data.crypto.instructions;
  const set = rows.filter(([, v]) => v);
  return (
    <div className="space-y-3">
      <DemoFundsNotice />
      {set.length === 0 ? <p className="text-sm text-muted-foreground">Deposit details for this method have not been set up yet.</p> : (
        <dl className="divide-y divide-border rounded-lg border border-border">
          {set.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="flex min-w-0 items-center gap-2"><span className="num break-all text-right">{value}</span><Button type="button" variant="ghost" size="icon" aria-label={`Copy ${label}`} onClick={() => navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`))}><Copy className="h-4 w-4" /></Button></dd>
            </div>
          ))}
        </dl>
      )}
      {note && <p className="whitespace-pre-line text-sm">{note}</p>}
    </div>
  );
}
