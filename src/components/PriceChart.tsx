import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getChart } from "@/lib/market.functions";
import { fmt } from "@/lib/data";

const ranges = ["1d", "5d", "1mo", "6mo", "1y", "5y"] as const;

export function PriceChart({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<(typeof ranges)[number]>("1mo");
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["chart", symbol, range],
    queryFn: () => getChart({ data: { symbol, range } }),
  });
  const up = (data[data.length - 1]?.c ?? 0) >= (data[0]?.c ?? 0);
  const color = up ? "var(--success)" : "var(--destructive)";
  return (
    <div>
      <div className="mb-3 flex gap-1">
        {ranges.map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`rounded-md px-2.5 py-1 text-xs uppercase ${r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{r}</button>
        ))}
      </div>
      <div className="h-64">
        {isLoading ? (
          <div className="h-full animate-pulse rounded-lg bg-muted" />
        ) : isError || data.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Chart unavailable</div>
        ) : (
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                labelFormatter={(t) => new Date(t as number).toLocaleString()}
                formatter={(v) => [fmt(v as number), "Price"]}
              />
              <Area type="monotone" dataKey="c" stroke={color} strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
