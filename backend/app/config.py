"""Settings read from the root .env file (never hard-code keys)."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    # "auto": try the MCP server, fall back to in-process tools. "off": in-process only.
    mcp_mode: str = os.getenv("MCP_MODE", "auto")
    max_tool_calls: int = int(os.getenv("MAX_TOOL_CALLS", "6"))
    cache_ttl_seconds: int = int(os.getenv("CACHE_TTL_SECONDS", "300"))

    @property
    def ai_enabled(self) -> bool:
        return bool(self.gemini_api_key) and not self.gemini_api_key.startswith("your-")


settings = Settings()
