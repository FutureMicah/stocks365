import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: {
  userId: string;
  supabase: { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
}) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Administrator access required");
}

/** Webmail URL for Hostinger (or any provider). Set WEBMAIL_URL in env. */
export const getEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const webmailUrl = process.env.WEBMAIL_URL || process.env.VITE_WEBMAIL_URL || "https://webmail.hostinger.com";
    const from = process.env.SUPPORT_FROM_EMAIL || process.env.RESEND_FROM || "";
    const canSend = Boolean(process.env.RESEND_API_KEY && from);
    return {
      webmailUrl,
      from: from || null,
      canSend,
      provider: process.env.RESEND_API_KEY ? "resend" : "none",
    };
  });

/** Send a support email to a client. Uses Resend when RESEND_API_KEY + SUPPORT_FROM_EMAIL are set. */
export const sendSupportEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        to: z.string().trim().email().max(255),
        subject: z.string().trim().min(3).max(200),
        body: z.string().trim().min(1).max(10000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.SUPPORT_FROM_EMAIL || process.env.RESEND_FROM;
    if (!apiKey || !from) {
      throw new Error(
        "Email sending is not configured. Set RESEND_API_KEY and SUPPORT_FROM_EMAIL (e.g. support@yourdomain.com) in the project environment, or open webmail to send manually.",
      );
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [data.to],
        subject: data.subject,
        text: data.body,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      throw new Error(json.message || `Email provider error (${res.status})`);
    }
    await context.supabase.from("admin_audit").insert({
      admin_id: context.userId,
      subject_id: context.userId,
      action: "support_email_sent",
      note: `To ${data.to}: ${data.subject}`,
    });
    return { id: json.id ?? "sent" };
  });

/** Resolve emails for profile ids (admin only). */
export const listAccountEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id,full_name")
      .order("created_at", { ascending: false })
      .limit(500);
    const rows = profiles ?? [];
    const out: { id: string; full_name: string | null; email: string | null }[] = [];
    for (const p of rows) {
      const u = await supabaseAdmin.auth.admin.getUserById(p.id);
      out.push({
        id: p.id,
        full_name: p.full_name,
        email: u.data?.user?.email ?? null,
      });
    }
    return out;
  });
