"""Tool registry: one place that defines every tool the AI may call.

The same functions are exposed by the MCP server (mcp_server/server.py), so the harness
can call them either through MCP or in-process (fallback).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from app.services import analysis, market


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
    ]
}


def register_tool(tool: Tool) -> None:
    """Used by later modules (e.g. the Python sandbox in Hissa C) to add tools."""
    TOOLS[tool.name] = tool


def call_local(name: str, args: dict[str, Any]) -> dict:
    tool = TOOLS[name]
    return tool.fn(**args)
