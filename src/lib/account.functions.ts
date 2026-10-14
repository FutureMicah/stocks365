import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchQuote } from "./market.server";

function clean(e: { message?: string } | null) {
  if (!e) return;
  const msg = e.message ?? "Request failed";
  throw new Error(msg.replace(/^.*?EXCEPTION:?\s*/i, ""));
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
    const { data: prof } = await context.supabase.from("profiles").select("kyc_status").eq("id", context.userId).single();
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

    const payload: Record<string, unknown> = {
      _type: data.type,
      _method: data.method,
      _amount: data.amount,
    };
    if (destination) payload._destination = destination;

    let { error } = await context.supabase.rpc("request_cash", payload);
    if (error && data.type === "deposit" && /destination|_destination|schema cache|function/i.test(error.message || "")) {
      const retry = await context.supabase.rpc("request_cash", {
        _type: data.type,
        _method: data.method,
        _amount: data.amount,
      });
      error = retry.error;
    }
    if (error) {
      const raw = error.message || "";
      const cleaned = raw.replace(/^.*?EXCEPTION:?\s*/i, "");
      if (/destination|column.*cash_requests/i.test(raw)) {
        throw new Error(
          "Deposit setup is incomplete in the database. In Lovable SQL run migration 0014 (destination column + request_cash), then try again.",
        );
      }
      if (/Could not find the function|schema cache/i.test(raw)) {
        throw new Error(
          "Cash request function is missing. Apply drizzle/migrations/0014_request_cash_safe.sql in Lovable SQL, then try again.",
        );
      }
      throw new Error(cleaned || "Unable to submit cash request");
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("repay_loan", {
      _uid: context.userId,
      _loan: data.loanId,
      _amount: data.amount,
    });
    clean(error);
    return { ok: true };
  });
