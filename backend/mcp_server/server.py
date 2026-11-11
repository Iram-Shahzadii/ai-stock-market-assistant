"""MCP server: exposes market data + company information tools over stdio.

Run on its own (for testing with any MCP client):
    python -m mcp_server.server
The FastAPI harness starts it automatically as a subprocess.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:  # mcp >= 2
    from mcp.server.mcpserver import MCPServer as Server
except ImportError:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP as Server

import functools  # noqa: E402

from app.harness.tools import TOOLS  # noqa: E402


def _safe(fn):
    """Return {"error": ...} instead of crashing, so the client gets a clear message."""

    @functools.wraps(fn)
    def inner(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:  # noqa: BLE001
            return {"error": f"{type(e).__name__}: {e}"}

    return inner


server = Server(
    "market-data",
    instructions="US stock market data and company information (Yahoo Finance, SEC EDGAR links).",
)

for tool in TOOLS.values():
    if tool.via_mcp:
        server.add_tool(_safe(tool.fn), name=tool.name, description=tool.description)


if __name__ == "__main__":
    server.run("stdio")
