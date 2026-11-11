"""FastAPI entry point.

Run (from the backend folder):
    uvicorn app.main:app --port 8000
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.harness.agent import run_chat
from app.harness.gateway import gateway
from app.harness.tools import TOOLS
from app.services import analysis, market

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await gateway.start()  # starts the MCP market-data server (falls back if it can't)
    yield
    await gateway.stop()


app = FastAPI(title="AI Stock Market Assistant API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _wrap(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except market.MarketDataError as e:
        raise HTTPException(400, str(e)) from e
    except Exception as e:  # noqa: BLE001  (Yahoo rate limit, network...)
        raise HTTPException(503, f"Market data unavailable: {e}") from e


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "ai": "gemini" if settings.ai_enabled else "rules",
        "model": settings.gemini_model if settings.ai_enabled else None,
        "mcp": gateway.mcp_connected,
        "tools": sorted(TOOLS),
    }


@app.get("/api/quote/{ticker}")
def quote(ticker: str):
    return _wrap(market.get_quote, ticker)


@app.get("/api/quotes")
def quotes(tickers: str = Query("AAPL,MSFT,NVDA,TSLA")):
    out = []
    for t in tickers.split(",")[:10]:
        try:
            out.append(market.get_quote(t))
        except Exception:  # noqa: BLE001
            continue
    if not out:
        raise HTTPException(503, "Market data unavailable")
    return out


@app.get("/api/history/{ticker}")
def history(ticker: str, period: str = "2y"):
    return {"symbol": ticker.upper(), "period": period, "candles": _wrap(market.get_candles, ticker, period), "sources": [market.YAHOO(ticker.upper())]}


@app.get("/api/indicators/{ticker}")
def indicators(ticker: str, period: str = "1y"):
    return _wrap(analysis.technical_summary, ticker, period)


@app.get("/api/fundamentals/{ticker}")
def fundamentals(ticker: str):
    return _wrap(market.get_fundamentals, ticker)


@app.get("/api/profile/{ticker}")
def profile(ticker: str):
    return _wrap(market.get_company_profile, ticker)


@app.get("/api/compare")
def compare(tickers: str = Query(..., description="Comma separated, e.g. AAPL,MSFT"), period: str = "1y"):
    return _wrap(analysis.compare, tickers.split(","), period)


class ChatMessage(BaseModel):
    role: str
    content: str = ""
    ticker: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessage] = []


@app.post("/api/chat")
async def chat(req: ChatRequest):
    return await run_chat(req.message, [h.model_dump() for h in req.history])
