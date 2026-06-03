# Gemini Trading Suite

Applicazione Next.js per trasformare prompt di ricerca trading in report operativi generati da Google Gemini. Include 12 workflow: generazione strategie, backtesting, risk/reward, market regime, multi-factor, ottimizzazione, portfolio, trade setup, Monte Carlo, drawdown, macro strategy e alpha/edge detection.

## Setup

```bash
npm install
cp .env.example .env.local
# inserisci GEMINI_API_KEY in .env.local
npm run dev
```

Apri `http://localhost:3000`.


## Deploy su Vercel

Il progetto e una app Next.js: su Vercel usa il framework preset `Next.js` e lascia l'output directory gestita come `.next`. Se nel pannello Vercel e impostato `public` come Output Directory, rimuovi quell'impostazione o usa il `vercel.json` incluso nel repo.

Configura le variabili d'ambiente:

```env
GEMINI_API_KEY=la_tua_chiave
GEMINI_MODEL=gemini-3.5-flash
```

## Variabili d'ambiente

- `GEMINI_API_KEY`: chiave API Google Gemini, richiesta dalla route server `/api/gemini`.
- `GEMINI_MODEL`: opzionale, default `gemini-3.5-flash`.

## Note prodotto

- La chiave Gemini resta server-side e non viene esposta nel frontend.
- I report sono ricerca educativa e non consulenza finanziaria personalizzata.
- Per backtest numerici accurati servono dati storici reali: l'app accetta dati incollati dall'utente e chiede a Gemini di esplicitare assunzioni e test mancanti.
