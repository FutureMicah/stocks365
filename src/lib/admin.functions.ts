import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error) throw new Error("Unable to check administrator access");
    return Boolean(data);
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Administrator access required");
    const [profiles, transactions, loans, audit] = await Promise.all([
      context.supabase.from("profiles").select("id,full_name,cash,created_at,kyc_status,kyc_submitted_at,id_type").order("created_at", { ascending: false }).limit(500),
      context.supabase.from("transactions").select("id,user_id,type,symbol,amount,method,created_at,fee").order("created_at", { ascending: false }).limit(100),
      context.supabase.from("loans").select("id,user_id,kind,balance,status").order("created_at", { ascending: false }).limit(500),
      context.supabase.from("admin_audit").select("id,subject_id,action,note,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    if (profiles.error || transactions.error || loans.error || audit.error) throw new Error("Unable to load administration records");
    return { profiles: profiles.data ?? [], transactions: transactions.data ?? [], loans: loans.data ?? [], audit: audit.data ?? [] };
  });

export const getIdentityDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Administrator access required");
    const { data: profile, error } = await context.supabase.from("profiles").select("id_document_path").eq("id", data.userId).single();
    if (error || !profile?.id_document_path) throw new Error("No identity document is available");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage.from("kyc-docs").createSignedUrl(profile.id_document_path, 60);
    if (signed.error || !signed.data) throw new Error("Unable to open identity document");
    const browserOrigin = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
    if (!browserOrigin) throw new Error("Document access is not configured");
    const path = new URL(signed.data.signedUrl);
    return { url: `${browserOrigin.replace(/\/$/, "")}${path.pathname}${path.search}` };
  });

export const reviewIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), status: z.enum(["verified", "rejected"]), note: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("admin_review_identity", { _subject: data.userId, _status: data.status, _note: data.note });
    if (error) throw new Error(error.message);
    return { ok: true };
  });