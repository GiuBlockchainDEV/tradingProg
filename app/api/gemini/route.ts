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

type GeminiRequest = {
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

function buildPrompt(input: GeminiRequest) {
  const fullSuiteScope = Object.values(workflowCatalog)
    .map((workflow, index) => `${index + 1}. ${workflow.title}: ${workflow.objective}`)
    .join("\n");

  return `You are a senior quantitative research assistant for trading, portfolio management, and investment decision support.
Answer only in English with a professional, practical tone. Do not promise profits and do not present the content as personalized financial advice. If real or historical data is missing, state the assumptions clearly and explain how to validate them.

You must always run the full 12-module prompt suite below and blend the modules into one coherent, non-repetitive investment report. Do not answer only one module. Do not produce 12 disconnected mini-reports. Integrate the conclusions so strategy, backtest assumptions, risk/reward, market regime, portfolio fit, trade setup, Monte Carlo thinking, drawdown analysis, macro context, and alpha/edge all support a single objective view.

Full suite to cover:
${fullSuiteScope}

User context:
- Market/asset: ${normalize(input.market)}
- Operating timeframe: ${normalize(input.timeframe)}
- Capital: ${normalize(input.capital)}
- Risk per trade: ${normalize(input.riskPerTrade)}
- Risk tolerance: ${normalize(input.riskTolerance)}
- Time horizon: ${normalize(input.timeHorizon)}
- Asset list: ${normalize(input.assets)}
- Existing strategy rules: ${normalize(input.strategyRules)}
- Historical data or market observations provided: ${normalize(input.historicalData)}
- Extra notes: ${normalize(input.extraContext)}

Mandatory response format:
1. Objective Investment Score: provide a single score from 0 to 100 in the first line, formatted exactly as "Investment Score: X/100". Make the score data-driven: trend, risk, volatility, drawdown, valuation, momentum, liquidity, macro context, portfolio fit, and quality of evidence must influence it. If the automatic market-data context already contains an investment score, use it as the anchor and adjust only if the broader 12-module analysis justifies it.
2. One integrated executive summary in 5-8 bullet points.
3. Unified decision table with: score drivers, trend/regime, risk/reward, valuation, drawdown risk, macro sensitivity, trade quality, portfolio role, and confidence level.
4. Mandatory Buy / Sell / Risk table: include suggested buy zone, preferred buy price, stop-loss, risk percentage from buy to stop, current-price downside to stop, target 1, target 2, sell/trim zone, upside percentages, reward/risk, and the objective probability of reaching Target 1 and Target 2. Keep probabilities conservative and explicitly avoid optimistic language. If the current price is not attractive, explicitly say to wait for the buy zone instead of buying immediately.
5. Blended strategy plan: entry logic, exit logic, stop/risk rules, position sizing, and invalidation conditions.
6. Backtest and robustness view: CAGR/Sharpe assumptions, max drawdown, win-rate expectations, Monte Carlo risks, and what data is still needed.
7. Risk-reduction and return-improvement ideas: include concrete improvements without increasing risk where possible.
8. Portfolio fit: whether this asset should be a core holding, satellite position, tactical trade, watchlist-only candidate, or avoid.
9. Market conditions that help or break the thesis.
10. Final action framework: bullish case, base case, bearish case, and what to monitor next.
11. Short disclaimer: educational research only, not financial advice.

Use clean Markdown with tables where useful. Keep numbers, formulas, and thresholds explicit when reasonable, but flag assumptions and stale or missing data.`;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured. Add it in your environment variables, or copy .env.example to .env.local for local development." },
      { status: 500 },
    );
  }

  let body: GeminiRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    });

    const result = await model.generateContent(buildPrompt(body));
    const text = result.response.text();

    return NextResponse.json({
      workflow: "Full 12-module integrated analysis",
      result: text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error while generating the Gemini response.";

    return NextResponse.json(
      { error: `Gemini did not complete the request: ${message}` },
      { status: 502 },
    );
  }
}
