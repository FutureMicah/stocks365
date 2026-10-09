export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 text-lg font-extrabold tracking-tight ${inverted ? "text-deep-foreground" : "text-foreground"}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-xs font-extrabold text-primary-foreground">S</span>
      STOCKS<span className="text-primary">365</span>
    </span>
  );
}
