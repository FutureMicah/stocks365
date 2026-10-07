import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Bitcoin, Smartphone, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moveCash } from "@/lib/account.functions";
import { fmt, profileQ, txQ } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/funds")({
  head: () => ({ meta: [{ title: "Funds — stocks365" }, { name: "description", content: "Deposit and withdraw practice funds." }] }),
  component: Funds,
});

const methods = [
  { id: "ach", label: "ACH transfer", icon: Building2, note: "1–3 business days" },
  { id: "wire", label: "Domestic wire", icon: Landmark, note: "Same day" },
  { id: "crypto", label: "Crypto deposit", icon: Bitcoin, note: "~30 minutes" },
  { id: "check", label: "Mobile check", icon: Smartphone, note: "1–2 business days" },
] as const;

function Funds() {
  const qc = useQueryClient();
  const move = useServerFn(moveCash);
  const profile = useQuery(profileQ);
  const tx = useQuery(txQ);
  const [type, setType] = useState<"deposit" | "withdrawal">("deposit");
  const [method, setMethod] = useState<(typeof methods)[number]["id"]>("ach");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await move({ data: { type, method, amount: Number(amount) } });
      toast.success(`${type === "deposit" ? "Deposited" : "Withdrew"} ${fmt(Number(amount))}`);
      setAmount("");
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
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
      <form onSubmit={submit} className="glass space-y-5 rounded-2xl p-6">
        <div className="grid w-64 grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["deposit", "withdrawal"] as const).map((t) => (
            <button type="button" key={t} onClick={() => setType(t)} className={`rounded-md py-1.5 text-sm capitalize ${type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {methods.map((m) => (
            <button type="button" key={m.id} onClick={() => setMethod(m.id)} className={`rounded-xl border p-4 text-left transition ${method === m.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40"}`}>
              <m.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-semibold">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.note}</p>
            </button>
          ))}
        </div>
        <div className="flex max-w-md gap-3">
          <Input type="number" min="1" step="0.01" required placeholder="Amount (USD)" className="num" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button type="submit" variant="hero" disabled={busy}>{busy ? "Processing…" : type === "deposit" ? "Deposit" : "Withdraw"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">Practice funds settle instantly. No real bank account is charged.</p>
      </form>
      <div className="glass rounded-2xl p-6">
        <h2 className="mb-4 font-semibold">Recent transfers</h2>
        {cashTx.length === 0 ? <p className="text-sm text-muted-foreground">No transfers yet.</p> : (
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
