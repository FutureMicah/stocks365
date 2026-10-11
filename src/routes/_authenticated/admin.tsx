import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminAccess, getAdminOverview, getIdentityDocument, reviewIdentity } from "@/lib/admin.functions";
import { fmt } from "@/lib/data";

const accessQ = queryOptions({ queryKey: ["admin-access"], queryFn: () => getAdminAccess() });
const overviewQ = queryOptions({ queryKey: ["admin-overview"], queryFn: () => getAdminOverview() });
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administration — stocks365" }, { name: "description", content: "Restricted account oversight and identity review for stocks365 administrators." }, { property: "og:title", content: "Administration — stocks365" }, { property: "og:description", content: "Restricted account oversight and identity review." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: async ({ context }) => {
    const allowed = await context.queryClient.ensureQueryData(accessQ);
    if (allowed) await context.queryClient.ensureQueryData(overviewQ);
  },
  component: Admin,
});
function Admin() {
  const { data: allowed } = useSuspenseQuery(accessQ);
  if (!allowed) return <div className="mx-auto max-w-xl py-12"><h1 className="text-2xl">Administrator access required</h1><p className="mt-3 text-muted-foreground">This account does not have permission to view administration records.</p></div>;
  return <Overview />;
}
function Overview() {
  const { data } = useSuspenseQuery(overviewQ);
  const qc = useQueryClient();
  const [tab, setTab] = useState("accounts");
  const [search, setSearch] = useState("");
  const pending = data.profiles.filter((p) => p.kyc_status === "submitted");
  const profiles = data.profiles.filter((p) => `${p.full_name ?? ""} ${p.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-primary">stocks365</p><h1 className="text-3xl">Administration</h1></div><Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["admin-overview"] })}><RefreshCw />Refresh</Button></header>
    <dl className="grid gap-5 border-y border-border py-5 sm:grid-cols-2 lg:grid-cols-4">{[["Accounts loaded", String(data.profiles.length)], ["Pending identity reviews", String(pending.length)], ["Account cash (practice)", fmt(data.profiles.reduce((s, p) => s + Number(p.cash), 0))], ["Active loan balances (practice)", fmt(data.loans.filter((l) => l.status === "active").reduce((s, l) => s + Number(l.balance), 0))]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="num mt-2 break-words text-xl">{value}</dd></div>)}</dl>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Administration views">{[["accounts", "Accounts"], ["reviews", "Identity reviews"], ["activity", "Transfers & trades"], ["audit", "Review history"]].map(([id, label]) => <Button key={id} role="tab" aria-selected={tab === id} variant={tab === id ? "default" : "ghost"} onClick={() => setTab(id ?? "accounts")}>{label}</Button>)}</div>
    {tab === "accounts" && <><Input aria-label="Search accounts" placeholder="Search name or account ID" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" /><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-3">Account</th><th>Identity status</th><th>Created</th><th className="text-right">Practice cash</th></tr></thead><tbody>{profiles.map((p) => <tr key={p.id} className="border-b border-border"><td className="py-3"><p className="font-semibold">{p.full_name || "Unnamed account"}</p><p className="text-xs text-muted-foreground">{p.id}</p></td><td className="capitalize">{p.kyc_status}</td><td>{new Date(p.created_at).toLocaleDateString()}</td><td className="num text-right">{fmt(Number(p.cash))}</td></tr>)}</tbody></table>{profiles.length === 0 && <p className="py-8 text-muted-foreground">No matching accounts.</p>}</div></>}
    {tab === "reviews" && <div className="space-y-4">{pending.map((p) => <Review key={p.id} profile={p} />)}{!pending.length && <p className="py-8 text-muted-foreground">No pending identity submissions.</p>}</div>}
    {tab === "activity" && <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-3">Date</th><th>Account</th><th>Activity</th><th>Method / symbol</th><th className="text-right">Amount</th></tr></thead><tbody>{data.transactions.map((t) => <tr key={t.id} className="border-b border-border"><td className="py-3">{new Date(t.created_at).toLocaleString()}</td><td>{data.profiles.find((p) => p.id === t.user_id)?.full_name || t.user_id}</td><td className="capitalize">{t.type}</td><td>{t.symbol || t.method || "—"}</td><td className="num text-right">{fmt(Number(t.amount))}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-muted-foreground">Latest 100 recorded transactions · practice funds</p></div>}
    {tab === "audit" && <ul className="divide-y divide-border">{data.audit.map((a) => <li key={a.id} className="py-4"><p className="font-semibold">{a.action.replaceAll("_", " ")}</p><p className="text-sm">{a.note}</p><p className="mt-1 text-xs text-muted-foreground">{a.subject_id} · {new Date(a.created_at).toLocaleString()}</p></li>)}{!data.audit.length && <li className="py-8 text-muted-foreground">No identity decisions recorded.</li>}</ul>}
  </div>;
}
function Review({ profile }: { profile: { id: string; full_name: string | null; id_type: string | null } }) {
  const open = useServerFn(getIdentityDocument);
  const review = useServerFn(reviewIdentity);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  async function document() {
    setBusy(true);
    try { const result = await open({ data: { userId: profile.id } }); setDocumentUrl(result.url); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function decide(status: "verified" | "rejected") {
    if (!window.confirm(`${status === "verified" ? "Approve" : "Reject"} this identity submission?`)) return;
    setBusy(true);
    try { await review({ data: { userId: profile.id, status, note } }); toast.success("Identity review recorded"); await qc.invalidateQueries({ queryKey: ["admin-overview"] }); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return <article className="space-y-3 rounded-lg border border-border bg-card p-5"><h2 className="font-semibold">{profile.full_name || "Unnamed account"}</h2><p className="text-xs text-muted-foreground">{profile.id_type?.replaceAll("_", " ")}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={document} disabled={busy}><ExternalLink />Request document link</Button>{documentUrl && <Button asChild variant="outline"><a href={documentUrl} target="_blank" rel="noopener noreferrer">Open ID (expires in 60 seconds)</a></Button>}</div><Input aria-label={`Review note for ${profile.full_name}`} placeholder="Review decision note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /><div className="flex gap-2"><Button disabled={busy || note.trim().length < 3} onClick={() => decide("verified")}>Approve identity</Button><Button variant="destructive" disabled={busy || note.trim().length < 3} onClick={() => decide("rejected")}>Reject identity</Button></div></article>;
}