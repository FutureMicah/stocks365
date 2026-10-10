import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Stocks365" },
      { name: "description", content: "Get a secure link to reset your Stocks365 password." },
      { property: "og:title", content: "Reset your password — Stocks365" },
      { property: "og:description", content: "Get a secure password reset link." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setSent(true);
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-glow px-4">
      <Link to="/" className="mb-8"><Logo /></Link>
      <div className="glass w-full max-w-md rounded-2xl p-8">
        {sent ? (
          <div className="text-center">
            <h1 className="text-2xl">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">If an account exists for <b>{email}</b>, a reset link is on its way.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div><h1 className="text-2xl">Forgot your password?</h1><p className="mt-1 text-sm text-muted-foreground">Enter your email and we'll send you a secure reset link.</p></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
          </form>
        )}
        <p className="mt-5 text-center text-sm"><Link to="/auth" className="font-semibold text-primary hover:underline">Back to login</Link></p>
      </div>
    </div>
  );
}
