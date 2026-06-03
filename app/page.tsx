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
  };
  promptContext: string;
};


const workflows: Workflow[] = [
  {
    id: "strategy_generation",
    number: "01",
    title: "Strategy Generation",
    short: "3 strategie complete con indicatori, entry, exit e edge.",
    tags: ["edge", "rules", "signals"],
    placeholder: "Esempio: crypto large cap, timeframe 1D, capitale 10.000 EUR, rischio 1% per trade.",
  },
  {
    id: "backtesting",
    number: "02",
    title: "Backtesting",
    short: "CAGR, Sharpe, max drawdown, win rate e sintesi.",
    tags: ["CAGR", "Sharpe", "MDD"],
    placeholder: "Incolla regole della strategia e, se li hai, risultati o dati storici OHLCV.",
  },
  {
    id: "risk_reward",
    number: "03",
    title: "Risk-Reward Analysis",
    short: "Rischio per trade, R/R, drawdown e miglioramenti.",
    tags: ["risk", "R/R", "sizing"],
    placeholder: "Descrivi setup, stop, target e frequenza operativa della strategia.",
  },
  {
    id: "market_regime",
    number: "04",
    title: "Market Regime Detection",
    short: "Trend, volatilita, volumi, cosa fare e cosa evitare.",
    tags: ["trend", "volatility", "volume"],
    placeholder: "Indica asset, timeframe e dati recenti: prezzo, medie mobili, volatilita, volumi.",
  },
  {
    id: "multi_factor",
    number: "05",
    title: "Multi-Factor Strategy",
    short: "Momentum, value, volatility e trend in un modello pesato.",
    tags: ["factor", "weights", "rebalance"],
    placeholder: "Elenca universo investibile, frequenza di ribilanciamento e vincoli di rischio.",
  },
  {
    id: "optimization",
    number: "06",
    title: "Strategy Optimization",
    short: "Migliora Sharpe, drawdown, timing e filtri.",
    tags: ["filters", "timing", "before/after"],
    placeholder: "Incolla la strategia attuale con indicatori, parametri, entry, exit e limiti noti.",
  },
  {
    id: "portfolio",
    number: "07",
    title: "Portfolio Construction",
    short: "Allocazioni, rendimento atteso, rischio e razionale.",
    tags: ["allocation", "risk", "horizon"],
    placeholder: "Esempio asset: SPY, QQQ, GLD, BTC, cash. Orizzonte 1-3 anni, rischio medio.",
  },
  {
    id: "trade_setup",
    number: "08",
    title: "Trade Setup Generation",
    short: "3 trade con entry, stop, take profit e motivazione.",
    tags: ["entry", "SL", "TP"],
    placeholder: "Indica mercato, direzione preferita, livelli chiave, news/macro e timeframe.",
  },
  {
    id: "monte_carlo",
    number: "09",
    title: "Monte Carlo Simulation",
    short: "Distribuzione ritorni, perdita probabile e scenari worst case.",
    tags: ["simulation", "loss", "robustness"],
    placeholder: "Fornisci win rate, R medio, numero trade, perdita media e serie risultati se disponibile.",
  },
  {
    id: "drawdown",
    number: "10",
    title: "Drawdown Analysis",
    short: "Max drawdown, recovery time e position sizing.",
    tags: ["MDD", "recovery", "sizing"],
    placeholder: "Incolla equity curve, risultati trade o descrizione della strategia da analizzare.",
  },
  {
    id: "macro_strategy",
    number: "11",
    title: "Macro-Based Strategy",
    short: "Tassi, inflazione, crescita, segnali ed esempi operativi.",
    tags: ["rates", "inflation", "growth"],
    placeholder: "Descrivi area geografica, asset macro e dati: CPI, PMI, banche centrali, curve tassi.",
  },
  {
    id: "alpha_edge",
    number: "12",
    title: "Alpha / Edge Detection",
    short: "Inefficienze, gap di struttura mercato e strategie poco affollate.",
    tags: ["alpha", "behavior", "structure"],
    placeholder: "Indica mercato, partecipanti dominanti, vincoli, microstruttura e orizzonte operativo.",
  },
];

const starterState: FormState = {
  market: "Apple",
  timeframe: "1D",
  capital: "10000 EUR",
  riskPerTrade: "1%",
  riskTolerance: "Media",
  timeHorizon: "1-3 anni",
  assets: "AAPL",
  strategyRules: "",
  historicalData: "",
  extraContext: "",
};


function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "n/d";
  }

  return `${value.toFixed(2)}%`;
}

function formatPrice(value: number | null, currency?: string) {
  if (value === null || !Number.isFinite(value)) {
    return "n/d";
  }

  return `${currency ? `${currency} ` : ""}${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
}

function formatCompact(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "n/d";
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
      `Fonti automatiche: Yahoo Finance (${data.links.yahoo}) e TradingView (${data.links.tradingView}).`,
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
      throw new Error(data.error ?? "Impossibile recuperare i dati mercato.");
    }

    return data as MarketData;
  }

  async function loadMarketData() {
    const query = form.market.trim();
    if (!query) {
      setError("Inserisci il nome della stock o il ticker.");
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
      setError(requestError instanceof Error ? requestError.message : "Errore nel recupero dati mercato.");
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
        const needsFreshData = !marketData || !form.historicalData.includes("Dati mercato recuperati automaticamente");
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
      setError(requestError instanceof Error ? requestError.message : "Errore imprevisto.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <nav className="topbar" aria-label="Navigazione principale">
          <div className="brand-mark">
            <span className="brand-orb" />
            <span>Gemini TradeLab</span>
          </div>
          <div className="topbar-actions">
            <span className="status-pill">AI Research</span>
            <a href="#workspace" className="ghost-link">Apri terminale</a>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Trading intelligence powered by Gemini</span>
            <h1>Una suite Next.js per strategie, backtest, rischio e portfolio.</h1>
            <p>
              Trasforma prompt di ricerca trading in workflow operativi: genera strategie, analizza drawdown,
              costruisci portafogli e crea setup con una UI fintech verde, veloce e responsive.
            </p>
            <div className="hero-actions">
              <a className="primary-cta" href="#workspace">Genera analisi</a>
              <a className="secondary-cta" href="#modules">Vedi moduli</a>
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

      <section className="module-strip" id="modules" aria-label="Metriche principali">
        <div>
          <strong>12</strong>
          <span>moduli trading</span>
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
              <span>Modulo attivo</span>
              <h2>{activeWorkflow.title}</h2>
            </div>
            <span className="status-pill">{activeWorkflow.number}/12</span>
          </div>

          <form onSubmit={submitAnalysis} className="analysis-form">
            <div className="stock-search-card">
              <label>
                Nome stock o ticker
                <div className="stock-input-row">
                  <input
                    value={form.market}
                    onChange={(event) => updateField("market", event.target.value)}
                    placeholder="Esempio: Apple, Tesla, NVDA, Microsoft"
                  />
                  <button disabled={isLoadingMarket || isLoading} onClick={loadMarketData} type="button">
                    {isLoadingMarket ? "Carico..." : "Carica metriche"}
                  </button>
                </div>
              </label>
              <p>
                Inserisci solo il nome della stock: l'app risolve il ticker, scarica quote e storico da Yahoo Finance e aggiunge link TradingView per verifica grafica.
              </p>
              {marketData && (
                <div className="metric-preview-grid">
                  <div className="metric-mini-card">
                    <span>Simbolo</span>
                    <strong>{marketData.symbol}</strong>
                    <small>{marketData.exchange || marketData.source}</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>Prezzo</span>
                    <strong>{formatPrice(marketData.quote.regularMarketPrice, marketData.currency)}</strong>
                    <small>{formatPercent(marketData.quote.regularMarketChangePercent)} oggi</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>Volatilita</span>
                    <strong>{formatPercent(marketData.metrics.annualizedVolatility)}</strong>
                    <small>annualizzata</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>Max drawdown</span>
                    <strong>{formatPercent(marketData.metrics.maxDrawdown)}</strong>
                    <small>storico disponibile</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>RSI 14</span>
                    <strong>{marketData.metrics.rsi14 ?? "n/d"}</strong>
                    <small>{marketData.metrics.trend}</small>
                  </div>
                  <div className="metric-mini-card">
                    <span>Market cap</span>
                    <strong>{formatCompact(marketData.quote.marketCap)}</strong>
                    <small>P/E {marketData.quote.trailingPE ?? "n/d"}</small>
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
                Capitale
                <input value={form.capital} onChange={(event) => updateField("capital", event.target.value)} />
              </label>
              <label>
                Rischio per trade
                <input value={form.riskPerTrade} onChange={(event) => updateField("riskPerTrade", event.target.value)} />
              </label>
              <label>
                Tolleranza rischio
                <select value={form.riskTolerance} onChange={(event) => updateField("riskTolerance", event.target.value)}>
                  <option>Bassa</option>
                  <option>Media</option>
                  <option>Alta</option>
                </select>
              </label>
              <label>
                Orizzonte
                <input value={form.timeHorizon} onChange={(event) => updateField("timeHorizon", event.target.value)} />
              </label>
            </div>

            <label>
              Asset list / Universo investibile
              <input value={form.assets} onChange={(event) => updateField("assets", event.target.value)} />
            </label>

            <label>
              Regole strategia o richiesta principale
              <textarea
                value={form.strategyRules}
                onChange={(event) => updateField("strategyRules", event.target.value)}
                placeholder={activeWorkflow.placeholder}
                rows={6}
              />
            </label>

            <label>
              Dati storici, metriche o osservazioni di mercato
              <textarea
                value={form.historicalData}
                onChange={(event) => updateField("historicalData", event.target.value)}
                placeholder="Incolla OHLCV, trade log, equity curve, metriche precedenti o livelli tecnici."
                rows={4}
              />
            </label>

            <label>
              Note extra
              <textarea
                value={form.extraContext}
                onChange={(event) => updateField("extraContext", event.target.value)}
                placeholder="Vincoli, broker, commissioni, strumenti esclusi, preferenze operative."
                rows={3}
              />
            </label>

            <button className="submit-button" disabled={isLoading} type="submit">
              {isLoading ? "Gemini sta elaborando..." : "Genera report con dati mercato + Gemini"}
            </button>
          </form>
        </div>
      </section>

      <section className="output-section" aria-live="polite">
        <div className="section-heading">
          <span>AI output</span>
          <h2>Report operativo</h2>
        </div>

        {!result && !error && (
          <div className="empty-output">
            <span>Pronto</span>
            <p>Inserisci il nome della stock, carica le metriche automatiche e genera un report completo con summary, tabelle, regole e rischi.</p>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
        {result && <MarkdownResult content={result} />}
      </section>
    </main>
  );
}
