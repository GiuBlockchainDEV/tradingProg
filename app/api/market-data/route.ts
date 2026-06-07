import { GoogleGenerativeAI } from "@google/generative-ai";
import YahooFinance from "yahoo-finance2";
import { NextResponse } from "next/server";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });


type AiProvider = "google" | "deepseek";

type AiSelection = {
  aiProvider?: string;
  aiModel?: string;
};

function normalizeProvider(selection: AiSelection): AiProvider {
  if (selection.aiProvider === "deepseek" || selection.aiModel?.startsWith("deepseek:")) {
    return "deepseek";
  }

  return "google";
}

function normalizeModel(selection: AiSelection, provider: AiProvider) {
  const rawModel = selection.aiModel?.includes(":") ? selection.aiModel.split(":").at(-1) : selection.aiModel;
  if (rawModel && rawModel.trim().length > 0) {
    return rawModel.trim();
  }

  return provider === "deepseek"
    ? process.env.DEEPSEEK_MODEL || "deepseek-v4"
    : process.env.AI_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function googleModelCandidates(selectedModel: string) {
  const fallback = (process.env.AI_FALLBACK_MODELS || "gemini-3.5-flash")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([selectedModel, "gemini-2.5-flash", ...fallback]));
}

function deepSeekModelCandidates(selectedModel: string) {
  const fallback = (process.env.DEEPSEEK_FALLBACK_MODELS || "deepseek-chat,deepseek-reasoner")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([selectedModel, ...fallback]));
}

function isRetriableAiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /503|Service Unavailable|high demand|429|RESOURCE_EXHAUSTED|quota|rate|timeout|fetch failed/i.test(message);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateGoogleText(apiKey: string, modelName: string, prompt: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateDeepSeekText(apiKey: string, modelName: string, prompt: string) {
  const response = await fetch(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: "Return strict JSON only. No markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.15,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with ${response.status}: ${await response.text()}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("DeepSeek response did not include content.");
  }

  return text;
}

async function generateTextWithFallback(selection: AiSelection, prompt: string) {
  const provider = normalizeProvider(selection);
  const selectedModel = normalizeModel(selection, provider);
  const apiKey = provider === "deepseek"
    ? process.env.DEEPSEEK_API_KEY
    : process.env.AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(provider === "deepseek" ? "DEEPSEEK_API_KEY is not configured." : "AI_API_KEY is not configured.");
  }

  const candidates = provider === "deepseek" ? deepSeekModelCandidates(selectedModel) : googleModelCandidates(selectedModel);
  let lastError: unknown;

  for (const modelName of candidates) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = provider === "deepseek"
          ? await generateDeepSeekText(apiKey, modelName, prompt)
          : await generateGoogleText(apiKey, modelName, prompt);
        return { text, modelName, provider };
      } catch (error) {
        lastError = error;
        if (!isRetriableAiError(error)) {
          throw error;
        }
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

type MarketDataRequest = AiSelection & {
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

async function getUsdConversionRate(currency: string | undefined) {
  const rawCurrency = currency?.trim();
  const normalized = rawCurrency?.toUpperCase();
  const isPenceQuote = rawCurrency === "GBp" || normalized === "GBX";

  if (!normalized || normalized === "USD") {
    return { rate: 1, originalCurrency: normalized || "USD", note: "Already quoted in USD" };
  }

  const yahooCurrency = isPenceQuote || normalized === "GBP" ? "GBP" : normalized;
  const penceMultiplier = isPenceQuote ? 0.01 : 1;
  const directSymbol = `${yahooCurrency}USD=X`;
  const inverseSymbol = `USD${yahooCurrency}=X`;

  try {
    const direct = await yahooFinance.quote(directSymbol) as unknown as Record<string, unknown>;
    const directRate = numeric(direct.regularMarketPrice);
    if (directRate !== null && directRate > 0) {
      return {
        rate: directRate * penceMultiplier,
        originalCurrency: normalized,
        note: `Converted using ${directSymbol}`,
      };
    }
  } catch {
    // Fall through to inverse pair.
  }

  try {
    const inverse = await yahooFinance.quote(inverseSymbol) as unknown as Record<string, unknown>;
    const inverseRate = numeric(inverse.regularMarketPrice);
    if (inverseRate !== null && inverseRate > 0) {
      return {
        rate: (1 / inverseRate) * penceMultiplier,
        originalCurrency: normalized,
        note: `Converted using inverse ${inverseSymbol}`,
      };
    }
  } catch {
    // Fall through to identity fallback.
  }

  return {
    rate: 1,
    originalCurrency: normalized,
    note: `USD conversion unavailable for ${normalized}; values may already be USD or require manual verification`,
  };
}

function convertMoney(value: unknown, rate: number) {
  const numberValue = numeric(value);
  return numberValue === null ? value : numberValue * rate;
}

function convertMoneyFields(record: Record<string, unknown>, fields: string[], rate: number) {
  for (const field of fields) {
    if (field in record) {
      record[field] = convertMoney(record[field], rate);
    }
  }
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
      target1ExpectedSessions: null,
      target2ExpectedSessions: null,
      target1MedianSessions: null,
      target2MedianSessions: null,
      target1ExpectedTimeframe: null,
      target2ExpectedTimeframe: null,
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

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function sessionsToTimeframe(sessions: number | null) {
  if (sessions === null || !Number.isFinite(sessions)) {
    return null;
  }

  if (sessions < 10) {
    return `${Math.round(sessions)} trading sessions`;
  }

  const weeks = sessions / 5;
  if (weeks < 8) {
    return `about ${round(weeks, 1)} trading weeks`;
  }

  const months = sessions / 21;
  if (months < 18) {
    return `about ${round(months, 1)} trading months`;
  }

  return `about ${round(sessions / 252, 1)} trading years`;
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
      averageSessionsToTarget: null,
      medianSessionsToTarget: null,
      expectedTimeframe: null,
      method: "Insufficient historical sample for objective target probability and timeframe",
    };
  }

  let successes = 0;
  let observations = 0;
  const sessionsToTarget: number[] = [];
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
        sessionsToTarget.push(forward - index);
        break;
      }
    }
  }

  if (observations === 0) {
    return {
      probability: null,
      sampleSize: 0,
      averageSessionsToTarget: null,
      medianSessionsToTarget: null,
      expectedTimeframe: null,
      method: "Insufficient historical sample for objective target probability and timeframe",
    };
  }

  // Haircut the empirical hit rate to avoid optimistic target probabilities.
  const conservativeProbability = (successes / observations) * 100 * 0.9;
  const averageSessions = sessionsToTarget.length > 0 ? mean(sessionsToTarget) : null;
  const medianSessions = median(sessionsToTarget);

  return {
    probability: round(conservativeProbability, 2),
    sampleSize: observations,
    averageSessionsToTarget: round(averageSessions, 1),
    medianSessionsToTarget: round(medianSessions, 1),
    expectedTimeframe: sessionsToTimeframe(medianSessions ?? averageSessions),
    method: "Conservative empirical hit rate and timeframe: historical target-before-stop frequency with same-day stop priority and 10% probability haircut; timeframe uses median successful hit time when available",
  };
}

function addBusinessDays(date: Date, businessDays: number) {
  const next = new Date(date);
  let added = 0;

  while (added < businessDays) {
    next.setDate(next.getDate() + 1);
    const day = next.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }

  return next;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildSimulatedPaths(args: {
  lastClose: number;
  returns: number[];
  horizonSessions: number;
  pathCount?: number;
}) {
  const cleanReturns = args.returns
    .slice(-252)
    .filter((value) => Number.isFinite(value) && value > -0.8 && value < 0.8)
    .map((value) => clamp(value, -0.12, 0.12));

  if (cleanReturns.length < 60) {
    return [];
  }

  const averageReturn = mean(cleanReturns) ?? 0;
  const conservativeDrift = clamp(averageReturn, -0.0015, 0.0015) * 0.35;
  const startDate = new Date();
  const pathCount = args.pathCount ?? 7;

  return Array.from({ length: pathCount }, (_, pathIndex) => {
    const random = seededRandom(Math.round(args.lastClose * 100) + pathIndex * 9973 + cleanReturns.length * 7919);
    let price = args.lastClose;
    const points = [{ session: 0, date: formatDate(startDate), price: round(price, 2) }];

    for (let session = 1; session <= args.horizonSessions; session += 1) {
      const sampledReturn = cleanReturns[Math.floor(random() * cleanReturns.length)] ?? 0;
      const returnShock = sampledReturn - averageReturn + conservativeDrift;
      price = Math.max(0.01, price * (1 + returnShock));
      points.push({
        session,
        date: formatDate(addBusinessDays(startDate, session)),
        price: round(price, 2),
      });
    }

    return {
      label: `Sim ${pathIndex + 1}`,
      points,
    };
  });
}

function selectScenarioPaths(args: {
  simulatedPaths: Array<{ label: string; points: Array<{ session: number; date: string; price: number | null }> }>;
  bearishEnd: number | null;
  normalEnd: number | null;
  bullishEnd: number | null;
}) {
  if (args.bearishEnd === null || args.normalEnd === null || args.bullishEnd === null || args.simulatedPaths.length === 0) {
    return [];
  }

  const bullishThreshold = (args.normalEnd + args.bullishEnd) / 2;
  const bearishThreshold = (args.bearishEnd + args.normalEnd) / 2;
  const classify = (finalPrice: number | null) => {
    if (finalPrice === null) return null;
    if (finalPrice >= bullishThreshold) return "bullish";
    if (finalPrice <= bearishThreshold) return "bearish";
    return "normal";
  };
  const pick = (scenario: "bullish" | "normal" | "bearish", target: number) => {
    const candidates = args.simulatedPaths
      .map((path) => ({ path, finalPrice: path.points.at(-1)?.price ?? null }))
      .filter((candidate) => classify(candidate.finalPrice) === scenario && candidate.finalPrice !== null);
    const pool = candidates.length > 0
      ? candidates
      : args.simulatedPaths.map((path) => ({ path, finalPrice: path.points.at(-1)?.price ?? null })).filter((candidate) => candidate.finalPrice !== null);
    const chosen = pool.sort((a, b) => Math.abs(Number(a.finalPrice) - target) - Math.abs(Number(b.finalPrice) - target))[0];

    return chosen ? {
      scenario,
      label: scenario === "bullish" ? "Bullish trend" : scenario === "normal" ? "Normal trend" : "Bearish trend",
      points: chosen.path.points,
    } : null;
  };

  return [
    pick("bullish", args.bullishEnd),
    pick("normal", args.normalEnd),
    pick("bearish", args.bearishEnd),
  ].filter((path): path is { scenario: "bullish" | "normal" | "bearish"; label: string; points: Array<{ session: number; date: string; price: number | null }> } => path !== null);
}

function estimateScenarioProbabilities(args: {
  lastClose: number;
  returns: number[];
  bearishEnd: number | null;
  normalEnd: number | null;
  bullishEnd: number | null;
  horizonSessions: number;
}) {
  if (
    args.bearishEnd === null ||
    args.normalEnd === null ||
    args.bullishEnd === null ||
    args.returns.length < 60
  ) {
    return {
      bullish: null,
      normal: null,
      bearish: null,
      method: "Insufficient data for scenario probabilities",
    };
  }

  const cleanReturns = args.returns
    .slice(-252)
    .filter((value) => Number.isFinite(value) && value > -0.8 && value < 0.8)
    .map((value) => clamp(value, -0.12, 0.12));
  const averageReturn = mean(cleanReturns) ?? 0;
  const conservativeDrift = clamp(averageReturn, -0.0015, 0.0015) * 0.35;
  const bullishThreshold = (args.normalEnd + args.bullishEnd) / 2;
  const bearishThreshold = (args.bearishEnd + args.normalEnd) / 2;
  const random = seededRandom(Math.round(args.lastClose * 100) + cleanReturns.length * 31337);
  const simulations = 500;
  let bullish = 0;
  let normal = 0;
  let bearish = 0;

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    let price = args.lastClose;

    for (let session = 1; session <= args.horizonSessions; session += 1) {
      const sampledReturn = cleanReturns[Math.floor(random() * cleanReturns.length)] ?? 0;
      price = Math.max(0.01, price * (1 + sampledReturn - averageReturn + conservativeDrift));
    }

    if (price >= bullishThreshold) {
      bullish += 1;
    } else if (price <= bearishThreshold) {
      bearish += 1;
    } else {
      normal += 1;
    }
  }

  return {
    bullish: round((bullish / simulations) * 100, 1),
    normal: round((normal / simulations) * 100, 1),
    bearish: round((bearish / simulations) * 100, 1),
    method: "500 deterministic bootstrap simulations from recent historical returns; final 3-month prices are classified into bullish/normal/bearish zones",
  };
}

function buildThreeMonthForecast(args: {
  lastClose: number | null;
  returns: number[];
  currency?: string;
}) {
  if (args.lastClose === null || args.lastClose <= 0 || args.returns.length < 60) {
    return {
      horizonSessions: 63,
      horizonLabel: "3 months / about 63 trading sessions",
      source: "Quantitative fallback",
      method: "Insufficient return history for objective 3-month forecast cone",
      confidenceNote: "Not enough return history to build a reliable scenario cone.",
      baseEnd: null,
      upperEnd: null,
      lowerEnd: null,
      expectedReturnPercent: null,
      upperReturnPercent: null,
      lowerReturnPercent: null,
      scenarioProbabilities: {
        bullish: null,
        normal: null,
        bearish: null,
        method: "Insufficient return history for scenario probabilities",
      },
      points: [],
      scenarioPaths: [],
      simulatedPaths: [],
    };
  }

  const lastClose = args.lastClose;
  const recentReturns = args.returns.slice(-252);
  const averageDailyReturn = mean(recentReturns) ?? 0;
  const dailyVolatility = standardDeviation(recentReturns) ?? 0;
  // Shrink drift toward zero to avoid extrapolating an optimistic trend too aggressively.
  const conservativeDailyDrift = clamp(averageDailyReturn, -0.0015, 0.0015) * 0.5;
  const horizonSessions = 63;
  const confidenceMultiplier = 0.67;
  const sessions = [0, 7, 14, 21, 31, 42, 52, 63];
  const startDate = new Date();
  const simulatedPaths = buildSimulatedPaths({ lastClose, returns: args.returns, horizonSessions, pathCount: 180 });
  const points = sessions.map((session) => {
    const base = lastClose * Math.exp(conservativeDailyDrift * session);
    const cone = confidenceMultiplier * dailyVolatility * Math.sqrt(session);
    const upper = lastClose * Math.exp(conservativeDailyDrift * session + cone);
    const lower = lastClose * Math.exp(conservativeDailyDrift * session - cone);

    return {
      session,
      date: formatDate(addBusinessDays(startDate, session)),
      base: round(base, 2),
      upper: round(upper, 2),
      lower: round(lower, 2),
    };
  });
  const finalPoint = points[points.length - 1];
  const scenarioProbabilities = estimateScenarioProbabilities({
    lastClose,
    returns: args.returns,
    bearishEnd: finalPoint.lower,
    normalEnd: finalPoint.base,
    bullishEnd: finalPoint.upper,
    horizonSessions,
  });
  const scenarioPaths = selectScenarioPaths({
    simulatedPaths,
    bearishEnd: finalPoint.lower,
    normalEnd: finalPoint.base,
    bullishEnd: finalPoint.upper,
  });

  return {
    horizonSessions,
    horizonLabel: "3 months / about 63 trading sessions",
    source: "Quantitative fallback",
    method: "Conservative forecast cone using recent daily returns, drift shrunk 50% toward zero, and realized volatility bands; educational scenario, not a promise",
    confidenceNote: "Fallback scenario generated by statistical return/volatility model because AI forecast was unavailable.",
    baseEnd: finalPoint.base,
    upperEnd: finalPoint.upper,
    lowerEnd: finalPoint.lower,
    expectedReturnPercent: finalPoint.base === null ? null : round(((Number(finalPoint.base) / lastClose) - 1) * 100, 2),
    upperReturnPercent: finalPoint.upper === null ? null : round(((Number(finalPoint.upper) / lastClose) - 1) * 100, 2),
    lowerReturnPercent: finalPoint.lower === null ? null : round(((Number(finalPoint.lower) / lastClose) - 1) * 100, 2),
    scenarioProbabilities,
    points,
    scenarioPaths,
    simulatedPaths: [],
  };
}

type ForecastPoint = {
  session: number;
  date: string;
  base: number | null;
  upper: number | null;
  lower: number | null;
};

type ForecastCone = {
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
  points: ForecastPoint[];
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

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI forecast did not return JSON.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeAiForecastPoint(point: unknown, fallback: ForecastPoint): ForecastPoint {
  const record = point && typeof point === "object" ? point as Record<string, unknown> : {};
  const base = round(numeric(record.base), 2) ?? fallback.base;
  const upper = round(numeric(record.upper), 2) ?? fallback.upper;
  const lower = round(numeric(record.lower), 2) ?? fallback.lower;
  const ordered = [lower, base, upper].filter((value): value is number => typeof value === "number").sort((a, b) => a - b);

  return {
    session: fallback.session,
    date: typeof record.date === "string" ? record.date : fallback.date,
    lower: ordered[0] ?? fallback.lower,
    base: ordered[1] ?? fallback.base,
    upper: ordered[2] ?? fallback.upper,
  };
}

async function generateAiThreeMonthForecast(args: AiSelection & {
  symbol: string;
  displayName: string;
  currency?: string;
  lastClose: number | null;
  recentHistory: Array<{ date: string; close: number | null; volume: number | null }>;
  quantitativeForecast: ForecastCone;
  oneYearReturn: number | null;
  annualizedVolatility: number | null;
  maxDrawdown: number | null;
  trend: string;
}) {
  if (args.lastClose === null || args.quantitativeForecast.points.length < 2) {
    return args.quantitativeForecast;
  }

  try {
    const prompt = `Generate a conservative 3-month price forecast cone as strict JSON only.\n\nRules:\n- Use the historical prices, volatility and quantitative baseline below.\n- Do not be optimistic. Treat this as a scenario cone, not a promise.\n- Preserve the same sessions and date count as the baseline.\n- Output only valid JSON. No markdown.\n- JSON shape: {"source":"AI forecast + historical baseline","confidenceNote":"...","method":"...","points":[{"session":0,"date":"YYYY-MM-DD","lower":number,"base":number,"upper":number}]}\n- For each point enforce lower <= base <= upper.\n\nAsset: ${args.displayName} (${args.symbol})\nCurrency: ${args.currency ?? "n/a"}\nLast close: ${args.lastClose}\nTrend: ${args.trend}\n1Y return: ${args.oneYearReturn ?? "n/a"}%\nAnnualized volatility: ${args.annualizedVolatility ?? "n/a"}%\nMax drawdown: ${args.maxDrawdown ?? "n/a"}%\nRecent history sample: ${JSON.stringify(args.recentHistory.slice(-90))}\nQuantitative baseline: ${JSON.stringify(args.quantitativeForecast.points)}`;
    const generated = await generateTextWithFallback(args, prompt);
    const parsed = extractJsonObject(generated.text) as Record<string, unknown>;
    const aiPointsInput = Array.isArray(parsed.points) ? parsed.points : [];
    const points = args.quantitativeForecast.points.map((fallback, index) => normalizeAiForecastPoint(aiPointsInput[index], fallback));

    if (points.length !== args.quantitativeForecast.points.length) {
      return args.quantitativeForecast;
    }

    const finalPoint = points[points.length - 1];

    const scenarioProbabilities = estimateScenarioProbabilities({
      lastClose: args.lastClose,
      returns: args.recentHistory
        .map((point, index, history) => {
          const previous = index > 0 ? history[index - 1].close : null;
          return previous && point.close ? point.close / previous - 1 : null;
        })
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      bearishEnd: finalPoint.lower,
      normalEnd: finalPoint.base,
      bullishEnd: finalPoint.upper,
      horizonSessions: args.quantitativeForecast.horizonSessions,
    });

    return {
      ...args.quantitativeForecast,
      source: textValue(parsed.source) ?? "AI forecast + historical baseline",
      method: textValue(parsed.method) ?? "AI-generated conservative 3-month scenario cone using historical data and quantitative baseline",
      confidenceNote: textValue(parsed.confidenceNote) ?? "AI scenario generated from past data; not a guaranteed prediction.",
      baseEnd: finalPoint.base,
      upperEnd: finalPoint.upper,
      lowerEnd: finalPoint.lower,
      expectedReturnPercent: finalPoint.base === null ? null : round(((Number(finalPoint.base) / args.lastClose) - 1) * 100, 2),
      upperReturnPercent: finalPoint.upper === null ? null : round(((Number(finalPoint.upper) / args.lastClose) - 1) * 100, 2),
      lowerReturnPercent: finalPoint.lower === null ? null : round(((Number(finalPoint.lower) / args.lastClose) - 1) * 100, 2),
      scenarioProbabilities,
      points,
    };
  } catch {
    return args.quantitativeForecast;
  }
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

function averageScores(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length === 0 ? null : valid.reduce((total, value) => total + value, 0) / valid.length;
}

function scoreLowerIsBetter(value: number | null, excellent: number, fair: number, poor: number) {
  if (value === null || value <= 0) return null;
  if (value <= excellent) return 90;
  if (value <= fair) return 70;
  if (value <= poor) return 45;
  return 20;
}

function scoreHigherIsBetter(value: number | null, poor: number, fair: number, excellent: number) {
  if (value === null || !Number.isFinite(value)) return null;
  if (value >= excellent) return 90;
  if (value >= fair) return 70;
  if (value >= poor) return 45;
  return 20;
}

function scoreCurrentRatio(value: number | null) {
  if (value === null || value <= 0) return null;
  if (value >= 2) return 90;
  if (value >= 1.2) return 70;
  if (value >= 0.9) return 45;
  return 20;
}

function scoreDebtToEquity(value: number | null) {
  if (value === null || value < 0) return null;
  if (value <= 40) return 90;
  if (value <= 100) return 70;
  if (value <= 200) return 45;
  return 20;
}

function scoreDividendProfile(args: {
  dividendYield: number | null;
  payoutRatio: number | null;
  historyCount: number | null;
  trailingAnnualDividendRate: number | null;
}) {
  const yieldScore = args.dividendYield === null ? null : scoreHigherIsBetter(args.dividendYield, 0.5, 2, 4);
  const payoutScore = args.payoutRatio === null
    ? null
    : args.payoutRatio <= 0 ? 20
      : args.payoutRatio <= 0.6 ? 85
        : args.payoutRatio <= 0.85 ? 60
          : 30;
  const historyScore = args.historyCount === null
    ? null
    : args.historyCount >= 8 ? 85
      : args.historyCount >= 4 ? 65
        : args.historyCount > 0 ? 45
          : 20;
  const amountScore = args.trailingAnnualDividendRate === null || args.trailingAnnualDividendRate <= 0 ? 25 : 70;

  return round(averageScores([yieldScore, payoutScore, historyScore, amountScore]), 0);
}

function buildResearchScores(args: {
  price: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToSales: number | null;
  priceToBook: number | null;
  pegRatio: number | null;
  analystTargetMean: number | null;
  oneYearReturn: number | null;
  annualizedReturn: number | null;
  maxDrawdown: number | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  returnOnEquity: number | null;
  earningsGrowth: number | null;
  revenueGrowth: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  debtToEquity: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  dividendHistoryCount: number | null;
  trailingAnnualDividendRate: number | null;
}) {
  const analystUpside = args.price && args.analystTargetMean ? ((args.analystTargetMean / args.price) - 1) * 100 : null;
  const value = round(averageScores([
    scoreLowerIsBetter(args.forwardPE ?? args.trailingPE, 18, 30, 45),
    scoreLowerIsBetter(args.priceToSales, 3, 8, 14),
    scoreLowerIsBetter(args.priceToBook, 2.5, 8, 14),
    scoreLowerIsBetter(args.pegRatio, 1.2, 2.5, 4),
    analystUpside === null ? null : scoreHigherIsBetter(analystUpside, -10, 5, 25),
  ]), 0);
  const future = round(averageScores([
    scoreHigherIsBetter(args.earningsGrowth === null ? null : args.earningsGrowth * 100, -5, 5, 15),
    scoreHigherIsBetter(args.revenueGrowth === null ? null : args.revenueGrowth * 100, -2, 4, 12),
    analystUpside === null ? null : scoreHigherIsBetter(analystUpside, -10, 5, 25),
  ]), 0);
  const past = round(averageScores([
    scoreHigherIsBetter(args.oneYearReturn, -15, 0, 20),
    scoreHigherIsBetter(args.annualizedReturn, -5, 5, 15),
    scoreHigherIsBetter(args.profitMargins === null ? null : args.profitMargins * 100, 5, 12, 22),
    scoreHigherIsBetter(args.operatingMargins === null ? null : args.operatingMargins * 100, 5, 15, 28),
    scoreHigherIsBetter(args.returnOnEquity === null ? null : args.returnOnEquity * 100, 5, 15, 30),
    args.maxDrawdown === null ? null : scoreHigherIsBetter(args.maxDrawdown, -55, -35, -20),
  ]), 0);
  const health = round(averageScores([
    scoreCurrentRatio(args.currentRatio),
    scoreCurrentRatio(args.quickRatio),
    scoreDebtToEquity(args.debtToEquity),
    args.freeCashflow === null ? null : args.freeCashflow > 0 ? 80 : 25,
    args.operatingCashflow === null ? null : args.operatingCashflow > 0 ? 80 : 25,
  ]), 0);
  const dividend = scoreDividendProfile({
    dividendYield: args.dividendYield,
    payoutRatio: args.payoutRatio,
    historyCount: args.dividendHistoryCount,
    trailingAnnualDividendRate: args.trailingAnnualDividendRate,
  });
  const overall = round(averageScores([value, future, past, health, dividend]), 0);
  const checks = [
    value !== null && value < 45 ? "Valuation screens weak versus available multiples" : null,
    health !== null && health < 45 ? "Balance-sheet/liquidity checks look weak" : null,
    dividend !== null && dividend < 45 ? "Dividend profile is limited or low quality" : null,
    future !== null && future >= 70 ? "Growth/analyst upside screens are constructive" : null,
    past !== null && past >= 70 ? "Past profitability/performance screens are strong" : null,
  ].filter((check): check is string => Boolean(check));

  return {
    overall,
    value,
    future,
    past,
    health,
    dividend,
    analystUpsidePercent: round(analystUpside, 2),
    method: "Simplified research dashboard scores inspired by equity-analysis dashboards; built from Yahoo valuation, growth, profitability, health, and dividend fields when available",
    checks,
  };
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


function linearRegressionSlope(values: number[]) {
  if (values.length < 2) return null;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  if (yMean === null || yMean === 0) return null;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  return denominator === 0 ? null : (numerator / denominator) / yMean * 100;
}

function scoreTechnicalModel(args: {
  lastClose: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  annualizedVolatility: number | null;
  maxDrawdown: number | null;
  distanceFrom52WeekHigh: number | null;
}) {
  const trendScore = args.lastClose !== null && args.sma50 !== null && args.sma200 !== null
    ? args.lastClose > args.sma50 && args.sma50 > args.sma200 ? 85
      : args.lastClose < args.sma50 && args.sma50 < args.sma200 ? 25
        : 50
    : null;
  const rsiScore = args.rsi14 === null ? null
    : args.rsi14 >= 45 && args.rsi14 <= 65 ? 80
      : args.rsi14 >= 35 && args.rsi14 <= 75 ? 60
        : 35;
  const volatilityScore = args.annualizedVolatility === null ? null
    : args.annualizedVolatility < 20 ? 80
      : args.annualizedVolatility < 35 ? 65
        : args.annualizedVolatility < 55 ? 40
          : 25;
  const drawdownScore = args.maxDrawdown === null ? null
    : args.maxDrawdown > -20 ? 80
      : args.maxDrawdown > -35 ? 60
        : args.maxDrawdown > -55 ? 35
          : 20;
  const highScore = args.distanceFrom52WeekHigh === null ? null
    : args.distanceFrom52WeekHigh > -10 ? 70
      : args.distanceFrom52WeekHigh > -30 ? 50
        : 30;
  return round(averageScores([trendScore, rsiScore, volatilityScore, drawdownScore, highScore]), 0);
}

function scoreSentimentProxy(args: {
  recommendationMean: number | null;
  analystUpsidePercent: number | null;
  analystOpinions: number | null;
  shortPercentOfFloat: number | null;
  volumeRatio: number | null;
}) {
  const recScore = args.recommendationMean === null ? null
    : args.recommendationMean <= 1.8 ? 85
      : args.recommendationMean <= 2.6 ? 70
        : args.recommendationMean <= 3.4 ? 50
          : 30;
  const upsideScore = args.analystUpsidePercent === null ? null
    : args.analystUpsidePercent > 25 ? 80
      : args.analystUpsidePercent > 5 ? 65
        : args.analystUpsidePercent > -10 ? 45
          : 25;
  const coverageScore = args.analystOpinions === null ? null
    : args.analystOpinions >= 15 ? 75
      : args.analystOpinions >= 5 ? 60
        : 40;
  const shortScore = args.shortPercentOfFloat === null ? null
    : args.shortPercentOfFloat < 3 ? 75
      : args.shortPercentOfFloat < 10 ? 55
        : 30;
  const attentionScore = args.volumeRatio === null ? null
    : args.volumeRatio > 2.5 ? 35
      : args.volumeRatio > 1.3 ? 60
        : 55;
  return round(averageScores([recScore, upsideScore, coverageScore, shortScore, attentionScore]), 0);
}

function buildAlphaScore(args: {
  technicalScore: number | null;
  fundamentalScore: number | null;
  sentimentScore: number | null;
}) {
  const score = round(averageScores([args.technicalScore, args.fundamentalScore, args.sentimentScore]), 0);
  return {
    score,
    label: score === null ? "n/a" : score >= 75 ? "High alpha" : score >= 60 ? "Constructive" : score >= 45 ? "Neutral" : "Weak",
    technicalScore: args.technicalScore,
    fundamentalScore: args.fundamentalScore,
    sentimentScore: args.sentimentScore,
    method: "Proprietary 3-pillar alpha score: technical model, fundamental model, and sentiment/attention proxy from analyst/short-interest/volume data. Social/web sentiment connectors require external APIs.",
  };
}

function detectPatterns(points: PricePoint[], metrics: Record<string, number | null | string>) {
  const recent = points.slice(-90);
  const closes = recent.map((point) => Number(point.close)).filter(Number.isFinite);
  const highs = recent.map((point) => Number(point.high ?? point.close)).filter(Number.isFinite);
  const lows = recent.map((point) => Number(point.low ?? point.close)).filter(Number.isFinite);
  const slope = linearRegressionSlope(closes);
  const support = lows.length ? Math.min(...lows.slice(-30)) : null;
  const resistance = highs.length ? Math.max(...highs.slice(-30)) : null;
  const lastClose = closes.at(-1) ?? null;
  const channelWidth = support !== null && resistance !== null && lastClose ? ((resistance - support) / lastClose) * 100 : null;
  const patterns: Array<{ name: string; signal: string; confidence: number; details: string }> = [];

  if (slope !== null) {
    patterns.push({
      name: slope > 0.08 ? "Rising channel / uptrend" : slope < -0.08 ? "Falling channel / downtrend" : "Sideways range",
      signal: slope > 0.08 ? "bullish" : slope < -0.08 ? "bearish" : "neutral",
      confidence: Math.min(85, Math.max(35, Math.round(Math.abs(slope) * 140))),
      details: `90-session regression slope ${round(slope, 3)}% per session`,
    });
  }
  if (support !== null && resistance !== null && lastClose !== null) {
    const nearSupport = Math.abs((lastClose / support - 1) * 100);
    const nearResistance = Math.abs((lastClose / resistance - 1) * 100);
    patterns.push({
      name: "Support / resistance range",
      signal: nearSupport < nearResistance ? "near support" : "near resistance",
      confidence: 70,
      details: `Support ${round(support, 2)}, resistance ${round(resistance, 2)}, channel width ${round(channelWidth, 2)}%`,
    });
  }
  const rsi = typeof metrics.rsi14 === "number" ? metrics.rsi14 : null;
  if (rsi !== null && (rsi > 70 || rsi < 30)) {
    patterns.push({
      name: rsi > 70 ? "Overbought momentum" : "Oversold momentum",
      signal: rsi > 70 ? "pullback risk" : "mean-reversion watch",
      confidence: 60,
      details: `RSI 14 is ${round(rsi, 1)}`,
    });
  }
  return {
    support: round(support, 2),
    resistance: round(resistance, 2),
    regressionSlopePercentPerSession: round(slope, 4),
    channelWidthPercent: round(channelWidth, 2),
    patterns,
    method: "Mathematical time-series pattern recognition using regression slope, support/resistance, range width, and RSI extremes; no image-based chart computer vision yet.",
  };
}

function strategyStats(strategyReturns: number[], points: PricePoint[]) {
  const validReturns = strategyReturns.filter(Number.isFinite);
  if (validReturns.length === 0) {
    return { totalReturn: null, annualizedReturn: null, maxDrawdown: null, winRate: null };
  }
  let equity = 1;
  const equityCurve = validReturns.map((value) => {
    equity *= 1 + value;
    return equity;
  });
  const totalReturn = (equity - 1) * 100;
  const years = points.length / 252;
  const annualized = years > 0 ? (equity ** (1 / years) - 1) * 100 : null;
  const wins = validReturns.filter((value) => value > 0).length;
  return {
    totalReturn: round(totalReturn, 2),
    annualizedReturn: round(annualized, 2),
    maxDrawdown: round(maxDrawdown(equityCurve), 2),
    winRate: round((wins / validReturns.length) * 100, 2),
  };
}

function buildStrategyLab(points: PricePoint[]) {
  const closes = points.map((point) => Number(point.close)).filter(Number.isFinite);
  const returns = closes.slice(1).map((close, index) => close / closes[index] - 1);
  const strategies = [
    {
      name: "Trend SMA50/SMA200",
      returns: returns.map((value, index) => {
        const history = closes.slice(0, index + 1);
        const sma50 = movingAverage(history, 50);
        const sma200 = movingAverage(history, 200);
        return sma50 !== null && sma200 !== null && sma50 > sma200 ? value : 0;
      }),
      signal: movingAverage(closes, 50) !== null && movingAverage(closes, 200) !== null && Number(movingAverage(closes, 50)) > Number(movingAverage(closes, 200)) ? "Buy / risk-on" : "Avoid / risk-off",
    },
    {
      name: "RSI mean reversion",
      returns: returns.map((value, index) => {
        const signalRsi = rsi(closes.slice(0, index + 15));
        return signalRsi !== null && signalRsi < 35 ? value : 0;
      }),
      signal: rsi(closes) !== null && Number(rsi(closes)) < 35 ? "Buy mean-reversion setup" : "No active mean-reversion setup",
    },
    {
      name: "20-day breakout",
      returns: returns.map((value, index) => {
        const history = closes.slice(Math.max(0, index - 20), index + 1);
        const previousHigh = history.length ? Math.max(...history) : null;
        return previousHigh !== null && closes[index] > previousHigh ? value : 0;
      }),
      signal: closes.length > 21 && closes.at(-1)! > Math.max(...closes.slice(-21, -1)) ? "Breakout buy signal" : "No breakout signal",
    },
  ];
  const tested = strategies.map((strategy) => ({
    name: strategy.name,
    signal: strategy.signal,
    ...strategyStats(strategy.returns, points.slice(-strategy.returns.length)),
  })).sort((a, b) => (Number(b.annualizedReturn ?? -999) - Number(a.annualizedReturn ?? -999)));
  return {
    bestStrategy: tested[0]?.name ?? "n/a",
    strategies: tested,
    method: "On-demand overnight-style strategy lab over historical data. True nightly batch optimization over thousands of combinations requires scheduled infrastructure.",
  };
}

function buildSeasonality(points: PricePoint[]) {
  const byMonth = new Map<string, PricePoint[]>();
  points.forEach((point) => {
    const key = `${point.date.getUTCFullYear()}-${point.date.getUTCMonth()}`;
    const group = byMonth.get(key) ?? [];
    group.push(point);
    byMonth.set(key, group);
  });
  const buckets = Array.from({ length: 12 }, () => [] as number[]);
  byMonth.forEach((group, key) => {
    const first = group[0]?.close;
    const last = group.at(-1)?.close;
    const month = Number(key.split("-")[1]);
    if (typeof first === "number" && typeof last === "number" && first > 0) {
      buckets[month].push((last / first - 1) * 100);
    }
  });
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthly = buckets.map((values, index) => ({
    month: monthNames[index],
    averageReturn: round(mean(values), 2),
    winRate: values.length ? round((values.filter((value) => value > 0).length / values.length) * 100, 2) : null,
    samples: values.length,
  }));
  const best = [...monthly].sort((a, b) => Number(b.averageReturn ?? -999) - Number(a.averageReturn ?? -999))[0];
  const worst = [...monthly].sort((a, b) => Number(a.averageReturn ?? 999) - Number(b.averageReturn ?? 999))[0];
  return {
    monthly,
    bestMonth: best?.month ?? "n/a",
    worstMonth: worst?.month ?? "n/a",
    method: "Calendar-month seasonality from available historical monthly returns.",
  };
}

function buildDataConnectorStatus() {
  return [
    { name: "Social/web sentiment", status: "connector-required", detail: "Requires Reddit/X/TikTok/forum APIs or approved data vendor. Current app uses analyst/short-interest/volume proxy only." },
    { name: "Business footprint", status: "connector-required", detail: "Job postings, web traffic, and app downloads require external providers." },
    { name: "Insider trading", status: "connector-required", detail: "Needs SEC/Form 4 or licensed insider transaction feed." },
    { name: "Politician trading", status: "connector-required", detail: "Needs congressional/political trade disclosure feed." },
    { name: "COT reports", status: "connector-required", detail: "Needs CFTC COT data integration, mostly useful for futures/commodities/FX." },
    { name: "Macro overlay", status: "connector-required", detail: "Needs FRED/OECD/ECB/BLS or macro data provider for live overlays." },
  ];
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
  forecast: {
    horizonLabel: string;
    source?: string;
    method: string;
    confidenceNote?: string;
    baseEnd: number | null;
    upperEnd: number | null;
    lowerEnd: number | null;
    expectedReturnPercent: number | null;
    upperReturnPercent: number | null;
    lowerReturnPercent: number | null;
    scenarioProbabilities?: {
      bullish: number | null;
      normal: number | null;
      bearish: number | null;
      method: string;
    };
    points: Array<{ session: number; date: string; base: number | null; upper: number | null; lower: number | null }>;
    scenarioPaths?: Array<{
      scenario: string;
      label: string;
      points: Array<{ session: number; date: string; price: number | null }>;
    }>;
    simulatedPaths?: Array<{
      label: string;
      points: Array<{ session: number; date: string; price: number | null }>;
    }>;
  };
  fundamentals: Record<string, number | null | string>;
  researchScores: Record<string, number | null | string | string[]>;
  advancedIntelligence: Record<string, unknown>;
  links: { yahoo: string; tradingView: string };
}) {
  const { displayName, symbol, exchange, currency, quoteType, quote, metrics, tradeLevels, forecast, fundamentals, researchScores, advancedIntelligence, links } = args;

  return `Market data automatically retrieved from Yahoo Finance for ${displayName} (${symbol}).
Numerical source: Yahoo Finance quote and 5Y daily chart. Verification links: Yahoo ${links.yahoo}; TradingView ${links.tradingView}.
Timestamp: ${new Date().toISOString()}

Identification:
- Name: ${displayName}
- Symbol: ${symbol}
- Exchange: ${exchange || "n/a"}
- Type: ${quoteType || "n/a"}
- Currency: USD
- Original quote currency: ${quote.originalCurrency ?? "n/a"}
- USD conversion rate used: ${quote.usdFxRate ?? "n/a"} (${quote.usdConversionNote ?? "n/a"})

Objective investment score:
- Score: ${metrics.investmentScore}/100
- Label: ${metrics.investmentScoreLabel}
- Main drivers: ${metrics.investmentScoreDrivers || "n/a"}

Research dashboard scores:
- Overall research score: ${researchScores.overall ?? "n/a"}/100
- Value: ${researchScores.value ?? "n/a"}/100
- Future growth: ${researchScores.future ?? "n/a"}/100
- Past performance: ${researchScores.past ?? "n/a"}/100
- Financial health: ${researchScores.health ?? "n/a"}/100
- Dividend quality: ${researchScores.dividend ?? "n/a"}/100
- Research checks: ${Array.isArray(researchScores.checks) ? researchScores.checks.join("; ") : "n/a"}
- Method: ${researchScores.method ?? "n/a"}

Advanced intelligence modules:
- Alpha Score: ${(advancedIntelligence.alphaScore as Record<string, unknown> | undefined)?.score ?? "n/a"}/100; technical ${(advancedIntelligence.alphaScore as Record<string, unknown> | undefined)?.technicalScore ?? "n/a"}, fundamental ${(advancedIntelligence.alphaScore as Record<string, unknown> | undefined)?.fundamentalScore ?? "n/a"}, sentiment proxy ${(advancedIntelligence.alphaScore as Record<string, unknown> | undefined)?.sentimentScore ?? "n/a"}
- Detected patterns: ${JSON.stringify((advancedIntelligence.patternRecognition as Record<string, unknown> | undefined)?.patterns ?? [])}
- Strategy lab best strategy: ${(advancedIntelligence.strategyLab as Record<string, unknown> | undefined)?.bestStrategy ?? "n/a"}
- Seasonality best/worst months: ${(advancedIntelligence.seasonality as Record<string, unknown> | undefined)?.bestMonth ?? "n/a"} / ${(advancedIntelligence.seasonality as Record<string, unknown> | undefined)?.worstMonth ?? "n/a"}
- Alternative data connector status: ${JSON.stringify(advancedIntelligence.dataConnectors ?? [])}

Fundamental snapshot:
- Sector / industry: ${fundamentals.sector ?? "n/a"} / ${fundamentals.industry ?? "n/a"}
- Analyst target mean: ${money(fundamentals.analystTargetMean as number | null, currency)} (${percent(fundamentals.analystUpsidePercent as number | null)} upside)
- Analyst recommendation: ${fundamentals.recommendationKey ?? "n/a"} from ${fundamentals.analystOpinions ?? "n/a"} opinions
- Profit margin: ${percent(fundamentals.profitMargins as number | null)}
- ROE: ${percent(fundamentals.returnOnEquity as number | null)}
- Revenue growth: ${percent(fundamentals.revenueGrowth as number | null)}
- Earnings growth: ${percent(fundamentals.earningsGrowth as number | null)}
- Current ratio: ${round(fundamentals.currentRatio as number | null, 2) ?? "n/a"}
- Debt/equity: ${round(fundamentals.debtToEquity as number | null, 2) ?? "n/a"}

Objective buy/sell/risk levels:
- Suggested buy zone: ${money(tradeLevels.buyZoneLow as number | null, currency)} - ${money(tradeLevels.buyZoneHigh as number | null, currency)}
- Preferred buy price: ${money(tradeLevels.preferredBuy as number | null, currency)}
- Stop-loss: ${money(tradeLevels.stopLoss as number | null, currency)}
- Risk from preferred buy to stop: ${percent(tradeLevels.riskPercent as number | null)}
- Current-price downside to stop: ${percent(tradeLevels.currentPriceRiskPercent as number | null)}
- Target 1 / first sell zone: ${money(tradeLevels.target1 as number | null, currency)} (${percent(tradeLevels.upsideToTarget1Percent as number | null)} upside; R/R ${round(tradeLevels.rewardRiskTarget1 as number | null, 2) ?? "n/a"})
- Target 1 probability: ${percent(tradeLevels.target1Probability as number | null)} over ~63 trading sessions
- Target 1 expected timeframe if reached: ${tradeLevels.target1ExpectedTimeframe ?? "n/a"} (median ${round(tradeLevels.target1MedianSessions as number | null, 1) ?? "n/a"} sessions; average ${round(tradeLevels.target1ExpectedSessions as number | null, 1) ?? "n/a"} sessions)
- Target 2 / extended sell zone: ${money(tradeLevels.target2 as number | null, currency)} (${percent(tradeLevels.upsideToTarget2Percent as number | null)} upside; R/R ${round(tradeLevels.rewardRiskTarget2 as number | null, 2) ?? "n/a"})
- Target 2 probability: ${percent(tradeLevels.target2Probability as number | null)} over ~126 trading sessions
- Target 2 expected timeframe if reached: ${tradeLevels.target2ExpectedTimeframe ?? "n/a"} (median ${round(tradeLevels.target2MedianSessions as number | null, 1) ?? "n/a"} sessions; average ${round(tradeLevels.target2ExpectedSessions as number | null, 1) ?? "n/a"} sessions)
- Probability method: ${tradeLevels.targetProbabilityMethod}
- Method: ${tradeLevels.method}

3-month forecast cone:
- Horizon: ${forecast.horizonLabel}
- Base case end price: ${money(forecast.baseEnd, currency)} (${percent(forecast.expectedReturnPercent)})
- Bullish scenario end price: ${money(forecast.upperEnd, currency)} (${percent(forecast.upperReturnPercent)}); probability ${percent(forecast.scenarioProbabilities?.bullish ?? null, 1)}
- Normal scenario end price: ${money(forecast.baseEnd, currency)} (${percent(forecast.expectedReturnPercent)}); probability ${percent(forecast.scenarioProbabilities?.normal ?? null, 1)}
- Bearish scenario end price: ${money(forecast.lowerEnd, currency)} (${percent(forecast.lowerReturnPercent)}); probability ${percent(forecast.scenarioProbabilities?.bearish ?? null, 1)}
- Scenario probability method: ${forecast.scenarioProbabilities?.method ?? "n/a"}
- Forecast source: ${forecast.source ?? "n/a"}
- Forecast method: ${forecast.method}
- Forecast confidence note: ${forecast.confidenceNote ?? "n/a"}
- Forecast points: ${forecast.points.map((point) => `${point.date}: lower ${money(point.lower, currency)}, base ${money(point.base, currency)}, upper ${money(point.upper, currency)}`).join("; ")}
- Realistic scenario trend paths: ${(forecast.scenarioPaths ?? []).map((path) => {
  const lastPoint = path.points.at(-1);
  return `${path.label} final ${money(lastPoint?.price ?? null, currency)} with ${path.points.length} trading-session points`;
}).join("; ") || "n/a"}

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

Macro/geopolitical scenario framework:
- Sector: ${fundamentals.sector ?? "n/a"}
- Industry: ${fundamentals.industry ?? "n/a"}
- Macro variables to stress test: interest rates, inflation, FX translation, consumer/enterprise demand cycle, credit/liquidity conditions, sector regulation, geopolitical/geographic exposure, and broad equity risk appetite.
- Important limitation: no live news or real-time macro feed is included unless explicitly provided; macro/geopolitical analysis must be framed as scenario sensitivity, not current-news certainty.

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

Instructions: use these USD-normalized data points as the base for the report, do not invent missing metrics, keep the investment score, research scores, buy/sell/risk levels, scenario probabilities, target timeframes, dividend profile, and forecast visible. Treat macro/geopolitical comments as scenario sensitivity unless live data is explicitly provided. Recommend verification on TradingView/Yahoo and official company filings before execution.`;}

async function getMarketData(query: string, selection: AiSelection = {}) {
  const search = await yahooFinance.search(query, { quotesCount: 8, newsCount: 0 }) as unknown as { quotes?: Array<Record<string, string>> };
  const quotes = search.quotes ?? [];
  const match = quotes.find((quote) => PREFERRED_TYPES.has(String(quote.quoteType))) ?? quotes[0];

  if (!match?.symbol) {
    throw new Error(`No symbol found for "${query}".`);
  }

  const symbol = match.symbol;
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 20);

  const [quoteResult, chartResult, quoteSummaryResult] = await Promise.all([
    yahooFinance.quote(symbol),
    yahooFinance.chart(symbol, { period1, period2: new Date(), interval: "1d", events: "div" }),
    yahooFinance.quoteSummary(symbol, {
      modules: ["financialData", "defaultKeyStatistics", "summaryDetail", "assetProfile"],
    }).catch(() => null),
  ]);

  const quote = quoteResult as unknown as Record<string, unknown>;
  const chart = chartResult as unknown as { quotes?: PricePoint[]; events?: { dividends?: DividendEvent[] } };
  const quoteSummary = quoteSummaryResult as unknown as {
    financialData?: Record<string, unknown>;
    defaultKeyStatistics?: Record<string, unknown>;
    summaryDetail?: Record<string, unknown>;
    assetProfile?: Record<string, unknown>;
  } | null;
  const financialData = quoteSummary?.financialData ?? {};
  const keyStats = quoteSummary?.defaultKeyStatistics ?? {};
  const summaryDetail = quoteSummary?.summaryDetail ?? {};
  const assetProfile = quoteSummary?.assetProfile ?? {};
  const originalCurrency = textValue(quote.currency) || textValue(summaryDetail.currency) || textValue(financialData.financialCurrency) || "USD";
  const usdConversion = await getUsdConversionRate(originalCurrency);
  const usdFxRate = usdConversion.rate;

  convertMoneyFields(quote, [
    "regularMarketPrice",
    "regularMarketChange",
    "marketCap",
    "fiftyTwoWeekHigh",
    "fiftyTwoWeekLow",
    "epsTrailingTwelveMonths",
    "dividendRate",
    "trailingAnnualDividendRate",
  ], usdFxRate);
  convertMoneyFields(summaryDetail, [
    "previousClose",
    "open",
    "dayLow",
    "dayHigh",
    "regularMarketPreviousClose",
    "regularMarketOpen",
    "regularMarketDayLow",
    "regularMarketDayHigh",
    "dividendRate",
    "trailingAnnualDividendRate",
    "marketCap",
  ], usdFxRate);
  convertMoneyFields(financialData, [
    "currentPrice",
    "targetHighPrice",
    "targetLowPrice",
    "targetMeanPrice",
    "targetMedianPrice",
    "totalCash",
    "totalCashPerShare",
    "ebitda",
    "totalDebt",
    "totalRevenue",
    "revenuePerShare",
    "grossProfits",
    "freeCashflow",
    "operatingCashflow",
  ], usdFxRate);
  quote.currency = "USD";
  summaryDetail.currency = "USD";
  financialData.financialCurrency = "USD";

  const pricePoints: PricePoint[] = (chart.quotes ?? [])
    .filter((point) => typeof point.close === "number")
    .map((point) => ({
      date: new Date(point.date),
      close: typeof point.close === "number" ? point.close * usdFxRate : point.close,
      high: typeof point.high === "number" ? point.high * usdFxRate : point.high,
      low: typeof point.low === "number" ? point.low * usdFxRate : point.low,
      volume: point.volume,
    }));

  const dividendEvents = (chart.events?.dividends ?? []).map((event) => ({
    ...event,
    amount: typeof event.amount === "number" ? event.amount * usdFxRate : event.amount,
  }));
  const dividendProfile = buildDividendProfile(dividendEvents, quote);
  const closes = pricePoints.map((point) => Number(point.close)).filter(Number.isFinite);
  const returns = closes.slice(1).map((close, index) => close / closes[index] - 1).filter(Number.isFinite);
  const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;
  const quantitativeForecast = buildThreeMonthForecast({ lastClose, returns, currency: textValue(quote.currency) }) as ForecastCone;
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
    target1ExpectedSessions: target1Probability.averageSessionsToTarget,
    target2ExpectedSessions: target2Probability.averageSessionsToTarget,
    target1MedianSessions: target1Probability.medianSessionsToTarget,
    target2MedianSessions: target2Probability.medianSessionsToTarget,
    target1ExpectedTimeframe: target1Probability.expectedTimeframe,
    target2ExpectedTimeframe: target2Probability.expectedTimeframe,
    targetProbabilityHorizon: "Target 1 probability window: 63 trading sessions; Target 2 probability window: 126 trading sessions",
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
  const fundamentals = {
    sector: textValue(assetProfile.sector) ?? "n/a",
    industry: textValue(assetProfile.industry) ?? "n/a",
    businessSummary: textValue(assetProfile.longBusinessSummary) ?? null,
    analystTargetMean: round(numeric(financialData.targetMeanPrice), 2),
    analystTargetLow: round(numeric(financialData.targetLowPrice), 2),
    analystTargetHigh: round(numeric(financialData.targetHighPrice), 2),
    analystOpinions: numeric(financialData.numberOfAnalystOpinions),
    recommendationKey: textValue(financialData.recommendationKey) ?? null,
    recommendationMean: round(numeric(financialData.recommendationMean), 2),
    currentRatio: round(numeric(financialData.currentRatio), 2),
    quickRatio: round(numeric(financialData.quickRatio), 2),
    debtToEquity: round(numeric(financialData.debtToEquity), 2),
    returnOnEquity: round(numeric(financialData.returnOnEquity) === null ? null : Number(numeric(financialData.returnOnEquity)) * 100, 2),
    returnOnAssets: round(numeric(financialData.returnOnAssets) === null ? null : Number(numeric(financialData.returnOnAssets)) * 100, 2),
    profitMargins: round(numeric(financialData.profitMargins) === null ? null : Number(numeric(financialData.profitMargins)) * 100, 2),
    operatingMargins: round(numeric(financialData.operatingMargins) === null ? null : Number(numeric(financialData.operatingMargins)) * 100, 2),
    grossMargins: round(numeric(financialData.grossMargins) === null ? null : Number(numeric(financialData.grossMargins)) * 100, 2),
    revenueGrowth: round(numeric(financialData.revenueGrowth) === null ? null : Number(numeric(financialData.revenueGrowth)) * 100, 2),
    earningsGrowth: round(numeric(financialData.earningsGrowth) === null ? null : Number(numeric(financialData.earningsGrowth)) * 100, 2),
    freeCashflow: numeric(financialData.freeCashflow),
    operatingCashflow: numeric(financialData.operatingCashflow),
    priceToSales: round(numeric(summaryDetail.priceToSalesTrailing12Months), 2),
    priceToBook: round(numeric(keyStats.priceToBook), 2),
    pegRatio: round(numeric(keyStats.pegRatio), 2),
    payoutRatio: round(numeric(summaryDetail.payoutRatio), 4),
    shortPercentOfFloat: round(numeric(keyStats.shortPercentOfFloat) === null ? null : Number(numeric(keyStats.shortPercentOfFloat)) * 100, 2),
  };
  const analystUpsidePercent = lastClose && fundamentals.analystTargetMean ? ((Number(fundamentals.analystTargetMean) / lastClose) - 1) * 100 : null;
  const researchScores = buildResearchScores({
    price: lastClose,
    trailingPE: numeric(quote.trailingPE) ?? numeric(summaryDetail.trailingPE),
    forwardPE: numeric(quote.forwardPE) ?? numeric(summaryDetail.forwardPE),
    priceToSales: fundamentals.priceToSales,
    priceToBook: fundamentals.priceToBook,
    pegRatio: fundamentals.pegRatio,
    analystTargetMean: fundamentals.analystTargetMean,
    oneYearReturn: baseMetrics.oneYearReturn,
    annualizedReturn: baseMetrics.annualizedReturn,
    maxDrawdown: baseMetrics.maxDrawdown,
    profitMargins: numeric(financialData.profitMargins),
    operatingMargins: numeric(financialData.operatingMargins),
    returnOnEquity: numeric(financialData.returnOnEquity),
    earningsGrowth: numeric(financialData.earningsGrowth),
    revenueGrowth: numeric(financialData.revenueGrowth),
    currentRatio: numeric(financialData.currentRatio),
    quickRatio: numeric(financialData.quickRatio),
    debtToEquity: numeric(financialData.debtToEquity),
    freeCashflow: numeric(financialData.freeCashflow),
    operatingCashflow: numeric(financialData.operatingCashflow),
    dividendYield: dividendProfile.dividendYield,
    payoutRatio: numeric(summaryDetail.payoutRatio),
    dividendHistoryCount: dividendProfile.dividendHistoryCount,
    trailingAnnualDividendRate: dividendProfile.trailingAnnualDividendRate,
  });
  const enrichedFundamentals = {
    ...fundamentals,
    analystUpsidePercent: round(analystUpsidePercent, 2),
  };
  const volumeRatio = numeric(quote.averageDailyVolume3Month) && numeric(quote.regularMarketVolume)
    ? Number(numeric(quote.regularMarketVolume)) / Number(numeric(quote.averageDailyVolume3Month))
    : null;
  const technicalAlphaScore = scoreTechnicalModel({
    lastClose,
    sma50,
    sma200,
    rsi14: baseMetrics.rsi14,
    annualizedVolatility: baseMetrics.annualizedVolatility,
    maxDrawdown: baseMetrics.maxDrawdown,
    distanceFrom52WeekHigh: baseMetrics.distanceFrom52WeekHigh,
  });
  const sentimentScore = scoreSentimentProxy({
    recommendationMean: enrichedFundamentals.recommendationMean,
    analystUpsidePercent: enrichedFundamentals.analystUpsidePercent,
    analystOpinions: enrichedFundamentals.analystOpinions,
    shortPercentOfFloat: enrichedFundamentals.shortPercentOfFloat,
    volumeRatio,
  });
  const alphaScore = buildAlphaScore({
    technicalScore: technicalAlphaScore,
    fundamentalScore: researchScores.overall,
    sentimentScore,
  });
  const advancedIntelligence = {
    alphaScore,
    patternRecognition: detectPatterns(pricePoints, baseMetrics),
    strategyLab: buildStrategyLab(pricePoints),
    seasonality: buildSeasonality(pricePoints),
    dataConnectors: buildDataConnectorStatus(),
  };

  const displayName = textValue(quote.longName) || textValue(quote.shortName) || textValue(match.longname) || textValue(match.shortname) || symbol;
  const exchange = textValue(quote.fullExchangeName) || textValue(quote.exchange) || textValue(match.exchDisp);
  const currency = "USD";
  const links = {
    yahoo: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    tradingView: `https://www.tradingview.com/symbols/${encodeURIComponent(symbol.replace(".", "-"))}/`,
  };
  const history = pricePoints.slice(-260).map((point) => ({
    date: point.date.toISOString().slice(0, 10),
    close: round(point.close, 2),
    volume: point.volume ?? null,
  }));
  const forecast = await generateAiThreeMonthForecast({
    symbol,
    displayName,
    currency,
    lastClose,
    recentHistory: history.slice(-120),
    quantitativeForecast,
    oneYearReturn: baseMetrics.oneYearReturn,
    annualizedVolatility: baseMetrics.annualizedVolatility,
    maxDrawdown: baseMetrics.maxDrawdown,
    trend: baseMetrics.trend,
    aiProvider: selection.aiProvider,
    aiModel: selection.aiModel,
  });

  return {
    symbol,
    displayName,
    exchange,
    currency,
    originalCurrency: usdConversion.originalCurrency,
    usdFxRate: round(usdFxRate, 8),
    usdConversionNote: usdConversion.note,
    quoteType: textValue(quote.quoteType) || textValue(match.quoteType),
    source: "Yahoo Finance",
    links,
    companyProfile: {
      sector: enrichedFundamentals.sector,
      industry: enrichedFundamentals.industry,
      businessSummary: enrichedFundamentals.businessSummary,
    },
    fundamentals: enrichedFundamentals,
    researchScores,
    advancedIntelligence,
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
    forecast,
    history,
    promptContext: buildPromptContext({
      displayName,
      symbol,
      exchange,
      currency,
      quoteType: textValue(quote.quoteType) || textValue(match.quoteType),
      quote: { ...quote, ...dividendProfile, originalCurrency: usdConversion.originalCurrency, usdFxRate: round(usdFxRate, 8), usdConversionNote: usdConversion.note } as Record<string, unknown>,
      metrics,
      tradeLevels: tradeLevels as unknown as Record<string, number | null | string>,
      forecast,
      fundamentals: enrichedFundamentals as Record<string, number | null | string>,
      researchScores: researchScores as Record<string, number | null | string | string[]>,
      advancedIntelligence: advancedIntelligence as Record<string, unknown>,
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
    const data = await getMarketData(query, body);
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
