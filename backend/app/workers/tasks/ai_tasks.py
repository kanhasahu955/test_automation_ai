"""Async AI tasks (long-running prompt processing)."""
from __future__ import annotations

from app.core.celery_app import celery_app
from app.modules.ai_generator import service as ai_service
from app.workers.db import task_session


@celery_app.task(name="ai.generate_test_cases")
def generate_test_cases_async(requirement: str, count: int = 5, project_id: str | None = None,
                               user_id: str | None = None) -> dict:
    with task_session() as session:
        return ai_service.generate_test_cases(session, requirement, count, project_id, user_id)


@celery_app.task(name="ai.analyze_failure")
def analyze_failure_async(test_name: str, error_message: str, logs: str | None = None) -> dict:
    with task_session() as session:
        return ai_service.analyze_failure(session, test_name, error_message, logs)
