"""What-if scenario: price shock + historical context.

inputs: closes, amount, shock_pct (e.g. -20), annual_return (for recovery estimate)
"""
import math

import numpy as np


def run(inputs: dict) -> dict:
    closes = np.asarray(inputs["closes"], dtype=float)
    price = float(closes[-1])
    amount = float(inputs.get("amount", 10000))
    shock = float(inputs.get("shock_pct", -20)) / 100
    mu = float(inputs.get("annual_return", 0.1))
    shares = amount / price
    new_price = price * (1 + shock)

    # how often has a move this big happened over ~1 month (21 trading days) historically?
    window = 21
    moves = closes[window:] / closes[:-window] - 1 if closes.size > window else np.array([])
    freq = float((moves <= shock).mean()) if shock < 0 and moves.size else float((moves >= shock).mean()) if moves.size else None
    dd = float((closes / np.maximum.accumulate(closes) - 1).min())
    recovery = math.log(1 / (1 + shock)) / mu if shock < 0 and mu > 0 else None

    return {
        "price": round(price, 2),
        "newPrice": round(new_price, 2),
        "shares": round(shares, 4),
        "valueBefore": round(amount, 2),
        "valueAfter": round(shares * new_price, 2),
        "pnl": round(shares * new_price - amount, 2),
        "historicalFrequency1m": None if freq is None else round(freq, 4),
        "worstDrawdownInData": round(dd * 100, 2),
        "recoveryYears": None if recovery is None else round(recovery, 2),
        "assumptions": [
            f"Instant {shock:+.0%} move from the last close {price:.2f}.",
            "Historical frequency = share of 21-day windows with a move at least this large.",
            f"Recovery time assumes {mu:.0%} yearly growth after the shock.",
        ],
    }
