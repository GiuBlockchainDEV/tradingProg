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

const PREFERRED_TYPES = new Set(["EQUITY", "ETF", "MUTUALFUND", "INDEX"]);

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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
  return rounded === null ? "n/d" : `${rounded}%`;
}

function money(value: number | null | undefined, currency?: string) {
  const rounded = round(value, 2);
  if (rounded === null) {
    return "n/d";
  }

  return `${currency ? `${currency} ` : ""}${rounded.toLocaleString("it-IT")}`;
}

function compactNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/d";
  }

  return new Intl.NumberFormat("it-IT", {
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
    return "Dati insufficienti";
  }

  if (lastClose > sma50 && sma50 > sma200) {
    return "Bullish: prezzo sopra SMA50 e SMA200";
  }

  if (lastClose < sma50 && sma50 < sma200) {
    return "Bearish: prezzo sotto SMA50 e SMA200";
  }

  return "Laterale/misto: segnali trend non allineati";
}

function buildPromptContext(args: {
  displayName: string;
  symbol: string;
  exchange?: string;
  currency?: string;
  quoteType?: string;
  quote: Record<string, unknown>;
  metrics: Record<string, number | null | string>;
  links: { yahoo: string; tradingView: string };
}) {
  const { displayName, symbol, exchange, currency, quoteType, quote, metrics, links } = args;

  return `Dati mercato recuperati automaticamente da Yahoo Finance per ${displayName} (${symbol}).\nFonte numerica: Yahoo Finance quote, quoteSummary e chart 5Y. Link di verifica: Yahoo ${links.yahoo}; TradingView ${links.tradingView}.\nTimestamp: ${new Date().toISOString()}\n\nIdentificazione:\n- Nome: ${displayName}\n- Simbolo: ${symbol}\n- Exchange: ${exchange || "n/d"}\n- Tipo: ${quoteType || "n/d"}\n- Valuta: ${currency || "n/d"}\n\nPrezzo e performance:\n- Prezzo corrente: ${money(numeric(quote.regularMarketPrice), currency)}\n- Variazione giornaliera: ${percent(numeric(quote.regularMarketChangePercent))}\n- Rendimento 1Y: ${percent(metrics.oneYearReturn as number | null)}\n- CAGR 5Y/storico disponibile: ${percent(metrics.annualizedReturn as number | null)}\n- Distanza da massimo 52 settimane: ${percent(metrics.distanceFrom52WeekHigh as number | null)}\n\nMetriche tecniche calcolate:\n- SMA 50: ${money(metrics.sma50 as number | null, currency)}\n- SMA 200: ${money(metrics.sma200 as number | null, currency)}\n- RSI 14: ${round(metrics.rsi14 as number | null, 1) ?? "n/d"}\n- Volatilita annualizzata: ${percent(metrics.annualizedVolatility as number | null)}\n- Max drawdown storico disponibile: ${percent(metrics.maxDrawdown as number | null)}\n- Volume medio 30 sedute: ${compactNumber(metrics.averageVolume30 as number | null)}\n- Regime trend: ${metrics.trend}\n\nFondamentali principali:\n- Market cap: ${compactNumber(numeric(quote.marketCap))}\n- P/E trailing: ${round(numeric(quote.trailingPE), 2) ?? "n/d"}\n- P/E forward: ${round(numeric(quote.forwardPE), 2) ?? "n/d"}\n- EPS trailing: ${round(numeric(quote.epsTrailingTwelveMonths), 2) ?? "n/d"}\n- Dividend yield: ${percent(dividendPercent(quote.dividendYield))}\n- Beta: ${round(numeric(quote.beta), 2) ?? "n/d"}\n\nIstruzioni: usa questi dati come base del report, non inventare metriche mancanti, e suggerisci sempre verifica su TradingView/Yahoo prima dell'esecuzione.`;
}

async function getMarketData(query: string) {
  const search = await yahooFinance.search(query, { quotesCount: 8, newsCount: 0 }) as unknown as { quotes?: Array<Record<string, string>> };
  const quotes = search.quotes ?? [];
  const match = quotes.find((quote) => PREFERRED_TYPES.has(String(quote.quoteType))) ?? quotes[0];

  if (!match?.symbol) {
    throw new Error(`Nessun simbolo trovato per "${query}".`);
  }

  const symbol = match.symbol;
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 5);

  const [quoteResult, chartResult] = await Promise.all([
    yahooFinance.quote(symbol),
    yahooFinance.chart(symbol, { period1, interval: "1d" }),
  ]);

  const quote = quoteResult as unknown as Record<string, string | number | null | undefined>;
  const chart = chartResult as unknown as { quotes?: PricePoint[] };

  const pricePoints: PricePoint[] = (chart.quotes ?? [])
    .filter((point) => typeof point.close === "number")
    .map((point) => ({
      date: new Date(point.date),
      close: point.close,
      high: point.high,
      low: point.low,
      volume: point.volume,
    }));

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
  const metrics = {
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
    trend: trendLabel(lastClose, sma50, sma200),
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
      dividendYield: round(dividendPercent(quote.dividendYield), 2),
      beta: round(numeric(quote.beta), 2),
      fiftyTwoWeekHigh: round(numeric(quote.fiftyTwoWeekHigh), 2),
      fiftyTwoWeekLow: round(numeric(quote.fiftyTwoWeekLow), 2),
      averageDailyVolume3Month: numeric(quote.averageDailyVolume3Month),
    },
    metrics,
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
      quote: quote as unknown as Record<string, unknown>,
      metrics,
      links,
    }),
  };
}

export async function POST(request: Request) {
  let body: MarketDataRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON non valido." }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "Inserisci nome o ticker della stock." }, { status: 400 });
  }

  try {
    const data = await getMarketData(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto nel recupero dati mercato.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Parametro q richiesto." }, { status: 400 });
  }

  try {
    const data = await getMarketData(query);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto nel recupero dati mercato.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
