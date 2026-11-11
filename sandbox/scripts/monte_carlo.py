"""Monte Carlo price projection (geometric Brownian motion).

inputs: closes (list[float]), amount, years, simulations, annual_return (optional, else historical)
"""
import numpy as np


def run(inputs: dict) -> dict:
    closes = np.asarray(inputs["closes"], dtype=float)
    if closes.size < 30:
        raise ValueError("Need at least 30 closing prices")
    amount = float(inputs.get("amount", 10000))
    years = float(inputs.get("years", 3))
    sims = int(min(max(int(inputs.get("simulations", 5000)), 100), 20000))
    rets = np.diff(np.log(closes[-252:]))
    sigma = float(rets.std() * np.sqrt(252))
    hist_mu = float(rets.mean() * 252 + sigma**2 / 2)
    mu = float(inputs["annual_return"]) if inputs.get("annual_return") is not None else hist_mu

    steps = max(12, int(round(years * 12)))  # monthly steps
    dt = years / steps
    rng = np.random.default_rng(int(inputs.get("seed", 42)))
    shocks = rng.standard_normal((sims, steps))
    log_paths = np.cumsum((mu - sigma**2 / 2) * dt + sigma * np.sqrt(dt) * shocks, axis=1)
    values = amount * np.exp(np.hstack([np.zeros((sims, 1)), log_paths]))

    pct = {p: np.percentile(values, p, axis=0).round(2).tolist() for p in (10, 50, 90)}
    final = values[:, -1]
    return {
        "method": "Monte Carlo (geometric Brownian motion)",
        "simulations": sims,
        "steps": steps,
        "annualReturnUsed": round(mu, 4),
        "annualVolatility": round(sigma, 4),
        "p10": pct[10],
        "p50": pct[50],
        "p90": pct[90],
        "final": {
            "p10": round(float(np.percentile(final, 10)), 2),
            "p50": round(float(np.percentile(final, 50)), 2),
            "p90": round(float(np.percentile(final, 90)), 2),
            "mean": round(float(final.mean()), 2),
            "probLoss": round(float((final < amount).mean()), 4),
        },
        "assumptions": [
            f"{sims:,} simulated paths, monthly steps over {years:g} years.",
            f"Annual volatility {sigma:.1%} from the last year of daily returns.",
            f"Expected annual return {mu:.1%} ({'user input' if inputs.get('annual_return') is not None else 'historical'}).",
            "No dividends, fees or taxes; returns are log-normal.",
        ],
    }
