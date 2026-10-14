import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [admin, superAdmin] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
    ]);
    if (admin.error || superAdmin.error) throw new Error("Unable to check administrator access");
    return Boolean(admin.data || superAdmin.data);
  });

/** True only while no admin or super_admin rows exist — enables first-admin claim. */
export const canBootstrapAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_bootstrap_available");
    if (error) throw new Error("Unable to check administrator bootstrap status");
    return Boolean(data);
  });

/** Claim admin + super_admin for the current user when no administrators exist yet. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("bootstrap_first_admin");
    if (error) throw new Error(error.message.replace(/^.*?EXCEPTION:?\s*/i, "") || "Unable to claim administrator access");
    return { ok: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [role, superRole] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
    ]);
    if (role.error || superRole.error || (!role.data && !superRole.data)) throw new Error("Administrator access required");
    const [profiles, transactions, loans, audit, cash, roles] = await Promise.all([
      context.supabase.from("profiles").select("id,full_name,cash,created_at,kyc_status,kyc_submitted_at,id_type").order("created_at", { ascending: false }).limit(500),
      context.supabase.from("transactions").select("id,user_id,type,symbol,amount,method,created_at,fee").order("created_at", { ascending: false }).limit(100),
      context.supabase.from("loans").select("id,user_id,kind,principal,balance,status,term_months,rate,created_at").order("created_at", { ascending: false }).limit(500),
      context.supabase.from("admin_audit").select("id,subject_id,action,note,created_at").order("created_at", { ascending: false }).limit(100),
      context.supabase.from("cash_requests").select("id,user_id,type,method,amount,status,note,destination,created_at").order("created_at", { ascending: false }).limit(200),
      superRole.data ? context.supabase.from("user_roles").select("user_id,role") : Promise.resolve({ data: [], error: null }),
    ]);
    if (profiles.error || transactions.error || loans.error || audit.error || cash.error) throw new Error("Unable to load administration records");
    return { profiles: profiles.data ?? [], transactions: transactions.data ?? [], loans: loans.data ?? [], audit: audit.data ?? [], cash: cash.data ?? [], roles: (roles.data ?? []) as { user_id: string; role: string }[], isSuper: Boolean(superRole.data) };
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
    const browserOrigin = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
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
const decision = z.object({ id: z.string().uuid(), approve: z.boolean(), note: z.string().trim().max(500) });

export const decideCash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => decision.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("admin_decide_cash", { _id: data.id, _approve: data.approve, _note: data.note });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => decision.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("admin_decide_loan", { _id: data.id, _approve: data.approve, _note: data.note });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function requireSuper(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (error || !data) throw new Error("Super administrator access required");
}

export const inviteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().trim().toLowerCase().email().max(255), redirectTo: z.string().url() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireSuper(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | undefined;
    let invited = false;
    const inv = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo: data.redirectTo });
    if (inv.data?.user) { userId = inv.data.user.id; invited = true; }
    else {
      for (let page = 1; page <= 20 && !userId; page++) {
        const list = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (list.error || !list.data.users.length) break;
        userId = list.data.users.find((u) => u.email?.toLowerCase() === data.email)?.id;
      }
      if (!userId) throw new Error(inv.error?.message ?? "Unable to invite this email");
      await supabaseAdmin.auth.resetPasswordForEmail(data.email, { redirectTo: data.redirectTo }).catch(() => undefined);
    }
    const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error("Unable to grant administrator access");
    await supabaseAdmin.from("admin_audit").insert({ admin_id: context.userId, subject_id: userId, action: "admin_granted", note: `Administrator invitation sent to ${data.email}` });
    return { invited };
  });

export const revokeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireSuper(context);
    if (data.userId === context.userId) throw new Error("You cannot remove your own access");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    if (error) throw new Error("Unable to remove administrator access");
    await supabaseAdmin.from("admin_audit").insert({ admin_id: context.userId, subject_id: data.userId, action: "admin_revoked", note: "Administrator access removed" });
    return { ok: true };
  });

export const getAccountDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Administrator access required");
    const id = data.userId;
    const [profile, holdings, transactions, loans, cash, audit] = await Promise.all([
      context.supabase.from("profiles").select("id,full_name,phone,cash,created_at,kyc_status,kyc_submitted_at,id_type,date_of_birth,address,ssn_last4").eq("id", id).single(),
      context.supabase.from("holdings").select("symbol,qty,avg_cost").eq("user_id", id).order("symbol"),
      context.supabase.from("transactions").select("id,type,symbol,qty,price,amount,fee,method,note,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
      context.supabase.from("loans").select("id,kind,principal,balance,monthly_payment,rate,term_months,status,created_at").eq("user_id", id).order("created_at", { ascending: false }),
      context.supabase.from("cash_requests").select("id,type,method,amount,status,note,destination,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
      context.supabase.from("admin_audit").select("id,action,note,created_at").eq("subject_id", id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (profile.error || !profile.data) throw new Error("Account not found");
    if (holdings.error || transactions.error || loans.error || cash.error || audit.error) throw new Error("Unable to load account records");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUser = await supabaseAdmin.auth.admin.getUserById(id);
    return {
      profile: profile.data,
      email: authUser.data?.user?.email ?? null,
      lastSignIn: authUser.data?.user?.last_sign_in_at ?? null,
      holdings: holdings.data ?? [],
      transactions: transactions.data ?? [],
      loans: loans.data ?? [],
      cash: cash.data ?? [],
      audit: audit.data ?? [],
    };
  });
