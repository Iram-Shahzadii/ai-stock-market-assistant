"""Saved job records: one JSON file per job in backend/data/jobs/.

Shared by the API, the Celery worker and the local worker, so progress, retries and
final results survive restarts and show up on the Analyses page.
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone

from app.config import settings

_lock = threading.Lock()


def _dir():
    d = settings.data_dir / "jobs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _path(job_id: str):
    if not job_id.replace("_", "").isalnum():
        raise KeyError(job_id)
    return _dir() / f"{job_id}.json"


def _write(job: dict) -> dict:
    p = _path(job["id"])
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(job, indent=1))
    os.replace(tmp, p)  # atomic
    return job


def create(job_type: str, params: dict, label: str, engine: str, max_retries: int = 3) -> dict:
    job = {
        "id": f"job_{uuid.uuid4().hex[:8]}",
        "type": job_type,
        "label": label,
        "params": params,
        "status": "queued",
        "progress": 0,
        "step": "Waiting for a worker",
        "retries": 0,
        "maxRetries": max_retries,
        "engine": engine,
        "created": _now(),
        "updated": _now(),
        "result": None,
        "error": None,
        "log": [],
    }
    return _write(job)


def get(job_id: str) -> dict:
    p = _path(job_id)
    if not p.exists():
        raise KeyError(job_id)
    return json.loads(p.read_text())


def update(job_id: str, **fields) -> dict:
    with _lock:
        job = get(job_id)
        job.update(fields)
        job["updated"] = _now()
        if "step" in fields:
            job["log"] = (job.get("log") or [])[-19:] + [f"{job['updated']} {fields['step']}"]
        return _write(job)


def list_jobs(limit: int = 50) -> list[dict]:
    jobs = []
    for p in sorted(_dir().glob("job_*.json"), key=lambda x: x.stat().st_mtime, reverse=True)[:limit]:
        try:
            j = json.loads(p.read_text())
            j.pop("log", None)
            if j.get("result"):
                j["result"] = {"summary": j["result"].get("summary")}  # keep list light
            jobs.append(j)
        except (json.JSONDecodeError, OSError):
            continue
    return jobs
