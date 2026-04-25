"""Sync layer between ``Schedule`` rows and RedBeat (Redis-backed cron).

Whenever a schedule is created, updated, paused or deleted, the API calls
into here so that the actual periodic-task entry in Redis matches the row
in the database. The dispatcher task ``schedule.run`` is what RedBeat fires
— see ``app.workers.tasks.schedule_tasks``.

We isolate ``redbeat`` imports here so the rest of the backend (and the
test suite) can keep working when Redis is not available; failures are
logged but not raised, mirroring the pattern used by ``_enqueue_run`` in
``executions/service.py``.
"""
from __future__ import annotations

from celery.schedules import crontab

from app.core.celery_app import celery_app
from app.core.logger import get_logger

log = get_logger("schedules.redbeat")

DISPATCH_TASK_NAME = "schedule.run"


def _redbeat_key(schedule_id: str) -> str:
    return f"qf_schedule:{schedule_id}"


def _crontab_from_expression(expression: str) -> crontab:
    """Translate a 5-field cron expression into a Celery ``crontab`` object."""
    parts = expression.strip().split()
    if len(parts) != 5:
        raise ValueError(f"Cron expression must have 5 fields, got: {expression!r}")
    minute, hour, day_of_month, month_of_year, day_of_week = parts
    return crontab(
        minute=minute,
        hour=hour,
        day_of_month=day_of_month,
        month_of_year=month_of_year,
        day_of_week=day_of_week,
    )


def upsert(schedule_id: str, *, cron_expression: str, timezone: str, enabled: bool) -> None:
    """Create or replace a RedBeat entry for ``schedule_id``."""
    try:
        from redbeat import RedBeatSchedulerEntry

        schedule = _crontab_from_expression(cron_expression)
        entry = RedBeatSchedulerEntry(
            name=_redbeat_key(schedule_id),
            task=DISPATCH_TASK_NAME,
            schedule=schedule,
            args=[schedule_id],
            app=celery_app,
            options={"queue": "default"},
        )
        # ``enabled`` exists on the entry meta; setting it to False keeps the
        # row in Redis but stops the scheduler from firing it.
        entry.enabled = bool(enabled)
        entry.save()
        log.info(
            "schedule.redbeat.upsert",
            schedule_id=schedule_id,
            enabled=enabled,
            cron=cron_expression,
            timezone=timezone,
        )
    except Exception as exc:
        log.warning(
            "schedule.redbeat.upsert_failed",
            schedule_id=schedule_id,
            error=str(exc),
        )


def remove(schedule_id: str) -> None:
    """Delete the RedBeat entry for ``schedule_id`` (idempotent)."""
    try:
        from redbeat import RedBeatSchedulerEntry

        entry = RedBeatSchedulerEntry.from_key(_redbeat_key(schedule_id), app=celery_app)
        entry.delete()
        log.info("schedule.redbeat.remove", schedule_id=schedule_id)
    except Exception as exc:
        log.debug(
            "schedule.redbeat.remove_skipped",
            schedule_id=schedule_id,
            error=str(exc),
        )
