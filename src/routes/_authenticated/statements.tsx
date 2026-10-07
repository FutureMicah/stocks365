import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmt, txQ } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/statements")({
  head: () => ({ meta: [{ title: "Statements — stocks365" }, { name: "description", content: "Your full account activity." }] }),
  component: Statements,
});

const filters = ["all", "buy", "sell", "deposit", "withdrawal", "loan", "loan_payment"] as const;

function Statements() {
  const tx = useQuery(txQ);
  const [f, setF] = useState<(typeof filters)[number]>("all");
  const rows = (tx.data ?? []).filter((t) => f === "all" || t.type === f);

  function download() {
    const head = "Date,Type,Symbol,Shares,Price,Amount,Method,Note\n";
    const body = rows.map((t) => [new Date(t.created_at).toISOString(), t.type, t.symbol ?? "", t.qty ?? "", t.price ?? "", t.amount, t.method ?? "", (t.note ?? "").replace(/,/g, " ")].join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "stocks365-statement.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Account statements</h1><p className="text-sm text-muted-foreground">Every trade, transfer and loan on your account.</p></div>
        <Button variant="outline" onClick={download} disabled={!rows.length}><Download className="h-4 w-4" />Download CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((x) => (
          <button key={x} onClick={() => setF(x)} className={`rounded-full border px-3 py-1 text-xs capitalize ${f === x ? "border-primary bg-primary/10" : "border-border text-muted-foreground"}`}>{x.replace("_", " ")}</button>
        ))}
      </div>
      <div className="glass overflow-x-auto rounded-2xl p-6">
        {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No activity.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2">Date</th><th className="pb-2">Activity</th><th className="pb-2 text-right">Shares</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Amount</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2.5 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="capitalize">{t.type.replace("_", " ")} {t.symbol && <b>{t.symbol}</b>} {t.method && <span className="text-xs uppercase text-muted-foreground">· {t.method}</span>}</td>
                  <td className="num text-right">{t.qty ?? ""}</td>
                  <td className="num text-right">{t.price ? fmt(t.price) : ""}</td>
                  <td className={`num text-right ${t.amount >= 0 ? "text-success" : "text-destructive"}`}>{fmt(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
