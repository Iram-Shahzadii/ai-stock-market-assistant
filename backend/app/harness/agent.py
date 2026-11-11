"""AI harness: coordinates the model, context, permissions and the analysis workflow.

Workflow for one chat turn:
  1. Build context  (system prompt + recent history + user message)
  2. Model plans and requests tool calls (Gemini function calling)
  3. Gateway checks permission and runs each tool (via MCP or in-process)
  4. Results go back to the model; repeat until it answers (max N tool calls)
  5. Harness attaches sources, assumptions, a table and chart data from the tool results
"""
from __future__ import annotations

import asyncio
import copy
import datetime as dt
import logging
import re
import time
from typing import Any

from app.config import settings
from app.harness.gateway import ToolError, gateway
from app.harness.tools import TOOLS

log = logging.getLogger("harness.agent")

SYSTEM_PROMPT = """You are Sovereign, an AI stock market assistant for US stocks.
Today is {today}.

Rules:
- Always use the tools to get prices, indicators and financials. Never invent numbers.
- If the user does not name a ticker, ask which one (or use the one from the recent conversation).
- Explain clearly for beginners: say what each indicator means in one short phrase.
- Be concise: 2-4 short paragraphs or a few bullet points. Use **bold** for key numbers.
- Mention risks. This is educational analysis, not financial advice.
- Finish with a line "ASSUMPTIONS:" followed by 1-4 bullet points ("- ...") listing the
  assumptions behind your answer (time period, data source, method).
"""

# Large arrays are useful for charts but waste model tokens
HIDDEN_KEYS = {"recentCloses", "rebased"}
TICKER_WORD = re.compile(r"\b[A-Z]{1,5}\b")
NAME_TO_TICKER = {"APPLE": "AAPL", "MICROSOFT": "MSFT", "NVIDIA": "NVDA", "TESLA": "TSLA", "AMAZON": "AMZN", "GOOGLE": "GOOGL", "ALPHABET": "GOOGL", "META": "META", "NETFLIX": "NFLX"}
STOPWORDS = {"I", "A", "AN", "THE", "IS", "IT", "OF", "TO", "VS", "AND", "OR", "PE", "RSI", "MACD", "SMA", "EMA", "EPS", "IF", "US", "USD", "AI", "ME", "MY", "ON", "IN", "AT", "BE", "DO", "SO", "UP", "WHAT", "HOW", "WHY"}


def _for_model(result: dict) -> dict:
    r = copy.deepcopy(result)
    if isinstance(r, dict):
        for k in HIDDEN_KEYS:
            r.pop(k, None)
        for row in r.get("rows", []) if isinstance(r.get("rows"), list) else []:
            for k in HIDDEN_KEYS:
                row.pop(k, None)
    return r


def _gemini_schema(s: Any) -> Any:
    """JSON schema -> Gemini schema (UPPERCASE types, only supported keys)."""
    if isinstance(s, dict):
        out = {}
        for k, v in s.items():
            if k == "type":
                out[k] = str(v).upper()
            elif k in {"properties"}:
                out[k] = {pk: _gemini_schema(pv) for pk, pv in v.items()}
            elif k in {"items"}:
                out[k] = _gemini_schema(v)
            elif k in {"description", "enum", "required"}:
                out[k] = v
        return out
    return s


def split_assumptions(text: str) -> tuple[str, list[str]]:
    m = re.search(r"\n?\s*\**ASSUMPTIONS:?\**\s*:?\s*\n?", text, flags=re.IGNORECASE)
    if not m:
        return text.strip(), []
    body, tail = text[: m.start()].strip(), text[m.end():]
    items = [re.sub(r"^\s*[-*•]\s*", "", ln).strip() for ln in tail.splitlines()]
    return body, [i for i in items if i]


def detect_tickers(message: str, history: list[dict] | None = None) -> list[str]:
    up = message.upper()
    found = [NAME_TO_TICKER[n] for n in NAME_TO_TICKER if n in up]
    found += [w for w in TICKER_WORD.findall(message) if w not in STOPWORDS]
    if not found and history:
        for h in reversed(history):
            if h.get("ticker"):
                found = [h["ticker"]]
                break
    seen, out = set(), []
    for t in found:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:5]


def build_extras(calls: list[dict]) -> dict:
    """Sources, default assumptions, a table and chart data from tool results."""
    sources, assumptions, table, chart, ticker = [], [], None, None, None
    seen = set()
    for c in calls:
        r = c.get("result") or {}
        for s in r.get("sources", []):
            if s["url"] not in seen:
                seen.add(s["url"])
                sources.append(s)
        assumptions += [a for a in r.get("assumptions", []) if a not in assumptions]
        ticker = ticker or r.get("symbol")

    by_name = {c["name"]: c.get("result") for c in calls if c.get("ok")}
    tech, fund, comp, quote = (by_name.get(k) for k in ("get_technical_indicators", "get_fundamentals", "compare_stocks", "get_quote"))
    if comp:
        table = {
            "columns": ["Ticker", "Return %", "Volatility %", "Max drawdown %", "RSI 14"],
            "rows": [[r["symbol"], r["returnPct"], r["volatilityPct"], r["maxDrawdownPct"], r["rsi14"]] for r in comp["rows"]],
        }
        chart = {"type": "compare", "series": [{"name": r["symbol"], "values": r["rebased"]} for r in comp["rows"]]}
    elif tech:
        rows = [["Price", tech["price"]], ["Trend", tech["trend"]], ["RSI 14", tech["rsi14"]], ["MACD hist", tech["macdHist"]], ["SMA 50", tech["sma50"]], ["SMA 200", tech["sma200"]]]
        if fund:
            rows += [["P/E", fund.get("pe")], ["Net margin %", fund.get("netMargin")]]
        table = {"columns": ["Metric", "Value"], "rows": rows}
        chart = {"type": "price", "symbol": tech["symbol"], "points": tech["recentCloses"]}
    elif fund:
        table = {
            "columns": ["Metric", "Value"],
            "rows": [["Market cap", fund.get("marketCap")], ["P/E", fund.get("pe")], ["Forward P/E", fund.get("forwardPe")], ["Gross margin %", fund.get("grossMargin")], ["Net margin %", fund.get("netMargin")], ["Debt/Equity", fund.get("debtToEquity")]],
        }
    elif quote:
        table = {"columns": ["Metric", "Value"], "rows": [["Price", quote["price"]], ["Change %", quote["changePct"]], ["Volume", quote["volume"]]]}
    return {"sources": sources, "assumptions": assumptions, "table": table, "chart": chart, "ticker": ticker}


async def _run_tool(name: str, args: dict, calls: list[dict]) -> dict:
    t0 = time.perf_counter()
    entry = {"name": name, "args": args}
    try:
        if len(calls) >= settings.max_tool_calls:
            raise ToolError(f"Tool budget reached ({settings.max_tool_calls} calls per answer)")
        result, transport = await gateway.call(name, args)
        entry.update(ok=True, result=result, transport=transport)
        payload = _for_model(result)
    except Exception as e:  # noqa: BLE001
        entry.update(ok=False, error=str(e), transport="-")
        payload = {"error": str(e)}
    entry["ms"] = int((time.perf_counter() - t0) * 1000)
    calls.append(entry)
    return payload


def _public_calls(calls: list[dict]) -> list[dict]:
    return [{k: c.get(k) for k in ("name", "args", "ok", "transport", "ms", "error")} for c in calls]


# ---------------- Gemini path ----------------
async def _run_gemini(message: str, history: list[dict]) -> tuple[str, list[dict]]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    decls = [
        types.FunctionDeclaration(name=t.name, description=t.description.strip(), parameters=_gemini_schema(t.parameters))
        for t in TOOLS.values()
    ]
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT.format(today=dt.date.today().isoformat()),
        tools=[types.Tool(function_declarations=decls)],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.3,
    )
    contents: list = []
    for h in history[-10:]:  # short-term context window
        role = "user" if h.get("role") == "user" else "model"
        text = h.get("content") or ""
        if text:
            contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    calls: list[dict] = []
    for _ in range(settings.max_tool_calls + 1):
        resp = await asyncio.to_thread(client.models.generate_content, model=settings.gemini_model, contents=contents, config=config)
        fcs = resp.function_calls or []
        if not fcs:
            return (resp.text or "").strip(), calls
        contents.append(resp.candidates[0].content)
        parts = []
        for fc in fcs:
            payload = await _run_tool(fc.name, dict(fc.args or {}), calls)
            parts.append(types.Part.from_function_response(name=fc.name, response={"result": payload}))
        contents.append(types.Content(role="user", parts=parts))
    return "I reached the tool-call limit before finishing. Here is what I found so far.", calls


# ---------------- No-key / error fallback (rule-based) ----------------
async def _run_rules(message: str, history: list[dict]) -> tuple[str, list[dict]]:
    calls: list[dict] = []
    tickers = detect_tickers(message, history) or ["AAPL"]
    low = message.lower()
    if len(tickers) >= 2 or "compare" in low:
        if len(tickers) < 2:
            tickers = tickers + ["MSFT" if tickers[0] != "MSFT" else "AAPL"]
        r = await _run_tool("compare_stocks", {"tickers": tickers}, calls)
        if "error" in r:
            return f"I could not load the data: {r['error']}", calls
        rows = sorted(r["rows"], key=lambda x: x["returnPct"] or 0, reverse=True)
        lines = [f"- **{x['symbol']}**: {x['returnPct']}% return, {x['volatilityPct']}% volatility, max drawdown {x['maxDrawdownPct']}%" for x in rows]
        return f"Over the last year **{r['leader']}** performed best.\n\n" + "\n".join(lines), calls

    t = tickers[0]
    tech = await _run_tool("get_technical_indicators", {"ticker": t}, calls)
    if "error" in tech:
        return f"I could not load data for {t}: {tech['error']}", calls
    fund = await _run_tool("get_fundamentals", {"ticker": t}, calls)
    zone = {"overbought": "overbought (it has risen fast; pullback risk)", "oversold": "oversold (it has fallen fast; possible bounce)"}.get(tech["rsiZone"], "neutral")
    text = (
        f"**{t}** closed at **{tech['price']}** ({tech['periodReturnPct']}% over 1 year). "
        f"The trend is **{tech['trend']}** (price vs 50-day vs 200-day moving average).\n\n"
        f"RSI(14) is **{tech['rsi14']}**, which is {zone}. MACD histogram is {tech['macdHist']} "
        f"({'positive' if (tech['macdHist'] or 0) >= 0 else 'negative'} momentum). "
        f"Annual volatility is about {tech['volatilityAnnualPct']}%."
    )
    if "error" not in fund and fund.get("pe"):
        text += f"\n\nOn valuation, P/E is **{fund['pe']}x** and net margin is {fund.get('netMargin')}%."
    text += "\n\n_AI model not configured, so this is an automatic summary. Add GEMINI_API_KEY to .env for full answers._"
    return text, calls


async def run_chat(message: str, history: list[dict] | None = None) -> dict:
    history = history or []
    mode = "gemini" if settings.ai_enabled else "rules"
    note = None
    try:
        if mode == "gemini":
            text, calls = await _run_gemini(message, history)
        else:
            text, calls = await _run_rules(message, history)
    except Exception as e:  # noqa: BLE001  (quota, network, bad key...)
        log.exception("Model call failed")
        note = f"AI model error ({type(e).__name__}); showing automatic summary instead."
        mode = "rules"
        text, calls = await _run_rules(message, history)

    body, model_assumptions = split_assumptions(text)
    extras = build_extras(calls)
    assumptions = model_assumptions + [a for a in extras["assumptions"] if a not in model_assumptions]
    assumptions.append("Educational analysis only, not financial advice.")
    if note:
        body = f"_{note}_\n\n{body}"
    return {
        "text": [p for p in body.split("\n\n") if p.strip()],
        "table": extras["table"],
        "chart": extras["chart"],
        "ticker": extras["ticker"],
        "sources": extras["sources"],
        "assumptions": assumptions,
        "tools": _public_calls(calls),
        "mode": mode,
        "mcp": gateway.mcp_connected,
    }
