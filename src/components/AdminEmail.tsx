import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEmailSettings, listAccountEmails, sendSupportEmail } from "@/lib/email.functions";

export function AdminEmail() {
  const qc = useQueryClient();
  const loadSettings = useServerFn(getEmailSettings);
  const loadAccounts = useServerFn(listAccountEmails);
  const send = useServerFn(sendSupportEmail);

  const settings = useQuery({ queryKey: ["admin-email-settings"], queryFn: () => loadSettings() });
  const accounts = useQuery({ queryKey: ["admin-account-emails"], queryFn: () => loadAccounts() });

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return (accounts.data ?? []).filter(
      (a) =>
        !q ||
        (a.email ?? "").toLowerCase().includes(q) ||
        (a.full_name ?? "").toLowerCase().includes(q) ||
        a.id.includes(q),
    );
  }, [accounts.data, filter]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await send({ data: { to: to.trim(), subject: subject.trim(), body: body.trim() } });
      toast.success("Email sent");
      setSubject("");
      setBody("");
      await qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const webmail = settings.data?.webmailUrl ?? "https://webmail.hostinger.com";

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold">Client accounts</p>
        <Input
          aria-label="Filter accounts"
          placeholder="Search name or email"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="max-h-[28rem] space-y-1 overflow-y-auto text-sm">
          {accounts.isLoading && <li className="text-muted-foreground">Loading…</li>}
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-2 text-left hover:bg-accent"
                onClick={() => a.email && setTo(a.email)}
                disabled={!a.email}
              >
                <p className="font-medium">{a.full_name || "Unnamed"}</p>
                <p className="truncate text-xs text-muted-foreground">{a.email || "No email"}</p>
              </button>
            </li>
          ))}
          {!accounts.isLoading && !filtered.length && (
            <li className="text-muted-foreground">No matching accounts.</li>
          )}
        </ul>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">Support email</p>
              <p className="text-xs text-muted-foreground">
                {settings.data?.canSend
                  ? `Sending as ${settings.data.from} via Resend.`
                  : "Compose here when Resend is configured, or open Hostinger webmail for full inbox."}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" asChild>
            <a href={webmail} target="_blank" rel="noreferrer">
              Open webmail <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>

        <form onSubmit={onSend} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">To</span>
            <Input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@email.com"
              disabled={busy}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Subject</span>
            <Input
              required
              minLength={3}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Deposit approved"
              disabled={busy}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Message</span>
            <textarea
              required
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex min-h-[8rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Write your message to the client…"
              disabled={busy}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || !to.trim() || subject.trim().length < 3 || !body.trim()}>
              {busy ? "Sending…" : "Send email"}
            </Button>
            {!settings.data?.canSend && (
              <p className="text-xs text-muted-foreground">
                Set <code className="text-foreground">RESEND_API_KEY</code> and{" "}
                <code className="text-foreground">SUPPORT_FROM_EMAIL</code> (your domain mailbox) to enable send.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
