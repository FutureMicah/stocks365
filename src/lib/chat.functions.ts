import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function clean(e: { message?: string } | null) {
  if (!e) return;
  throw new Error((e.message ?? "Request failed").replace(/^.*?EXCEPTION:?\s*/i, ""));
}

async function requireAdmin(context: {
  userId: string;
  supabase: { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
}) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Administrator access required");
}

/** Admin: list every thread with the latest message preview. */
export const adminListThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data: threads, error } = await context.supabase
      .from("chat_threads")
      .select("id,user_id,created_by,created_at,last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message || "Unable to load conversations");
    const rows = threads ?? [];
    if (!rows.length) return [];
    const userIds = [...new Set(rows.map((t) => t.user_id))];
    const { data: profiles } = await context.supabase.from("profiles").select("id,full_name").in("id", userIds);
    const names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || "Unnamed account"]));
    const { data: msgs } = await context.supabase
      .from("chat_messages")
      .select("thread_id,body,created_at,sender_id")
      .in(
        "thread_id",
        rows.map((t) => t.id),
      )
      .order("created_at", { ascending: false })
      .limit(500);
    const preview = new Map<string, { body: string; created_at: string; sender_id: string }>();
    for (const m of msgs ?? []) {
      if (!preview.has(m.thread_id)) preview.set(m.thread_id, m);
    }
    return rows.map((t) => ({
      ...t,
      userName: names[t.user_id] ?? t.user_id,
      preview: preview.get(t.id) ?? null,
    }));
  });

/** Admin: full message history for a thread. */
export const adminListMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { data: messages, error } = await context.supabase
      .from("chat_messages")
      .select("id,thread_id,sender_id,body,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message || "Unable to load messages");
    return messages ?? [];
  });

/** Admin starts (or reopens) a chat with a user and may send the first message. */
export const adminOpenChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        body: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { data: threadId, error } = await context.supabase.rpc("admin_open_chat", {
      _user: data.userId,
      _body: data.body ?? null,
    });
    clean(error);
    return { threadId: threadId as string };
  });

/** Admin or user sends a message on an existing thread. */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: id, error } = await context.supabase.rpc("chat_send", {
      _thread: data.threadId,
      _body: data.body,
    });
    clean(error);
    return { id: id as string };
  });

/**
 * User (or any signed-in account): open own support thread if needed and optionally post a message.
 * This is what lets customers text the admin first.
 */
export const userOpenChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ body: z.string().trim().min(1).max(2000).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: threadId, error } = await context.supabase.rpc("user_open_chat", {
      _body: data.body ?? null,
    });
    clean(error);
    return { threadId: threadId as string };
  });

/** User: own thread (if any) + messages. Creates nothing — use userOpenChat to start. */
export const getMyChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: thread, error } = await context.supabase
      .from("chat_threads")
      .select("id,user_id,created_at,last_message_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message || "Unable to load conversation");
    }
    if (!thread) {
      return {
        thread: null as null,
        messages: [] as { id: string; sender_id: string; body: string; created_at: string }[],
      };
    }
    const { data: messages, error: me } = await context.supabase
      .from("chat_messages")
      .select("id,sender_id,body,created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (me) throw new Error(me.message || "Unable to load messages");
    return { thread, messages: messages ?? [] };
  });
