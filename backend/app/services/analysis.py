"""Technical indicators and comparisons (pandas). Pure functions = easy to test."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from app.services import market


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()


def rsi(s: pd.Series, n: int = 14) -> pd.Series:
    d = s.diff()
    gain = d.clip(lower=0).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    loss = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    rs = gain / loss.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(100)


def macd(s: pd.Series, fast=12, slow=26, signal=9):
    line = ema(s, fast) - ema(s, slow)
    sig = ema(line, signal)
    return line, sig, line - sig


def _r(v, d=2):
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    return round(float(v), d)


def trend_label(price: float, s50: float | None, s200: float | None) -> str:
    if s50 is None or s200 is None:
        return "not enough data"
    if price > s50 > s200:
        return "uptrend"
    if price < s50 < s200:
        return "downtrend"
    return "sideways"


def technical_summary(ticker: str, period: str = "1y") -> dict:
    t = market.normalize_ticker(ticker)
    # always load enough history for SMA 200; `period` only sets the return window
    candles = market.get_candles(t, "5y" if period == "5y" else "2y")
    df = pd.DataFrame(candles)
    c = df["close"]
    s20, s50, s200 = sma(c, 20), sma(c, 50), sma(c, 200)
    r = rsi(c)
    m_line, m_sig, m_hist = macd(c)
    price = float(c.iloc[-1])
    s50v, s200v = _r(s50.iloc[-1]), _r(s200.iloc[-1])
    vol20 = df["volume"].tail(20).mean()
    window = {"1mo": 21, "3mo": 63, "6mo": 126, "1y": 252, "2y": 504, "5y": 1260}.get(period, 252)
    start = float(c.iloc[-min(window, len(c))])
    rets = np.log(c / c.shift(1)).dropna().tail(252)
    rsi_v = _r(r.iloc[-1], 1)
    return {
        "symbol": t,
        "asOf": candles[-1]["time"],
        "price": _r(price),
        "periodReturnPct": _r((price / start - 1) * 100),
        "sma20": _r(s20.iloc[-1]),
        "sma50": s50v,
        "sma200": s200v,
        "rsi14": rsi_v,
        "rsiZone": "overbought" if rsi_v and rsi_v > 70 else "oversold" if rsi_v and rsi_v < 30 else "neutral",
        "macd": _r(m_line.iloc[-1], 3),
        "macdSignal": _r(m_sig.iloc[-1], 3),
        "macdHist": _r(m_hist.iloc[-1], 3),
        "trend": trend_label(price, s50v, s200v),
        "volume": int(df["volume"].iloc[-1]),
        "avgVolume20": int(vol20) if not math.isnan(vol20) else None,
        "volatilityAnnualPct": _r(rets.std() * math.sqrt(252) * 100),
        "high52w": _r(df["high"].tail(252).max()),
        "low52w": _r(df["low"].tail(252).min()),
        "recentCloses": [{"time": x["time"], "close": x["close"]} for x in candles[-120:]],
        "sources": [market.YAHOO(t)],
        "assumptions": [
            "Daily candles from Yahoo Finance.",
            "RSI 14 (Wilder smoothing), MACD 12/26/9 EMA, simple moving averages.",
            "Trend: price vs SMA50 vs SMA200.",
        ],
    }


def compare(tickers: list[str], period: str = "1y") -> dict:
    tks = [market.normalize_ticker(t) for t in tickers][:5]
    if len(tks) < 2:
        raise market.MarketDataError("Give at least 2 tickers to compare")
    rows, sources = [], []
    for t in tks:
        df = pd.DataFrame(market.get_candles(t, period))
        c = df["close"]
        rets = np.log(c / c.shift(1)).dropna()
        dd = (c / c.cummax() - 1).min()
        rows.append(
            {
                "symbol": t,
                "returnPct": _r((c.iloc[-1] / c.iloc[0] - 1) * 100),
                "volatilityPct": _r(rets.std() * math.sqrt(252) * 100),
                "maxDrawdownPct": _r(dd * 100),
                "rsi14": _r(rsi(c).iloc[-1], 1),
                "rebased": [round(float(v / c.iloc[0] * 100), 2) for v in c],
            }
        )
        sources.append(market.YAHOO(t))
    best = max(rows, key=lambda x: x["returnPct"] or -1e9)
    return {
        "period": period,
        "rows": rows,
        "leader": best["symbol"],
        "sources": sources,
        "assumptions": [
            "Returns use closing prices; dividends are not included.",
            "Volatility is annualised from daily log returns (252 trading days).",
            "Max drawdown = largest peak-to-trough fall in the period.",
        ],
    }
