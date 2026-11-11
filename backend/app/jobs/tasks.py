"""The actual analysis work for background jobs (engine independent).

Each job: 1) fetch market data  2) run the script in the sandbox  3) save the result.
"""
from __future__ import annotations

import time

from app.jobs import store
from app.services import analysis, market, sandbox

JOB_TYPES = {
    "projection": "Monte Carlo projection",
    "what_if": "What-if scenario",
    "backtest_sma": "Backtest SMA crossover",
    "compare": "Peer comparison",
}


class TransientError(Exception):
    """Temporary problem (network, data provider, sandbox busy) -> retry."""


class PermanentError(Exception):
    """Bad input -> do not retry."""


def label_for(job_type: str, params: dict) -> str:
    t = params.get("tickers") or [params.get("ticker", "?")]
    return f"{JOB_TYPES.get(job_type, job_type)} · {', '.join(t) if isinstance(t, list) else t}"


def _closes(ticker: str) -> list[float]:
    try:
        return [c["close"] for c in market.get_candles(ticker, "2y")]
    except market.MarketDataError as e:
        raise PermanentError(str(e)) from e
    except Exception as e:  # noqa: BLE001  network / rate limit
        raise TransientError(f"Data provider error: {e}") from e


def _sandbox(script: str, inputs: dict) -> dict:
    try:
        return sandbox.run(script=script, inputs=inputs)
    except sandbox.SandboxError as e:
        msg = str(e)
        if "unreachable" in msg or "Timeout" in msg:
            raise TransientError(msg) from e
        raise PermanentError(msg) from e


def execute(job_id: str, attempt: int = 0) -> dict:
    job = store.get(job_id)
    p, kind = job["params"], job["type"]
    store.update(job_id, status="running", retries=attempt, progress=10, step="Fetching price history", error=None)

    if p.get("demo_fail_first") and attempt == 0:
        time.sleep(1)
        raise TransientError("Simulated data-provider timeout (demo of automatic retry)")

    if kind == "compare":
        try:
            res = analysis.compare(p["tickers"], p.get("period", "1y"))
        except market.MarketDataError as e:
            raise PermanentError(str(e)) from e
        except Exception as e:  # noqa: BLE001
            raise TransientError(str(e)) from e
        store.update(job_id, progress=80, step="Computing statistics")
        lead = next(r for r in res["rows"] if r["symbol"] == res["leader"])
        res["summary"] = f"{res['leader']} led with {lead['returnPct']}% over {res['period']}"
        return _finish(job_id, res, "backend")

    ticker = market.normalize_ticker(p["ticker"])
    closes = _closes(ticker)
    store.update(job_id, progress=40, step=f"Running {kind} script in sandbox ({sandbox.mode()})")

    if kind == "projection":
        out = _sandbox("monte_carlo", {"closes": closes, "amount": p.get("amount", 10000), "years": p.get("years", 3), "simulations": p.get("simulations", 5000), "annual_return": p.get("annual_return")})
        r = out["result"]
        r["summary"] = f"Median value after {p.get('years', 3)}y: ${r['final']['p50']:,.0f} (10–90%: ${r['final']['p10']:,.0f}–${r['final']['p90']:,.0f})"
    elif kind == "what_if":
        out = _sandbox("what_if", {"closes": closes, "amount": p.get("amount", 10000), "shock_pct": p.get("shock_pct", -20), "annual_return": p.get("annual_return", 0.1)})
        r = out["result"]
        r["summary"] = f"{p.get('shock_pct', -20)}% shock → P/L ${r['pnl']:,.0f}"
    elif kind == "backtest_sma":
        out = _sandbox("backtest_sma", {"closes": closes, "fast": p.get("fast", 20), "slow": p.get("slow", 50)})
        r = out["result"]
        r["summary"] = f"Strategy {r['strategyReturnPct']}% vs buy & hold {r['buyHoldReturnPct']}%"
    else:
        raise PermanentError(f"Unknown job type: {kind}")

    store.update(job_id, progress=85, step="Saving result")
    r["sources"] = [market.YAHOO(ticker)]
    return _finish(job_id, r, out["sandbox"])


def _finish(job_id: str, result: dict, sandbox_mode: str) -> dict:
    return store.update(job_id, status="success", progress=100, step="Saved result", result=result, sandbox=sandbox_mode)


def fail(job_id: str, error: str) -> dict:
    return store.update(job_id, status="failed", step=f"Failed: {error}"[:200], error=error)
