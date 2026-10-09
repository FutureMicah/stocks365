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

export const moveCash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        type: z.enum(["deposit", "withdrawal"]),
        amount: z.number().positive().max(10_000_000),
        method: z.enum(["ach", "wire", "crypto", "check"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("cash_move", {
      _uid: context.userId,
      _type: data.type,
      _amount: data.amount,
      _method: data.method,
    });
    clean(error);
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
