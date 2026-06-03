"use client";

import { FormEvent, ReactNode, useState } from "react";

type Workflow = {
  id: string;
  number: string;
  title: string;
  short: string;
  tags: string[];
  placeholder: string;
};

type FormState = {
  market: string;
  timeframe: string;
  capital: string;
  riskPerTrade: string;
  riskTolerance: string;
  timeHorizon: string;
  assets: string;
  strategyRules: string;
  historicalData: string;
  extraContext: string;
};

type MarketData = {
  symbol: string;
  displayName: string;
  exchange?: string;
  currency?: string;
  source: string;
  links: {
    yahoo: string;
    tradingView: string;
  };
  quote: {
    regularMarketPrice: number | null;
    regularMarketChangePercent: number | null;
    marketCap: number | null;
    trailingPE: number | null;
    forwardPE: number | null;
    beta: number | null;
    dividendYield: number | null;
    dividendRate: number | null;
    trailingAnnualDividendRate: number | null;
    trailingAnnualDividendYield: number | null;
    averageDividendPayment: number | null;
    lastDividendAmount: number | null;
    lastDividendDate: string | null;
    dividendPaymentsPerYear: number | null;
    dividendFrequency: string;
    exDividendDate: string | null;
    dividendDate: string | null;
    dividendHistoryCount: number;
  };
  metrics: {
    oneYearReturn: number | null;
    annualizedReturn: number | null;
    annualizedVolatility: number | null;
    maxDrawdown: number | null;
    sma50: number | null;
    sma200: number | null;
    rsi14: number | null;
    distanceFrom52WeekHigh: number | null;
    averageVolume30: number | null;
    trend: string;
    investmentScore: number;
    investmentScoreLabel: string;
    investmentScoreDrivers: string;
  };
  tradeLevels: {
    buyZoneLow: number | null;
    buyZoneHigh: number | null;
    preferredBuy: number | null;
    stopLoss: number | null;
    riskPercent: number | null;
    currentPriceRiskPercent: number | null;
    target1: number | null;
    target2: number | null;
    target1Probability: number | null;
    target2Probability: number | null;
    target1ExpectedSessions: number | null;
    target2ExpectedSessions: number | null;
    target1MedianSessions: number | null;
    target2MedianSessions: number | null;
    target1ExpectedTimeframe: string | null;
    target2ExpectedTimeframe: string | null;
    targetProbabilityHorizon: string | null;
    targetProbabilitySampleSize: number | null;
    targetProbabilityMethod: string;
    sellZoneLow: number | null;
    sellZoneHigh: number | null;
    upsideToTarget1Percent: number | null;
    upsideToTarget2Percent: number | null;
    rewardRiskTarget1: number | null;
    rewardRiskTarget2: number | null;
    method: string;
  };
  promptContext: string;
};


const workflows: Workflow[] = [
  {
    id: "strategy_generation",
    number: "01",
    title: "Strategy Generation",
    short: "3 complete strategies with indicators, entries, exits, and edge rationale.",
    tags: ["edge", "rules", "signals"],
    placeholder: "Example: large-cap crypto, 1D timeframe, EUR 10,000 capital, 1% risk per trade.",
  },
  {
    id: "backtesting",
    number: "02",
    title: "Backtesting",
    short: "CAGR, Sharpe, max drawdown, win rate, and summary.",
    tags: ["CAGR", "Sharpe", "MDD"],
    placeholder: "Paste strategy rules and, if available, results or OHLCV history.",
  },
  {
    id: "risk_reward",
    number: "03",
    title: "Risk-Reward Analysis",
    short: "Risk per trade, R/R, drawdown, and improvements.",
    tags: ["risk", "R/R", "sizing"],
    placeholder: "Describe setup, stop, target, and operating frequency.",
  },
  {
    id: "market_regime",
    number: "04",
    title: "Market Regime Detection",
    short: "Trend, volatility, volume, what to do, and what to avoid.",
    tags: ["trend", "volatility", "volume"],
    placeholder: "Enter asset, timeframe, and recent data: price, moving averages, volatility, and volume.",
  },
  {
    id: "multi_factor",
    number: "05",
    title: "Multi-Factor Strategy",
    short: "Momentum, value, volatility, and trend in a weighted model.",
    tags: ["factor", "weights", "rebalance"],
    placeholder: "List investable universe, rebalancing frequency, and risk constraints.",
  },
  {
    id: "optimization",
    number: "06",
    title: "Strategy Optimization",
    short: "Improve Sharpe, drawdown, timing, and filters.",
    tags: ["filters", "timing", "before/after"],
    placeholder: "Paste the current strategy with indicators, parameters, entries, exits, and known limitations.",
  },
  {
    id: "portfolio",
    number: "07",
    title: "Portfolio Construction",
    short: "Allocations, expected return, risk, and rationale.",
    tags: ["allocation", "risk", "horizon"],
    placeholder: "Example assets: SPY, QQQ, GLD, BTC, cash. 1-3 year horizon, medium risk.",
  },
  {
    id: "trade_setup",
    number: "08",
    title: "Trade Setup Generation",
    short: "3 trades with entry, stop, take profit, and reasoning.",
    tags: ["entry", "SL", "TP"],
    placeholder: "Enter market, preferred direction, key levels, news/macro context, and timeframe.",
  },
  {
    id: "monte_carlo",
    number: "09",
    title: "Monte Carlo Simulation",
    short: "Return distribution, probability of loss, and worst-case scenarios.",
    tags: ["simulation", "loss", "robustness"],
    placeholder: "Provide win rate, average R, number of trades, average loss, and result series if available.",
  },
  {
    id: "drawdown",
    number: "10",
    title: "Drawdown Analysis",
    short: "Max drawdown, recovery time, and position sizing.",
    tags: ["MDD", "recovery", "sizing"],
    placeholder: "Paste equity curve, trade results, or a strategy description to analyze.",
  },
  {
    id: "macro_strategy",
    number: "11",
    title: "Macro-Based Strategy",
    short: "Rates, inflation, growth, signals, and operating examples.",
    tags: ["rates", "inflation", "growth"],
    placeholder: "Describe geography, macro assets, and data: CPI, PMI, central banks, yield curves.",
  },
  {
    id: "alpha_edge",
    number: "12",
    title: "Alpha / Edge Detection",
    short: "Inefficiencies, market-structure gaps, and less crowded strategies.",
    tags: ["alpha", "behavior", "structure"],
    placeholder: "Enter market, dominant participants, constraints, microstructure, and operating horizon.",
  },
];

const starterState: FormState = {
  market: "",
  timeframe: "Automatically selected from market data and the full 12-module analysis",
  capital: "Not specified",
  riskPerTrade: "Not specified",
  riskTolerance: "Not specified",
  timeHorizon: "Not specified",
  assets: "",
  strategyRules: "",
  historicalData: "",
  extraContext: "",
};


function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${value.toFixed(2)}%`;
}

function formatPrice(value: number | null, currency?: string) {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${currency ? `${currency} ` : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatCompact(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function parseInline(text: string) {
  const strongPattern = /\*\*(.*?)\*\*/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = strongPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={`${match.index}-${match[1]}`}>{match[1]}</strong>);
    lastIndex = strongPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function MarkdownTable({ block }: { block: string }) {
  const rows = block
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.startsWith("|") && row.endsWith("|"))
    .map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));

  if (rows.length === 0) {
    return null;
  }

  const [header, ...body] = rows;

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {header.map((cell) => (
              <th key={cell}>{parseInline(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`${row.join("-")}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{parseInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownBlock({ block }: { block: string }) {
  const trimmed = block.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("|") && trimmed.split("\n").some((line) => line.trim().startsWith("|"))) {
    return <MarkdownTable block={trimmed} />;
  }

  if (trimmed.startsWith("### ")) {
    return <h3>{parseInline(trimmed.replace(/^###\s+/, ""))}</h3>;
  }

  if (trimmed.startsWith("## ")) {
    return <h2>{parseInline(trimmed.replace(/^##\s+/, ""))}</h2>;
  }

  if (trimmed.startsWith("# ")) {
    return <h2>{parseInline(trimmed.replace(/^#\s+/, ""))}</h2>;
  }

  const lines = trimmed.split("\n");
  const isList = lines.every((line) => /^\s*(-|\*|\d+\.)\s+/.test(line));

  if (isList) {
    return (
      <ul>
        {lines.map((line) => (
          <li key={line}>{parseInline(line.replace(/^\s*(-|\*|\d+\.)\s+/, ""))}</li>
        ))}
      </ul>
    );
  }

  return <p>{parseInline(trimmed)}</p>;
}

function MarkdownResult({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="markdown-result">
      {blocks.map((block, index) => (
        <MarkdownBlock key={`${block.slice(0, 24)}-${index}`} block={block} />
      ))}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState<FormState>(starterState);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("gtl-disclaimer-accepted") === "true",
  );

  function acceptDisclaimer() {
    localStorage.setItem("gtl-disclaimer-accepted", "true");
    setHasAcceptedDisclaimer(true);
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "market") {
      setMarketData(null);
    }
  }

  function mergeMarketDataIntoForm(data: MarketData, currentForm: FormState) {
    const extraContext = [
      currentForm.extraContext,
      `Automatic sources: Yahoo Finance (${data.links.yahoo}) and TradingView (${data.links.tradingView}).`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      ...currentForm,
      market: `${data.displayName} (${data.symbol})`,
      assets: data.symbol,
      historicalData: data.promptContext,
      extraContext,
    };
  }

  async function fetchMarketData(query: string) {
    const response = await fetch("/api/market-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Unable to retrieve market data.");
    }

    return data as MarketData;
  }

  async function submitAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setResult("");

    try {
      let enrichedForm = form;
      let dataForPrompt = marketData;

      if (form.market.trim()) {
        const needsFreshData = !marketData || !form.historicalData.includes("Market data automatically retrieved");
        dataForPrompt = needsFreshData ? await fetchMarketData(form.market) : marketData;

        if (dataForPrompt) {
          enrichedForm = mergeMarketDataIntoForm(dataForPrompt, form);
          setMarketData(dataForPrompt);
          setForm(enrichedForm);
        }
      }

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrichedForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed.");
      }

      setResult(data.result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unexpected error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      {!hasAcceptedDisclaimer && (
        <div className="disclaimer-backdrop" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
          <div className="disclaimer-modal">
            <div className="modal-icon">!</div>
            <span className="eyebrow">Before you continue</span>
            <h2 id="disclaimer-title">Educational research, not financial advice.</h2>
            <p>
              Gemini TradeLab provides automated market research, scoring, and example trade levels for educational purposes only.
              It does not provide personalized financial, investment, tax, or legal advice.
            </p>
            <ul>
              <li>Always verify data, prices, and levels with your broker or market data provider.</li>
              <li>Markets involve risk, including loss of capital.</li>
              <li>You are responsible for every investment or trading decision.</li>
            </ul>
            <button className="modal-accept" onClick={acceptDisclaimer} type="button">
              I understand and accept
            </button>
          </div>
        </div>
      )}

      <header className="app-header">
        <a className="brand-mark" href="#top" aria-label="Gemini TradeLab home">
          <span className="brand-orb" />
          <span>Gemini TradeLab</span>
        </a>
        <nav className="header-actions" aria-label="Primary navigation">
          <a href="#analysis">Analysis</a>
          <a href="#suite">12 prompts</a>
          <a href="#report">Report</a>
        </nav>
      </header>

      <section className="hero-panel" id="top">
        <div className="hero-copy">
          <span className="eyebrow">AI equity research terminal</span>
          <h1>One stock. One click. Full 12-prompt investment analysis.</h1>
          <p>
            Enter a ticker or company name. The app retrieves market data, calculates score, buy zone, sell targets,
            risk percentage, and sends the complete context to Gemini 2.5 Flash.
          </p>
          <div className="trust-row" aria-label="Feature highlights">
            <span>Yahoo Finance data</span>
            <span>TradingView verification</span>
            <span>Objective 0-100 score</span>
            <span>Buy / Sell / Risk levels</span>
          </div>
        </div>

        <section className="command-card" id="analysis" aria-label="Stock analysis form">
          <div className="command-card-header">
            <div>
              <span className="eyebrow">Start here</span>
              <h2>Analyze a stock</h2>
            </div>
            <span className="status-pill">12/12 prompts included</span>
          </div>

          <form onSubmit={submitAnalysis} className="stock-command-form">
            <label>
              Stock name or ticker
              <div className="stock-input-shell">
                <input
                  value={form.market}
                  onChange={(event) => updateField("market", event.target.value)}
                  placeholder="Example: Ferrari, Apple, Tesla, NVDA"
                  aria-label="Stock name or ticker"
                />
                <button disabled={isLoading} type="submit">
                  {isLoading ? "Generating..." : "Generate report"}
                </button>
              </div>
            </label>
          </form>

          <p className="microcopy">
            No timeframe, capital, risk settings, or manual metrics required. The full research suite runs automatically.
          </p>

          {error && <div className="error-box compact-error">{error}</div>}
        </section>
      </section>

      <section className="insight-grid" aria-label="Live analysis summary">
        <article className="insight-card primary-score">
          <span>Investment score</span>
          <strong>{marketData ? `${marketData.metrics.investmentScore}/100` : "--/100"}</strong>
          <small>{marketData ? marketData.metrics.investmentScoreLabel : "Generated after analysis"}</small>
        </article>
        <article className="insight-card">
          <span>Buy zone</span>
          <strong>
            {marketData
              ? `${formatPrice(marketData.tradeLevels.buyZoneLow, marketData.currency)} - ${formatPrice(marketData.tradeLevels.buyZoneHigh, marketData.currency)}`
              : "Waiting for stock"}
          </strong>
          <small>{marketData ? `Preferred: ${formatPrice(marketData.tradeLevels.preferredBuy, marketData.currency)}` : "Objective pullback area"}</small>
        </article>
        <article className="insight-card">
          <span>Sell targets</span>
          <strong>
            {marketData
              ? `${formatPrice(marketData.tradeLevels.target1, marketData.currency)} / ${formatPrice(marketData.tradeLevels.target2, marketData.currency)}`
              : "Waiting for stock"}
          </strong>
          <small>Target 1 / Target 2</small>
        </article>
        <article className="insight-card odds-card">
          <span>Target odds</span>
          <strong>
            {marketData
              ? `${formatPercent(marketData.tradeLevels.target1Probability)} / ${formatPercent(marketData.tradeLevels.target2Probability)}`
              : "-- / --"}
          </strong>
          <small>
            {marketData
              ? `T1 ${marketData.tradeLevels.target1ExpectedTimeframe ?? "n/a"} | T2 ${marketData.tradeLevels.target2ExpectedTimeframe ?? "n/a"}`
              : "Target 1 / Target 2 probability"}
          </small>
        </article>
        <article className="insight-card risk-card">
          <span>Risk to stop</span>
          <strong>{marketData ? formatPercent(marketData.tradeLevels.riskPercent) : "--"}</strong>
          <small>{marketData ? `Stop: ${formatPrice(marketData.tradeLevels.stopLoss, marketData.currency)}` : "Calculated from levels"}</small>
        </article>
        <article className="insight-card dividend-card">
          <span>Dividend profile</span>
          <strong>{marketData ? formatPrice(marketData.quote.averageDividendPayment, marketData.currency) : "--"}</strong>
          <small>
            {marketData
              ? `Avg historical payment | annual ${formatPrice(marketData.quote.dividendRate ?? marketData.quote.trailingAnnualDividendRate, marketData.currency)} | ex ${marketData.quote.exDividendDate ?? "n/a"}`
              : "Amount and timing from Yahoo"}
          </small>
        </article>
      </section>

      {marketData && (
        <section className="market-summary" aria-label="Resolved market data">
          <div>
            <span className="eyebrow">Resolved asset</span>
            <h2>{marketData.displayName} <small>({marketData.symbol})</small></h2>
          </div>
          <div className="summary-metrics">
            <span>{formatPrice(marketData.quote.regularMarketPrice, marketData.currency)}</span>
            <span>{formatPercent(marketData.quote.regularMarketChangePercent)} today</span>
            <span>Dividend yield {formatPercent(marketData.quote.dividendYield ?? marketData.quote.trailingAnnualDividendYield)}</span>
            <span>{marketData.quote.dividendDate ? `Payment ${marketData.quote.dividendDate}` : marketData.quote.dividendFrequency}</span>
            <span>{marketData.metrics.trend}</span>
          </div>
          <div className="source-links">
            <a href={marketData.links.yahoo} target="_blank" rel="noreferrer">Yahoo Finance</a>
            <a href={marketData.links.tradingView} target="_blank" rel="noreferrer">TradingView</a>
          </div>
        </section>
      )}

      <section className="suite-section" id="suite">
        <div className="section-heading centered-heading">
          <span>Research engine</span>
          <h2>All 12 prompts are blended into one report</h2>
          <p>Gemini receives every module together and produces a single coherent decision framework.</p>
        </div>
        <div className="suite-grid">
          {workflows.map((workflow) => (
            <article className="suite-chip" key={workflow.id}>
              <span>{workflow.number}</span>
              <strong>{workflow.title}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="output-section" id="report" aria-live="polite">
        <div className="report-header">
          <div>
            <span className="eyebrow">AI output</span>
            <h2>Integrated investment report</h2>
          </div>
          <span className="status-pill">Not financial advice</span>
        </div>

        {!result && !error && (
          <div className="empty-output">
            <span>Ready</span>
            <p>Enter a stock above to generate score, buy/sell/risk levels, and the full Gemini report.</p>
          </div>
        )}

        {result && <MarkdownResult content={result} />}
      </section>
    </main>
  );}
