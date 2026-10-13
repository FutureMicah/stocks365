import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Wallet, Landmark, FileText, Settings, LogOut, BadgeCheck, Users, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { KycForm } from "@/components/KycForm";
import { fmt, profileQ } from "@/lib/data";
import { getAdminAccess } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const nav = [
  { to: "/dashboard", label: "Portfolio", icon: LayoutDashboard },
  { to: "/funds", label: "Wallet", icon: Wallet },
  { to: "/lending", label: "Lending", icon: Landmark },
  { to: "/statements", label: "Activity", icon: FileText },
  { to: "/copy", label: "Copy", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Shell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const profile = useQuery(profileQ);
  // Same query key as the /admin route, so the result is shared from cache.
  const adminAccess = useQuery({ queryKey: ["admin-access"], queryFn: () => getAdminAccess() });
  const isAdmin = adminAccess.data === true;
  const items = isAdmin ? [...nav, { to: "/admin", label: "Admin", icon: Shield } as const] : nav;
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const kycStatus = profile.data?.kyc_status;
  const verified = kycStatus === "verified";
  // Accounts that have never submitted, or were rejected, must (re)submit identity details.
  // Administrators are exempt so they can always reach the admin console.
  const needsKyc = !!profile.data && !isAdmin && (kycStatus === "unverified" || kycStatus === "rejected");
  const kycLabel = verified ? "Identity verified" : kycStatus === "submitted" ? "Identity under review" : "Verification needed";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 md:flex">
        <Link to="/" className="px-2 py-2"><Logo /></Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {items.map((n) => (
            <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" activeProps={{ className: "bg-sidebar-accent !text-primary" }}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
        </nav>
        {profile.data && (
          <div className="mb-3 rounded-xl bg-muted p-4 text-xs">
            <p className="flex items-center gap-1.5 font-semibold">
              <BadgeCheck className={`h-4 w-4 ${verified ? "text-success" : "text-muted-foreground"}`} />
              {kycLabel}
            </p>
            <p className="mt-1 text-muted-foreground">Cash <span className="num text-foreground">{fmt(profile.data.cash)}</span></p>
          </div>
        )}
        <button onClick={signOut} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
          <LogOut className="h-4 w-4" />Log out
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur md:hidden">
          <Logo />
          <button onClick={signOut} aria-label="Log out" className="text-muted-foreground"><LogOut className="h-5 w-5" /></button>
        </header>
        <main className="flex-1 p-4 md:p-8">
          {profile.isLoading || adminAccess.isLoading ? (
            <div className="mx-auto h-64 max-w-xl animate-pulse rounded-2xl bg-muted" />
          ) : profile.data && needsKyc ? (
            <>
              {kycStatus === "rejected" && (
                <p role="alert" className="mx-auto mb-4 max-w-xl rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  Your previous identity submission was not approved. Please check your details and submit again.
                </p>
              )}
              <KycForm userId={user.id} defaults={{ fullName: profile.data.full_name, ssnLast4: profile.data.ssn_last4 }} />
            </>
          ) : (
            <Outlet />
          )}
        </main>
        <nav className={`fixed inset-x-0 bottom-0 z-20 grid ${isAdmin ? "grid-cols-7" : "grid-cols-6"} border-t border-border bg-card md:hidden`}>
          {items.map((n) => (
            <Link key={n.to} to={n.to} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground" activeProps={{ className: "!text-primary" }}>
              <n.icon className="h-5 w-5" />{n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
