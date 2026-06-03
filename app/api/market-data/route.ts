import YahooFinance from "yahoo-finance2";
import { NextResponse } from "next/server";

const yahooFinance = new YahooFinance();

type MarketDataRequest = {
  query?: string;
};

type PricePoint = {
  date: Date;
  close?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
};

type DividendEvent = {
  amount?: number | null;
  date: Date;
};

const PREFERRED_TYPES = new Set(["EQUITY", "ETF", "MUTUALFUND", "INDEX"]);

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  }

  return null;
}

function dividendFrequencyLabel(paymentsPerYear: number | null) {
  if (paymentsPerYear === null || paymentsPerYear <= 0) {
    return "No regular dividend history detected in Yahoo Finance chart events";
  }

  if (paymentsPerYear >= 10) return "Monthly based on historical dividend events";
  if (paymentsPerYear >= 3) return "Quarterly based on historical dividend events";
  if (paymentsPerYear >= 1.5) return "Semiannual based on historical dividend events";
  return "Annual based on historical dividend events";
}

function buildDividendProfile(dividends: DividendEvent[], quote: Record<string, unknown>) {
  const sortedDividends = dividends
    .filter((event) => typeof event.amount === "number" && event.amount > 0 && event.date instanceof Date)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const amounts = sortedDividends.map((event) => Number(event.amount));
  const averagePayment = mean(amounts);
  const lastDividend = sortedDividends.at(-1);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const trailingTwelveMonthAmount = sortedDividends
    .filter((event) => event.date >= oneYearAgo)
    .reduce((total, event) => total + Number(event.amount), 0);
  const firstDividend = sortedDividends[0];
  const lastDividendForFrequency = sortedDividends.at(-1);
  const historyYears = firstDividend && lastDividendForFrequency
    ? Math.max(1, (lastDividendForFrequency.date.getTime() - firstDividend.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const paymentsPerYear = historyYears === null ? null : sortedDividends.length / historyYears;
  const forwardAnnualDividend = numeric(quote.dividendRate);
  const trailingAnnualDividend = numeric(quote.trailingAnnualDividendRate) ?? (trailingTwelveMonthAmount > 0 ? trailingTwelveMonthAmount : null);

  return {
    dividendYield: round(dividendPercent(quote.dividendYield), 2),
    dividendRate: round(forwardAnnualDividend, 4),
    trailingAnnualDividendRate: round(trailingAnnualDividend, 4),
    trailingAnnualDividendYield: round(dividendPercent(quote.trailingAnnualDividendYield), 2),
    averageDividendPayment: round(averagePayment, 4),
    lastDividendAmount: round(typeof lastDividend?.amount === "number" ? lastDividend.amount : null, 4),
    lastDividendDate: lastDividend ? dateValue(lastDividend.date) : null,
    dividendPaymentsPerYear: round(paymentsPerYear, 2),
    dividendFrequency: dividendFrequencyLabel(paymentsPerYear),
    exDividendDate: dateValue(quote.exDividendDate),
    dividendDate: dateValue(quote.dividendDate),
    dividendHistoryCount: sortedDividends.length,
  };
}

function dividendPercent(value: unknown) {
  const dividend = numeric(value);
  return dividend;
}

function round(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percent(value: number | null | undefined, digits = 2) {
  const rounded = round(value, digits);
  return rounded === null ? "n/a" : `${rounded}%`;
}

function money(value: number | null | undefined, currency?: string) {
  const rounded = round(value, 2);
  if (rounded === null) {
    return "n/a";
  }

  return `${currency ? `${currency} ` : ""}${rounded.toLocaleString("en-US")}`;
}

function compactNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function mean(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  const avg = mean(values);
  if (avg === null || values.length < 2) {
    return null;
  }

  const variance = values.reduce((total, value) => total + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function movingAverage(values: number[], window: number) {
  if (values.length < window) {
    return null;
  }

  return mean(values.slice(-window));
}

function maxDrawdown(closes: number[]) {
  if (closes.length < 2) {
    return null;
  }

  let peak = closes[0];
  let worst = 0;

  for (const close of closes) {
    peak = Math.max(peak, close);
    const drawdown = peak > 0 ? (close / peak - 1) * 100 : 0;
    worst = Math.min(worst, drawdown);
  }

  return worst;
}

function rsi(closes: number[], window = 14) {
  if (closes.length <= window) {
    return null;
  }

  const slice = closes.slice(-(window + 1));
  const changes = slice.slice(1).map((close, index) => close - slice[index]);
  const gains = changes.map((change) => Math.max(change, 0));
  const losses = changes.map((change) => Math.abs(Math.min(change, 0)));
  const avgGain = mean(gains);
  const avgLoss = mean(losses);

  if (avgGain === null || avgLoss === null) {
    return null;
  }

  if (avgLoss === 0) {
    return 100;
  }

  const relativeStrength = avgGain / avgLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function averageTrueRange(points: PricePoint[], window = 14) {
  if (points.length <= window) {
    return null;
  }

  const trueRanges = points.slice(1).map((point, index) => {
    const previousClose = points[index].close;
    if (
      typeof point.high !== "number" ||
      typeof point.low !== "number" ||
      typeof previousClose !== "number"
    ) {
      return null;
    }

    return Math.max(
      point.high - point.low,
      Math.abs(point.high - previousClose),
      Math.abs(point.low - previousClose),
    );
  }).filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (trueRanges.length < window) {
    return null;
  }

  return mean(trueRanges.slice(-window));
}

function calculateTradeLevels(args: {
  lastClose: number | null;
  sma50: number | null;
  atr14: number | null;
  recentSupport: number | null;
  recentResistance: number | null;
}) {
  if (args.lastClose === null || args.lastClose <= 0) {
    return {
      buyZoneLow: null,
      buyZoneHigh: null,
      preferredBuy: null,
      stopLoss: null,
      riskPercent: null,
      currentPriceRiskPercent: null,
      target1: null,
      target2: null,
      target1Probability: null,
      target2Probability: null,
      targetProbabilityHorizon: null,
      targetProbabilitySampleSize: null,
      targetProbabilityMethod: "Insufficient price data for objective probability estimate",
      sellZoneLow: null,
      sellZoneHigh: null,
      upsideToTarget1Percent: null,
      upsideToTarget2Percent: null,
      rewardRiskTarget1: null,
      rewardRiskTarget2: null,
      atr14: null,
      support20: null,
      resistance20: null,
      method: "Insufficient price data for objective levels",
    };
  }

  const lastClose = args.lastClose;
  const atr = args.atr14 ?? lastClose * 0.03;
  const support = args.recentSupport ?? Math.max(0, lastClose - 2 * atr);
  const resistance = args.recentResistance ?? lastClose + 2 * atr;
  const trendAnchor = args.sma50 ?? lastClose;
  const rawBuyLow = Math.max(0.01, Math.min(support + 0.25 * atr, trendAnchor - 0.5 * atr, lastClose - 1.5 * atr));
  const rawBuyHigh = Math.max(rawBuyLow, Math.min(lastClose, trendAnchor + 0.5 * atr));
  const preferredBuy = (rawBuyLow + rawBuyHigh) / 2;
  const stopLoss = Math.max(0.01, Math.min(support - 0.75 * atr, rawBuyLow - atr));
  const riskPerShare = Math.max(0.01, preferredBuy - stopLoss);
  const target1 = Math.max(resistance, preferredBuy + 2 * riskPerShare);
  const target2 = Math.max(target1 + atr, preferredBuy + 3 * riskPerShare);
  const sellZoneLow = target1;
  const sellZoneHigh = target2;
  const riskPercent = (riskPerShare / preferredBuy) * 100;
  const currentPriceRiskPercent = ((lastClose - stopLoss) / lastClose) * 100;

  return {
    buyZoneLow: round(rawBuyLow, 2),
    buyZoneHigh: round(rawBuyHigh, 2),
    preferredBuy: round(preferredBuy, 2),
    stopLoss: round(stopLoss, 2),
    riskPercent: round(riskPercent, 2),
    currentPriceRiskPercent: round(currentPriceRiskPercent, 2),
    target1: round(target1, 2),
    target2: round(target2, 2),
    sellZoneLow: round(sellZoneLow, 2),
    sellZoneHigh: round(sellZoneHigh, 2),
    upsideToTarget1Percent: round(((target1 / preferredBuy) - 1) * 100, 2),
    upsideToTarget2Percent: round(((target2 / preferredBuy) - 1) * 100, 2),
    rewardRiskTarget1: round((target1 - preferredBuy) / riskPerShare, 2),
    rewardRiskTarget2: round((target2 - preferredBuy) / riskPerShare, 2),
    atr14: round(args.atr14, 2),
    support20: round(args.recentSupport, 2),
    resistance20: round(args.recentResistance, 2),
    method: "ATR- and support/resistance-based educational levels; verify with live chart before execution",
  };
}

function estimateTargetProbability(args: {
  points: PricePoint[];
  targetReturnPercent: number | null;
  riskPercent: number | null;
  horizonSessions: number;
}) {
  if (
    args.targetReturnPercent === null ||
    args.riskPercent === null ||
    args.targetReturnPercent <= 0 ||
    args.riskPercent <= 0 ||
    args.points.length <= args.horizonSessions + 30
  ) {
    return {
      probability: null,
      sampleSize: 0,
      method: "Insufficient historical sample for objective target probability",
    };
  }

  let successes = 0;
  let observations = 0;
  const maxStart = args.points.length - args.horizonSessions - 1;

  for (let index = 0; index <= maxStart; index += 1) {
    const entry = args.points[index].close;
    if (typeof entry !== "number" || entry <= 0) {
      continue;
    }

    const targetPrice = entry * (1 + args.targetReturnPercent / 100);
    const stopPrice = entry * (1 - args.riskPercent / 100);
    observations += 1;

    for (let forward = index + 1; forward <= index + args.horizonSessions; forward += 1) {
      const high = args.points[forward].high ?? args.points[forward].close;
      const low = args.points[forward].low ?? args.points[forward].close;

      // Conservative ordering: if stop and target happen in the same session, count the stop first.
      if (typeof low === "number" && low <= stopPrice) {
        break;
      }

      if (typeof high === "number" && high >= targetPrice) {
        successes += 1;
        break;
      }
    }
  }

  if (observations === 0) {
    return {
      probability: null,
      sampleSize: 0,
      method: "Insufficient historical sample for objective target probability",
    };
  }

  // Haircut the empirical hit rate to avoid optimistic target probabilities.
  const conservativeProbability = (successes / observations) * 100 * 0.9;

  return {
    probability: round(conservativeProbability, 2),
    sampleSize: observations,
    method: "Conservative empirical hit rate: historical target-before-stop frequency with same-day stop priority and 10% haircut",
  };
}

function annualizedReturn(closes: number[], firstDate?: Date, lastDate?: Date) {
  if (closes.length < 2 || !firstDate || !lastDate) {
    return null;
  }

  const years = (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years <= 0) {
    return null;
  }

  return ((closes[closes.length - 1] / closes[0]) ** (1 / years) - 1) * 100;
}

function trendLabel(lastClose: number | null, sma50: number | null, sma200: number | null) {
  if (lastClose === null || sma50 === null || sma200 === null) {
    return "Insufficient data";
  }

  if (lastClose > sma50 && sma50 > sma200) {
    return "Bullish: price above SMA50 and SMA200";
  }

  if (lastClose < sma50 && sma50 < sma200) {
    return "Bearish: price below SMA50 and SMA200";
  }

  return "Sideways/mixed: trend signals are not aligned";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function scoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Constructive";
  if (score >= 50) return "Neutral";
  if (score >= 35) return "Weak";
  return "High risk";
}

function calculateInvestmentScore(args: {
  lastClose: number | null;
  sma50: number | null;
  sma200: number | null;
  oneYearReturn: number | null;
  annualizedReturn: number | null;
  annualizedVolatility: number | null;
  maxDrawdown: number | null;
  rsi14: number | null;
  distanceFrom52WeekHigh: number | null;
  averageVolume30: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
}) {
  let score = 50;
  const drivers: string[] = [];

  if (args.lastClose !== null && args.sma50 !== null && args.sma200 !== null) {
    if (args.lastClose > args.sma50 && args.sma50 > args.sma200) {
      score += 15;
      drivers.push("positive trend alignment");
    } else if (args.lastClose < args.sma50 && args.sma50 < args.sma200) {
      score -= 18;
      drivers.push("negative trend alignment");
    } else {
      score -= 3;
      drivers.push("mixed trend alignment");
    }
  } else {
    score -= 4;
    drivers.push("limited trend data");
  }

  const returnSignal = args.oneYearReturn ?? args.annualizedReturn;
  if (returnSignal !== null) {
    if (returnSignal > 25) score += 10;
    else if (returnSignal > 10) score += 7;
    else if (returnSignal > 0) score += 3;
    else if (returnSignal > -10) score -= 6;
    else score -= 12;
    drivers.push(`return signal ${round(returnSignal, 1)}%`);
  }

  if (args.annualizedVolatility !== null) {
    if (args.annualizedVolatility < 20) score += 8;
    else if (args.annualizedVolatility < 35) score += 2;
    else if (args.annualizedVolatility < 55) score -= 8;
    else score -= 15;
    drivers.push(`annualized volatility ${round(args.annualizedVolatility, 1)}%`);
  }

  if (args.maxDrawdown !== null) {
    if (args.maxDrawdown > -20) score += 8;
    else if (args.maxDrawdown > -35) score += 1;
    else if (args.maxDrawdown > -55) score -= 8;
    else score -= 14;
    drivers.push(`max drawdown ${round(args.maxDrawdown, 1)}%`);
  }

  if (args.rsi14 !== null) {
    if (args.rsi14 >= 45 && args.rsi14 <= 65) score += 6;
    else if ((args.rsi14 >= 35 && args.rsi14 < 45) || (args.rsi14 > 65 && args.rsi14 <= 75)) score += 1;
    else score -= 6;
    drivers.push(`RSI 14 ${round(args.rsi14, 1)}`);
  }

  const pe = args.forwardPE ?? args.trailingPE;
  if (pe !== null) {
    if (pe > 0 && pe < 18) score += 7;
    else if (pe < 30) score += 2;
    else if (pe < 50) score -= 5;
    else score -= 10;
    drivers.push(`valuation P/E ${round(pe, 1)}`);
  }

  if (args.distanceFrom52WeekHigh !== null) {
    if (args.distanceFrom52WeekHigh > -10) score += 4;
    else if (args.distanceFrom52WeekHigh < -35) score -= 7;
    drivers.push(`distance from 52-week high ${round(args.distanceFrom52WeekHigh, 1)}%`);
  }

  if (args.averageVolume30 !== null) {
    if (args.averageVolume30 > 1_000_000) score += 3;
    else if (args.averageVolume30 < 100_000) score -= 5;
    drivers.push("liquidity check included");
  }

  const finalScore = Math.round(clamp(score));
  return {
    score: finalScore,
    label: scoreLabel(finalScore),
    drivers,
  };
}

function buildPromptContext(args: {
  displayName: string;
  symbol: string;
  exchange?: string;
  currency?: string;
  quoteType?: string;
  quote: Record<string, unknown>;
  metrics: Record<string, number | null | string>;
  tradeLevels: Record<string, number | null | string>;
  links: { yahoo: string; tradingView: string };
}) {
  const { displayName, symbol, exchange, currency, quoteType, quote, metrics, tradeLevels, links } = args;

  return `Market data automatically retrieved from Yahoo Finance for ${displayName} (${symbol}).
Numerical source: Yahoo Finance quote and 5Y daily chart. Verification links: Yahoo ${links.yahoo}; TradingView ${links.tradingView}.
Timestamp: ${new Date().toISOString()}

Identification:
- Name: ${displayName}
- Symbol: ${symbol}
- Exchange: ${exchange || "n/a"}
- Type: ${quoteType || "n/a"}
- Currency: ${currency || "n/a"}

Objective investment score:
- Score: ${metrics.investmentScore}/100
- Label: ${metrics.investmentScoreLabel}
- Main drivers: ${metrics.investmentScoreDrivers || "n/a"}

Objective buy/sell/risk levels:
- Suggested buy zone: ${money(tradeLevels.buyZoneLow as number | null, currency)} - ${money(tradeLevels.buyZoneHigh as number | null, currency)}
- Preferred buy price: ${money(tradeLevels.preferredBuy as number | null, currency)}
- Stop-loss: ${money(tradeLevels.stopLoss as number | null, currency)}
- Risk from preferred buy to stop: ${percent(tradeLevels.riskPercent as number | null)}
- Current-price downside to stop: ${percent(tradeLevels.currentPriceRiskPercent as number | null)}
- Target 1 / first sell zone: ${money(tradeLevels.target1 as number | null, currency)} (${percent(tradeLevels.upsideToTarget1Percent as number | null)} upside; R/R ${round(tradeLevels.rewardRiskTarget1 as number | null, 2) ?? "n/a"})
- Target 1 probability: ${percent(tradeLevels.target1Probability as number | null)} over ~63 trading sessions
- Target 2 / extended sell zone: ${money(tradeLevels.target2 as number | null, currency)} (${percent(tradeLevels.upsideToTarget2Percent as number | null)} upside; R/R ${round(tradeLevels.rewardRiskTarget2 as number | null, 2) ?? "n/a"})
- Target 2 probability: ${percent(tradeLevels.target2Probability as number | null)} over ~126 trading sessions
- Probability method: ${tradeLevels.targetProbabilityMethod}
- Method: ${tradeLevels.method}

Price and performance:
- Current price: ${money(numeric(quote.regularMarketPrice), currency)}
- Daily change: ${percent(numeric(quote.regularMarketChangePercent))}
- 1Y return: ${percent(metrics.oneYearReturn as number | null)}
- 5Y/available-history CAGR: ${percent(metrics.annualizedReturn as number | null)}
- Distance from 52-week high: ${percent(metrics.distanceFrom52WeekHigh as number | null)}

Calculated technical metrics:
- SMA 50: ${money(metrics.sma50 as number | null, currency)}
- SMA 200: ${money(metrics.sma200 as number | null, currency)}
- RSI 14: ${round(metrics.rsi14 as number | null, 1) ?? "n/a"}
- Annualized volatility: ${percent(metrics.annualizedVolatility as number | null)}
- Max drawdown over available history: ${percent(metrics.maxDrawdown as number | null)}
- 30-session average volume: ${compactNumber(metrics.averageVolume30 as number | null)}
- Trend regime: ${metrics.trend}

Key fundamentals:
- Market cap: ${compactNumber(numeric(quote.marketCap))}
- Trailing P/E: ${round(numeric(quote.trailingPE), 2) ?? "n/a"}
- Forward P/E: ${round(numeric(quote.forwardPE), 2) ?? "n/a"}
- Trailing EPS: ${round(numeric(quote.epsTrailingTwelveMonths), 2) ?? "n/a"}
- Dividend yield: ${percent(numeric(quote.dividendYield))}
- Forward annual dividend: ${money(numeric(quote.dividendRate), currency)}
- Trailing annual dividend: ${money(numeric(quote.trailingAnnualDividendRate), currency)}
- Average dividend per historical payment: ${money(numeric(quote.averageDividendPayment), currency)}
- Last dividend paid: ${money(numeric(quote.lastDividendAmount), currency)} on ${quote.lastDividendDate ?? "n/a"}
- Dividend cadence: ${quote.dividendFrequency ?? "n/a"}
- Ex-dividend date: ${quote.exDividendDate ?? "n/a"}
- Payment date: ${quote.dividendDate ?? "n/a"}
- Dividend history events used: ${quote.dividendHistoryCount ?? "n/a"}
- Beta: ${round(numeric(quote.beta), 2) ?? "n/a"}

Instructions: use these data points as the base for the report, do not invent missing metrics, keep the investment score and buy/sell/risk levels visible, and recommend verification on TradingView/Yahoo before execution.`;}

async function getMarketData(query: string) {
  const search = await yahooFinance.search(query, { quotesCount: 8, newsCount: 0 }) as unknown as { quotes?: Array<Record<string, string>> };
  const quotes = search.quotes ?? [];
  const match = quotes.find((quote) => PREFERRED_TYPES.has(String(quote.quoteType))) ?? quotes[0];

  if (!match?.symbol) {
    throw new Error(`No symbol found for "${query}".`);
  }

  const symbol = match.symbol;
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 5);

  const [quoteResult, chartResult] = await Promise.all([
    yahooFinance.quote(symbol),
    yahooFinance.chart(symbol, { period1, period2: new Date(), interval: "1d", events: "div" }),
  ]);

  const quote = quoteResult as unknown as Record<string, unknown>;
  const chart = chartResult as unknown as { quotes?: PricePoint[]; events?: { dividends?: DividendEvent[] } };

  const pricePoints: PricePoint[] = (chart.quotes ?? [])
    .filter((point) => typeof point.close === "number")
    .map((point) => ({
      date: new Date(point.date),
      close: point.close,
      high: point.high,
      low: point.low,
      volume: point.volume,
    }));

  const dividendEvents = chart.events?.dividends ?? [];
  const dividendProfile = buildDividendProfile(dividendEvents, quote);
  const closes = pricePoints.map((point) => Number(point.close)).filter(Number.isFinite);
  const returns = closes.slice(1).map((close, index) => close / closes[index] - 1).filter(Number.isFinite);
  const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;
  const sma50 = movingAverage(closes, 50);
  const sma200 = movingAverage(closes, 200);
  const annualizedVolatility = standardDeviation(returns) === null ? null : Number(standardDeviation(returns)) * Math.sqrt(252) * 100;
  const last252 = pricePoints.slice(-252);
  const closes252 = last252.map((point) => Number(point.close)).filter(Number.isFinite);
  const oneYearReturn = closes252.length > 1 ? (closes252[closes252.length - 1] / closes252[0] - 1) * 100 : null;
  const high52Week = closes252.length > 0 ? Math.max(...closes252) : null;
  const low52Week = closes252.length > 0 ? Math.min(...closes252) : null;
  const averageVolume30 = mean(pricePoints.slice(-30).map((point) => Number(point.volume)).filter(Number.isFinite));
  const atr14 = averageTrueRange(pricePoints, 14);
  const recent20 = pricePoints.slice(-20);
  const recentSupport = recent20.length > 0 ? Math.min(...recent20.map((point) => Number(point.low ?? point.close)).filter(Number.isFinite)) : null;
  const recentResistance = recent20.length > 0 ? Math.max(...recent20.map((point) => Number(point.high ?? point.close)).filter(Number.isFinite)) : null;
  const tradeLevelsBase = calculateTradeLevels({
    lastClose,
    sma50,
    atr14,
    recentSupport,
    recentResistance,
  });
  const target1Probability = estimateTargetProbability({
    points: pricePoints,
    targetReturnPercent: tradeLevelsBase.upsideToTarget1Percent,
    riskPercent: tradeLevelsBase.riskPercent,
    horizonSessions: 63,
  });
  const target2Probability = estimateTargetProbability({
    points: pricePoints,
    targetReturnPercent: tradeLevelsBase.upsideToTarget2Percent,
    riskPercent: tradeLevelsBase.riskPercent,
    horizonSessions: 126,
  });
  const tradeLevels = {
    ...tradeLevelsBase,
    target1Probability: target1Probability.probability,
    target2Probability: target2Probability.probability,
    targetProbabilityHorizon: "Target 1: 63 trading sessions; Target 2: 126 trading sessions",
    targetProbabilitySampleSize: Math.min(target1Probability.sampleSize, target2Probability.sampleSize),
    targetProbabilityMethod: `${target1Probability.method}; ${target2Probability.method}`,
  };
  const baseMetrics = {
    lastClose: round(lastClose, 2),
    oneYearReturn: round(oneYearReturn, 2),
    annualizedReturn: round(annualizedReturn(closes, pricePoints[0]?.date, pricePoints[pricePoints.length - 1]?.date), 2),
    annualizedVolatility: round(annualizedVolatility, 2),
    maxDrawdown: round(maxDrawdown(closes), 2),
    sma50: round(sma50, 2),
    sma200: round(sma200, 2),
    rsi14: round(rsi(closes), 2),
    high52Week: round(high52Week, 2),
    low52Week: round(low52Week, 2),
    distanceFrom52WeekHigh: high52Week && lastClose ? round((lastClose / high52Week - 1) * 100, 2) : null,
    averageVolume30: round(averageVolume30, 0),
    atr14: round(atr14, 2),
    support20: round(recentSupport, 2),
    resistance20: round(recentResistance, 2),
    trend: trendLabel(lastClose, sma50, sma200),
  };
  const investmentScore = calculateInvestmentScore({
    lastClose,
    sma50,
    sma200,
    oneYearReturn,
    annualizedReturn: baseMetrics.annualizedReturn,
    annualizedVolatility,
    maxDrawdown: maxDrawdown(closes),
    rsi14: baseMetrics.rsi14,
    distanceFrom52WeekHigh: baseMetrics.distanceFrom52WeekHigh,
    averageVolume30,
    trailingPE: numeric(quote.trailingPE),
    forwardPE: numeric(quote.forwardPE),
  });
  const metrics = {
    ...baseMetrics,
    investmentScore: investmentScore.score,
    investmentScoreLabel: investmentScore.label,
    investmentScoreDrivers: investmentScore.drivers.join(", "),
  };

  const displayName = textValue(quote.longName) || textValue(quote.shortName) || textValue(match.longname) || textValue(match.shortname) || symbol;
  const exchange = textValue(quote.fullExchangeName) || textValue(quote.exchange) || textValue(match.exchDisp);
  const currency = textValue(quote.currency);
  const links = {
    yahoo: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    tradingView: `https://www.tradingview.com/symbols/${encodeURIComponent(symbol.replace(".", "-"))}/`,
  };

  return {
    symbol,
    displayName,
    exchange,
    currency,
    quoteType: textValue(quote.quoteType) || textValue(match.quoteType),
    source: "Yahoo Finance",
    links,
    quote: {
      regularMarketPrice: round(numeric(quote.regularMarketPrice), 2),
      regularMarketChangePercent: round(numeric(quote.regularMarketChangePercent), 2),
      marketCap: numeric(quote.marketCap),
      trailingPE: round(numeric(quote.trailingPE), 2),
      forwardPE: round(numeric(quote.forwardPE), 2),
      epsTrailingTwelveMonths: round(numeric(quote.epsTrailingTwelveMonths), 2),
      ...dividendProfile,
      beta: round(numeric(quote.beta), 2),
      fiftyTwoWeekHigh: round(numeric(quote.fiftyTwoWeekHigh), 2),
      fiftyTwoWeekLow: round(numeric(quote.fiftyTwoWeekLow), 2),
      averageDailyVolume3Month: numeric(quote.averageDailyVolume3Month),
    },
    metrics,
    tradeLevels,
    history: pricePoints.slice(-260).map((point) => ({
      date: point.date.toISOString().slice(0, 10),
      close: round(point.close, 2),
      volume: point.volume ?? null,
    })),
    promptContext: buildPromptContext({
      displayName,
      symbol,
      exchange,
      currency,
      quoteType: textValue(quote.quoteType) || textValue(match.quoteType),
      quote: { ...quote, ...dividendProfile } as Record<string, unknown>,
      metrics,
      tradeLevels: tradeLevels as unknown as Record<string, number | null | string>,
      links,
    }),
  };
}

export async function POST(request: Request) {
  let body: MarketDataRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "Enter a stock name or ticker." }, { status: 400 });
  }

  try {
    const data = await getMarketData(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error while retrieving market data.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Query parameter q is required." }, { status: 400 });
  }

  try {
    const data = await getMarketData(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error while retrieving market data.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
