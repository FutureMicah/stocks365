import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchQuote, fetchChart, fetchQuoteWithSpark } from "./market.server";

const sym = z.string().trim().toUpperCase().regex(/^[A-Z0-9.^=-]{1,12}$/);

export const getQuotes = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ symbols: z.array(sym).max(30), spark: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const f = data.spark ? fetchQuoteWithSpark : fetchQuote;
    const out = await Promise.all(data.symbols.map((s) => f(s).catch(() => null)));
    return out.filter((q): q is NonNullable<typeof q> => q !== null);
  });

export const getChart = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ symbol: sym, range: z.enum(["1d", "5d", "1mo", "6mo", "1y", "5y"]) }).parse(d),
  )
  .handler(async ({ data }) => fetchChart(data.symbol, data.range));
