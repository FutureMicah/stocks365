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
    if (admin.error || superAdmin.error) {
      console.error("has_role failed", admin.error || superAdmin.error);
      return false;
    }
    return Boolean(admin.data || superAdmin.data);
  });

export const canBootstrapAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_bootstrap_available");
    if (error) {
      throw new Error(
        error.message?.includes("Could not find") || error.message?.includes("function")
          ? "Admin bootstrap is not set up yet. Apply migration 0007_bootstrap_first_admin (and 0011) in the Supabase SQL Editor."
          : error.message || "Unable to check administrator bootstrap status",
      );
    }
    return Boolean(data);
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("bootstrap_first_admin");
    if (error) {
      const msg = (error.message || "").replace(/^.*?EXCEPTION:?\s*/i, "");
      if (/Could not find|function .* does not exist/i.test(error.message || "")) {
        throw new Error("Apply migration 0007_bootstrap_first_admin in the Supabase SQL Editor, then try again.");
      }
      throw new Error(msg || "Unable to claim administrator access");
    }
    return { ok: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [role, superRole] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
    ]);
    if (role.error || superRole.error) {
      throw new Error(role.error?.message || superRole.error?.message || "Unable to check administrator access");
    }
    if (!role.data && !superRole.data) throw new Error("Administrator access required");

    let cash = await context.supabase
      .from("cash_requests")
      .select("id,user_id,type,method,amount,status,note,destination,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (cash.error && /destination|column/i.test(cash.error.message || "")) {
      cash = await context.supabase
        .from("cash_requests")
        .select("id,user_id,type,method,amount,status,note,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
    }

    let profiles = await context.supabase
      .from("profiles")
      .select("id,full_name,cash,created_at,kyc_status,kyc_submitted_at,id_type,account_status,status_note,phone")
      .order("created_at", { ascending: false })
      .limit(500);
    if (profiles.error && /account_status|column/i.test(profiles.error.message || "")) {
      profiles = await context.supabase
        .from("profiles")
        .select("id,full_name,cash,created_at,kyc_status,kyc_submitted_at,id_type,phone")
        .order("created_at", { ascending: false })
        .limit(500);
    }

    const [transactions, loans, audit, roles] = await Promise.all([
      context.supabase.from("transactions").select("id,user_id,type,symbol,amount,method,created_at,fee").order("created_at", { ascending: false }).limit(100),
      context.supabase.from("loans").select("id,user_id,kind,principal,balance,status,term_months,rate,created_at").order("created_at", { ascending: false }).limit(500),
      context.supabase.from("admin_audit").select("id,subject_id,action,note,created_at").order("created_at", { ascending: false }).limit(100),
      context.supabase.from("user_roles").select("user_id,role"),
    ]);

    const failures = [
      profiles.error && `profiles: ${profiles.error.message}`,
      transactions.error && `transactions: ${transactions.error.message}`,
      loans.error && `loans: ${loans.error.message}`,
      audit.error && `audit: ${audit.error.message}`,
      cash.error && `cash_requests: ${cash.error.message}`,
      roles.error && `user_roles: ${roles.error.message}`,
    ].filter(Boolean);
    if (failures.length) {
      throw new Error(`Unable to load administration records (${failures.join("; ")})`);
    }

    const cashRows = (cash.data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      destination: (row as { destination?: unknown }).destination ?? null,
    }));

    const profileRows = (profiles.data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      account_status: (row as { account_status?: string }).account_status ?? "active",
      status_note: (row as { status_note?: string | null }).status_note ?? null,
    }));

    return {
      profiles: profileRows,
      transactions: transactions.data ?? [],
      loans: loans.data ?? [],
      audit: audit.data ?? [],
      cash: cashRows,
      roles: (roles.data ?? []) as { user_id: string; role: string }[],
      isSuper: Boolean(superRole.data),
    };
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

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Administrator access required");
}

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
    if (inv.data?.user) {
      userId = inv.data.user.id;
      invited = true;
    } else {
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
    await supabaseAdmin.from("admin_audit").insert({
      admin_id: context.userId,
      subject_id: userId,
      action: "admin_granted",
      note: `Administrator invitation sent to ${data.email}`,
    });
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
    await supabaseAdmin.from("admin_audit").insert({
      admin_id: context.userId,
      subject_id: data.userId,
      action: "admin_revoked",
      note: "Administrator access removed",
    });
    return { ok: true };
  });

export const getAccountDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const id = data.userId;

    let profile = await context.supabase
      .from("profiles")
      .select(
        "id,full_name,phone,cash,created_at,kyc_status,kyc_submitted_at,id_type,date_of_birth,address,ssn_last4,id_document_path,account_status,status_note,status_changed_at,status_changed_by",
      )
      .eq("id", id)
      .single();
    if (profile.error && /account_status|column/i.test(profile.error.message || "")) {
      profile = await context.supabase
        .from("profiles")
        .select("id,full_name,phone,cash,created_at,kyc_status,kyc_submitted_at,id_type,date_of_birth,address,ssn_last4,id_document_path")
        .eq("id", id)
        .single();
    }

    let cash = await context.supabase
      .from("cash_requests")
      .select("id,type,method,amount,status,note,destination,created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (cash.error && /destination|column/i.test(cash.error.message || "")) {
      cash = await context.supabase
        .from("cash_requests")
        .select("id,type,method,amount,status,note,created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
    }

    const [holdings, transactions, loans, audit, roles] = await Promise.all([
      context.supabase.from("holdings").select("symbol,qty,avg_cost").eq("user_id", id).order("symbol"),
      context.supabase
        .from("transactions")
        .select("id,type,symbol,qty,price,amount,fee,method,note,created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("loans")
        .select("id,kind,principal,balance,monthly_payment,rate,term_months,status,created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("admin_audit")
        .select("id,action,note,created_at,admin_id")
        .eq("subject_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase.from("user_roles").select("role").eq("user_id", id),
    ]);

    if (profile.error || !profile.data) throw new Error("Account not found");
    if (holdings.error || transactions.error || loans.error || cash.error || audit.error) {
      throw new Error("Unable to load account records");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUser = await supabaseAdmin.auth.admin.getUserById(id);
    const u = authUser.data?.user;

    const p = profile.data as Record<string, unknown>;
    return {
      profile: {
        ...p,
        account_status: (p.account_status as string) ?? "active",
        status_note: (p.status_note as string | null) ?? null,
        status_changed_at: (p.status_changed_at as string | null) ?? null,
        status_changed_by: (p.status_changed_by as string | null) ?? null,
      },
      email: u?.email ?? null,
      emailConfirmed: Boolean(u?.email_confirmed_at),
      lastSignIn: u?.last_sign_in_at ?? null,
      createdAt: u?.created_at ?? null,
      bannedUntil: (u as { banned_until?: string | null } | undefined)?.banned_until ?? null,
      phoneAuth: u?.phone ?? null,
      roles: (roles.data ?? []).map((r: { role: string }) => r.role),
      holdings: holdings.data ?? [],
      transactions: transactions.data ?? [],
      loans: loans.data ?? [],
      cash: (cash.data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        destination: (row as { destination?: unknown }).destination ?? null,
      })),
      audit: audit.data ?? [],
    };
  });

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["active", "suspended", "banned"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("admin_set_account_status", {
      _subject: data.userId,
      _status: data.status,
      _note: data.note ?? null,
    });
    if (error) {
      const msg = (error.message || "").replace(/^.*?EXCEPTION:?\s*/i, "");
      if (/Could not find|function .* does not exist|account_status/i.test(error.message || "")) {
        throw new Error(
          "Account status controls need migration 0015. In Lovable SQL run drizzle/migrations/0015_admin_account_controls.sql, then try again.",
        );
      }
      throw new Error(msg || "Unable to update account status");
    }
    if (data.status === "banned") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin
        .updateUserById(data.userId, { ban_duration: "876000h" })
        .catch((e: Error) => console.error("auth ban failed", e));
    } else if (data.status === "active") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin
        .updateUserById(data.userId, { ban_duration: "none" })
        .catch((e: Error) => console.error("auth unban failed", e));
    }
    return { ok: true };
  });

export const setAccountCash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        cash: z
          .number()
          .min(0)
          .max(100_000_000)
          .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, "Use no more than two decimal places"),
        note: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("admin_set_cash", {
      _subject: data.userId,
      _cash: data.cash,
      _note: data.note,
    });
    if (error) {
      const msg = (error.message || "").replace(/^.*?EXCEPTION:?\s*/i, "");
      if (/Could not find|function .* does not exist/i.test(error.message || "")) {
        throw new Error(
          "Cash adjustment needs migration 0015. In Lovable SQL run drizzle/migrations/0015_admin_account_controls.sql, then try again.",
        );
      }
      throw new Error(msg || "Unable to update cash balance");
    }
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        note: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { error } = await context.supabase.rpc("admin_delete_user", {
      _subject: data.userId,
      _note: data.note,
    });
    if (error) {
      const msg = (error.message || "").replace(/^.*?EXCEPTION:?\s*/i, "");
      if (/Could not find|function .* does not exist/i.test(error.message || "")) {
        throw new Error(
          "Account deletion needs migration 0015. In Lovable SQL run drizzle/migrations/0015_admin_account_controls.sql, then try again.",
        );
      }
      throw new Error(msg || "Unable to prepare account deletion");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const del = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (del.error) throw new Error(del.error.message || "Unable to delete auth user");
    return { ok: true };
  });
