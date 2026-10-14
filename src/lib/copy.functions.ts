import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CopyAllocation, CopyPosition } from "@/lib/copy-traders";

const positionSchema = z.object({
  symbol: z.string().min(1).max(12),
  qty: z.number().positive(),
  entry: z.number().positive(),
});

const allocationSchema = z.object({
  traderId: z.string().min(1).max(64),
  amount: z.number().positive(),
  startedAt: z.string().optional(),
  positions: z.array(positionSchema).min(1),
});

export const listCopyAllocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("copy_allocations")
      .select("trader_id,amount,positions,started_at")
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false });
    if (error) {
      if (/copy_allocations|schema cache|does not exist/i.test(error.message || "")) {
        return [] as CopyAllocation[];
      }
      throw new Error(error.message || "Unable to load copy allocations");
    }
    return (data ?? []).map((row) => ({
      traderId: row.trader_id as string,
      amount: Number(row.amount),
      startedAt: row.started_at as string,
      positions: (row.positions as CopyPosition[]) ?? [],
    }));
  });

export const upsertCopyAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => allocationSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("copy_allocations").upsert(
      {
        user_id: context.userId,
        trader_id: data.traderId,
        amount: data.amount,
        positions: data.positions,
        started_at: data.startedAt ?? new Date().toISOString(),
      },
      { onConflict: "user_id,trader_id" },
    );
    if (error) throw new Error(error.message || "Unable to save copy allocation");
    return { ok: true };
  });

export const deleteCopyAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ traderId: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("copy_allocations")
      .delete()
      .eq("user_id", context.userId)
      .eq("trader_id", data.traderId);
    if (error) throw new Error(error.message || "Unable to remove copy allocation");
    return { ok: true };
  });
