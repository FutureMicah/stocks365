import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Upload, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { submitKyc } from "@/lib/kyc.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["signin", "signup"]).optional() }),
  head: () => ({
    meta: [
      { title: "Log in or open an account — Stocks365" },
      { name: "description", content: "Log in or open your Stocks365 investing account in minutes." },
      { property: "og:title", content: "Log in — Stocks365" },
      { property: "og:description", content: "Access your Stocks365 account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const signup = mode === "signup";
  const navigate = useNavigate();
  const kyc = useServerFn(submitKyc);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ssn, setSsn] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [idType, setIdType] = useState<"drivers_license" | "passport" | "state_id">("drivers_license");
  const [file, setFile] = useState<File | null>(null);
  const [sent, setSent] = useState(false);

  // Send already-signed-in visitors (incl. returning from Google) to the app.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (signup) {
      if (!/^\d{4}$/.test(ssn)) return void toast.error("Enter exactly the last 4 digits of your SSN");
      if (!file) return void toast.error("Upload your government ID to continue");
      if (file.size > 10 * 1024 * 1024) return void toast.error("ID file must be under 10 MB");
    }
    setBusy(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth", data: { full_name: name, ssn_last4: ssn } },
        });
        if (error) throw error;
        if (data.session && data.user && file) {
          const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
          const path = `${data.user.id}/government-id-${Date.now()}.${ext}`;
          const up = await supabase.storage.from("kyc-docs").upload(path, file, { contentType: file.type });
          if (up.error) throw up.error;
          await kyc({ data: { fullName: name, ssnLast4: ssn, dob, address, idType, idPath: path } });
          navigate({ to: "/dashboard" });
        } else {
          setSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setGoogleBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) {
      setGoogleBusy(false);
      toast.error(r.error.message ?? "Google sign-in failed");
      return;
    }
    if (r.redirected) return;
    setGoogleBusy(false);
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-deep-grad p-12 text-deep-foreground lg:flex">
        <Link to="/"><Logo inverted /></Link>
        <div>
          <h1 className="text-4xl leading-tight">Own a piece of the world's best companies.</h1>
          <p className="mt-4 max-w-md text-deep-foreground/70">US stocks and ETFs from $1, a flat 0.5% commission, and live market prices.</p>
        </div>
        <p className="flex items-center gap-2 text-xs text-deep-foreground/60"><ShieldCheck className="h-4 w-4" />Identity-verified accounts · encrypted documents</p>
      </div>
      <div className="flex flex-col items-center justify-center px-4 py-10">
        <Link to="/" className="mb-8 lg:hidden"><Logo /></Link>
        <div className="w-full max-w-md">
          {sent ? (
            <div className="glass rounded-2xl p-8 text-center">
              <h1 className="text-2xl">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <b>{email}</b>. After confirming, log in and re-attach your government ID once to finish verification.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl">{signup ? "Open your account" : "Welcome back"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{signup ? "Takes about 3 minutes. Have your ID ready." : "Log in to your investing account."}</p>
              <Button variant="outline" className="mt-6 w-full" onClick={google} disabled={googleBusy}>
                {googleBusy ? "Connecting to Google…" : "Continue with Google"}
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" /></div>
              <form onSubmit={submit} className="space-y-4">
                {signup && <div className="space-y-1.5"><Label>Legal full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>}
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Password</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                {signup && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>SSN — last 4 digits</Label>
                        <Input required inputMode="numeric" maxLength={4} pattern="\d{4}" className="num tracking-[0.4em]" placeholder="••••" value={ssn} onChange={(e) => setSsn(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                      </div>
                      <div className="space-y-1.5"><Label>Date of birth</Label><Input required type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Residential address</Label><Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state, ZIP" /></div>
                    <div className="space-y-1.5">
                      <Label>Government ID</Label>
                      <select value={idType} onChange={(e) => setIdType(e.target.value as typeof idType)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm">
                        <option value="drivers_license">Driver's license</option>
                        <option value="passport">Passport</option>
                        <option value="state_id">State ID card</option>
                      </select>
                      <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input bg-muted/50 p-4 text-sm hover:bg-accent/50">
                        <Upload className="h-5 w-5 text-primary" />
                        <span className="flex-1 truncate">{file ? file.name : "Upload photo or scan (JPG, PNG, PDF)"}</span>
                        <input type="file" accept="image/*,application/pdf" required className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                  </>
                )}
                <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Log in"}</Button>
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {signup ? "Already have an account? " : "New to Stocks365? "}
                <Link to="/auth" search={{ mode: signup ? "signin" : "signup" }} className="font-semibold text-primary hover:underline">{signup ? "Log in" : "Open an account"}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
