"use client";

import Link from "next/link";
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
  originalCurrency?: string;
  usdFxRate?: number | null;
  usdConversionNote?: string;
  source: string;
  companyProfile: {
    sector: string;
    industry: string;
    businessSummary: string | null;
  };
  fundamentals: {
    sector: string;
    industry: string;
    analystTargetMean: number | null;
    analystTargetLow: number | null;
    analystTargetHigh: number | null;
    analystUpsidePercent: number | null;
    analystOpinions: number | null;
    recommendationKey: string | null;
    currentRatio: number | null;
    quickRatio: number | null;
    debtToEquity: number | null;
    returnOnEquity: number | null;
    profitMargins: number | null;
    revenueGrowth: number | null;
    earningsGrowth: number | null;
    priceToSales: number | null;
    priceToBook: number | null;
    pegRatio: number | null;
    payoutRatio: number | null;
    shortPercentOfFloat: number | null;
  };
  researchScores: {
    overall: number | null;
    value: number | null;
    future: number | null;
    past: number | null;
    health: number | null;
    dividend: number | null;
    analystUpsidePercent: number | null;
    method: string;
    checks: string[];
  };
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
  forecast: {
    horizonSessions: number;
    horizonLabel: string;
    source: string;
    method: string;
    confidenceNote: string;
    baseEnd: number | null;
    upperEnd: number | null;
    lowerEnd: number | null;
    expectedReturnPercent: number | null;
    upperReturnPercent: number | null;
    lowerReturnPercent: number | null;
    scenarioProbabilities: {
      bullish: number | null;
      normal: number | null;
      bearish: number | null;
      method: string;
    };
    points: Array<{
      session: number;
      date: string;
      base: number | null;
      upper: number | null;
      lower: number | null;
    }>;
    scenarioPaths: Array<{
      scenario: string;
      label: string;
      points: Array<{ session: number; date: string; price: number | null }>;
    }>;
    simulatedPaths: Array<{
      label: string;
      points: Array<{ session: number; date: string; price: number | null }>;
    }>;
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

function scoreTone(score: number | null) {
  if (score === null) return "muted";
  if (score >= 70) return "good";
  if (score >= 45) return "mixed";
  return "weak";
}

function formatScore(score: number | null) {
  return score === null ? "n/a" : `${score}/100`;
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

function ResearchSnowflake({ marketData }: { marketData: MarketData }) {
  const axes = [
    { key: "value", label: "Value", score: marketData.researchScores.value },
    { key: "future", label: "Future", score: marketData.researchScores.future },
    { key: "past", label: "Past", score: marketData.researchScores.past },
    { key: "health", label: "Health", score: marketData.researchScores.health },
    { key: "dividend", label: "Dividend", score: marketData.researchScores.dividend },
  ];
  const center = 120;
  const maxRadius = 92;
  const pointFor = (index: number, score: number | null) => {
    const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
    const radius = ((score ?? 0) / 100) * maxRadius;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  };
  const labelFor = (index: number) => {
    const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
    return {
      x: center + Math.cos(angle) * 113,
      y: center + Math.sin(angle) * 113,
    };
  };
  const polygon = axes.map((axis, index) => {
    const point = pointFor(index, axis.score);
    return `${point.x},${point.y}`;
  }).join(" ");

  return (
    <section className="snowflake-section" aria-label="Research snowflake scores">
      <div className="snowflake-card">
        <div className="snowflake-copy">
          <span className="eyebrow">Research snowflake</span>
          <h2>{formatScore(marketData.researchScores.overall)}</h2>
          <p>Overall research score built from valuation, growth, past performance, financial health, and dividend quality.</p>
          {marketData.researchScores.checks.length > 0 && (
            <ul>
              {marketData.researchScores.checks.slice(0, 3).map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          )}
        </div>
        <svg className="snowflake-chart" viewBox="0 0 240 240" role="img" aria-label="Five-axis research score radar">
          {[25, 50, 75, 100].map((ring) => {
            const ringPoints = axes.map((_, index) => {
              const point = pointFor(index, ring);
              return `${point.x},${point.y}`;
            }).join(" ");
            return <polygon key={ring} points={ringPoints} className="snowflake-ring" />;
          })}
          {axes.map((axis, index) => {
            const outer = pointFor(index, 100);
            const label = labelFor(index);
            return (
              <g key={axis.key}>
                <line x1={center} y1={center} x2={outer.x} y2={outer.y} className="snowflake-axis" />
                <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" className="snowflake-label">
                  {axis.label}
                </text>
              </g>
            );
          })}
          <polygon points={polygon} className="snowflake-score" />
        </svg>
      </div>
      <div className="research-score-grid">
        {axes.map((axis) => (
          <article className={`research-score-card ${scoreTone(axis.score)}`} key={axis.key}>
            <span>{axis.label}</span>
            <strong>{formatScore(axis.score)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function FundamentalCards({ marketData }: { marketData: MarketData }) {
  return (
    <section className="fundamental-grid" aria-label="Fundamental research cards">
      <article>
        <span>Fair value / analysts</span>
        <strong>{formatPrice(marketData.fundamentals.analystTargetMean, marketData.currency)}</strong>
        <small>{formatPercent(marketData.fundamentals.analystUpsidePercent)} upside | {marketData.fundamentals.analystOpinions ?? "n/a"} opinions</small>
      </article>
      <article>
        <span>Future growth</span>
        <strong>{formatPercent(marketData.fundamentals.earningsGrowth)}</strong>
        <small>earnings | revenue {formatPercent(marketData.fundamentals.revenueGrowth)}</small>
      </article>
      <article>
        <span>Profitability</span>
        <strong>{formatPercent(marketData.fundamentals.profitMargins)}</strong>
        <small>ROE {formatPercent(marketData.fundamentals.returnOnEquity)}</small>
      </article>
      <article>
        <span>Financial health</span>
        <strong>{marketData.fundamentals.currentRatio ?? "n/a"}</strong>
        <small>current ratio | D/E {marketData.fundamentals.debtToEquity ?? "n/a"}</small>
      </article>
      <article>
        <span>Valuation multiples</span>
        <strong>P/S {marketData.fundamentals.priceToSales ?? "n/a"}</strong>
        <small>P/B {marketData.fundamentals.priceToBook ?? "n/a"} | PEG {marketData.fundamentals.pegRatio ?? "n/a"}</small>
      </article>
      <article>
        <span>Business profile</span>
        <strong>{marketData.companyProfile.sector}</strong>
        <small>{marketData.companyProfile.industry}</small>
      </article>
    </section>
  );
}

function ForecastChart({ marketData }: { marketData: MarketData }) {
  const fallbackScenarioPaths = [
    {
      scenario: "bullish",
      label: "Bullish trend",
      points: marketData.forecast.points.map((point) => ({ session: point.session, date: point.date, price: point.upper })),
    },
    {
      scenario: "normal",
      label: "Normal trend",
      points: marketData.forecast.points.map((point) => ({ session: point.session, date: point.date, price: point.base })),
    },
    {
      scenario: "bearish",
      label: "Bearish trend",
      points: marketData.forecast.points.map((point) => ({ session: point.session, date: point.date, price: point.lower })),
    },
  ];
  const scenarioPaths = marketData.forecast.scenarioPaths.length >= 3 ? marketData.forecast.scenarioPaths : fallbackScenarioPaths;
  const bullishPath = scenarioPaths.find((path) => path.scenario === "bullish") ?? fallbackScenarioPaths[0];
  const normalPath = scenarioPaths.find((path) => path.scenario === "normal") ?? fallbackScenarioPaths[1];
  const bearishPath = scenarioPaths.find((path) => path.scenario === "bearish") ?? fallbackScenarioPaths[2];
  const selectablePoints = normalPath.points.filter(
    (point) => point.session === 0 || point.session === marketData.forecast.horizonSessions || point.session % 7 === 0,
  );
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, selectablePoints.length - 1));
  const selectedPoint = selectablePoints[selectedIndex] ?? selectablePoints.at(-1);

  if (normalPath.points.length < 2) {
    return (
      <section className="forecast-panel" aria-label="3-month forecast chart">
        <div className="forecast-header">
          <div>
            <span className="eyebrow">3-month AI forecast</span>
            <h2>Not enough data for a forecast cone</h2>
          </div>
        </div>
      </section>
    );
  }

  const width = 760;
  const height = 320;
  const paddingLeft = 64;
  const paddingRight = 24;
  const paddingTop = 26;
  const paddingBottom = 42;
  const allScenarioPoints = [bullishPath, normalPath, bearishPath].flatMap((path) => path.points);
  const values = allScenarioPoints.map((point) => Number(point.price)).filter(Number.isFinite);
  const minValue = Math.min(...values) * 0.992;
  const maxValue = Math.max(...values) * 1.008;
  const maxSession = Math.max(...allScenarioPoints.map((point) => point.session));
  const x = (session: number) => paddingLeft + (session / maxSession) * (width - paddingLeft - paddingRight);
  const y = (value: number) => height - paddingBottom - ((value - minValue) / (maxValue - minValue)) * (height - paddingTop - paddingBottom);
  const linePath = (path: typeof bullishPath) => path.points
    .filter((point) => point.price !== null)
    .map((point) => `${x(point.session)},${y(Number(point.price))}`)
    .join(" ");
  const priceAt = (path: typeof bullishPath, session: number) => path.points.find((point) => point.session === session)?.price ?? null;
  const area = `${bullishPath.points.map((point) => `${x(point.session)},${y(Number(point.price))}`).join(" ")} ${[...bearishPath.points]
    .reverse()
    .map((point) => `${x(point.session)},${y(Number(point.price))}`)
    .join(" ")}`;
  const yTicks = Array.from({ length: 5 }, (_, index) => minValue + ((maxValue - minValue) / 4) * index);
  const xTicks = selectablePoints.filter((_, index) => index === 0 || index === selectablePoints.length - 1 || index % 2 === 0);

  return (
    <section className="forecast-panel" aria-label="3-month forecast chart">
      <div className="forecast-header">
        <div>
          <span className="eyebrow">3-month AI forecast</span>
          <h2>Three realistic trend paths</h2>
        </div>
        <div className="forecast-summary">
          <span>Bullish {formatPrice(priceAt(bullishPath, marketData.forecast.horizonSessions), marketData.currency)} | {formatPercent(marketData.forecast.scenarioProbabilities.bullish)}</span>
          <span>Normal {formatPrice(priceAt(normalPath, marketData.forecast.horizonSessions), marketData.currency)} | {formatPercent(marketData.forecast.scenarioProbabilities.normal)}</span>
          <span>Bearish {formatPrice(priceAt(bearishPath, marketData.forecast.horizonSessions), marketData.currency)} | {formatPercent(marketData.forecast.scenarioProbabilities.bearish)}</span>
        </div>
      </div>
      <div className="forecast-layout">
        <div className="forecast-chart-wrap">
          <svg className="forecast-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Three-month realistic scenario paths with axes">
            {yTicks.map((tick) => (
              <g key={tick}>
                <line x1={paddingLeft} x2={width - paddingRight} y1={y(tick)} y2={y(tick)} className="forecast-grid-line" />
                <text x={paddingLeft - 10} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="forecast-axis-label">
                  {formatPrice(tick, marketData.currency)}
                </text>
              </g>
            ))}
            {xTicks.map((point) => (
              <g key={point.session}>
                <line x1={x(point.session)} x2={x(point.session)} y1={paddingTop} y2={height - paddingBottom} className="forecast-grid-line vertical" />
                <text x={x(point.session)} y={height - 15} textAnchor="middle" className="forecast-axis-label">
                  {point.session === 0 ? "Now" : `${point.session}d`}
                </text>
              </g>
            ))}
            <polygon points={area} className="forecast-area" />
            <polyline points={linePath(bullishPath)} className="forecast-line upper" />
            <polyline points={linePath(normalPath)} className="forecast-line base" />
            <polyline points={linePath(bearishPath)} className="forecast-line lower" />
            {selectablePoints.map((point, index) => (
              <g
                className={`forecast-point ${index === selectedIndex ? "selected" : ""}`}
                key={point.session}
                onClick={() => setSelectedIndex(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setSelectedIndex(index);
                  }
                }}
                aria-label={`Select forecast point for ${point.date}`}
              >
                <circle cx={x(point.session)} cy={y(Number(priceAt(bullishPath, point.session)))} r="4" className="forecast-dot upper-dot" />
                <circle cx={x(point.session)} cy={y(Number(priceAt(normalPath, point.session)))} r="5" className="forecast-dot base-dot" />
                <circle cx={x(point.session)} cy={y(Number(priceAt(bearishPath, point.session)))} r="4" className="forecast-dot lower-dot" />
              </g>
            ))}
          </svg>
        </div>
        <div className="scenario-legend" aria-label="Forecast scenario legend">
          <span><i className="legend-dot bullish" /> Bullish scenario <b>{formatPercent(marketData.forecast.scenarioProbabilities.bullish)}</b></span>
          <span><i className="legend-dot normal" /> Normal scenario <b>{formatPercent(marketData.forecast.scenarioProbabilities.normal)}</b></span>
          <span><i className="legend-dot bearish" /> Bearish scenario <b>{formatPercent(marketData.forecast.scenarioProbabilities.bearish)}</b></span>
        </div>
        {selectedPoint && (
          <aside className="forecast-detail-card" aria-label="Selected forecast point details">
            <span>Selected point</span>
            <strong>{selectedPoint.date}</strong>
            <dl>
              <div><dt>Session</dt><dd>{selectedPoint.session}</dd></div>
              <div><dt>Bullish ({formatPercent(marketData.forecast.scenarioProbabilities.bullish)})</dt><dd>{formatPrice(priceAt(bullishPath, selectedPoint.session), marketData.currency)}</dd></div>
              <div><dt>Normal ({formatPercent(marketData.forecast.scenarioProbabilities.normal)})</dt><dd>{formatPrice(priceAt(normalPath, selectedPoint.session), marketData.currency)}</dd></div>
              <div><dt>Bearish ({formatPercent(marketData.forecast.scenarioProbabilities.bearish)})</dt><dd>{formatPrice(priceAt(bearishPath, selectedPoint.session), marketData.currency)}</dd></div>
            </dl>
          </aside>
        )}
      </div>
      <p className="forecast-method"><strong>{marketData.forecast.source}</strong>: {marketData.forecast.confidenceNote} {marketData.forecast.method} The chart shows three realistic day-by-day trend paths selected from historical-return simulations. Percentages estimate how often simulations finish in each scenario zone.</p>
    </section>
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
    setMarketData(null);

    try {
      let enrichedForm = form;
      let dataForPrompt = marketData;

      if (form.market.trim()) {
        const needsFreshData = !marketData || !form.historicalData.includes("Market data automatically retrieved");
        dataForPrompt = needsFreshData ? await fetchMarketData(form.market) : marketData;

        if (dataForPrompt) {
          enrichedForm = mergeMarketDataIntoForm(dataForPrompt, form);
        }
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrichedForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed.");
      }

      if (dataForPrompt) {
        setMarketData(dataForPrompt);
        setForm(enrichedForm);
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
              Equity Research Lab provides automated market research, scoring, and example trade levels for educational purposes only.
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
        <a className="brand-mark" href="#top" aria-label="Equity Research Lab home">
          <span className="brand-orb" />
          <span>Equity Research Lab</span>
        </a>
        <nav className="header-actions" aria-label="Primary navigation">
          <a href="#analysis">Analysis</a>
          <Link href="/">Overview</Link>
          <a href="#report">Report</a>
        </nav>
      </header>

      <section className="analysis-intro" id="top">
        <div>
          <span className="eyebrow">Stock analysis</span>
          <h1>Analyze one stock</h1>
          <p>Search a ticker or company name. The dashboard will generate scores, targets, forecast paths, dividends, and the full report.</p>
        </div>
      </section>

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
                <button className="generate-button" disabled={isLoading} type="submit">
                  {isLoading && <span className="loading-spinner" aria-hidden="true" />}
                  <span>{isLoading ? "Analyzing..." : "Generate report"}</span>
                </button>
              </div>
            </label>
          </form>

          <p className="microcopy">
            No timeframe, capital, risk settings, or manual metrics required. The full research suite runs automatically.
          </p>

          {isLoading && (
            <div className="loading-panel" role="status" aria-live="polite">
              <span className="loading-spinner large" aria-hidden="true" />
              <div>
                <strong>Building your investment report...</strong>
                <p>Fetching market data, simulating forecast paths, and generating the AI analysis.</p>
              </div>
            </div>
          )}

          {error && <div className="error-box compact-error">{error}</div>}
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
            <span>{marketData.originalCurrency && marketData.originalCurrency !== "USD" ? `Converted from ${marketData.originalCurrency}` : "USD values"}</span>
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

      {marketData && <ResearchSnowflake marketData={marketData} />}

      {marketData && <FundamentalCards marketData={marketData} />}

      {marketData && <ForecastChart marketData={marketData} />}

      {result && (
        <section className="output-section" id="report" aria-live="polite">
          <div className="report-header">
            <div>
              <span className="eyebrow">AI output</span>
              <h2>Integrated investment report</h2>
            </div>
            <span className="status-pill">Not financial advice</span>
          </div>

          <MarkdownResult content={result} />
        </section>
      )}
    </main>
  );}
