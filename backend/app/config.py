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
    # Sandbox: empty = run locally in an isolated subprocess; set to http://sandbox:8080 in Docker
    sandbox_url: str = os.getenv("SANDBOX_URL", "").strip()
    sandbox_timeout: int = int(os.getenv("SANDBOX_TIMEOUT", "30"))
    # Jobs: auto = Celery if Redis is reachable, else in-process worker threads
    jobs_mode: str = os.getenv("JOBS_MODE", "auto")
    data_dir: Path = Path(os.getenv("DATA_DIR", str(ROOT / "backend" / "data")))

    @property
    def ai_enabled(self) -> bool:
        return bool(self.gemini_api_key) and not self.gemini_api_key.startswith("your-")


settings = Settings()
