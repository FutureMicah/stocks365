import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitKyc } from "@/lib/kyc.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { userId: string; defaults?: { fullName?: string | null; ssnLast4?: string | null } };

export function KycForm({ userId, defaults }: Props) {
  const qc = useQueryClient();
  const submit = useServerFn(submitKyc);
  const [fullName, setFullName] = useState(defaults?.fullName ?? "");
  const [ssn, setSsn] = useState(defaults?.ssnLast4 ?? "");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [idType, setIdType] = useState<"drivers_license" | "passport" | "state_id">("drivers_license");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(ssn)) return void toast.error("Enter exactly the last 4 digits of your SSN");
    if (!file) return void toast.error("Upload a photo or scan of your government ID");
    if (file.size > 10 * 1024 * 1024) return void toast.error("ID file must be under 10 MB");
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userId}/government-id-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("kyc-docs").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await submit({ data: { fullName, ssnLast4: ssn, dob, address, idType, idPath: path } });
      toast.success("Identity submitted — your account is ready");
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass mx-auto max-w-xl space-y-4 rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-primary"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <h2 className="text-xl">Verify your identity</h2>
          <p className="text-sm text-muted-foreground">Required by US regulations before you can fund or trade.</p>
        </div>
      </div>
      <div className="space-y-1.5"><Label>Legal full name</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>SSN — last 4 digits</Label>
          <Input required inputMode="numeric" maxLength={4} pattern="\d{4}" className="num tracking-[0.4em]" value={ssn} onChange={(e) => setSsn(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" />
        </div>
        <div className="space-y-1.5"><Label>Date of birth</Label><Input required type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label>Residential address</Label><Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state, ZIP" /></div>
      <div className="space-y-1.5">
        <Label>Government ID type</Label>
        <select value={idType} onChange={(e) => setIdType(e.target.value as typeof idType)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm">
          <option value="drivers_license">Driver's license</option>
          <option value="passport">Passport</option>
          <option value="state_id">State ID card</option>
        </select>
      </div>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-input bg-muted/50 p-6 text-center text-sm hover:bg-accent/50">
        <Upload className="h-5 w-5 text-primary" />
        <span className="font-semibold">{file ? file.name : "Upload government ID"}</span>
        <span className="text-xs text-muted-foreground">JPG, PNG or PDF · max 10 MB</span>
        <input type="file" accept="image/*,application/pdf" required className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Submitting…" : "Submit verification"}</Button>
      <p className="text-center text-[11px] text-muted-foreground">Your documents are stored privately and encrypted. Only you can access them.</p>
    </form>
  );
}
