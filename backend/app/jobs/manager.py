"""Submits jobs to Celery (if Redis is up) or to a local thread worker (fallback).

The local worker follows the same rules: progress updates, 3 retries with backoff,
saved results - so the demo works even without Docker/Redis.
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor

from app.config import settings
from app.jobs import store, tasks

log = logging.getLogger("jobs")
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="local-worker")
_engine_cache: tuple[float, str] | None = None


def engine() -> str:
    """'celery' when Redis answers, otherwise 'local'. Cached for 30 seconds."""
    global _engine_cache
    if settings.jobs_mode == "local":
        return "local"
    if _engine_cache and time.time() - _engine_cache[0] < 30:
        return _engine_cache[1]
    eng = "local"
    try:
        import redis

        redis.Redis.from_url(settings.redis_url, socket_connect_timeout=0.5, socket_timeout=0.5).ping()
        import app.worker  # noqa: F401  (celery installed?)

        eng = "celery"
    except Exception as e:  # noqa: BLE001
        if settings.jobs_mode == "celery":
            log.warning("JOBS_MODE=celery but Redis/Celery not available: %s", e)
    _engine_cache = (time.time(), eng)
    return eng


def submit(job_type: str, params: dict) -> dict:
    if job_type not in tasks.JOB_TYPES:
        raise ValueError(f"Unknown job type. Use one of: {', '.join(tasks.JOB_TYPES)}")
    eng = engine()
    job = store.create(job_type, params, tasks.label_for(job_type, params), eng)
    _dispatch(job["id"], eng)
    return job


def retry(job_id: str) -> dict:
    job = store.get(job_id)
    if job["status"] not in {"failed", "success"}:
        raise ValueError("Only finished jobs can be retried")
    eng = engine()
    store.update(job_id, status="queued", progress=0, step="Manual retry queued", error=None, result=None, engine=eng,
                 params={**job["params"], "demo_fail_first": False})
    _dispatch(job_id, eng)
    return store.get(job_id)


def _dispatch(job_id: str, eng: str) -> None:
    if eng == "celery":
        from app.worker import run_analysis

        run_analysis.delay(job_id)
    else:
        _pool.submit(_run_local, job_id)


def _run_local(job_id: str, max_retries: int = 3) -> None:
    for attempt in range(max_retries + 1):
        try:
            tasks.execute(job_id, attempt=attempt)
            return
        except tasks.TransientError as e:
            if attempt < max_retries:
                wait = 2 ** (attempt + 1)
                store.update(job_id, status="retrying", retries=attempt + 1, step=f"{e} — retry {attempt + 1}/{max_retries} in {wait}s")
                time.sleep(wait)
                continue
            tasks.fail(job_id, f"{e} (after {max_retries} retries)")
        except Exception as e:  # noqa: BLE001
            tasks.fail(job_id, str(e))
            return
