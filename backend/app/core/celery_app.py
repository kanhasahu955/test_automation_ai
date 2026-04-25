"""Celery application factory.

The Celery app uses **RedBeat** as its scheduler so that periodic tasks can
be created, edited and removed at runtime through the Schedules API. RedBeat
stores its state in the same Redis instance we already use as the broker, so
no extra infrastructure is required.

Beat must be launched with the RedBeat scheduler:

    celery -A app.core.celery_app.celery_app beat \
        --scheduler redbeat.RedBeatScheduler -l info

(see ``docker-compose.yml`` for the production wiring).
"""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "qualityforge",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.execution_tasks",
        "app.workers.tasks.ai_tasks",
        "app.workers.tasks.stm_tasks",
        "app.workers.tasks.profiling_tasks",
        "app.workers.tasks.metadata_tasks",
        "app.workers.tasks.schedule_tasks",
    ],
)

celery_app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_default_queue="default",
    task_routes={
        "execution.*": {"queue": "executions"},
        "ai.*": {"queue": "ai"},
        "stm.*": {"queue": "stm"},
        "profiling.*": {"queue": "profiling"},
        "metadata.*": {"queue": "metadata"},
        "schedule.*": {"queue": "default"},
    },
    # ---- RedBeat (dynamic schedules backed by Redis) -----------------------
    redbeat_redis_url=settings.CELERY_BROKER_URL,
    # All RedBeat keys share this prefix for easy ops/inspection.
    redbeat_key_prefix="qf:redbeat:",
    # How long the beat scheduler holds the leader lock between heartbeats.
    redbeat_lock_timeout=60,
)
