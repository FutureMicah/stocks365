import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAdminAccess, getAdminOverview, canBootstrapAdmin, claimFirstAdmin } from "@/lib/admin.functions";
import { Overview } from "./admin-panel";

const accessQ = queryOptions({ queryKey: ["admin-access"], queryFn: () => getAdminAccess() });
const overviewQ = queryOptions({ queryKey: ["admin-overview"], queryFn: () => getAdminOverview() });

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — stocks365" },
      { name: "description", content: "Restricted account oversight and identity review for stocks365 administrators." },
      { property: "og:title", content: "Administration — stocks365" },
      { property: "og:description", content: "Restricted account oversight and identity review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    const allowed = await context.queryClient.ensureQueryData(accessQ);
    if (allowed) await context.queryClient.ensureQueryData(overviewQ);
  },
  component: Admin,
});

function Admin() {
  const { data: allowed } = useSuspenseQuery(accessQ);
  if (!allowed) return <BootstrapGate />;
  return <Overview />;
}

function BootstrapGate() {
  const qc = useQueryClient();
  const load = useServerFn(canBootstrapAdmin);
  const claim = useServerFn(claimFirstAdmin);
  const available = useQuery({ queryKey: ["admin-bootstrap"], queryFn: () => load() });
  const [busy, setBusy] = useState(false);
  async function take() {
    if (
      !window.confirm(
        "Claim administrator access for this account? You will become the first super administrator and can invite others.",
      )
    )
      return;
    setBusy(true);
    try {
      await claim();
      toast.success("You are now the first administrator");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-access"] }),
        qc.invalidateQueries({ queryKey: ["admin-bootstrap"] }),
        qc.invalidateQueries({ queryKey: ["admin-overview"] }),
      ]);
      window.location.assign("/admin");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-xl space-y-4 py-12">
      <h1 className="text-2xl">Administrator access required</h1>
      <p className="text-muted-foreground">This account does not have permission to view administration records.</p>
      {available.isLoading ? (
        <p className="text-sm text-muted-foreground">Checking whether the first administrator can be named…</p>
      ) : available.data ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <p className="text-sm">
            No administrator has been named yet. As a signed-in account, you can claim the first super-administrator role.
            After that, only existing administrators can invite others.
          </p>
          <Button disabled={busy} onClick={() => void take()}>
            {busy ? "Claiming…" : "Become the first administrator"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ask an existing super administrator to invite this account from the Administrators tab.
        </p>
      )}
    </div>
  );
}
