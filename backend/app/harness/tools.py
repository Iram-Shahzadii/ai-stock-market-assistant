"""Tool registry: one place that defines every tool the AI may call.

The same functions are exposed by the MCP server (mcp_server/server.py), so the harness
can call them either through MCP or in-process (fallback).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from app.services import analysis, market, sandbox


# ---- tool functions (typed, so MCP can build JSON schemas from them) ----
def get_quote(ticker: str) -> dict:
    """Latest price, daily change and volume for a US stock ticker (e.g. AAPL)."""
    return market.get_quote(ticker)


def get_company_profile(ticker: str) -> dict:
    """Company name, sector, industry, country, employees and a short business summary."""
    return market.get_company_profile(ticker)


def get_technical_indicators(ticker: str, period: str = "1y") -> dict:
    """Technical analysis: SMA 20/50/200, RSI 14, MACD, trend, volume, volatility, 52-week range.
    period: one of 1mo, 3mo, 6mo, 1y, 2y, 5y."""
    return analysis.technical_summary(ticker, period)


def get_fundamentals(ticker: str) -> dict:
    """Fundamental analysis: valuation ratios (P/E, P/B, P/S, EV/EBITDA), margins, ROE,
    debt/equity, last 4 years of income statement and recent earnings vs estimates."""
    return market.get_fundamentals(ticker)


def compare_stocks(tickers: list[str], period: str = "1y") -> dict:
    """Compare 2-5 tickers: period return, annualised volatility, max drawdown and RSI."""
    return analysis.compare(tickers, period)


# ---- compute tools: run Python in the isolated sandbox ----
def _closes(ticker: str) -> list[float]:
    return [c["close"] for c in market.get_candles(market.normalize_ticker(ticker), "2y")]


def _with_meta(out: dict, ticker: str | None) -> dict:
    r = out["result"] if isinstance(out["result"], dict) else {"value": out["result"]}
    r["sandbox"] = out["sandbox"]
    r["sources"] = [market.YAHOO(ticker.upper())] if ticker else []
    if ticker:
        r["symbol"] = ticker.upper()
    return r


def run_projection(ticker: str, amount: float = 10000, years: float = 3, annual_return: float | None = None) -> dict:
    """Monte Carlo projection of an investment (5,000 simulated price paths) in the Python sandbox.
    Returns 10th/50th/90th percentile values and probability of loss. annual_return as a decimal
    (0.1 = 10%); leave empty to use the stock's historical return."""
    out = sandbox.run("monte_carlo", {"closes": _closes(ticker), "amount": amount, "years": years, "simulations": 5000, "annual_return": annual_return})
    return _with_meta(out, ticker)


def run_what_if(ticker: str, shock_pct: float = -20, amount: float = 10000, annual_return: float = 0.1) -> dict:
    """What-if scenario in the sandbox: effect of a sudden price move (shock_pct, e.g. -20) on a
    position, how often such moves happened historically, and estimated recovery time."""
    out = sandbox.run("what_if", {"closes": _closes(ticker), "shock_pct": shock_pct, "amount": amount, "annual_return": annual_return})
    return _with_meta(out, ticker)


def run_backtest(ticker: str, fast: int = 20, slow: int = 50) -> dict:
    """Backtest an SMA crossover strategy (fast/slow days) vs buy-and-hold over 2 years, in the sandbox."""
    out = sandbox.run("backtest_sma", {"closes": _closes(ticker), "fast": fast, "slow": slow})
    r = _with_meta(out, ticker)
    r.pop("equity", None)
    return r


def run_python(code: str, ticker: str | None = None) -> dict:
    """Run a short custom Python calculation in the isolated sandbox. Allowed imports: math,
    statistics, numpy, pandas, json, datetime, random. If ticker is given, `inputs["closes"]` holds
    ~2 years of daily closing prices. The code MUST assign its answer to a variable named `result`."""
    inputs = {"closes": _closes(ticker)} if ticker else {}
    out = sandbox.run(code=code, inputs=inputs)
    r = _with_meta(out, ticker)
    r["assumptions"] = ["Custom calculation executed in the isolated Python sandbox."]
    return r


# ---- registry with permissions ----
@dataclass
class Tool:
    name: str
    fn: Callable[..., dict]
    description: str
    parameters: dict
    permission: str = "read"  # read = market data, compute = runs code in the sandbox
    via_mcp: bool = True
    tags: list[str] = field(default_factory=list)


T = {"type": "string", "description": "US stock ticker symbol, e.g. AAPL"}
P = {"type": "string", "enum": ["1mo", "3mo", "6mo", "1y", "2y", "5y"], "description": "Lookback period"}

TOOLS: dict[str, Tool] = {
    t.name: t
    for t in [
        Tool("get_quote", get_quote, get_quote.__doc__, {"type": "object", "properties": {"ticker": T}, "required": ["ticker"]}),
        Tool("get_company_profile", get_company_profile, get_company_profile.__doc__, {"type": "object", "properties": {"ticker": T}, "required": ["ticker"]}),
        Tool("get_technical_indicators", get_technical_indicators, get_technical_indicators.__doc__, {"type": "object", "properties": {"ticker": T, "period": P}, "required": ["ticker"]}),
        Tool("get_fundamentals", get_fundamentals, get_fundamentals.__doc__, {"type": "object", "properties": {"ticker": T}, "required": ["ticker"]}),
        Tool(
            "compare_stocks",
            compare_stocks,
            compare_stocks.__doc__,
            {"type": "object", "properties": {"tickers": {"type": "array", "items": T, "description": "2 to 5 tickers"}, "period": P}, "required": ["tickers"]},
        ),
        Tool("run_projection", run_projection, run_projection.__doc__, {"type": "object", "properties": {"ticker": T, "amount": {"type": "number", "description": "Investment in USD"}, "years": {"type": "number", "description": "Horizon in years (1-10)"}, "annual_return": {"type": "number", "description": "Expected yearly return as decimal, optional"}}, "required": ["ticker"]}, permission="compute", via_mcp=False),
        Tool("run_what_if", run_what_if, run_what_if.__doc__, {"type": "object", "properties": {"ticker": T, "shock_pct": {"type": "number", "description": "Price move in percent, e.g. -20"}, "amount": {"type": "number"}, "annual_return": {"type": "number"}}, "required": ["ticker"]}, permission="compute", via_mcp=False),
        Tool("run_backtest", run_backtest, run_backtest.__doc__, {"type": "object", "properties": {"ticker": T, "fast": {"type": "integer"}, "slow": {"type": "integer"}}, "required": ["ticker"]}, permission="compute", via_mcp=False),
        Tool("run_python", run_python, run_python.__doc__, {"type": "object", "properties": {"code": {"type": "string", "description": "Python code that sets `result`"}, "ticker": T}, "required": ["code"]}, permission="compute", via_mcp=False),
    ]
}


def register_tool(tool: Tool) -> None:
    """Used by later modules (e.g. the Python sandbox in Hissa C) to add tools."""
    TOOLS[tool.name] = tool


def call_local(name: str, args: dict[str, Any]) -> dict:
    tool = TOOLS[name]
    return tool.fn(**args)
