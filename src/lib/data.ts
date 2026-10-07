import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getQuotes } from "./market.functions";

export const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export const profileQ = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const id = await uid();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (error) throw error;
    return { ...data, cash: Number(data.cash) };
  },
});
export const holdingsQ = queryOptions({
  queryKey: ["holdings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("holdings").select("*").order("symbol");
    if (error) throw error;
    return data.map((h) => ({ ...h, qty: Number(h.qty), avg_cost: Number(h.avg_cost) }));
  },
});
export const txQ = queryOptions({
  queryKey: ["transactions"],
  queryFn: async () => {
    const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return data.map((t) => ({ ...t, amount: Number(t.amount), qty: t.qty == null ? null : Number(t.qty), price: t.price == null ? null : Number(t.price) }));
  },
});
export const watchQ = queryOptions({
  queryKey: ["watchlist"],
  queryFn: async () => {
    const { data, error } = await supabase.from("watchlist").select("symbol").order("created_at");
    if (error) throw error;
    return data.map((w) => w.symbol);
  },
});
export const loansQ = queryOptions({
  queryKey: ["loans"],
  queryFn: async () => {
    const { data, error } = await supabase.from("loans").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((l) => ({ ...l, principal: Number(l.principal), balance: Number(l.balance), rate: Number(l.rate), monthly_payment: Number(l.monthly_payment) }));
  },
});

export function useQuotes(symbols: string[]) {
  const key = [...new Set(symbols)].sort();
  return useQuery({
    queryKey: ["quotes", key],
    queryFn: () => getQuotes({ data: { symbols: key } }),
    enabled: key.length > 0,
    refetchInterval: 15_000,
  });
}

export function payment(principal: number, ratePct: number, months: number) {
  const r = ratePct / 100 / 12;
  return r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
}
