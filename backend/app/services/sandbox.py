"""Client for the isolated Python sandbox.

- Docker (docker compose): POST to the sandbox container (no internet, read-only, limited CPU/RAM).
- Local dev (no Docker): run sandbox/runner.py in a separate `python -I` process with a timeout.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from app.config import ROOT, settings

RUNNER = ROOT / "sandbox" / "runner.py"


class SandboxError(Exception):
    pass


def mode() -> str:
    return "docker" if settings.sandbox_url else "subprocess"


def run(script: str | None = None, inputs: dict | None = None, code: str | None = None) -> dict:
    req = {"script": script, "code": code, "inputs": inputs or {}}
    if settings.sandbox_url:
        import httpx

        try:
            r = httpx.post(f"{settings.sandbox_url.rstrip('/')}/run", json=req, timeout=settings.sandbox_timeout + 5)
            r.raise_for_status()
            out = r.json()
        except httpx.HTTPError as e:
            raise SandboxError(f"Sandbox service unreachable: {e}") from e
    else:
        out = _run_subprocess(req)
    if not out.get("ok"):
        raise SandboxError(out.get("error", "Sandbox failed"))
    return {"result": out["result"], "ms": out.get("ms"), "sandbox": mode()}


def _run_subprocess(req: dict) -> dict:
    if not RUNNER.exists():
        raise SandboxError(f"Sandbox runner not found at {RUNNER}")
    env = {k: v for k, v in os.environ.items() if k in {"PATH", "SYSTEMROOT", "TEMP", "TMP"}}  # no API keys inside
    env["OPENBLAS_NUM_THREADS"] = "1"
    try:
        p = subprocess.run(
            [sys.executable, "-I", str(RUNNER)],
            input=json.dumps(req).encode(),
            capture_output=True,
            timeout=settings.sandbox_timeout,
            env=env,
            cwd=str(Path(RUNNER).parent),
        )
    except subprocess.TimeoutExpired as e:
        raise SandboxError(f"Timeout: script ran longer than {settings.sandbox_timeout}s") from e
    if not p.stdout:
        raise SandboxError(p.stderr.decode(errors="replace")[-500:] or "Sandbox crashed")
    return json.loads(p.stdout)
