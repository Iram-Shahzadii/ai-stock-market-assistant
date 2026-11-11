"""SMA crossover backtest: long when fast SMA > slow SMA, else cash.

inputs: closes, fast (20), slow (50)
"""
import pandas as pd


def run(inputs: dict) -> dict:
    c = pd.Series(inputs["closes"], dtype=float)
    fast, slow = int(inputs.get("fast", 20)), int(inputs.get("slow", 50))
    if len(c) < slow + 10:
        raise ValueError(f"Need more than {slow + 10} prices")
    signal = (c.rolling(fast).mean() > c.rolling(slow).mean()).astype(int).shift(1).fillna(0)
    daily = c.pct_change().fillna(0)
    strat = (1 + daily * signal).cumprod()
    hold = (1 + daily).cumprod()
    trades = int(signal.diff().abs().sum())
    return {
        "strategyReturnPct": round((strat.iloc[-1] - 1) * 100, 2),
        "buyHoldReturnPct": round((hold.iloc[-1] - 1) * 100, 2),
        "trades": trades,
        "timeInMarketPct": round(float(signal.mean()) * 100, 1),
        "strategyMaxDrawdownPct": round(float((strat / strat.cummax() - 1).min()) * 100, 2),
        "equity": [round(float(v), 4) for v in strat.iloc[:: max(1, len(strat) // 120)]],
        "assumptions": [f"SMA {fast}/{slow} crossover, trades at next close, no fees or slippage."],
    }
