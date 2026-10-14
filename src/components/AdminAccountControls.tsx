import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAccountStatus, setAccountCash, deleteAccount } from "@/lib/admin.functions";
import { fmt } from "@/lib/data";

export function AccountControls({
  userId,
  currentStatus,
  currentCash,
  onDone,
  onDeleted,
}: {
  userId: string;
  currentStatus: string;
  currentCash: number;
  onDone: () => Promise<void>;
  onDeleted: () => void;
}) {
  const setStatus = useServerFn(setAccountStatus);
  const setCash = useServerFn(setAccountCash);
  const del = useServerFn(deleteAccount);
  const [note, setNote] = useState("");
  const [cashInput, setCashInput] = useState(String(currentCash));
  const [busy, setBusy] = useState<string | null>(null);

  async function status(next: "active" | "suspended" | "banned") {
    if (next === currentStatus) return;
    const label = next === "active" ? "restore" : next;
    if (!window.confirm(`Are you sure you want to ${label} this account?`)) return;
    setBusy(next);
    try {
      await setStatus({ data: { userId, status: next, note: note.trim() || undefined } });
      toast.success(`Account ${next === "active" ? "restored" : next}`);
      setNote("");
      await onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveCash(e: FormEvent) {
    e.preventDefault();
    const value = Number(cashInput);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid cash amount");
      return;
    }
    if (note.trim().length < 3) {
      toast.error("Add a note of at least 3 characters for the balance change");
      return;
    }
    if (!window.confirm(`Set cash balance to ${fmt(value)}?`)) return;
    setBusy("cash");
    try {
      await setCash({ data: { userId, cash: value, note: note.trim() } });
      toast.success("Cash balance updated");
      setNote("");
      await onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (note.trim().length < 3) {
      toast.error("Add a note of at least 3 characters before deleting");
      return;
    }
    if (!window.confirm("Permanently delete this user and all related data? This cannot be undone.")) return;
    if (!window.confirm("Final confirmation: delete this account forever?")) return;
    setBusy("delete");
    try {
      await del({ data: { userId, note: note.trim() } });
      toast.success("Account deleted");
      await onDone();
      onDeleted();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-semibold">Account controls</p>
      <label className="block space-y-1 text-sm">
        <span className="text-xs text-muted-foreground">Note (required for balance change / delete; optional for status)</span>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Reason for this action"
          disabled={!!busy}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!!busy || currentStatus === "active"}
          onClick={() => void status("active")}
        >
          {busy === "active" ? "…" : "Restore (active)"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!!busy || currentStatus === "suspended"}
          onClick={() => void status("suspended")}
        >
          {busy === "suspended" ? "…" : "Suspend"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={!!busy || currentStatus === "banned"}
          onClick={() => void status("banned")}
        >
          {busy === "banned" ? "…" : "Ban"}
        </Button>
        <Button type="button" variant="destructive" disabled={!!busy} onClick={() => void remove()}>
          {busy === "delete" ? "Deleting…" : "Delete account"}
        </Button>
      </div>
      <form onSubmit={saveCash} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Cash balance (USD)</span>
          <Input
            className="num w-40"
            type="number"
            min={0}
            step="0.01"
            value={cashInput}
            onChange={(e) => setCashInput(e.target.value)}
            disabled={!!busy}
          />
        </label>
        <Button type="submit" disabled={!!busy}>
          {busy === "cash" ? "Saving…" : "Update balance"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Suspend blocks trading and funding. Ban also blocks sign-in at the auth layer. Delete removes the auth user and cascaded profile data.
      </p>
    </div>
  );
}
