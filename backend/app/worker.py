"""Celery worker (task queue = Redis).

Start it (from the backend folder):
    Windows:      celery -A app.worker worker --pool=solo --loglevel=info
    Docker/Linux: celery -A app.worker worker --loglevel=info --concurrency=2
"""
from __future__ import annotations

from celery import Celery

from app.config import settings
from app.jobs import store, tasks

celery_app = Celery("stock_assistant", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_acks_late=True,            # a crashed worker's job goes back to the queue
    worker_prefetch_multiplier=1,   # long jobs: take one at a time
    task_track_started=True,
    result_expires=24 * 3600,
    broker_connection_retry_on_startup=True,
)


@celery_app.task(bind=True, name="analysis.run", max_retries=3)
def run_analysis(self, job_id: str):
    try:
        tasks.execute(job_id, attempt=self.request.retries)
    except tasks.TransientError as e:
        if self.request.retries < self.max_retries:
            wait = 2 ** (self.request.retries + 1)
            store.update(job_id, status="retrying", retries=self.request.retries + 1, step=f"{e} — retry {self.request.retries + 1}/{self.max_retries} in {wait}s")
            raise self.retry(exc=e, countdown=wait) from e
        tasks.fail(job_id, f"{e} (after {self.max_retries} retries)")
    except Exception as e:  # noqa: BLE001
        tasks.fail(job_id, str(e))
    return job_id
