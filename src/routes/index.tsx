import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Zap, Landmark, LineChart, Wallet, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "stocks365 — Institution-Grade Practice Trading" },
      { name: "description", content: "Trade real stocks at live prices with $100,000 in practice money. Portfolio, deposits, HELOC and statements." },
      { property: "og:title", content: "stocks365 — Institution-Grade Practice Trading" },
      { property: "og:description", content: "Live market prices, $100k practice balance, real portfolio tracking." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: LineChart, t: "Live market prices", d: "Real quotes for any US-listed stock, refreshed every 15 seconds." },
  { icon: Zap, t: "Instant execution", d: "Orders fill at the current market price with no commission." },
  { icon: Wallet, t: "Deposits & withdrawals", d: "Move practice cash by ACH, wire, crypto or mobile check." },
  { icon: Landmark, t: "HELOC & personal loans", d: "Calculate payments and draw funds straight into your account." },
  { icon: Calculator, t: "Statements", d: "Full transaction history you can filter and download." },
  { icon: ShieldCheck, t: "Zero risk", d: "Learn and test strategies without putting real money on the line." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-glow">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
          <Button variant="hero" asChild><Link to="/auth" search={{ mode: "signup" }}>Open account</Link></Button>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-20 text-center">
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Practice account · $100,000 to start</span>
        <h1 className="mt-6 text-5xl font-bold leading-tight md:text-6xl">
          Institution-grade trading, <span className="text-brand">zero risk.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Buy and sell real stocks at live market prices using practice money. Track performance, move funds and explore lending — all in one place.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" variant="hero" asChild><Link to="/auth" search={{ mode: "signup" }}>Start trading free</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/auth">I have an account</Link></Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="glass rounded-2xl p-6">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        stocks365 is a simulated trading platform. No real money is deposited, traded or lent.
      </footer>
    </div>
  );
}
