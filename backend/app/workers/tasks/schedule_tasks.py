"""Celery dispatcher task for scheduled executions.

RedBeat is configured (via ``app.modules.schedules.redbeat_sync``) to call
``schedule.run`` with the schedule id whenever a schedule fires. The task
loads the row, asserts it is still active, and launches the appropriate
ExecutionRun via the schedules service. The actual test execution happens
in the queue-specific tasks (``execution.run``, ``stm.run_validation``, …).
"""
from __future__ import annotations

from app.core.celery_app import celery_app
from app.core.logger import get_logger
from app.modules.schedules import service as schedule_service
from app.workers.db import task_session

log = get_logger("schedule.tasks")


@celery_app.task(name="schedule.run", bind=True, max_retries=2)
def run_scheduled(self, schedule_id: str) -> dict:
    """Fire the schedule with id ``schedule_id``."""
    log.info("schedule.fired", schedule_id=schedule_id)
    try:
        with task_session() as session:
            return schedule_service.dispatch(session, schedule_id)
    except Exception as exc:
        log.warning("schedule.error", schedule_id=schedule_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60) from exc
