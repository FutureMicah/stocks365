import { TrendingUp } from "lucide-react";

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-display text-lg font-bold">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-primary-foreground">
        <TrendingUp className="h-4 w-4" />
      </span>
      stocks<span className="text-brand">365</span>
    </span>
  );
}
