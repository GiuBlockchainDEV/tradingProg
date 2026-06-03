"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";

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
  market: "Apple",
  timeframe: "1D",
  capital: "10000 EUR",
  riskPerTrade: "1%",
  riskTolerance: "Medium",
  timeHorizon: "1-3 anni",
  assets: "AAPL",
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

  return `${currency ? `${currency} ` : ""}${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
}

function formatCompact(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("it-IT", {
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
  const [selectedWorkflow, setSelectedWorkflow] = useState(workflows[0].id);
  const [form, setForm] = useState<FormState>(starterState);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);

  const activeWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflow) ?? workflows[0],
    [selectedWorkflow],
  );

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "market") {
      setMarketData(null);
    }
  }

  function mergeMarketDataIntoForm(data: MarketData, currentForm: FormState) {
    const extraContext = [
      currentForm.extraContext,
      `Automatic sources: Yahoo Finance (${data.links.yahoo}) e TradingView (${data.links.tradingView}).`,
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

  async function loadMarketData() {
    const query = form.market.trim();
    if (!query) {
      setError("Enter a stock name or ticker.");
      return null;
    }

    setIsLoadingMarket(true);
    setError("");

    try {
      const data = await fetchMarketData(query);
      setMarketData(data);
      setForm((current) => mergeMarketDataIntoForm(data, current));
      return data;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Error while retrieving market data.");
      return null;
    } finally {
      setIsLoadingMarket(false);
    }
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
        body: JSON.stringify({ workflow: selectedWorkflow, ...enrichedForm }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Richiesta non riuscita.");
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
            <h1>A Next.js suite for strategies, backtests, risk, and portfolios.</h1>
            <p>
              Turn trading research prompts into operating workflows: generate strategies, analyze drawdowns,
              build portfolios, and create setups with a fast, responsive green fintech UI.
            </p>
            <div className="hero-actions">
              <a className="primary-cta" href="#workspace">Generate analysis</a>
              <a className="secondary-cta" href="#modules">View modules</a>
            </div>
          </div>

          <aside className="market-card" aria-label="Anteprima dashboard">
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
          <span>tabelle e checklist</span>
        </div>
        <div>
          <strong>Responsive</strong>
          <span>desktop e mobile</span>
        </div>
      </section>

      <section className="workspace" id="workspace">
        <div className="workflow-panel">
          <div className="section-heading">
            <span>Research modules</span>
            <h2>Scegli cosa vuoi costruire</h2>
          </div>

          <div className="workflow-grid">
            {workflows.map((workflow) => (
              <button
                className={`workflow-card ${workflow.id === selectedWorkflow ? "selected" : ""}`}
                key={workflow.id}
                onClick={() => setSelectedWorkflow(workflow.id)}
                type="button"
              >
                <span className="workflow-number">{workflow.number}</span>
                <strong>{workflow.title}</strong>
                <span>{workflow.short}</span>
                <div>
                  {workflow.tags.map((tag) => (
                    <em key={tag}>{tag}</em>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="terminal-panel">
          <div className="terminal-header">
            <div>
              <span>Active module</span>
              <h2>{activeWorkflow.title}</h2>
            </div>
            <span className="status-pill">{activeWorkflow.number}/12</span>
          </div>

          <form onSubmit={submitAnalysis} className="analysis-form">
            <div className="stock-search-card">
              <label>
                Stock name or ticker
                <div className="stock-input-row">
                  <input
                    value={form.market}
                    onChange={(event) => updateField("market", event.target.value)}
                    placeholder="Example: Apple, Tesla, NVDA, Microsoft"
                  />
                  <button disabled={isLoadingMarket || isLoading} onClick={loadMarketData} type="button">
                    {isLoadingMarket ? "Loading..." : "Load metrics"}
                  </button>
                </div>
              </label>
              <p>
                Enter only the stock name: the app resolves the ticker, retrieves quotes and historical data from Yahoo Finance, and adds TradingView links for chart verification.
              </p>
              {marketData && (
                <div className="metric-preview-grid">
                  <div className="metric-mini-card score-card">
                    <span>Investment Score</span>
                    <strong>{marketData.metrics.investmentScore}/100</strong>
                    <small>{marketData.metrics.investmentScoreLabel}</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>Symbol</span>
                    <strong>{marketData.symbol}</strong>
                    <small>{marketData.exchange || marketData.source}</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>Price</span>
                    <strong>{formatPrice(marketData.quote.regularMarketPrice, marketData.currency)}</strong>
                    <small>{formatPercent(marketData.quote.regularMarketChangePercent)} today</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>Volatility</span>
                    <strong>{formatPercent(marketData.metrics.annualizedVolatility)}</strong>
                    <small>annualized</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>Max drawdown</span>
                    <strong>{formatPercent(marketData.metrics.maxDrawdown)}</strong>
                    <small>available history</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>RSI 14</span>
                    <strong>{marketData.metrics.rsi14 ?? "n/a"}</strong>
                    <small>{marketData.metrics.trend}</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>Market cap</span>
                    <strong>{formatCompact(marketData.quote.marketCap)}</strong>
                    <small>P/E {marketData.quote.trailingPE ?? "n/a"}</small>
                  </div>
                </div>
              )}
              {marketData && (
                <div className="source-links">
                  <a href={marketData.links.yahoo} target="_blank" rel="noreferrer">Yahoo Finance</a>
                  <a href={marketData.links.tradingView} target="_blank" rel="noreferrer">TradingView</a>
                </div>
              )}
            </div>

            <div className="form-grid">
              <label>
                Timeframe
                <input value={form.timeframe} onChange={(event) => updateField("timeframe", event.target.value)} />
              </label>
              <label>
                Capital
                <input value={form.capital} onChange={(event) => updateField("capital", event.target.value)} />
              </label>
              <label>
                Risk per trade
                <input value={form.riskPerTrade} onChange={(event) => updateField("riskPerTrade", event.target.value)} />
              </label>
              <label>
                Risk tolerance
                <select value={form.riskTolerance} onChange={(event) => updateField("riskTolerance", event.target.value)}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
              <label>
                Horizon
                <input value={form.timeHorizon} onChange={(event) => updateField("timeHorizon", event.target.value)} />
              </label>
            </div>

            <label>
              Asset list / Investable universe
              <input value={form.assets} onChange={(event) => updateField("assets", event.target.value)} />
            </label>

            <label>
              Strategy rules or main request
              <textarea
                value={form.strategyRules}
                onChange={(event) => updateField("strategyRules", event.target.value)}
                placeholder={activeWorkflow.placeholder}
                rows={6}
              />
            </label>

            <label>
              Historical data, metrics, or market observations
              <textarea
                value={form.historicalData}
                onChange={(event) => updateField("historicalData", event.target.value)}
                placeholder="Paste OHLCV, trade log, equity curve, previous metrics, or technical levels."
                rows={4}
              />
            </label>

            <label>
              Extra notes
              <textarea
                value={form.extraContext}
                onChange={(event) => updateField("extraContext", event.target.value)}
                placeholder="Constraints, broker, fees, excluded instruments, operating preferences."
                rows={3}
              />
            </label>

            <button className="submit-button" disabled={isLoading} type="submit">
              {isLoading ? "Gemini is processing..." : "Generate report with market data + Gemini"}
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
            <p>Enter the stock name, load automatic metrics, and generate a complete report with summary, tables, rules, risks, and an objective score.</p>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
        {result && <MarkdownResult content={result} />}
      </section>
    </main>
  );
}
