# Equity Research Lab

Equity Research Lab is a Next.js AI-powered equity research dashboard. The user enters one stock ticker or company name, selects an AI model, and receives a visual company analysis plus a complete Markdown investment report.

The app is designed for educational research only. It is not financial advice.

## Core user flow

1. Open `/` to see the landing page.
2. Click **Start stock analysis**.
3. On `/analyze`, enter a ticker or company name.
4. Choose the AI model:
   - Gemini 2.5
   - Gemini 3.5
   - DeepSeek V4
   - DeepSeek V4 Pro
5. Click **Generate report**.
6. Review the dashboard and integrated report.
7. Download the full analysis as PDF.

## Main features

### Automated stock research

- Yahoo Finance ticker lookup
- USD-normalized prices and monetary values
- Current price and daily change
- 1Y return
- CAGR / annualized return
- annualized volatility
- max drawdown
- SMA 50 / SMA 200
- RSI 14
- support / resistance
- volume and liquidity checks

### Visual research dashboard

- Investment Score from 0 to 100
- Research snowflake / radar
- Value score
- Future score
- Past Performance score
- Financial Health score
- Dividend Quality score
- Fair value / analyst target snapshot
- Profitability checks
- Growth checks
- Valuation multiples
- Business profile sector/industry

### Buy / Sell / Risk engine

- suggested buy zone
- preferred buy price
- stop-loss
- risk percentage to stop
- target 1
- target 2
- target probabilities
- expected target timeframes
- reward/risk
- sell/trim zone

### Forecast engine

- 3-month forecast chart
- X/Y axes with price and session values
- clickable intermediate points
- three realistic scenario paths:
  - Bullish
  - Normal
  - Bearish
- probability for each scenario
- AI-generated forecast when an AI key is available
- conservative quantitative fallback when AI is unavailable

### Dividends

- dividend yield
- forward annual dividend
- trailing annual dividend
- average historical dividend payment
- last dividend amount/date
- estimated cadence from real Yahoo dividend events
- ex-dividend date when available
- payment date when available

### Advanced intelligence modules

- Alpha Score system
  - technical model
  - fundamental model
  - sentiment/attention proxy
- mathematical pattern recognition
- support / resistance detection
- trend/range/channel detection
- RSI extremes
- strategy lab / backtesting
- seasonality by month
- alternative data connector status

## AI model support

The analysis page includes a visible AI model selector.

### Generic AI env variables

```env
AI_API_KEY=
AI_MODEL=gemini-2.5-flash
AI_FALLBACK_MODELS=gemini-3.5-flash
```

### DeepSeek env variables

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_FALLBACK_MODELS=deepseek-chat,deepseek-reasoner
DEEPSEEK_BASE_URL=https://api.deepseek.com/chat/completions
```

DeepSeek V4 is shown as a UI label. The default compatible DeepSeek model id is `deepseek-chat`. DeepSeek V4 Pro requests `deepseek-v4-pro`; if your account does not support that id, the app will show which fallback model was used.

## Routes

```text
/                  Landing page
/analyze           Stock analysis dashboard
/api/market-data   Market data, scores, forecast, dividends, advanced intelligence
/api/analyze       AI report generation
```

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

## Deploy on Vercel

Use the Next.js framework preset.

Required minimum:

```env
AI_API_KEY=
```

Optional DeepSeek support:

```env
DEEPSEEK_API_KEY=
```

The repository includes `vercel.json` with `.next` output configuration.

## PDF export

When the report is complete, the analysis page shows **Download PDF**. It uses the browser print/save-as-PDF flow with print-optimized CSS.

## Alternative data connectors

The app currently exposes connector status for:

- social / web sentiment
- business footprint
- insider trading
- politician trading
- COT reports
- macro overlays

These require external APIs or licensed data providers before becoming live feeds.

## Stitch prompt for UI/UX generation

Use this prompt in Stitch to generate a polished desktop and mobile UI/UX for the app.

```text
Design a premium equity research web app called "Equity Research Lab".

The product lets users enter one stock ticker or company name, choose an AI model, and generate a complete visual investment research dashboard plus a Markdown report. The app is educational and not financial advice.

Design style:
- Inspired by modern equity research dashboards and Simply Wall St-style visual company reports.
- Clean, bright, premium, data-heavy but easy to read.
- White / very light gray background.
- Rounded cards.
- Soft shadows.
- Clear typography.
- Green for strong/positive scores.
- Orange for neutral/mid scores.
- Red for weak/risky scores.
- Blue for primary actions and normal scenario.
- Avoid dark neon styling.
- Avoid clutter.
- Prioritize readability and hierarchy.

Pages:

1. Landing page
- Header with logo "Equity Research Lab".
- Hero card with headline: "One stock. One click. Full 12-prompt investment analysis."
- Subheading explaining automated market data, research scores, fair value checks, forecast cone, buy/sell/risk levels, dividends, and AI report.
- CTA button: "Start stock analysis".
- Secondary link: "View included prompts".
- Pills: Yahoo Finance data, TradingView verification, Research snowflake, Buy / Sell / Risk levels.
- Section showing 12 included research prompts in a clean grid:
  01 Strategy Generation
  02 Backtesting
  03 Risk-Reward Analysis
  04 Market Regime Detection
  05 Multi-Factor Strategy
  06 Strategy Optimization
  07 Portfolio Construction
  08 Trade Setup Generation
  09 Monte Carlo Simulation
  10 Drawdown Analysis
  11 Macro-Based Strategy
  12 Alpha / Edge Detection

2. Analysis page
- Header with navigation back to Overview.
- Intro block: "Analyze one stock".
- Main input card:
  - Stock name or ticker input.
  - Generate report button.
  - AI model selector as large visible cards:
    - Gemini 2.5
    - Gemini 3.5
    - DeepSeek V4
    - DeepSeek V4 Pro
  - Selected model card must be clearly highlighted.
  - A badge in the card header should say: "Model: Gemini 2.5" or selected model.
- Loading state:
  - spinner
  - text: "Building your investment report..."
  - explain that the app is fetching market data, simulating forecast paths, and generating the AI analysis.

Dashboard after report generation:

A. Resolved Asset card
- company name and ticker
- current USD price
- daily change
- conversion badge if original currency was not USD
- trend label
- Yahoo Finance and TradingView links

B. Decision Snapshot section
- Large Investment Score card on the left.
- Score color system:
  - red below 45
  - orange 45-69
  - green 70+
- Detail cards:
  - Buy zone
  - Sell targets
  - Target odds
  - Risk to stop
  - Dividend profile

C. Research Scores section
- Snowflake/radar chart with five axes:
  - Value
  - Future
  - Past
  - Health
  - Dividend
- Score cards next to/under the radar.
- Labels must never be cut off.
- On mobile, radar should be centered and labels readable.

D. Fundamentals section
- Cards for:
  - Fair value / analyst target
  - Future growth
  - Profitability
  - Financial health
  - Valuation multiples
  - Business profile

E. Advanced Intelligence section
- Cards for:
  - Alpha scoring system
  - Pattern recognition
  - Strategy lab
  - Seasonality
  - Alternative data connectors

F. Forecast section
- 3-month forecast chart.
- Visible X axis and Y axis.
- Y axis must show USD values.
- X axis must show Now, 14d, 31d, 52d, 63d or equivalent.
- Three clear realistic paths only:
  - Bullish scenario green
  - Normal scenario blue
  - Bearish scenario red
- Each scenario must show probability percentage.
- Clicking an intermediate point shows selected point details:
  - date
  - session
  - bullish price
  - normal price
  - bearish price
- Chart must be clean, not cluttered.

G. Integrated Investment Report section
- Show only after the report exists.
- Header with Download PDF button.
- Badge: Not financial advice.
- Badge showing model used and whether fallback was used.
- Markdown renderer should make headings, tables, bullet lists, score pills, and blockquotes readable.

Mobile UX requirements:
- Single-column layout.
- Sticky/simple top header.
- Large ticker input.
- AI model selector cards stacked vertically or 2-column if space allows.
- Decision Snapshot score first.
- Forecast chart horizontally scrollable only if necessary.
- Tables should scroll horizontally.
- PDF button should be easy to tap.
- Avoid tiny text.
- Avoid clipped labels.
- Keep spacing generous.

Desktop UX requirements:
- Max width around 1180px.
- Dashboard sections in clear vertical order.
- Cards use 2-3 column grids, not overly dense.
- Forecast chart plus legend/detail panel should fit cleanly.
- Report section should be comfortable to read.

Output:
- Provide desktop and mobile mockups.
- Include component hierarchy.
- Include spacing, typography, and color guidance.
- Focus on clarity, financial-dashboard trust, and mobile usability.
```

## Important disclaimer

This app provides educational market research only. It does not provide personalized financial advice.
