import os

os.environ["MARKET_FAKE"] = "1"  # offline synthetic data, no internet needed

import pandas as pd  # noqa: E402
import pytest  # noqa: E402

from app.harness.agent import _gemini_schema, build_extras, detect_tickers, split_assumptions  # noqa: E402
from app.services import analysis, market  # noqa: E402


def test_rsi_bounds_and_trend():
    s = pd.Series(range(1, 300), dtype=float)  # always rising
    assert analysis.rsi(s).iloc[-1] == pytest.approx(100)
    assert analysis.trend_label(300, 250, 150) == "uptrend"
    assert analysis.trend_label(100, 150, 250) == "downtrend"


def test_sma_and_macd():
    s = pd.Series([1.0, 2, 3, 4, 5])
    assert analysis.sma(s, 5).iloc[-1] == 3
    line, sig, hist = analysis.macd(pd.Series(range(100), dtype=float))
    assert hist.iloc[-1] == pytest.approx(line.iloc[-1] - sig.iloc[-1])


def test_technical_summary_has_sources_and_sma200():
    r = analysis.technical_summary("AAPL", "6mo")
    assert r["sma200"] is not None
    assert r["sources"] and r["assumptions"]
    assert len(r["recentCloses"]) == 120


def test_compare_needs_two():
    with pytest.raises(market.MarketDataError):
        analysis.compare(["AAPL"])
    r = analysis.compare(["AAPL", "MSFT"])
    assert r["leader"] in {"AAPL", "MSFT"}


def test_invalid_ticker_rejected():
    with pytest.raises(market.MarketDataError):
        market.normalize_ticker("rm -rf /")


def test_harness_helpers():
    body, a = split_assumptions("Text\n\nASSUMPTIONS:\n- one\n- two")
    assert body == "Text" and a == ["one", "two"]
    assert detect_tickers("compare apple with NVDA") == ["AAPL", "NVDA"]
    assert _gemini_schema({"type": "object", "properties": {"t": {"type": "string", "title": "x"}}}) == {
        "type": "OBJECT",
        "properties": {"t": {"type": "STRING"}},
    }
    tech = analysis.technical_summary("MSFT")
    extras = build_extras([{"name": "get_technical_indicators", "ok": True, "result": tech}])
    assert extras["table"] and extras["chart"]["type"] == "price" and extras["sources"]
