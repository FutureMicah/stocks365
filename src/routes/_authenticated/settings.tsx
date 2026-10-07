import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileQ } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — stocks365" }, { name: "description", content: "Manage your profile and password." }] }),
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const profile = useQuery(profileQ);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  useEffect(() => {
    if (profile.data) { setName(profile.data.full_name ?? ""); setPhone(profile.data.phone ?? ""); }
  }, [profile.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    setPw(""); setCur("");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Account settings</h1>
      <form onSubmit={save} className="glass space-y-4 rounded-2xl p-6">
        <h2 className="font-semibold">Profile</h2>
        <div className="space-y-1.5"><Label>Email</Label><Input value={user.email ?? ""} disabled /></div>
        <div className="space-y-1.5"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <Button type="submit">Save changes</Button>
      </form>
      <form onSubmit={changePw} className="glass space-y-4 rounded-2xl p-6">
        <h2 className="font-semibold">Change password</h2>
        <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>New password</Label><Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button type="submit" variant="secondary">Update password</Button>
      </form>
    </div>
  );
}
