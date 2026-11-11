# AI Stock Market Assistant

An AI stock market assistant that brings together market data, company research and analysis in one conversational interface.

> Educational project. Nothing here is financial advice.

## Features

| Area | What it does |
|---|---|
| Technical analysis | Candlestick charts, SMA 20/50/200, RSI, MACD, volume, trend detection |
| Fundamental analysis | Income statements, earnings vs estimates, valuation ratios, margins |
| Calculations | Python-powered comparisons, projections and what-if scenarios (sandboxed) |
| Explanations | Chat answers with tables, charts, **sources and assumptions** on every result |
| Background jobs | Celery workers + Redis queue with progress tracking, retries and saved results |

## Tech stack

- **Frontend:** React (Vite), Framer Motion, TradingView lightweight-charts. Design system: *Institutional Sovereign*
- **Backend:** Python FastAPI, tool calling, AI harness (Google Gemini)
- **Data:** MCP server for market data and company information (yfinance, SEC EDGAR)
- **Workers:** Celery + Redis
- **Sandbox:** isolated Docker container for analysis scripts

## Project structure

```
ai-stock-market-assistant/
├── frontend/          React app (Vite)
│   └── src/
│       ├── api/       API client (mock in Hissa A)
│       ├── components/ UI kit, charts, layout
│       ├── data/      demo data
│       ├── lib/       indicators + formatting
│       ├── pages/     Chat, Technicals, Fundamentals, Compare, What-if, Analyses
│       └── styles/    design tokens + global CSS (animations)
├── backend/           FastAPI + Celery + MCP (Hissa B/C)
├── docs/              setup guide, deliverables
├── .env.example       copy to .env and add your keys
└── README.md
```

## Setup (Windows)

1. Copy `.env.example` to `.env` (project root) and add your free Gemini key.
2. Start the backend (terminal 1):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

3. Start the frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (app) and http://localhost:8000/docs (API).
If the backend is offline the UI automatically shows demo data with a **DEMO DATA** badge.

## Screenshots

_Add screenshots here after running the app (save them in `docs/screenshots/`)._

| Assistant | Technicals | Fundamentals |
|---|---|---|
| ![chat](docs/screenshots/chat.png) | ![chart](docs/screenshots/chart.png) | ![fundamentals](docs/screenshots/fundamentals.png) |

| Compare | What-if | Analyses |
|---|---|---|
| ![compare](docs/screenshots/compare.png) | ![whatif](docs/screenshots/whatif.png) | ![jobs](docs/screenshots/jobs.png) |

## Contributing

Work happens on feature branches (`feature/...`) and is merged into `main` through pull requests. See `CONTRIBUTING.md` (added in Hissa C).
