import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(100),
        ssnLast4: z.string().regex(/^\d{4}$/, "SSN last 4 must be exactly 4 digits"),
        dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        address: z.string().trim().min(5).max(200),
        idType: z.enum(["drivers_license", "passport", "state_id"]),
        idPath: z.string().min(5).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const age = (Date.now() - new Date(data.dob).getTime()) / (365.25 * 864e5);
    if (!(age >= 18 && age < 120)) throw new Error("You must be at least 18 years old");
    if (!data.idPath.startsWith(`${context.userId}/`)) throw new Error("Invalid document");
    const folder = context.userId;
    const file = data.idPath.slice(folder.length + 1);
    const { data: files, error: listErr } = await context.supabase.storage.from("kyc-docs").list(folder, { search: file });
    if (listErr || !files?.some((f) => f.name === file)) throw new Error("Please upload your government ID");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        ssn_last4: data.ssnLast4,
        date_of_birth: data.dob,
        address: data.address,
        id_type: data.idType,
        id_document_path: data.idPath,
        kyc_status: "submitted",
        kyc_submitted_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
