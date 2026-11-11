import os
import time

os.environ["MARKET_FAKE"] = "1"
os.environ["JOBS_MODE"] = "local"

import pytest  # noqa: E402
from app.config import settings  # noqa: E402
from app.services import sandbox  # noqa: E402

CLOSES = [100 + i * 0.3 + (i % 7) for i in range(300)]


def test_monte_carlo_in_sandbox():
    out = sandbox.run("monte_carlo", {"closes": CLOSES, "amount": 1000, "years": 1, "simulations": 500})
    r = out["result"]
    assert out["sandbox"] == "subprocess"
    assert r["final"]["p10"] <= r["final"]["p50"] <= r["final"]["p90"]
    assert len(r["p50"]) == r["steps"] + 1


def test_what_if_and_backtest():
    w = sandbox.run("what_if", {"closes": CLOSES, "amount": 1000, "shock_pct": -50})["result"]
    assert w["valueAfter"] == pytest.approx(500, rel=1e-3)
    b = sandbox.run("backtest_sma", {"closes": CLOSES})["result"]
    assert "strategyReturnPct" in b


@pytest.mark.parametrize(
    "code",
    ["import os\nresult = 1", "result = open('x').read()", "result = ().__class__", "import pandas as pd\nresult = pd.read_csv('x')", "x = 1"],
)
def test_sandbox_blocks_unsafe_code(code):
    with pytest.raises(sandbox.SandboxError):
        sandbox.run(code=code)


def test_sandbox_custom_code_ok():
    assert sandbox.run(code="import numpy as np\nresult = float(np.mean(inputs['x']))", inputs={"x": [1, 2, 3]})["result"] == 2.0


def test_sandbox_timeout(monkeypatch):
    monkeypatch.setattr(settings, "sandbox_timeout", 2)
    with pytest.raises(sandbox.SandboxError, match="Timeout"):
        sandbox.run(code="x = 0\nwhile True:\n    x += 1")


def _wait(job_id, store, seconds=20):
    for _ in range(seconds * 4):
        j = store.get(job_id)
        if j["status"] in {"success", "failed"}:
            return j
        time.sleep(0.25)
    raise AssertionError("job did not finish")


def test_jobs_progress_retry_and_saved_result(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    from app.jobs import manager, store

    ok = manager.submit("projection", {"ticker": "AAPL", "years": 1, "simulations": 300})
    flaky = manager.submit("what_if", {"ticker": "MSFT", "demo_fail_first": True})
    bad = manager.submit("backtest_sma", {"ticker": "not a ticker"})

    j = _wait(ok["id"], store)
    assert j["status"] == "success" and j["progress"] == 100 and j["result"]["summary"]
    f = _wait(flaky["id"], store)
    assert f["status"] == "success" and f["retries"] == 1  # failed once, retried automatically
    b = _wait(bad["id"], store)
    assert b["status"] == "failed" and b["retries"] == 0  # bad input is not retried
    assert {x["id"] for x in store.list_jobs()} >= {ok["id"], flaky["id"], bad["id"]}
    assert (tmp_path / "jobs" / f"{ok['id']}.json").exists()
