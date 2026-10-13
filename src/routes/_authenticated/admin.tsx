import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RefreshCw, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminAccess, getAdminOverview, getAccountDetail, getIdentityDocument, reviewIdentity, decideCash, decideLoan, inviteAdmin, revokeAdmin } from "@/lib/admin.functions";
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
  const [selected, setSelected] = useState<string | null>(null);
  const pending = data.profiles.filter((p) => p.kyc_status === "submitted");
  const name = (id: string) => data.profiles.find((p) => p.id === id)?.full_name || id;
  const pendingCash = data.cash.filter((c) => c.status === "pending");
  const pendingLoans = data.loans.filter((l) => l.status === "pending");
  const profiles = data.profiles.filter((p) => `${p.full_name ?? ""} ${p.id}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-primary">stocks365</p><h1 className="text-3xl">Administration</h1></div><Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["admin-overview"] })}><RefreshCw />Refresh</Button></header>
    <dl className="grid gap-5 border-y border-border py-5 sm:grid-cols-2 lg:grid-cols-4">{[["Accounts", String(data.profiles.length)], ["Pending approvals", String(pending.length + pendingCash.length + pendingLoans.length)], ["Total account cash", fmt(data.profiles.reduce((s, p) => s + Number(p.cash), 0))], ["Active loan balances", fmt(data.loans.filter((l) => l.status === "active").reduce((s, l) => s + Number(l.balance), 0))]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="num mt-2 break-words text-xl">{value}</dd></div>)}</dl>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Administration views">{[["accounts", "Accounts"], ["funding", `Deposits & withdrawals (${pendingCash.length})`], ["loans", `Loans (${pendingLoans.length})`], ["reviews", `Identity reviews (${pending.length})`], ...(data.isSuper ? [["admins", "Administrators"]] : []), ["activity", "Transfers & trades"], ["audit", "Review history"]].map(([id, label]) => <Button key={id} role="tab" aria-selected={tab === id} variant={tab === id ? "default" : "ghost"} onClick={() => setTab(id ?? "accounts")}>{label}</Button>)}</div>
    {tab === "accounts" && selected && <AccountDetail id={selected} onBack={() => setSelected(null)} />}
    {tab === "accounts" && !selected && <><Input aria-label="Search accounts" placeholder="Search name or account ID" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" /><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-3">Account</th><th>Identity status</th><th>Created</th><th className="text-right">Cash balance</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{profiles.map((p) => <tr key={p.id} className="border-b border-border"><td className="py-3"><p className="font-semibold">{p.full_name || "Unnamed account"}</p><p className="text-xs text-muted-foreground">{p.id}</p></td><td className="capitalize">{p.kyc_status}</td><td>{new Date(p.created_at).toLocaleDateString()}</td><td className="num text-right">{fmt(Number(p.cash))}</td><td className="text-right"><Button variant="outline" size="sm" onClick={() => setSelected(p.id)}>View</Button></td></tr>)}</tbody></table>{profiles.length === 0 && <p className="py-8 text-muted-foreground">No matching accounts.</p>}</div></>}
    {tab === "funding" && <div className="space-y-3">{data.cash.map((c) => <Decision key={c.id} kind="cash" id={c.id} pending={c.status === "pending"} title={`${c.type === "deposit" ? "Deposit" : "Withdrawal"} · ${c.method.toUpperCase()} · ${fmt(Number(c.amount))}`} sub={`${name(c.user_id)} · ${new Date(c.created_at).toLocaleString()} · ${c.status}${c.note ? ` · ${c.note}` : ""}`} />)}{!data.cash.length && <p className="py-8 text-muted-foreground">No deposit or withdrawal requests.</p>}</div>}
    {tab === "loans" && <div className="space-y-3">{data.loans.map((l) => <Decision key={l.id} kind="loan" id={l.id} pending={l.status === "pending"} title={`${l.kind.toUpperCase()} · ${fmt(Number(l.principal))} · ${l.term_months} months @ ${l.rate}%`} sub={`${name(l.user_id)} · ${new Date(l.created_at).toLocaleDateString()} · ${l.status} · balance ${fmt(Number(l.balance))}`} />)}{!data.loans.length && <p className="py-8 text-muted-foreground">No loan applications.</p>}</div>}
    {tab === "admins" && data.isSuper && <Admins roles={data.roles} name={name} />}
    {tab === "reviews" && <div className="space-y-4">{pending.map((p) => <Review key={p.id} profile={p} />)}{!pending.length && <p className="py-8 text-muted-foreground">No pending identity submissions.</p>}</div>}
    {tab === "activity" && <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-3">Date</th><th>Account</th><th>Activity</th><th>Method / symbol</th><th className="text-right">Amount</th></tr></thead><tbody>{data.transactions.map((t) => <tr key={t.id} className="border-b border-border"><td className="py-3">{new Date(t.created_at).toLocaleString()}</td><td>{data.profiles.find((p) => p.id === t.user_id)?.full_name || t.user_id}</td><td className="capitalize">{t.type}</td><td>{t.symbol || t.method || "—"}</td><td className="num text-right">{fmt(Number(t.amount))}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-muted-foreground">Latest 100 recorded transactions</p></div>}
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
function Decision({ kind, id, title, sub, pending }: { kind: "cash" | "loan"; id: string; title: string; sub: string; pending: boolean }) {
  const cash = useServerFn(decideCash);
  const loan = useServerFn(decideLoan);
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(approve: boolean) {
    if (!window.confirm(`${approve ? "Approve" : "Reject"} this request?`)) return;
    setBusy(true);
    try { await (kind === "cash" ? cash : loan)({ data: { id, approve, note } }); toast.success(approve ? "Approved" : "Rejected"); await qc.invalidateQueries({ queryKey: ["admin-overview"] }); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return <article className="rounded-lg border border-border bg-card p-4"><p className="font-semibold">{title}</p><p className="text-xs capitalize text-muted-foreground">{sub}</p>{pending && <div className="mt-3 flex flex-wrap gap-2"><Input aria-label="Decision note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="max-w-sm" /><Button disabled={busy} onClick={() => go(true)}>Approve</Button><Button variant="destructive" disabled={busy} onClick={() => go(false)}>Reject</Button></div>}</article>;
}
function Admins({ roles, name }: { roles: { user_id: string; role: string }[]; name: (id: string) => string }) {
  const invite = useServerFn(inviteAdmin);
  const revoke = useServerFn(revokeAdmin);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const admins = roles.filter((r) => r.role === "admin");
  const supers = new Set(roles.filter((r) => r.role === "super_admin").map((r) => r.user_id));
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { const r = await invite({ data: { email, redirectTo: `${window.location.origin}/reset-password` } }); toast.success(r.invited ? "Invitation email sent" : "Existing user promoted and notified by email"); setEmail(""); await qc.invalidateQueries({ queryKey: ["admin-overview"] }); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Remove administrator access?")) return;
    try { await revoke({ data: { userId: id } }); toast.success("Access removed"); await qc.invalidateQueries({ queryKey: ["admin-overview"] }); } catch (err) { toast.error((err as Error).message); }
  }
  return <div className="space-y-5"><form onSubmit={send} className="flex max-w-lg flex-wrap gap-2"><Input type="email" required aria-label="Administrator email" placeholder="new.admin@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1" /><Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send admin invitation"}</Button></form><ul className="divide-y divide-border">{admins.map((a) => <li key={a.user_id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold">{name(a.user_id)}</p><p className="text-xs text-muted-foreground">{supers.has(a.user_id) ? "Super administrator" : "Administrator"}</p></div>{!supers.has(a.user_id) && <Button variant="outline" size="sm" onClick={() => remove(a.user_id)}>Remove</Button>}</li>)}</ul></div>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value || "—"}</dd></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="text-lg font-semibold">{title}</h2><div className="overflow-x-auto">{children}</div></section>;
}
function AccountDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const load = useServerFn(getAccountDetail);
  const q = useQuery({ queryKey: ["admin-account", id], queryFn: () => load({ data: { userId: id } }) });
  const back = <Button variant="ghost" onClick={onBack}><ArrowLeft />All accounts</Button>;
  if (q.isLoading) return <div className="space-y-4">{back}<div className="h-48 animate-pulse rounded-lg bg-muted" /></div>;
  if (q.isError || !q.data) return <div className="space-y-4">{back}<p className="text-destructive">{(q.error as Error | null)?.message ?? "Unable to load this account."}</p><Button variant="outline" onClick={() => q.refetch()}>Try again</Button></div>;
  const { profile: p, holdings, transactions, loans, cash, audit } = q.data;
  const costBasis = holdings.reduce((s, h) => s + Number(h.qty) * Number(h.avg_cost), 0);
  const th = "py-2 pr-4 font-normal";
  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3">{back}<Button variant="outline" onClick={() => q.refetch()}><RefreshCw />Refresh</Button></div>
    <header><h1 className="text-2xl">{p.full_name || "Unnamed account"}</h1><p className="text-xs text-muted-foreground">{p.id}</p></header>
    <dl className="grid gap-5 border-y border-border py-5 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Cash balance" value={<span className="num text-xl">{fmt(Number(p.cash))}</span>} />
      <Field label="Holdings at cost" value={<span className="num">{fmt(costBasis)}</span>} />
      <Field label="Identity status" value={<span className="capitalize">{p.kyc_status}</span>} />
      <Field label="Joined" value={new Date(p.created_at).toLocaleDateString()} />
      <Field label="Email" value={q.data.email} />
      <Field label="Phone" value={p.phone} />
      <Field label="Last sign-in" value={q.data.lastSignIn ? new Date(q.data.lastSignIn).toLocaleString() : null} />
      <Field label="Identity submitted" value={p.kyc_submitted_at ? new Date(p.kyc_submitted_at).toLocaleString() : null} />
      <Field label="Date of birth" value={p.date_of_birth} />
      <Field label="Address" value={p.address} />
      <Field label="ID type" value={p.id_type?.replaceAll("_", " ")} />
      <Field label="SSN (last 4)" value={p.ssn_last4 ? `•••• ${p.ssn_last4}` : null} />
    </dl>
    <Section title={`Holdings (${holdings.length})`}>
      <table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className={th}>Symbol</th><th className={`${th} text-right`}>Shares</th><th className={`${th} text-right`}>Avg cost</th><th className={`${th} text-right`}>Cost basis</th></tr></thead><tbody>{holdings.map((h) => <tr key={h.symbol} className="border-b border-border"><td className="py-2 pr-4 font-semibold">{h.symbol}</td><td className="num pr-4 text-right">{Number(h.qty)}</td><td className="num pr-4 text-right">{fmt(Number(h.avg_cost))}</td><td className="num text-right">{fmt(Number(h.qty) * Number(h.avg_cost))}</td></tr>)}</tbody></table>
      {!holdings.length && <p className="py-4 text-muted-foreground">No holdings.</p>}
    </Section>
    <Section title={`Loans (${loans.length})`}>
      <table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className={th}>Type</th><th className={`${th} text-right`}>Principal</th><th className={`${th} text-right`}>Balance</th><th className={`${th} text-right`}>Monthly</th><th className={th}>Terms</th><th className={th}>Status</th><th className={th}>Opened</th></tr></thead><tbody>{loans.map((l) => <tr key={l.id} className="border-b border-border"><td className="py-2 pr-4 uppercase">{l.kind}</td><td className="num pr-4 text-right">{fmt(Number(l.principal))}</td><td className="num pr-4 text-right">{fmt(Number(l.balance))}</td><td className="num pr-4 text-right">{fmt(Number(l.monthly_payment))}</td><td className="pr-4">{l.term_months} mo @ {Number(l.rate)}%</td><td className="pr-4 capitalize">{l.status}</td><td>{new Date(l.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>
      {!loans.length && <p className="py-4 text-muted-foreground">No loans.</p>}
    </Section>
    <Section title={`Deposit & withdrawal requests (${cash.length})`}>
      <table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className={th}>Date</th><th className={th}>Type</th><th className={th}>Method</th><th className={`${th} text-right`}>Amount</th><th className={`${th} pl-4`}>Status</th><th className={th}>Note</th></tr></thead><tbody>{cash.map((c) => <tr key={c.id} className="border-b border-border"><td className="py-2 pr-4">{new Date(c.created_at).toLocaleString()}</td><td className="pr-4 capitalize">{c.type}</td><td className="pr-4 uppercase">{c.method}</td><td className="num pr-4 text-right">{fmt(Number(c.amount))}</td><td className="pl-4 pr-4 capitalize">{c.status}</td><td>{c.note || "—"}</td></tr>)}</tbody></table>
      {!cash.length && <p className="py-4 text-muted-foreground">No requests.</p>}
    </Section>
    <Section title="Transactions">
      <table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className={th}>Date</th><th className={th}>Activity</th><th className={th}>Symbol / method</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Price</th><th className={`${th} text-right`}>Fee</th><th className={`${th} text-right`}>Amount</th></tr></thead><tbody>{transactions.map((t) => <tr key={t.id} className="border-b border-border"><td className="py-2 pr-4">{new Date(t.created_at).toLocaleString()}</td><td className="pr-4 capitalize">{t.type}</td><td className="pr-4">{t.symbol || t.method || "—"}</td><td className="num pr-4 text-right">{t.qty == null ? "—" : Number(t.qty)}</td><td className="num pr-4 text-right">{t.price == null ? "—" : fmt(Number(t.price))}</td><td className="num pr-4 text-right">{Number(t.fee) ? fmt(Number(t.fee)) : "—"}</td><td className="num text-right">{fmt(Number(t.amount))}</td></tr>)}</tbody></table>
      {!transactions.length && <p className="py-4 text-muted-foreground">No transactions.</p>}
      {transactions.length === 200 && <p className="mt-2 text-xs text-muted-foreground">Showing the latest 200 transactions</p>}
    </Section>
    <Section title="Admin actions on this account">
      <ul className="divide-y divide-border">{audit.map((a) => <li key={a.id} className="py-3"><p className="font-semibold capitalize">{a.action.replaceAll("_", " ")}</p><p className="text-sm">{a.note}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p></li>)}</ul>
      {!audit.length && <p className="py-4 text-muted-foreground">No admin actions recorded.</p>}
    </Section>
  </div>;
}
