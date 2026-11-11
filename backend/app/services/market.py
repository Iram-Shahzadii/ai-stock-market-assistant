"""Market data + company information (Yahoo Finance via yfinance).

Every function returns plain JSON-able dicts and includes a `sources` list so the UI
can always show where numbers came from.
"""
from __future__ import annotations

import math
import os
import re
import time
from typing import Any, Callable

import pandas as pd

from app.config import settings

TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}

YAHOO = lambda t: {"label": f"Yahoo Finance — {t} quote & history (via yfinance)", "url": f"https://finance.yahoo.com/quote/{t}"}  # noqa: E731
EDGAR = lambda t: {"label": f"SEC EDGAR — {t} filings (10-K / 10-Q)", "url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company={t}&type=10-K"}  # noqa: E731


class MarketDataError(Exception):
    pass


def normalize_ticker(ticker: str) -> str:
    t = (ticker or "").strip().upper()
    if not TICKER_RE.match(t):
        raise MarketDataError(f"Invalid ticker: {ticker!r}")
    return t


# ---------- tiny TTL cache (avoids hitting Yahoo rate limits) ----------
_cache: dict[str, tuple[float, Any]] = {}


def cached(key: str, fn: Callable[[], Any]) -> Any:
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < settings.cache_ttl_seconds:
        return hit[1]
    val = fn()
    _cache[key] = (now, val)
    return val


def _yf():
    import yfinance as yf  # imported lazily so tests can run without it

    return yf


def _num(v: Any, scale: float = 1.0, digits: int = 4) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return round(f * scale, digits)


# ---------- offline synthetic data (tests / no internet: MARKET_FAKE=1) ----------
def _fake_history(ticker: str, period: str) -> pd.DataFrame:
    import numpy as np

    n = {"1mo": 21, "3mo": 63, "6mo": 126, "1y": 252, "2y": 504, "5y": 1260}[period]
    rng = np.random.default_rng(sum(map(ord, ticker)))
    close = 100 * np.exp(np.cumsum(rng.normal(0.0005, 0.015, n)))
    idx = pd.bdate_range(end="2026-11-10", periods=n)
    return pd.DataFrame(
        {"Open": close * 0.998, "High": close * 1.01, "Low": close * 0.99, "Close": close, "Volume": rng.integers(1e7, 5e7, n)},
        index=idx,
    )


FAKE = os.getenv("MARKET_FAKE") == "1"


# ---------- raw fetchers (monkeypatched in tests) ----------
def _fetch_history(ticker: str, period: str) -> pd.DataFrame:
    if FAKE:
        return _fake_history(ticker, period)
    df = _yf().Ticker(ticker).history(period=period, interval="1d", auto_adjust=False)
    if df is None or df.empty:
        raise MarketDataError(f"No price data for {ticker}")
    return df


def _fetch_info(ticker: str) -> dict:
    if FAKE:
        return {"longName": f"{ticker} Demo Corp", "trailingPE": 25.0, "profitMargins": 0.2, "debtToEquity": 80.0, "marketCap": 1e12}
    try:
        return _yf().Ticker(ticker).info or {}
    except Exception as e:  # noqa: BLE001
        raise MarketDataError(f"Could not load company info for {ticker}: {e}") from e


def _fetch_income(ticker: str) -> pd.DataFrame:
    if FAKE:
        return pd.DataFrame()
    try:
        return _yf().Ticker(ticker).income_stmt
    except Exception:  # noqa: BLE001
        return pd.DataFrame()


def _fetch_earnings(ticker: str) -> pd.DataFrame:
    if FAKE:
        return pd.DataFrame()
    try:
        return _yf().Ticker(ticker).earnings_history
    except Exception:  # noqa: BLE001
        return pd.DataFrame()


# ---------- public API ----------
def get_candles(ticker: str, period: str = "1y") -> list[dict]:
    t = normalize_ticker(ticker)
    if period not in PERIODS:
        raise MarketDataError(f"period must be one of {sorted(PERIODS)}")

    def load():
        df = _fetch_history(t, period)
        out = []
        for idx, r in df.iterrows():
            out.append(
                {
                    "time": pd.Timestamp(idx).strftime("%Y-%m-%d"),
                    "open": round(float(r["Open"]), 2),
                    "high": round(float(r["High"]), 2),
                    "low": round(float(r["Low"]), 2),
                    "close": round(float(r["Close"]), 2),
                    "volume": int(r["Volume"]) if not pd.isna(r["Volume"]) else 0,
                }
            )
        return out

    return cached(f"candles:{t}:{period}", load)


def get_quote(ticker: str) -> dict:
    t = normalize_ticker(ticker)
    c = get_candles(t, "1mo")
    last, prev = c[-1], c[-2] if len(c) > 1 else c[-1]
    change = last["close"] - prev["close"]
    return {
        "symbol": t,
        "price": last["close"],
        "change": round(change, 2),
        "changePct": round(change / prev["close"] * 100, 2) if prev["close"] else 0.0,
        "volume": last["volume"],
        "asOf": last["time"],
        "sources": [YAHOO(t)],
    }


def get_company_profile(ticker: str) -> dict:
    t = normalize_ticker(ticker)
    info = cached(f"info:{t}", lambda: _fetch_info(t))
    summary = (info.get("longBusinessSummary") or "")[:600]
    return {
        "symbol": t,
        "name": info.get("longName") or info.get("shortName") or t,
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "country": info.get("country"),
        "employees": info.get("fullTimeEmployees"),
        "website": info.get("website"),
        "summary": summary,
        "sources": [YAHOO(t)],
    }


def _row(df: pd.DataFrame, *names: str):
    for n in names:
        if n in df.index:
            return df.loc[n]
    return None


def get_fundamentals(ticker: str) -> dict:
    t = normalize_ticker(ticker)
    info = cached(f"info:{t}", lambda: _fetch_info(t))
    price = info.get("currentPrice") or info.get("regularMarketPrice")
    div_rate = info.get("dividendRate")

    income = []
    inc = cached(f"income:{t}", lambda: _fetch_income(t))
    if inc is not None and not inc.empty:
        cols = sorted(inc.columns)[-4:]  # last 4 fiscal years, oldest first
        rev, gp = _row(inc, "Total Revenue"), _row(inc, "Gross Profit")
        op, ni = _row(inc, "Operating Income"), _row(inc, "Net Income")
        eps = _row(inc, "Diluted EPS", "Basic EPS")
        for c in cols:
            g = lambda s: _num(s[c], digits=2) if s is not None else None  # noqa: E731
            income.append(
                {
                    "year": f"FY{pd.Timestamp(c).year}",
                    "revenue": g(rev),
                    "grossProfit": g(gp),
                    "operatingIncome": g(op),
                    "netIncome": g(ni),
                    "eps": g(eps),
                }
            )

    earnings = []
    eh = cached(f"earn:{t}", lambda: _fetch_earnings(t))
    if eh is not None and not eh.empty:
        for idx, r in eh.tail(4).iterrows():
            ts = pd.Timestamp(idx)
            earnings.append(
                {
                    "quarter": f"Q{(ts.month - 1) // 3 + 1} {str(ts.year)[2:]}",
                    "estimate": _num(r.get("epsEstimate"), digits=2),
                    "actual": _num(r.get("epsActual"), digits=2),
                }
            )

    return {
        "symbol": t,
        "name": info.get("longName") or t,
        "currency": info.get("currency", "USD"),
        "marketCap": _num(info.get("marketCap"), digits=0),
        "pe": _num(info.get("trailingPE"), digits=2),
        "forwardPe": _num(info.get("forwardPE"), digits=2),
        "pb": _num(info.get("priceToBook"), digits=2),
        "ps": _num(info.get("priceToSalesTrailing12Months"), digits=2),
        "evEbitda": _num(info.get("enterpriseToEbitda"), digits=2),
        "dividendYield": _num(div_rate / price * 100, digits=2) if div_rate and price else 0.0,
        "beta": _num(info.get("beta"), digits=2),
        "grossMargin": _num(info.get("grossMargins"), 100, 2),
        "operatingMargin": _num(info.get("operatingMargins"), 100, 2),
        "netMargin": _num(info.get("profitMargins"), 100, 2),
        "roe": _num(info.get("returnOnEquity"), 100, 2),
        "debtToEquity": _num(info.get("debtToEquity"), 0.01, 2),  # Yahoo reports it in %
        "income": income,
        "earnings": earnings,
        "sources": [YAHOO(t), EDGAR(t)],
    }
