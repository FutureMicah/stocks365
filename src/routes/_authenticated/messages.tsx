import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyChat, sendChatMessage, userOpenChat } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — stocks365" },
      { name: "description", content: "Chat with stocks365 support." },
    ],
  }),
  component: Messages,
});

const authRoute = getRouteApi("/_authenticated");

function Messages() {
  const { user } = authRoute.useRouteContext();
  const qc = useQueryClient();
  const load = useServerFn(getMyChat);
  const send = useServerFn(sendChatMessage);
  const open = useServerFn(userOpenChat);
  const chat = useQuery({
    queryKey: ["my-chat"],
    queryFn: () => load(),
    refetchInterval: 4_000,
    retry: 2,
  });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.data?.messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      if (chat.data?.thread?.id) {
        await send({ data: { threadId: chat.data.thread.id, body } });
      } else {
        await open({ data: { body } });
      }
      setDraft("");
      await qc.invalidateQueries({ queryKey: ["my-chat"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const messages = chat.data?.messages ?? [];
  const hasThread = !!chat.data?.thread;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with stocks365 support. You can send the first message — an administrator will reply here.
        </p>
      </div>

      <div className="flex min-h-[24rem] flex-col rounded-2xl border border-border bg-card">
        {chat.isLoading ? (
          <p className="m-auto text-sm text-muted-foreground">Loading conversation…</p>
        ) : chat.isError ? (
          <div className="m-auto max-w-sm space-y-3 p-6 text-center">
            <p role="alert" className="text-sm text-destructive">
              {(chat.error as Error)?.message || "Unable to load messages."}
            </p>
            <p className="text-xs text-muted-foreground">
              If this keeps failing, the chat database migration may not be applied yet.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void chat.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {!hasThread && messages.length === 0 ? (
                <p className="m-auto max-w-sm py-12 text-center text-sm text-muted-foreground">
                  No messages yet. Type below to start a conversation with support.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          mine ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {mine ? "You" : "Support"} · {new Date(m.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottom} />
            </div>
            <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
              <Input
                aria-label="Your message"
                placeholder="Message support…"
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
