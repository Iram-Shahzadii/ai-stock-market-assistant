"""Tool gateway: calls tools through the MCP server when it is running,
otherwise in-process. Also enforces permissions (the harness 'policy')."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any

from app.config import settings
from app.harness.tools import TOOLS

log = logging.getLogger("harness.gateway")
BACKEND_DIR = Path(__file__).resolve().parents[2]

# Which permission levels the assistant is allowed to use without asking
ALLOWED_PERMISSIONS = {"read", "compute"}


class ToolError(Exception):
    pass


class ToolGateway:
    def __init__(self) -> None:
        self._stack: AsyncExitStack | None = None
        self._session = None
        self.mcp_tools: set[str] = set()
        self._lock = asyncio.Lock()

    @property
    def mcp_connected(self) -> bool:
        return self._session is not None

    async def start(self) -> None:
        if settings.mcp_mode == "off":
            log.info("MCP disabled (MCP_MODE=off); using in-process tools")
            return
        try:
            from mcp import ClientSession, StdioServerParameters
            from mcp.client.stdio import stdio_client

            params = StdioServerParameters(
                command=sys.executable,
                args=["-m", "mcp_server.server"],
                cwd=str(BACKEND_DIR),
                env={**os.environ, "PYTHONPATH": str(BACKEND_DIR)},
            )
            self._stack = AsyncExitStack()
            read, write = await self._stack.enter_async_context(stdio_client(params))
            session = await self._stack.enter_async_context(ClientSession(read, write))
            await asyncio.wait_for(session.initialize(), timeout=20)
            listed = await session.list_tools()
            self.mcp_tools = {t.name for t in listed.tools}
            self._session = session
            log.info("MCP connected: %s", sorted(self.mcp_tools))
        except Exception as e:  # noqa: BLE001
            log.warning("MCP server not available (%s); falling back to in-process tools", e)
            await self.stop()

    async def stop(self) -> None:
        if self._stack:
            try:
                await self._stack.aclose()
            except Exception:  # noqa: BLE001
                pass
        self._stack = None
        self._session = None

    def check_permission(self, name: str) -> None:
        tool = TOOLS.get(name)
        if tool is None:
            raise ToolError(f"Unknown tool: {name}")
        if tool.permission not in ALLOWED_PERMISSIONS:
            raise ToolError(f"Tool '{name}' needs '{tool.permission}' permission, which is not granted")

    async def call(self, name: str, args: dict[str, Any]) -> tuple[dict, str]:
        """Returns (result, transport) where transport is 'mcp' or 'local'."""
        self.check_permission(name)
        if self._session is not None and name in self.mcp_tools:
            async with self._lock:
                res = await self._session.call_tool(name, args)
            is_error = getattr(res, "is_error", None) or getattr(res, "isError", False)
            text = "".join(getattr(c, "text", "") for c in (res.content or []))
            if is_error:
                raise ToolError(text or f"{name} failed")
            structured = getattr(res, "structured_content", None) or getattr(res, "structuredContent", None)
            if isinstance(structured, dict) and structured:
                if set(structured) == {"result"} and isinstance(structured["result"], dict):
                    structured = structured["result"]
                data = structured
            else:
                try:
                    data = json.loads(text)
                except json.JSONDecodeError:
                    data = {"text": text}
            if isinstance(data, dict) and set(data) == {"error"}:
                raise ToolError(data["error"])
            return data, "mcp"
        try:
            return await asyncio.to_thread(TOOLS[name].fn, **args), "local"
        except TypeError as e:
            raise ToolError(f"Bad arguments for {name}: {e}") from e
        except Exception as e:  # noqa: BLE001
            raise ToolError(str(e)) from e


gateway = ToolGateway()
