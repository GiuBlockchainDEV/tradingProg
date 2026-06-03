import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const workflowCatalog = {
  strategy_generation: {
    title: "Strategy Generation",
    objective: "Genera 3 strategie di trading con indicatori, regole operative, stop-loss, take-profit, condizioni di mercato ed edge.",
  },
  backtesting: {
    title: "Backtesting",
    objective: "Valuta una strategia su dati storici con CAGR, Sharpe ratio, max drawdown, win rate, tabella e sintesi.",
  },
  risk_reward: {
    title: "Risk-Reward Analysis",
    objective: "Analizza rischio per trade, reward-to-risk, pattern di drawdown e miglioramenti per ridurre il rischio/aumentare i ritorni.",
  },
  market_regime: {
    title: "Market Regime Detection",
    objective: "Identifica trend, volatilita, volumi, strategia piu adatta e cosa evitare nel regime attuale.",
  },
  multi_factor: {
    title: "Multi-Factor Strategy",
    objective: "Crea una strategia multi-fattoriale con momentum, value, volatility e trend, includendo formule, pesi, ribilanciamento e portfolio esempio.",
  },
  optimization: {
    title: "Strategy Optimization",
    objective: "Ottimizza una strategia per Sharpe piu alto e drawdown minore, migliorando indicatori, timing e filtri.",
  },
  portfolio: {
    title: "Portfolio Construction",
    objective: "Costruisci un portafoglio diversificato con allocazioni, rendimento atteso, rischio e razionale di ogni asset.",
  },
  trade_setup: {
    title: "Trade Setup Generation",
    objective: "Genera 3 trade ad alta probabilita con entry, stop-loss, take-profit, risk/reward e motivazione tecnica/macro.",
  },
  monte_carlo: {
    title: "Monte Carlo Simulation",
    objective: "Simula una strategia con probabilita di perdita, distribuzione dei ritorni, scenari peggiori e giudizio robustezza/fragilita.",
  },
  drawdown: {
    title: "Drawdown Analysis",
    objective: "Analizza max drawdown, recovery time medio, modi per ridurre drawdown e miglioramenti di position sizing.",
  },
  macro_strategy: {
    title: "Macro-Based Strategy",
    objective: "Crea una strategia basata su tassi, inflazione e crescita economica con impatto dei fattori, segnali entry/exit ed esempi.",
  },
  alpha_edge: {
    title: "Alpha / Edge Detection",
    objective: "Individua inefficienze comportamentali e gap di struttura mercato, proponendo strategie uniche ed esecuzione step-by-step.",
  },
} as const;

type WorkflowKey = keyof typeof workflowCatalog;

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

function normalize(value: unknown, fallback = "Non specificato") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function resolveWorkflow(workflow: unknown): { key: WorkflowKey; title: string; objective: string } {
  const key = typeof workflow === "string" && workflow in workflowCatalog
    ? (workflow as WorkflowKey)
    : "strategy_generation";

  return { key, ...workflowCatalog[key] };
}

function buildPrompt(input: GeminiRequest) {
  const workflow = resolveWorkflow(input.workflow);

  return `Sei un assistente senior di ricerca quantitativa per trading e portfolio management.
Rispondi in italiano, con tono professionale e pratico. Non promettere profitti e non presentare il contenuto come consulenza finanziaria personalizzata. Se mancano dati reali o storici, dichiara chiaramente le assunzioni e proponi come validarle.

Modulo richiesto: ${workflow.title}
Obiettivo: ${workflow.objective}

Contesto utente:
- Mercato/asset: ${normalize(input.market)}
- Timeframe operativo: ${normalize(input.timeframe)}
- Capitale: ${normalize(input.capital)}
- Rischio per trade: ${normalize(input.riskPerTrade)}
- Tolleranza al rischio: ${normalize(input.riskTolerance)}
- Orizzonte temporale: ${normalize(input.timeHorizon)}
- Lista asset: ${normalize(input.assets)}
- Regole strategia esistenti: ${normalize(input.strategyRules)}
- Dati storici o osservazioni fornite: ${normalize(input.historicalData)}
- Note extra: ${normalize(input.extraContext)}

Formato obbligatorio della risposta:
1. Executive summary in 4-6 bullet point.
2. Tabella principale con metriche, segnali, soglie operative o allocazioni rilevanti per il modulo.
3. Regole operative step-by-step.
4. Sezione rischio: drawdown, sizing, invalidation level, condizioni in cui il metodo si rompe.
5. Checklist di validazione/backtest con dati necessari e test da eseguire.
6. Disclaimer breve: ricerca educativa, non consulenza finanziaria.

Usa Markdown pulito con tabelle dove utile. Mantieni numeri, formule e soglie esplicite quando sono ragionevoli, ma segnala le ipotesi.`;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY non configurata. Copia .env.example in .env.local e inserisci la tua chiave Google Gemini." },
      { status: 500 },
    );
  }

  let body: GeminiRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON non valido." }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    });

    const result = await model.generateContent(buildPrompt(body));
    const text = result.response.text();

    return NextResponse.json({
      workflow: resolveWorkflow(body.workflow).title,
      result: text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto durante la generazione Gemini.";

    return NextResponse.json(
      { error: `Gemini non ha completato la richiesta: ${message}` },
      { status: 502 },
    );
  }
}
