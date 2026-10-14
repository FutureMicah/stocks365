import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, Users, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/copy")({
  head: () => ({
    meta: [
      { title: "Copy Trading — stocks365" },
      { name: "description", content: "Follow experienced US stock traders and mirror their strategies on stocks365." },
      { property: "og:title", content: "Copy Trading — stocks365" },
      { property: "og:description", content: "Follow experienced US stock traders and mirror their strategies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CopyTrading,
});

const traders = [
  { name: "Lisa Anderson", strategy: "Large-cap growth", return12m: "+38.4%", winRate: "71%", copiers: 4218, risk: "Moderate", bio: "Twelve years trading NYSE large caps. Focuses on earnings momentum and disciplined position sizing." },
  { name: "James Carter", strategy: "Dividend income", return12m: "+19.2%", winRate: "78%", copiers: 3105, risk: "Conservative", bio: "Builds steady income portfolios from dividend aristocrats and utility leaders." },
  { name: "Michael Bennett", strategy: "Tech momentum", return12m: "+52.7%", winRate: "64%", copiers: 2874, risk: "Aggressive", bio: "Rides semiconductor and software trends with tight stop-loss discipline." },
  { name: "David Sullivan", strategy: "Index swing", return12m: "+24.1%", winRate: "69%", copiers: 1990, risk: "Moderate", bio: "Trades S&P 500 and Nasdaq-100 ETFs around macro events and seasonality." },
  { name: "Robert Hayes", strategy: "Value & financials", return12m: "+16.8%", winRate: "74%", copiers: 1542, risk: "Conservative", bio: "Former bank analyst hunting undervalued financials and industrial names." },
];

function CopyTrading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Log in</Link></Button>
            <Button asChild variant="hero"><Link to="/auth" search={{ mode: "signup" }}>Open an account</Link></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Copy trading</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Invest alongside proven traders</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Pick a strategy you believe in and mirror it in your own account. You keep full control — start, pause, or stop copying at any time.
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {traders.map((t) => (
          <article key={t.name} className="glass flex flex-col rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {t.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <h2 className="font-semibold">{t.name}</h2>
                <p className="text-xs text-muted-foreground">{t.strategy}</p>
              </div>
            </div>
            <p className="mt-4 flex-1 text-sm text-muted-foreground">{t.bio}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">12-month return</dt><dd className="num font-semibold text-success">{t.return12m}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Win rate</dt><dd className="num font-semibold">{t.winRate}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Copiers</dt><dd className="num font-semibold">{t.copiers.toLocaleString()}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Risk level</dt><dd className="font-semibold">{t.risk}</dd></div>
            </dl>
            <Button asChild variant="hero" className="mt-5 w-full">
              <Link to="/copy-trading">Copy {t.name.split(" ")[0]} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </article>
        ))}
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:grid-cols-3">
          <div className="flex gap-3"><TrendingUp className="h-6 w-6 shrink-0 text-primary" /><div><h3 className="font-semibold">Live prices, real fills</h3><p className="mt-1 text-sm text-muted-foreground">Copied orders execute at the same live market price you see on your chart.</p></div></div>
          <div className="flex gap-3"><Users className="h-6 w-6 shrink-0 text-primary" /><div><h3 className="font-semibold">You stay in control</h3><p className="mt-1 text-sm text-muted-foreground">Set your own allocation per trader and stop copying whenever you like.</p></div></div>
          <div className="flex gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-primary" /><div><h3 className="font-semibold">Verified track records</h3><p className="mt-1 text-sm text-muted-foreground">Every featured trader completes identity verification before being listed.</p></div></div>
        </div>
        <p className="mx-auto max-w-3xl px-4 pb-12 text-center text-xs text-muted-foreground">
          Past performance does not guarantee future results. Copy trading involves risk, including the possible loss of principal.
        </p>
      </section>
    </div>
  );
}
