"""Regression detection.

A *regression* is a test case whose latest **finished** execution result is a
failure (``FAILED`` or ``ERROR``) **and** whose previous execution result for
the same test case was ``PASSED``.

We compute it in pure Python over the last *N* finished runs of a project so
the algorithm works the same on MySQL and SQLite (used in tests). The cost is
``O(N * results_per_run)`` which is fine for the dashboard pull-size.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Session, select

from app.modules.executions.models import (
    ExecutionResult,
    ExecutionRun,
    ResultStatus,
    RunStatus,
)
from app.modules.reports.schemas import RegressionItem
from app.modules.test_cases.models import TestCase

if TYPE_CHECKING:
    pass


_FAILURE_STATUSES = {ResultStatus.FAILED, ResultStatus.ERROR}
_FINISHED_STATUSES = {RunStatus.PASSED, RunStatus.FAILED}


def _key_for_result(r: ExecutionResult) -> str | None:
    """We dedupe history per ``test_case_id`` (flow-only results are skipped)."""
    return r.test_case_id


def detect_regressions(
    session: Session,
    project_id: str,
    *,
    history_runs: int = 20,
    limit: int = 50,
) -> list[RegressionItem]:
    """Return regressions for ``project_id``.

    ``history_runs`` bounds how many recent finished runs we consider when
    looking for the *previous* status of each currently-failing test.
    """
    finished_runs: list[ExecutionRun] = list(
        session.exec(
            select(ExecutionRun)
            .where(
                ExecutionRun.project_id == project_id,
                ExecutionRun.status.in_(list(_FINISHED_STATUSES)),
            )
            .order_by(ExecutionRun.created_at.desc())
            .limit(history_runs)
        ).all()
    )
    if not finished_runs:
        return []

    latest_run = finished_runs[0]
    older_runs = finished_runs[1:]

    latest_results = list(
        session.exec(
            select(ExecutionResult).where(ExecutionResult.execution_run_id == latest_run.id)
        ).all()
    )
    failing_now: dict[str, ExecutionResult] = {}
    for r in latest_results:
        key = _key_for_result(r)
        if key and r.status in _FAILURE_STATUSES and key not in failing_now:
            failing_now[key] = r
    if not failing_now:
        return []

    older_run_ids = [r.id for r in older_runs]
    previous_status: dict[str, tuple[ExecutionRun, ExecutionResult]] = {}
    if older_run_ids:
        history_results = list(
            session.exec(
                select(ExecutionResult)
                .where(ExecutionResult.execution_run_id.in_(older_run_ids))
            ).all()
        )
        results_by_run: dict[str, list[ExecutionResult]] = defaultdict(list)
        for r in history_results:
            results_by_run[r.execution_run_id].append(r)
        for run in older_runs:
            for r in results_by_run.get(run.id, []):
                key = _key_for_result(r)
                if key and key in failing_now and key not in previous_status:
                    previous_status[key] = (run, r)
            if len(previous_status) >= len(failing_now):
                break

    regressed_ids = [
        tc_id
        for tc_id, (_, prev_result) in previous_status.items()
        if prev_result.status == ResultStatus.PASSED
    ]
    if not regressed_ids:
        return []

    titles_by_id = {
        tc.id: tc.title
        for tc in session.exec(
            select(TestCase).where(TestCase.id.in_(regressed_ids))
        ).all()
    }

    items: list[RegressionItem] = []
    for tc_id in regressed_ids:
        current_result = failing_now[tc_id]
        prev_run, prev_result = previous_status[tc_id]
        broken_at = current_result.created_at or latest_run.finished_at
        items.append(
            RegressionItem(
                test_case_id=tc_id,
                title=titles_by_id.get(tc_id, "(deleted test case)"),
                current_status=current_result.status.value,
                previous_status=prev_result.status.value,
                current_run_id=latest_run.id,
                previous_run_id=prev_run.id,
                broken_at=_as_naive(broken_at),
                error_message=(current_result.error_message or "")[:240] or None,
            )
        )

    items.sort(key=lambda i: i.broken_at or datetime.min, reverse=True)
    return items[:limit]


def _as_naive(when: datetime | None) -> datetime | None:
    if when is None:
        return None
    if when.tzinfo is None:
        return when
    return when.replace(tzinfo=None)
