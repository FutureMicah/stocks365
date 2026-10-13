import { TriangleAlert } from "lucide-react";

// Shown wherever deposit details appear until a licensed funding provider is connected.
export function DemoFundsNotice() {
  return (
    <div role="note" className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p><span className="font-semibold">Demonstration environment.</span> Do not send real money. Payments to these details are not processed, held or settled by a licensed provider, and balances shown here are not real funds.</p>
    </div>
  );
}
