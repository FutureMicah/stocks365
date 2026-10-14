import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchQuote } from "./market.server";

function clean(e: { message?: string } | null) {
  if (!e) return;
  const msg = e.message ?? "Request failed";
  throw new Error(msg.replace(/^.*?EXCEPTION:?\s*/i, ""));
}

async function assertActive(
  supabase: { from: (t: string) => any },
  userId: string,
) {
  const { data: prof } = await supabase
    .from("profiles")
    .select("kyc_status,account_status")
    .eq("id", userId)
    .single();
  const st = (prof as { account_status?: string } | null)?.account_status ?? "active";
  if (st === "suspended") throw new Error("This account is suspended. Contact support.");
  if (st === "banned") throw new Error("This account has been banned.");
  return prof as { kyc_status?: string; account_status?: string } | null;
}

export const placeTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{1,10}$/),
        side: z.enum(["buy", "sell"]),
        qty: z.number().positive().max(1_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const prof = await assertActive(context.supabase, context.userId);
    if (prof?.kyc_status !== "verified") throw new Error("Trading unlocks after an administrator approves your identity");
    const q = await fetchQuote(data.symbol);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("execute_trade_v2", {
      _uid: context.userId,
      _symbol: q.symbol,
      _side: data.side,
      _qty: data.qty,
      _price: q.price,
      _fee_rate: 0.005,
    });
    clean(error);
    return { price: q.price, symbol: q.symbol };
  });

const achWithdraw = z.object({
  accountName: z.string().trim().min(2).max(120),
  routingNumber: z.string().trim().regex(/^\d{9}$/, "Routing number must be 9 digits"),
  accountNumber: z.string().trim().regex(/^\d{4,17}$/, "Account number must be 4–17 digits"),
});
const cryptoWithdraw = z.object({
  asset: z.string().trim().min(2).max(40),
  network: z.string().trim().min(2).max(60),
  address: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9:]+$/, "Wallet address may only contain letters, numbers, and colons"),
});

export const moveCash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    const base = z
      .object({
        type: z.enum(["deposit", "withdrawal"]),
        amount: z
          .number()
          .min(1)
          .max(10_000_000)
          .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, "Use no more than two decimal places"),
        method: z.enum(["ach", "crypto"]),
        destination: z.union([achWithdraw, cryptoWithdraw]).optional(),
      })
      .parse(d);
    if (base.type === "withdrawal") {
      if (!base.destination) throw new Error("Withdrawal destination is required");
      if (base.method === "ach") achWithdraw.parse(base.destination);
      else cryptoWithdraw.parse(base.destination);
    }
    return base;
  })
  .handler(async ({ data, context }) => {
    await assertActive(context.supabase, context.userId);

    let destination: string | null = null;
    if (data.type === "withdrawal" && data.destination) {
      if (data.method === "ach") {
        const d = achWithdraw.parse(data.destination);
        destination = `Bank transfer · ${d.accountName} · routing ${d.routingNumber} · account ${d.accountNumber}`;
      } else {
        const d = cryptoWithdraw.parse(data.destination);
        destination = `Crypto · ${d.asset} on ${d.network} · ${d.address}`;
      }
    }

    if (data.type === "deposit") {
      let { error } = await context.supabase.rpc("request_cash", {
        _type: data.type,
        _method: data.method,
        _amount: data.amount,
      });
      if (error && /destination|_destination|Could not find the function|schema cache|function.*does not exist/i.test(error.message || "")) {
        const retry = await context.supabase.rpc("request_cash", {
          _type: data.type,
          _method: data.method,
          _amount: data.amount,
          _destination: null,
        });
        error = retry.error;
      }
      if (error) {
        const raw = error.message || "";
        const cleaned = raw.replace(/^.*?EXCEPTION:?\s*/i, "");
        if (/destination|column.*cash_requests|Could not find the function|schema cache/i.test(raw)) {
          throw new Error(
            "Deposit is not fully set up in the database yet. In Lovable Cloud → SQL, run the contents of drizzle/migrations/0014_request_cash_safe.sql, then try again.",
          );
        }
        throw new Error(cleaned || "Unable to submit deposit request");
      }
      return { ok: true };
    }

    const payload: Record<string, unknown> = {
      _type: data.type,
      _method: data.method,
      _amount: data.amount,
      _destination: destination,
    };
    let { error } = await context.supabase.rpc("request_cash", payload);
    if (error && /Could not find the function|schema cache|function.*does not exist/i.test(error.message || "")) {
      throw new Error(
        "Withdrawal destinations need migration 0009 or 0014. In Lovable Cloud → SQL, run drizzle/migrations/0014_request_cash_safe.sql, then try again.",
      );
    }
    if (error) {
      const cleaned = (error.message || "").replace(/^.*?EXCEPTION:?\s*/i, "");
      throw new Error(cleaned || "Unable to submit withdrawal request");
    }
    return { ok: true };
  });

const RATES = { heloc: 7.25, personal: 9.99 } as const;

export const openLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["heloc", "personal"]),
        principal: z.number().min(1000).max(500_000),
        term: z.number().int().min(12).max(360),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertActive(context.supabase, context.userId);
    if (data.kind === "personal" && data.principal > 100_000) throw new Error("Personal loans are capped at $100,000");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("open_loan", {
      _uid: context.userId,
      _kind: data.kind,
      _principal: data.principal,
      _rate: RATES[data.kind],
      _term: data.term,
    });
    clean(error);
    return { ok: true };
  });

export const repayLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ loanId: z.string().uuid(), amount: z.number().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertActive(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("repay_loan", {
      _uid: context.userId,
      _loan: data.loanId,
      _amount: data.amount,
    });
    clean(error);
    return { ok: true };
  });
