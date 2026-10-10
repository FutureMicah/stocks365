import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Stocks365" },
      { name: "description", content: "Set a new password for your Stocks365 account." },
      { property: "og:title", content: "Choose a new password — Stocks365" },
      { property: "og:description", content: "Set a new password." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session || window.location.hash.includes("type=recovery")) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return void toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-glow px-4">
      <Link to="/" className="mb-8"><Logo /></Link>
      <div className="glass w-full max-w-md rounded-2xl p-8">
        {!ready ? (
          <div className="text-center">
            <h1 className="text-2xl">Link expired or invalid</h1>
            <p className="mt-2 text-sm text-muted-foreground">Open the latest reset link from your email, or request a new one.</p>
            <Button variant="hero" className="mt-6" asChild><Link to="/forgot-password">Request new link</Link></Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-2xl">Choose a new password</h1>
            <div className="space-y-1.5"><Label>New password</Label><Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Confirm password</Label><Input type="password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
