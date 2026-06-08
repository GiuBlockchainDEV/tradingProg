import Link from "next/link";

const workflows = [
  ["01", "Strategy Generation"],
  ["02", "Backtesting"],
  ["03", "Risk-Reward Analysis"],
  ["04", "Market Regime Detection"],
  ["05", "Multi-Factor Strategy"],
  ["06", "Strategy Optimization"],
  ["07", "Portfolio Construction"],
  ["08", "Trade Setup Generation"],
  ["09", "Monte Carlo Simulation"],
  ["10", "Drawdown Analysis"],
  ["11", "Macro-Based Strategy"],
  ["12", "Alpha / Edge Detection"],
];

export default function LandingPage() {
  return (
    <main className="app-shell landing-shell">
      <header className="app-header">
        <Link className="brand-mark" href="/" aria-label="Equity Research Lab home">
          <span className="brand-orb" />
          <span>Equity Research Lab</span>
        </Link>
        <nav className="header-actions" aria-label="Primary navigation">
          <a href="#suite">12 prompts</a>
          <Link href="/analyze">Start analysis</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <span className="eyebrow">Visual equity research terminal</span>
        <h1>One stock. One click. Full 12-prompt investment analysis.</h1>
        <p>
          Enter a ticker or company name and get a visual company report with research scores, fair value checks,
          fundamentals, forecast cone, buy/sell/risk levels, target odds, dividends, and an AI-generated report.
        </p>
        <div className="landing-actions">
          <Link className="primary-link" href="/analyze">Start stock analysis</Link>
          <a className="secondary-link" href="#suite">View included prompts</a>
        </div>
        <div className="trust-row">
          <span>Yahoo Finance data</span>
          <span>TradingView verification</span>
          <span>Research snowflake</span>
          <span>Buy / Sell / Risk levels</span>
        </div>
      </section>

      <section className="suite-section landing-suite" id="suite">
        <div className="section-heading centered-heading">
          <span>Research engine</span>
          <h2>All 12 prompts are blended into one report</h2>
          <p>The analysis engine receives every module together and produces a single coherent decision framework.</p>
        </div>
        <div className="suite-grid">
          {workflows.map(([number, title]) => (
            <article className="suite-chip" key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
