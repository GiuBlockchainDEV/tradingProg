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
    <main>
      <section className="hero">
        <nav className="topbar" aria-label="Main navigation">
          <div className="brand-mark">
            <span className="brand-orb" />
            <span>Gemini TradeLab</span>
          </div>
          <div className="topbar-actions">
            <span className="status-pill">AI Research</span>
            <a href="#workspace" className="ghost-link">Open terminal</a>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Trading intelligence powered by Gemini</span>
            <h1>Type a stock, get the full 12-prompt AI investment report.</h1>
            <p>
              No prompt setup, no manual metrics. The app fetches market data, scores the stock from 0 to 100,
              and asks Gemini to blend all 12 research prompts into one integrated report.
            </p>
            <div className="hero-actions">
              <a className="primary-cta" href="#workspace">Generate analysis</a>
              <a className="secondary-cta" href="#modules">View modules</a>
            </div>
          </div>

          <aside className="market-card" aria-label="Dashboard preview">
            <div className="market-card-header">
              <span>Watchlist</span>
              <strong>Live style</strong>
            </div>
            {[
              ["BTC", "+2.41%", "$68,420"],
              ["SPY", "+0.34%", "$541.12"],
              ["EUR/USD", "-0.18%", "1.0832"],
            ].map(([symbol, change, price]) => (
              <div className="ticker-row" key={symbol}>
                <div>
                  <strong>{symbol}</strong>
                  <span>AI signal scan</span>
                </div>
                <div className={change.startsWith("+") ? "positive" : "negative"}>
                  <strong>{price}</strong>
                  <span>{change}</span>
                </div>
              </div>
            ))}
            <div className="signal-meter">
              <span>Risk budget used</span>
              <div><span style={{ width: "42%" }} /></div>
              <strong>42%</strong>
            </div>
          </aside>
        </div>
      </section>

      <section className="module-strip" id="modules" aria-label="Key metrics">
        <div>
          <strong>12</strong>
          <span>trading modules</span>
        </div>
        <div>
          <strong>Gemini</strong>
          <span>server-side API</span>
        </div>
        <div>
          <strong>Markdown</strong>
          <span>tables and checklists</span>
        </div>
        <div>
          <strong>Responsive</strong>
          <span>desktop and mobile</span>
        </div>
      </section>

      <section className="workspace" id="workspace">
        <div className="workflow-panel">
          <div className="section-heading">
            <span>Research modules</span>
            <h2>All 12 prompts included</h2>
          </div>

          <div className="workflow-grid included-workflow-grid">
            {workflows.map((workflow) => (
              <article className="workflow-card included" key={workflow.id}>
                <span className="workflow-number">{workflow.number}</span>
                <strong>{workflow.title}</strong>
                <span>{workflow.short}</span>
                <div>
                  {workflow.tags.map((tag) => (
                    <em key={tag}>{tag}</em>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="terminal-panel">
          <div className="terminal-header">
            <div>
              <span>Analysis mode</span>
              <h2>Full research suite</h2>
            </div>
            <span className="status-pill">12/12 prompts</span>
          </div>

          <form onSubmit={submitAnalysis} className="analysis-form simplified-form">
            <div className="stock-search-card simple-stock-card">
              <label>
                Stock name or ticker
                <input
                  value={form.market}
                  onChange={(event) => updateField("market", event.target.value)}
                  placeholder="Example: Apple, Tesla, NVDA, Microsoft"
                />
              </label>
              <p>
                Enter the stock only. The app retrieves market data automatically and runs all 12 prompt types together.
              </p>
            </div>

            <div className="selected-prompt-card">
              <span>Included prompt suite</span>
              <strong>All 12 research prompts</strong>
              <p>Gemini will blend strategy generation, backtesting, risk/reward, regime detection, multi-factor logic, optimization, portfolio construction, trade setup, Monte Carlo, drawdown, macro, and alpha/edge analysis.</p>
            </div>

            {marketData && (
              <div className="simple-score-card">
                <div>
                  <span>Investment Score</span>
                  <strong>{marketData.metrics.investmentScore}/100</strong>
                  <small>{marketData.metrics.investmentScoreLabel}</small>
                </div>
                <div>
                  <span>Resolved asset</span>
                  <strong>{marketData.symbol}</strong>
                  <small>{formatPrice(marketData.quote.regularMarketPrice, marketData.currency)}</small>
                </div>
                <div>
                  <span>Buy zone</span>
                  <strong>{formatPrice(marketData.tradeLevels.buyZoneLow, marketData.currency)} - {formatPrice(marketData.tradeLevels.buyZoneHigh, marketData.currency)}</strong>
                  <small>Preferred: {formatPrice(marketData.tradeLevels.preferredBuy, marketData.currency)}</small>
                </div>
                <div>
                  <span>Sell targets</span>
                  <strong>{formatPrice(marketData.tradeLevels.target1, marketData.currency)} / {formatPrice(marketData.tradeLevels.target2, marketData.currency)}</strong>
                  <small>Trim/sell zone</small>
                </div>
                <div>
                  <span>Risk</span>
                  <strong>{formatPercent(marketData.tradeLevels.riskPercent)}</strong>
                  <small>Stop: {formatPrice(marketData.tradeLevels.stopLoss, marketData.currency)}</small>
                </div>
              </div>
            )}

            <button className="submit-button" disabled={isLoading} type="submit">
              {isLoading ? "Generating report..." : "Generate report"}
            </button>
          </form>
        </div>
      </section>

      <section className="output-section" aria-live="polite">
        <div className="section-heading">
          <span>AI output</span>
          <h2>Operating report</h2>
        </div>

        {!result && !error && (
          <div className="empty-output">
            <span>Ready</span>
            <p>Enter a stock and generate one complete report that blends all 12 research prompts with an objective investment score.</p>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
        {result && <MarkdownResult content={result} />}
      </section>
    </main>
  );
}
