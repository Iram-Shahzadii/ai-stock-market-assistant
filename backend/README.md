# Backend

FastAPI API + MCP market-data server + AI harness (Google Gemini tool calling).

```
backend/
├── app/
│   ├── main.py            FastAPI routes (/api/...)
│   ├── config.py          settings from the root .env
│   ├── services/
│   │   ├── market.py      Yahoo Finance data (prices, fundamentals, company info)
│   │   └── analysis.py    indicators (SMA, RSI, MACD), trend, comparison
│   └── harness/
│       ├── tools.py       tool registry (name, schema, permission)
│       ├── gateway.py     calls tools via MCP (or in-process fallback) + permission check
│       └── agent.py       model + context + tool-calling loop + sources/assumptions
├── mcp_server/server.py   MCP server exposing the market-data tools (stdio)
└── tests/                 pytest (runs offline with MARKET_FAKE=1)
```

## Run (Windows)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

Open http://localhost:8000/docs to try every endpoint.

## Endpoints

| Method | Path | What |
|---|---|---|
| GET | `/api/health` | status, AI mode, MCP connected? |
| GET | `/api/quote/{ticker}` | latest price |
| GET | `/api/quotes?tickers=AAPL,MSFT` | several quotes |
| GET | `/api/history/{ticker}?period=2y` | daily candles |
| GET | `/api/indicators/{ticker}` | SMA, RSI, MACD, trend, volatility |
| GET | `/api/fundamentals/{ticker}` | valuation, margins, income statement, earnings |
| GET | `/api/profile/{ticker}` | company info |
| GET | `/api/compare?tickers=AAPL,MSFT` | returns, volatility, drawdown |
| POST | `/api/chat` | AI assistant (tool calling) |

## AI modes

- `GEMINI_API_KEY` set in `.env` → Gemini plans, calls tools, writes the answer.
- No key or model error → automatic rule-based summary from the same tools (demo never breaks).

## Tests

```bash
pip install pytest
pytest -q
```
