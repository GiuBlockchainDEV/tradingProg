import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const workflowCatalog = {
  strategy_generation: {
    title: "Strategy Generation",
    objective: "Generate 3 trading strategies with indicators, operational rules, stop-loss, take-profit, market conditions, and edge rationale.",
  },
  backtesting: {
    title: "Backtesting",
    objective: "Evaluate a strategy on historical data with CAGR, Sharpe ratio, max drawdown, win rate, tables, and a concise summary.",
  },
  risk_reward: {
    title: "Risk-Reward Analysis",
    objective: "Analyze risk per trade, reward-to-risk, drawdown patterns, and improvements to reduce risk or increase returns.",
  },
  market_regime: {
    title: "Market Regime Detection",
    objective: "Identify trend, volatility, volume behavior, the best strategy type, and what to avoid in the current regime.",
  },
  multi_factor: {
    title: "Multi-Factor Strategy",
    objective: "Create a multi-factor strategy using momentum, value, volatility, and trend, including formulas, weights, rebalancing, and an example portfolio.",
  },
  optimization: {
    title: "Strategy Optimization",
    objective: "Optimize a strategy for a higher Sharpe ratio and lower drawdown by improving indicators, timing, and filters.",
  },
  portfolio: {
    title: "Portfolio Construction",
    objective: "Build a diversified portfolio with allocations, expected return, risk, and the rationale for each asset.",
  },
  trade_setup: {
    title: "Trade Setup Generation",
    objective: "Generate 3 high-probability trades with entry, stop-loss, take-profit, risk/reward, and technical/macro reasoning.",
  },
  monte_carlo: {
    title: "Monte Carlo Simulation",
    objective: "Simulate a strategy with probability of loss, return distribution, worst-case scenarios, and robustness/fragility assessment.",
  },
  drawdown: {
    title: "Drawdown Analysis",
    objective: "Analyze max drawdown, average recovery time, drawdown reduction methods, and position sizing improvements.",
  },
  macro_strategy: {
    title: "Macro-Based Strategy",
    objective: "Create a strategy based on interest rates, inflation, and economic growth with factor impact, entry/exit signals, and example trades.",
  },
  alpha_edge: {
    title: "Alpha / Edge Detection",
    objective: "Identify behavioral inefficiencies and market-structure gaps, then propose unique strategies and step-by-step execution.",
  },
} as const;

type AiRequest = {
  workflow?: string;
  market?: string;
  timeframe?: string;
  capital?: string;
  riskPerTrade?: string;
  riskTolerance?: string;
  timeHorizon?: string;
  strategyRules?: string;
  assets?: string;
  historicalData?: string;
  extraContext?: string;
};

function normalize(value: unknown, fallback = "Not specified") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildPrompt(input: AiRequest) {
  const fullSuiteScope = Object.values(workflowCatalog)
    .map((workflow, index) => `${index + 1}. ${workflow.title}: ${workflow.objective}`)
    .join("\n");

  return `You are an institutional-grade equity research system combining quantitative analysis, fundamental analysis, technical/trend analytics, risk management, and macro/geopolitical scenario analysis.
Answer only in English with a professional, objective, practical tone. Do not promise profits and do not present the content as personalized financial advice.

Core operating rules:
- Be evidence-weighted, not persuasive. Prefer a cautious, reality-based conclusion over an optimistic one.
- Use only the data provided in the market-data context unless you clearly label a point as an assumption or general market consideration.
- Do not invent missing financial metrics, macro data, dates, analyst estimates, or news. If unavailable, write "n/a" and explain what data would be needed.
- Treat analyst targets as one input, not truth. Explicitly compare analyst target upside against valuation multiples, growth, balance sheet, trend, drawdown, volatility, and forecast probabilities.
- Reconcile conflicts. If fundamentals are strong but trend is weak, or analyst upside is high but valuation is expensive, say so clearly.
- Keep target probabilities, timeframes, and forecast scenarios conservative. Never phrase them as certainties.
- Do not mention the underlying AI provider or model name in the user-facing report.

You must always run the full 12-module prompt suite below and blend the modules into one coherent, non-repetitive investment report. Do not answer only one module. Do not produce 12 disconnected mini-reports. Integrate the conclusions so strategy, backtest assumptions, risk/reward, market regime, portfolio fit, trade setup, Monte Carlo thinking, drawdown analysis, macro/geopolitical context, and alpha/edge all support a single objective view.

Full suite to cover:
${fullSuiteScope}

User and data context:
- Market/asset: ${normalize(input.market)}
- Operating timeframe: ${normalize(input.timeframe)}
- Capital: ${normalize(input.capital)}
- Risk per trade: ${normalize(input.riskPerTrade)}
- Risk tolerance: ${normalize(input.riskTolerance)}
- Time horizon: ${normalize(input.timeHorizon)}
- Asset list: ${normalize(input.assets)}
- Existing strategy rules: ${normalize(input.strategyRules)}
- Structured market, company, valuation, dividend, target, forecast, and risk data: ${normalize(input.historicalData)}
- Extra notes: ${normalize(input.extraContext)}

Decision weighting framework:
- 20% company fundamentals: profitability, margins, ROE/ROA, growth, cash flow, business profile, sector/industry quality.
- 15% valuation and analyst view: P/E, P/S, P/B, PEG, analyst target range, analyst count, recommendation quality, target-vs-current upside.
- 15% financial health: current ratio, quick ratio, debt/equity, cash flow strength, leverage risk.
- 15% technical/trend analytics: SMA50/SMA200 alignment, RSI, 52-week position, volume/liquidity, support/resistance.
- 15% quantitative risk model: volatility, max drawdown, target probabilities, expected target timeframe, reward/risk, forecast cone and simulated scenario probabilities.
- 10% dividends/shareholder return: yield, annual dividend, historical payment, cadence, payout sustainability, ex/payment dates.
- 10% macro/geopolitical/market regime: sector cyclicality, rates/inflation sensitivity, FX exposure, commodity exposure, regulatory/geopolitical risk, broad equity risk appetite. If live macro data is unavailable, frame this as scenario analysis rather than current-news claims.

Required analytical checks before writing the final recommendation:
1. Data quality check: identify stale, missing, or weak fields.
2. Reality check: compare investment score, research snowflake scores, target probabilities, and forecast scenarios. If they disagree, explain why.
3. Analyst skepticism check: explain whether analyst upside is supported or contradicted by valuation, fundamentals, and trend.
4. Downside-first check: discuss stop-loss, bearish scenario, max drawdown, and what invalidates the thesis before discussing upside.
5. Geopolitical/macro sensitivity check: identify at least 3 external variables that could materially affect the asset/sector.
6. Positioning check: decide whether the asset is buy now, wait for buy zone, watchlist, tactical trade only, trim/sell, or avoid.

Mandatory response format:
1. First line exactly: "Investment Score: X/100".
   - Use the provided objective investment score as the anchor.
   - Adjust only if the full evidence set strongly contradicts it.
   - If adjusted, explain the adjustment in one sentence.
2. Verdict box: one of Buy now / Wait for buy zone / Watchlist / Tactical trade only / Trim or avoid, plus confidence level Low/Medium/High.
3. Executive summary: 6-8 concise bullets, balanced between upside and downside.
4. Evidence-weighted decision table with columns: Area, Data observed, Interpretation, Weight/importance, Impact on score.
5. Buy / Sell / Risk table with: current price, suggested buy zone, preferred buy price, stop-loss, risk %, target 1, target 1 probability, expected target 1 timeframe, target 2, target 2 probability, expected target 2 timeframe, reward/risk, sell/trim zone.
6. Scenario table with Bullish / Normal / Bearish: expected price, scenario probability, what must happen, what would invalidate it.
7. 3-month forecast interpretation: explain base/upper/lower paths from the provided forecast context, including scenario probabilities. State clearly that it is a scenario model, not a prediction guarantee.
8. Fundamentals and valuation: business profile, profitability, growth, valuation multiples, analyst target credibility, analyst upside/downside, key contradiction checks.
9. Financial health: liquidity, debt/leverage, cash flow, balance-sheet risks, and resilience under stress.
10. Dividend profile: average historical payment, annual dividend, yield, cadence, ex-dividend date, payment date, payout sustainability when data is available.
11. Technical and market regime: trend, momentum, RSI, support/resistance, 52-week position, volume/liquidity, and market conditions where the setup works best/worst.
12. Macro and geopolitical sensitivity: rates, inflation, FX, sector cycle, regulation, geopolitical/geographic exposure, and broad market risk appetite. Avoid pretending to know live news unless provided.
13. Quantitative robustness: target probabilities, expected timeframes, drawdown, volatility, Monte Carlo/forecast limitations, and data needed for a proper backtest.
14. Practical action plan: exact action, what to wait for, alerts to set, invalidation triggers, and reassessment checklist.
15. Final disclaimer: educational research only, not financial advice.

Formatting requirements:
- Use Markdown tables for sections 4, 5, and 6.
- Use USD for all monetary values.
- Keep the report concise but complete: prioritize decision-useful data over generic explanation.
- Flag assumptions and stale/missing data instead of filling gaps with speculation.`;
}

export async function POST(request: Request) {
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "AI_API_KEY is not configured. Add it in your environment variables, or copy .env.example to .env.local for local development." },
      { status: 500 },
    );
  }

  let body: AiRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.AI_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash",
    });

    const result = await model.generateContent(buildPrompt(body));
    const text = result.response.text();

    return NextResponse.json({
      workflow: "Full 12-module integrated analysis",
      result: text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error while generating the AI response.";

    return NextResponse.json(
      { error: `The AI engine did not complete the request: ${message}` },
      { status: 502 },
    );
  }
}
