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

      <section className="border-b border-border bg-deep-grad py-16 text-deep-foreground md:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Copy trading</p>
          <h1 className="mt-3 text-4xl font-bold md:text-5xl">Trade alongside experienced investors</h1>
          <p className="mx-auto mt-4 max-w-2xl text-deep-foreground/70">
            Allocate cash to a trader's basket. Buys and sells hit your wallet at live US market prices so your portfolio stays in sync.
          </p>
          <Button asChild variant="hero" size="lg" className="mt-8">
            <Link to="/auth" search={{ mode: "signup" }}>Get started <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="flex gap-3"><Users className="h-6 w-6 shrink-0 text-primary" /><div><h3 className="font-semibold">Curated traders</h3><p className="mt-1 text-sm text-muted-foreground">Each profile lists strategy, risk level, and a transparent basket of US stocks and ETFs.</p></div></div>
          <div className="flex gap-3"><TrendingUp className="h-6 w-6 shrink-0 text-primary" /><div><h3 className="font-semibold">Live prices, wallet fills</h3><p className="mt-1 text-sm text-muted-foreground">Copied baskets buy into your account at the latest market price, update cash and holdings, and mark to market while you hold them.</p></div></div>
          <div className="flex gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-primary" /><div><h3 className="font-semibold">You stay in control</h3><p className="mt-1 text-sm text-muted-foreground">Choose how much to allocate and close a copy anytime — proceeds return to your available cash.</p></div></div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-2xl font-semibold">Featured traders</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {traders.map((t) => (
              <article key={t.name} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {t.name.split(" ").map((p) => p[0]).join("")}
                  </div>
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.strategy} · {t.risk}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{t.bio}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <div><dt className="text-xs text-muted-foreground">12m return</dt><dd className="font-semibold text-success">{t.return12m}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Win rate</dt><dd className="font-semibold">{t.winRate}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Copiers</dt><dd className="font-semibold">{t.copiers.toLocaleString()}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="hero"><Link to="/auth" search={{ mode: "signup" }}>Open an account to start copying</Link></Button>
          </div>
        </div>
      </section>
    </div>
  );
}
