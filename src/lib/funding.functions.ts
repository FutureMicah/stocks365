import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const text = (max: number) => z.string().trim().max(max).default("");
export const achSchema = z.object({ bankName: text(120), accountName: text(120), routingNumber: z.string().trim().regex(/^(\d{9})?$/, "Routing number must be 9 digits").default(""), accountNumber: z.string().trim().regex(/^(\d{4,17})?$/, "Account number must be 4–17 digits").default(""), instructions: text(500) });
export const cryptoSchema = z.object({ asset: text(40), network: text(60), address: z.string().trim().regex(/^[A-Za-z0-9:]{0,128}$/, "Wallet address may only contain letters and numbers").default(""), instructions: text(500) });
export type AchDetails = z.infer<typeof achSchema>;
export type CryptoDetails = z.infer<typeof cryptoSchema>;
export type FundingInstructions = { ach: AchDetails; crypto: CryptoDetails; updatedAt: { ach: string | null; crypto: string | null } };

export const getFundingInstructions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FundingInstructions> => {
    const { data, error } = await context.supabase.from("funding_instructions").select("method,details,updated_at");
    if (error) throw new Error("Unable to load deposit instructions");
    const row = (m: string) => data?.find((r) => r.method === m);
    return {
      ach: achSchema.catch(achSchema.parse({})).parse(row("ach")?.details ?? {}),
      crypto: cryptoSchema.catch(cryptoSchema.parse({})).parse(row("crypto")?.details ?? {}),
      updatedAt: { ach: row("ach")?.updated_at ?? null, crypto: row("crypto")?.updated_at ?? null },
    };
  });

export const setFundingInstructions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.discriminatedUnion("method", [z.object({ method: z.literal("ach"), details: achSchema }), z.object({ method: z.literal("crypto"), details: cryptoSchema })]).parse(d))
  .handler(async ({ context, data }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Administrator access required");
    const { error } = await context.supabase.rpc("admin_set_funding_instructions", { _method: data.method, _details: data.details });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
