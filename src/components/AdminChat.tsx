import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminListMessages, adminListThreads, adminOpenChat, sendChatMessage } from "@/lib/chat.functions";

type Profile = { id: string; full_name: string | null };

export function AdminChat({ profiles }: { profiles: Profile[] }) {
  const qc = useQueryClient();
  const listThreads = useServerFn(adminListThreads);
  const listMessages = useServerFn(adminListMessages);
  const openChat = useServerFn(adminOpenChat);
  const send = useServerFn(sendChatMessage);

  const threads = useQuery({
    queryKey: ["admin-chat-threads"],
    queryFn: () => listThreads(),
    refetchInterval: 8_000,
  });

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["admin-chat-messages", threadId],
    queryFn: () => listMessages({ data: { threadId: threadId! } }),
    enabled: !!threadId,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  const filtered = profiles.filter((p) =>
    `${p.full_name ?? ""} ${p.id}`.toLowerCase().includes(filter.toLowerCase()),
  );

  async function selectUser(userId: string) {
    setSelectedUserId(userId);
    setDraft("");
    const existing = threads.data?.find((t) => t.user_id === userId);
    if (existing) {
      setThreadId(existing.id);
      return;
    }
    setThreadId(null);
  }

  async function startAndSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || busy) return;
    const body = draft.trim();
    if (!body) {
      toast.error("Write a message first.");
      return;
    }
    setBusy(true);
    try {
      if (threadId) {
        await send({ data: { threadId, body } });
      } else {
        const r = await openChat({ data: { userId: selectedUserId, body } });
        setThreadId(r.threadId);
      }
      setDraft("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-chat-threads"] }),
        qc.invalidateQueries({ queryKey: ["admin-chat-messages"] }),
      ]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selectedName =
    profiles.find((p) => p.id === selectedUserId)?.full_name || selectedUserId || "Select a user";

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <Input
          aria-label="Search accounts for chat"
          placeholder="Search name or ID"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Only administrators see this full chat history. Message a user to open a thread; they can reply afterward.
        </p>
        <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
          {filtered.map((p) => {
            const thread = threads.data?.find((t) => t.user_id === p.id);
            const active = selectedUserId === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void selectUser(p.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${active ? "bg-accent" : ""}`}
                >
                  <p className="font-semibold">{p.full_name || "Unnamed account"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {thread?.preview?.body ?? "No messages yet"}
                  </p>
                </button>
              </li>
            );
          })}
          {!filtered.length && <li className="px-2 py-4 text-sm text-muted-foreground">No matching accounts.</li>}
        </ul>
      </div>

      <div className="flex min-h-[28rem] flex-col rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">{selectedUserId ? selectedName : "Messages"}</h2>
          {selectedUserId && (
            <p className="text-xs text-muted-foreground">{selectedUserId}</p>
          )}
        </header>
        {!selectedUserId ? (
          <p className="m-auto p-6 text-sm text-muted-foreground">Select a user to start or continue a conversation.</p>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.isLoading && threadId ? (
                <p className="text-sm text-muted-foreground">Loading history…</p>
              ) : !threadId ? (
                <p className="text-sm text-muted-foreground">No thread yet — send the first message to open one.</p>
              ) : !(messages.data?.length) ? (
                <p className="text-sm text-muted-foreground">No messages in this conversation yet.</p>
              ) : (
                messages.data!.map((m) => {
                  const mine = m.sender_id !== selectedUserId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          mine ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottom} />
            </div>
            <form onSubmit={startAndSend} className="flex gap-2 border-t border-border p-3">
              <Input
                aria-label="Message"
                placeholder="Write a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !draft.trim()}>
                {busy ? "Sending…" : "Send"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
