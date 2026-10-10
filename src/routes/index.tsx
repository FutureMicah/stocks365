import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  DollarSign, PieChart, Scale, LineChart, ShieldCheck, BadgeCheck, KeyRound, Lock, ArrowRight, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Logo } from "@/components/Logo";
import { Sparkline } from "@/components/Sparkline";
import { getQuotes } from "@/lib/market.functions";
import { fmt, pct } from "@/lib/data";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stocks365 — Invest in US Stocks & ETFs from $1" },
      { name: "description", content: "Buy US stocks and ETFs at live market prices. Fractional shares from $1, flat 0.5% commission, T+1 settlement." },
      { property: "og:title", content: "Stocks365 — Invest in US Markets" },
      { property: "og:description", content: "Live prices, fractional shares from $1 and a flat 0.5% commission." },
    ],
  }),
  component: Landing,
});

const POPULAR = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM", "V", "KO"];
const INDICES = [
  { s: "SPY", label: "S&P 500" },
  { s: "QQQ", label: "Nasdaq-100" },
  { s: "DIA", label: "Dow Jones" },
  { s: "IWM", label: "Russell 2000" },
];

function useLive(symbols: string[]) {
  return useQuery({
    queryKey: ["public-quotes", symbols],
    queryFn: () => getQuotes({ data: { symbols, spark: true } }),
    refetchInterval: 30_000,
  });
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Popular />
      <Products />
      <Platform />
      <HowItWorks />
      <Legends />
      <Pricing />
      <Security />
      <Learn />
      <Faq />
      <Cta />
      <Footer />
    </div>
  );
}

function Nav() {
  const { session, ready } = useSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const links = [["#markets", "Markets"], ["#platform", "Platform"], ["#how", "How it works"], ["#legends", "Legends"], ["#pricing", "Pricing"], ["#faq", "FAQ"]];
  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }
  const actions = !ready ? null : session ? (
    <>
      <Button variant="ghost" onClick={logout}>Log out</Button>
      <Button variant="hero" asChild><Link to="/dashboard">My portfolio</Link></Button>
    </>
  ) : (
    <>
      <Button variant="ghost" asChild><Link to="/auth">Login</Link></Button>
      <Button variant="hero" asChild><Link to="/auth" search={{ mode: "signup" }}>Trade Now</Link></Button>
    </>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Link to="/"><Logo /></Link>
        <nav className="hidden gap-6 text-sm font-semibold text-muted-foreground lg:flex">
          {links.map(([h, l]) => <a key={h} href={h} className="hover:text-foreground">{l}</a>)}
        </nav>
        <div className="hidden gap-2 sm:flex">{actions}</div>
        <button className="sm:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="space-y-1 border-t border-border bg-card px-5 py-4 sm:hidden">
          {links.map(([h, l]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block py-2 font-semibold">{l}</a>)}
          <div className="flex gap-2 pt-2">{actions}</div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const { data } = useLive(INDICES.map((i) => i.s));
  const map = Object.fromEntries((data ?? []).map((q) => [q.symbol, q]));
  return (
    <section className="relative overflow-hidden bg-glow">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Live US market data
          </span>
          <h1 className="mt-6 text-4xl leading-[1.05] sm:text-6xl">Own a piece of the world's <span className="text-brand">best companies</span></h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">Access US stocks, ETFs and index funds. Fund your account in USD, invest with a flat 0.5% commission, and start from just $1.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" variant="hero" asChild><Link to="/auth" search={{ mode: "signup" }}>Open an account <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button size="lg" variant="outline" asChild><a href="#markets">See live prices</a></Button>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
            {[["$1", "Minimum order"], ["0.5%", "Flat commission"], ["T+1", "Settlement"]].map(([v, l]) => (
              <div key={l}><dt className="num text-2xl font-medium">{v}</dt><dd className="text-xs text-muted-foreground">{l}</dd></div>
            ))}
          </dl>
        </div>
        <div className="grid content-center gap-3 sm:grid-cols-2">
          {INDICES.map((i) => {
            const q = map[i.s];
            return (
              <div key={i.s} className="glass rounded-2xl p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">{i.label}</p>
                  <p className="num text-xs text-muted-foreground">{i.s}</p>
                </div>
                <p className="num mt-2 text-2xl">{q ? fmt(q.price) : <span className="inline-block h-7 w-24 animate-pulse rounded bg-muted" />}</p>
                <p className={`num text-sm ${q && q.change >= 0 ? "text-success" : "text-destructive"}`}>{q ? `${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)} (${pct(q.changePct)})` : " "}</p>
                <Sparkline data={q?.spark} className="mt-3 h-10 w-full" />
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground sm:col-span-2">ETF prices tracking each index. Updated every 30 seconds{map["SPY"] ? ` · last trade ${new Date(map["SPY"].marketTime).toLocaleString()}` : ""}.</p>
        </div>
      </div>
    </section>
  );
}

function Section({ id, eyebrow, title, sub, children, tone }: { id?: string; eyebrow: string; title: string; sub?: string; children: React.ReactNode; tone?: "muted" }) {
  return (
    <section id={id} className={`scroll-mt-20 py-20 ${tone === "muted" ? "bg-muted/60" : ""}`}>
      <div className="mx-auto max-w-7xl px-5">
        <p className="num text-xs font-medium uppercase tracking-widest text-primary">{eyebrow}</p>
        <h2 className="mt-2 max-w-2xl text-3xl sm:text-4xl">{title}</h2>
        {sub && <p className="mt-3 max-w-2xl text-muted-foreground">{sub}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function Popular() {
  const { data, isLoading } = useLive(POPULAR);
  return (
    <Section id="markets" eyebrow="Popular right now" title="Start with the companies you already know" sub="Real-time quotes from US exchanges. Tap any company to trade it.">
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr><th className="p-4">Company</th><th className="p-4 text-right">Price</th><th className="p-4 text-right">Today</th><th className="hidden p-4 text-right md:table-cell">Day range</th><th className="hidden p-4 text-right md:table-cell">Volume</th><th className="p-4">30 days</th><th className="p-4" /></tr>
          </thead>
          <tbody>
            {isLoading && POPULAR.map((s) => <tr key={s} className="border-t border-border"><td colSpan={7} className="p-4"><div className="h-6 animate-pulse rounded bg-muted" /></td></tr>)}
            {(data ?? []).map((q) => (
              <tr key={q.symbol} className="border-t border-border hover:bg-accent/40">
                <td className="p-4"><p className="font-bold">{q.symbol}</p><p className="max-w-[220px] truncate text-xs text-muted-foreground">{q.name}</p></td>
                <td className="num p-4 text-right">{fmt(q.price)}</td>
                <td className={`num p-4 text-right ${q.change >= 0 ? "text-success" : "text-destructive"}`}>{pct(q.changePct)}</td>
                <td className="num hidden p-4 text-right text-xs text-muted-foreground md:table-cell">{q.dayLow && q.dayHigh ? `${q.dayLow.toFixed(2)} – ${q.dayHigh.toFixed(2)}` : "—"}</td>
                <td className="num hidden p-4 text-right text-xs text-muted-foreground md:table-cell">{q.volume ? Intl.NumberFormat("en-US", { notation: "compact" }).format(q.volume) : "—"}</td>
                <td className="p-4"><Sparkline data={q.spark} /></td>
                <td className="p-4 text-right"><Button size="sm" variant="outline" asChild><Link to="/dashboard">Trade</Link></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Products() {
  const items = [
    ["US stocks", "Own shares of major US companies across technology, healthcare, consumer and finance.", false],
    ["ETFs", "Diversify instantly with funds that track the S&P 500, Nasdaq-100 and other indexes.", false],
    ["Fractional shares", "Invest a dollar amount instead of buying a whole share of a high-priced stock.", false],
    ["Treasury bills", "Earn interest on idle cash with short-term US government debt.", true],
    ["Recurring plans", "Automate weekly or monthly investing and build the habit.", true],
    ["Themed baskets", "Buy a curated group of stocks, such as dividend payers or AI leaders, in one tap.", true],
  ] as const;
  return (
    <Section eyebrow="What you can invest in" title="One account, a full range of US investments" tone="muted">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([t, d, soon]) => (
          <div key={t} className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between"><h3 className="text-lg">{t}</h3>{soon && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Soon</span>}</div>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Platform() {
  const items = [
    [DollarSign, "Fund in USD", "Add money by bank transfer, wire or card. See any fees before you confirm."],
    [PieChart, "Fractional shares", "Buy a slice of Apple, Microsoft or an S&P 500 ETF with any amount from $1."],
    [Scale, "Market orders", "Trade at the current live price. Track every order from placed to settled."],
    [LineChart, "Portfolio insight", "Live portfolio value, gains, allocation and long-term growth projections."],
  ] as const;
  return (
    <Section id="platform" eyebrow="Platform" title="Everything you need to invest with confidence" sub="One account for funding, trading and tracking.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([I, t, d]) => (
          <div key={t} className="glass rounded-2xl p-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary"><I className="h-5 w-5" /></span>
            <h3 className="mt-4 text-lg">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    ["Create and verify", "Sign up, confirm your email, then verify with your SSN last 4 and a government ID."],
    ["Fund your wallet", "Add US dollars by bank transfer, wire or card."],
    ["Place your order", "Pick a stock or ETF, choose an amount and confirm."],
    ["Track and withdraw", "Watch your portfolio live and cash out to your own bank."],
  ];
  return (
    <Section id="how" eyebrow="How it works" title="From sign-up to first investment in minutes" tone="muted">
      <ol className="grid gap-4 md:grid-cols-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="glass rounded-2xl p-6">
            <span className="num text-3xl text-primary">0{i + 1}</span>
            <h3 className="mt-3 text-lg">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Legends() {
  const quotes = [
    ["Price is what you pay. Value is what you get.", "Warren Buffett", "Chairman, Berkshire Hathaway"],
    ["Don't look for the needle in the haystack. Just buy the haystack.", "John Bogle", "Founder, Vanguard"],
    ["Know what you own, and know why you own it.", "Peter Lynch", "Former manager, Fidelity Magellan"],
    ["Diversifying well is the most important thing you need to do in order to invest well.", "Ray Dalio", "Founder, Bridgewater"],
  ];
  return (
    <section id="legends" className="scroll-mt-20 bg-deep-grad py-20 text-deep-foreground">
      <div className="mx-auto max-w-7xl px-5">
        <p className="num text-xs uppercase tracking-widest text-deep-foreground/60">Learn from the legends</p>
        <h2 className="mt-2 max-w-2xl text-3xl sm:text-4xl">Ideas from the world's most successful investors</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {quotes.map(([q, n, r]) => (
            <figure key={n} className="rounded-2xl border border-deep-foreground/15 p-6">
              <blockquote className="text-xl font-semibold leading-snug">“{q}”</blockquote>
              <figcaption className="num mt-4 text-xs uppercase tracking-wider text-deep-foreground/60">{n} · {r}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-xs text-deep-foreground/50">Quotes are widely attributed and shown for education. They are not endorsements.</p>
      </div>
    </section>
  );
}

function Pricing() {
  const rows = [["Account opening and maintenance", "$0"], ["Commission per trade", "0.5%"], ["Minimum order", "$1"], ["ACH deposits", "$0"], ["Withdrawals to your bank", "$0"]];
  return (
    <Section id="pricing" eyebrow="Pricing" title="Simple, transparent fees" sub="No account fees and no hidden charges. You see the full cost before every order.">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass divide-y divide-border rounded-2xl">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between p-5"><span>{k}</span><span className="num font-medium">{v}</span></div>)}
        </div>
        <div className="glass rounded-2xl p-6">
          <p className="num text-xs uppercase tracking-widest text-primary">Example</p>
          <p className="mt-3 text-lg">Buying <b>$200</b> of an S&P 500 ETF costs <b>$1.00</b> in commission, so <b>$201.00</b> in total.</p>
          <p className="mt-3 text-sm text-muted-foreground">Selling later carries the same 0.5% commission. Regulatory fees may apply and are shown at checkout.</p>
          <Button variant="hero" className="mt-6" asChild><Link to="/auth" search={{ mode: "signup" }}>Open the trading screen</Link></Button>
        </div>
      </div>
    </Section>
  );
}

function Security() {
  const items = [
    [ShieldCheck, "Segregated accounts", "Client assets are tracked separately from company funds."],
    [BadgeCheck, "Identity verification", "Every account is verified with SSN last 4 and a government ID."],
    [KeyRound, "Secure login", "Email verification, password reset and Google sign-in protect every account."],
    [Lock, "Encrypted end to end", "Data is encrypted in transit and at rest; ID documents are stored privately."],
  ] as const;
  return (
    <Section eyebrow="Security" title="Your money and data are protected" tone="muted">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([I, t, d]) => (
          <div key={t} className="glass rounded-2xl p-6"><I className="h-6 w-6 text-primary" /><h3 className="mt-4 text-lg">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>
        ))}
      </div>
    </Section>
  );
}

function Learn() {
  const items = [
    ["What is an ETF?", "An exchange-traded fund bundles hundreds of companies into one purchase, so a single trade can give you broad diversification at low cost."],
    ["Dollar-cost averaging", "Investing a fixed amount on a schedule means you buy more shares when prices are low and fewer when they're high, smoothing out swings."],
    ["Reading a stock quote", "Price is the last trade. Change is versus yesterday's close. Volume is how many shares traded today. The day range shows the high and low."],
  ];
  return (
    <Section eyebrow="Learn" title="Learn before you invest" sub="Short guides that explain the basics in plain language.">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map(([t, d]) => <article key={t} className="glass rounded-2xl p-6"><h3 className="text-lg">{t}</h3><p className="mt-2 text-sm text-muted-foreground">{d}</p></article>)}
      </div>
    </Section>
  );
}

function Faq() {
  const qs = [
    ["How much do I need to start?", "You can place an order from $1 thanks to fractional shares."],
    ["Is my money safe?", "Client assets are kept separate from the company's own funds. All investments still carry market risk."],
    ["Can I lose money?", "Yes. Stock and ETF prices go up and down, and you can get back less than you invest."],
    ["What does it cost?", "There are no account fees. Trades carry a 0.5% commission, shown before you confirm."],
    ["How long do trades take to settle?", "US stock trades settle one business day after execution (T+1)."],
    ["What do I need to sign up?", "Your legal name, email, date of birth, address, the last 4 digits of your SSN and a government-issued photo ID."],
    ["How do I withdraw?", "Sell your holdings, then withdraw the cash to your bank from the Wallet page."],
  ];
  return (
    <Section id="faq" eyebrow="FAQ" title="Frequently asked questions" tone="muted">
      <Accordion type="single" collapsible className="glass max-w-3xl rounded-2xl px-6">
        {qs.map(([q, a]) => (
          <AccordionItem key={q} value={q}><AccordionTrigger className="text-left font-semibold">{q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{a}</AccordionContent></AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}

function Cta() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-5xl rounded-3xl bg-deep-grad px-6 py-14 text-center text-deep-foreground">
        <h2 className="text-3xl sm:text-4xl">Ready to start investing?</h2>
        <p className="mx-auto mt-3 max-w-xl text-deep-foreground/70">Open your account in minutes and trade at live US market prices.</p>
        <Button size="lg" variant="hero" className="mt-8" asChild><Link to="/auth" search={{ mode: "signup" }}>Trade Now</Link></Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-4">
        <div><Logo /><p className="mt-3 text-sm text-muted-foreground">Invest in US stocks and ETFs with a simple, transparent platform.</p></div>
        <div><p className="font-bold">Products</p><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li><a href="#markets">Markets</a></li><li><Link to="/dashboard">Portfolio</Link></li><li><Link to="/funds">Wallet</Link></li></ul></div>
        <div><p className="font-bold">Company</p><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li><a href="#pricing">Pricing</a></li><li><a href="#legends">Legends</a></li><li><a href="#how">How it works</a></li></ul></div>
        <div><p className="font-bold">Support</p><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li><a href="#faq">FAQ</a></li><li><Link to="/auth">Login</Link></li><li><Link to="/forgot-password">Reset password</Link></li></ul></div>
      </div>
      <div className="mx-auto max-w-7xl border-t border-border px-5 py-6 text-xs text-muted-foreground">
        <b>Risk disclosure.</b> Investing involves risk, including the possible loss of principal. Past performance does not predict future results. Market data provided for information only and not investment advice.
        <p className="mt-2">© {2026} Stocks365. All rights reserved.</p>
      </div>
    </footer>
  );
}
