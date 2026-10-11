export function Sparkline({ data, className = "h-8 w-24" }: { data?: number[] | undefined; className?: string }) {
  if (!data || data.length < 2) return <div className={className} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / span) * 28 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`${className} bg-chart-surface`} aria-hidden>
      <polyline points={pts} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" className="stroke-chart-1" />
    </svg>
  );
}
