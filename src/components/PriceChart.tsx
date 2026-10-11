import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { getChart } from "@/lib/market.functions";
import { fmt } from "@/lib/data";

const ranges = ["1d", "5d", "1mo", "6mo", "1y", "5y"] as const;

export function PriceChart({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<(typeof ranges)[number]>("1mo");
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["chart", symbol, range],
    queryFn: () => getChart({ data: { symbol, range } }),
    refetchInterval: 30_000,
  });
  return <div className="rounded-lg bg-chart-surface p-3 text-chart-ink" aria-label={`${symbol} price chart`}>
    <div className="mb-3 flex flex-wrap gap-1">{ranges.map((r) => <Button type="button" size="sm" variant={r === range ? "default" : "ghost"} aria-pressed={r === range} key={r} onClick={() => setRange(r)} className="px-2 text-xs uppercase">{r}</Button>)}</div>
    <div className="h-64 min-w-0">
      {isLoading ? <div className="h-full animate-pulse rounded-lg bg-muted" /> : isError || data.length === 0 ? <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><p>Market data is temporarily unavailable.</p><Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Retry chart</Button></div> : <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="t" minTickGap={40} tickFormatter={(t) => range === "1d" ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis domain={["auto", "auto"]} width={60} tickFormatter={(v) => Number(v).toFixed(2)} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "var(--chart-surface)", border: "1px solid var(--border)", borderRadius: 8 }} labelFormatter={(t) => new Date(Number(t)).toLocaleString()} formatter={(v) => [fmt(Number(v)), "Price"]} />
          <Line type="linear" dataKey="c" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>}
    </div>
    {data.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Yahoo Finance · latest point {new Date(data[data.length - 1]?.t ?? 0).toLocaleString()} · prices may be delayed</p>}
  </div>;
}
