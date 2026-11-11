"""Tiny HTTP front for the sandbox container (stdlib only).

POST /run  body = runner request JSON  -> runner response JSON
Each request runs runner.py in a fresh subprocess with a hard timeout.
The container itself has no internet access (internal Docker network), a read-only
filesystem, a non-root user and CPU / memory / process limits (see docker-compose.yml).
"""
import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RUNNER = Path(__file__).resolve().parent / "runner.py"
TIMEOUT = int(os.getenv("SANDBOX_TIMEOUT", "30"))
MAX_BODY = 2_000_000


def run_isolated(body: bytes) -> dict:
    try:
        p = subprocess.run(
            [sys.executable, "-I", str(RUNNER)],
            input=body,
            capture_output=True,
            timeout=TIMEOUT,
            env={"PATH": os.getenv("PATH", ""), "HOME": "/tmp", "OPENBLAS_NUM_THREADS": "1"},
            cwd="/tmp",
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"Timeout: script ran longer than {TIMEOUT}s"}
    if not p.stdout:
        return {"ok": False, "error": (p.stderr.decode(errors="replace")[-500:] or "Sandbox crashed")}
    return json.loads(p.stdout)


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        data = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802
        self._send(200, {"status": "ok"} if self.path == "/health" else {"error": "not found"})

    def do_POST(self):  # noqa: N802
        if self.path != "/run":
            return self._send(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length", 0))
        if n > MAX_BODY:
            return self._send(413, {"ok": False, "error": "Request too large"})
        self._send(200, run_isolated(self.rfile.read(n)))

    def log_message(self, fmt, *args):
        sys.stderr.write("sandbox: " + fmt % args + "\n")


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
