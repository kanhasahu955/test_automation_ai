"""Execution services.

Every state-changing call publishes a Redis pub/sub event on the
``qf:project:{project_id}`` channel so the Socket.IO bridge in
``app.core.socketio`` can push the update to subscribed browsers
(Dashboard + Executions). Publishing is fire-and-forget — a Redis
outage MUST NOT block the database commit.
"""
from __future__ import annotations

from sqlmodel import Session, func, select

from app.core.errors import NotFoundError
from app.core.realtime import project_channel, publish
from app.modules.executions.models import (
    ExecutionResult,
    ExecutionRun,
    ResultStatus,
    RunStatus,
    RunType,
)
from app.modules.executions.schemas import (
    ExecutionReport,
    ExecutionResultRead,
    ExecutionRunRead,
)
from app.modules.no_code_flows.models import NoCodeFlow
from app.modules.test_cases.models import TestCase
from app.modules.test_suites.models import TestSuite, TestSuiteCase
from app.utils.datetime import utc_now_naive

# ---------- Realtime emit helpers --------------------------------------------


def _emit_run(run: ExecutionRun, *, event_type: str) -> None:
    """Publish a run-shape event on the project's realtime channel."""
    if not run or not run.project_id:
        return
    publish(
        project_channel(run.project_id),
        event_type,
        ExecutionRunRead.model_validate(run).model_dump(mode="json"),
    )
    # Run state changes invalidate the regression list — let subscribers
    # know they should refetch ``GET /projects/{id}/regressions`` (we don't
    # ship the new list inline since it requires a DB query).
    if event_type in {"run.updated", "run.created"} and run.status in {
        RunStatus.PASSED,
        RunStatus.FAILED,
    }:
        publish(
            project_channel(run.project_id),
            "regressions.invalidated",
            {"project_id": run.project_id, "run_id": run.id},
        )


def _enqueue_run(run_id: str, *, kind: str) -> None:
    """Push the run to the Celery queue (graceful if broker unavailable)."""
    try:
        from app.workers.tasks import execution_tasks  # local import to avoid cycles

        execution_tasks.run_execution.delay(run_id, kind)
    except Exception:
        # In dev (no broker) the API still returns the queued run; worker will pick later.
        pass


# ---------- CRUD-style API ---------------------------------------------------


def create_suite_run(
    session: Session, suite_id: str, triggered_by: str, environment_id: str | None = None
) -> ExecutionRunRead:
    suite = session.exec(select(TestSuite).where(TestSuite.id == suite_id)).first()
    if not suite:
        raise NotFoundError("Test suite not found")
    case_count = session.exec(
        select(func.count()).select_from(TestSuiteCase).where(TestSuiteCase.suite_id == suite_id)
    ).one()
    run = ExecutionRun(
        project_id=suite.project_id,
        suite_id=suite_id,
        triggered_by=triggered_by,
        run_type=RunType.MANUAL,
        status=RunStatus.PENDING,
        total_tests=case_count,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    _emit_run(run, event_type="run.created")
    _enqueue_run(run.id, kind="suite")
    return ExecutionRunRead.model_validate(run)


def create_flow_run(session: Session, flow_id: str, triggered_by: str) -> ExecutionRunRead:
    flow = session.exec(select(NoCodeFlow).where(NoCodeFlow.id == flow_id)).first()
    if not flow:
        raise NotFoundError("Flow not found")
    run = ExecutionRun(
        project_id=flow.project_id,
        flow_id=flow_id,
        triggered_by=triggered_by,
        run_type=RunType.MANUAL,
        status=RunStatus.PENDING,
        total_tests=1,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    _emit_run(run, event_type="run.created")
    _enqueue_run(run.id, kind="flow")
    return ExecutionRunRead.model_validate(run)


def list_runs(
    session: Session,
    project_id: str,
    limit: int = 50,
    schedule_id: str | None = None,
) -> list[ExecutionRun]:
    """List execution runs for a project, optionally scoped to a schedule.

    Passing ``schedule_id`` is the canonical way for the UI to surface the
    history of a single Schedule (used by the Schedule detail screen).
    """
    stmt = (
        select(ExecutionRun)
        .where(ExecutionRun.project_id == project_id)
        .order_by(ExecutionRun.created_at.desc())
        .limit(limit)
    )
    if schedule_id:
        stmt = stmt.where(ExecutionRun.schedule_id == schedule_id)
    return session.exec(stmt).all()


def get_report(session: Session, run_id: str) -> ExecutionReport:
    run = session.exec(select(ExecutionRun).where(ExecutionRun.id == run_id)).first()
    if not run:
        raise NotFoundError("Execution run not found")
    rows = session.exec(
        select(ExecutionResult, TestCase.title, NoCodeFlow.name)
        .join(TestCase, TestCase.id == ExecutionResult.test_case_id, isouter=True)
        .join(NoCodeFlow, NoCodeFlow.id == ExecutionResult.flow_id, isouter=True)
        .where(ExecutionResult.execution_run_id == run_id)
        .order_by(ExecutionResult.created_at)
    ).all()

    results: list[ExecutionResultRead] = []
    for row in rows:
        result_obj, test_title, flow_name = row
        dto = ExecutionResultRead.model_validate(result_obj)
        dto.test_name = test_title
        dto.flow_name = flow_name
        results.append(dto)

    return ExecutionReport(
        run=ExecutionRunRead.model_validate(run),
        results=results,
    )


def update_run_status(session: Session, run_id: str, status: RunStatus, finished: bool = False) -> ExecutionRun:
    run = session.exec(select(ExecutionRun).where(ExecutionRun.id == run_id)).first()
    if not run:
        raise NotFoundError("Run not found")
    run.status = status
    if status == RunStatus.RUNNING and not run.started_at:
        run.started_at = utc_now_naive()
    if finished:
        run.finished_at = utc_now_naive()
    session.add(run)
    session.commit()
    session.refresh(run)
    _emit_run(run, event_type="run.updated")
    return run


def append_result(
    session: Session,
    run_id: str,
    *,
    status: ResultStatus,
    test_case_id: str | None = None,
    flow_id: str | None = None,
    duration_ms: int | None = None,
    error_message: str | None = None,
    logs: str | None = None,
    result_json: dict | None = None,
) -> ExecutionResult:
    result = ExecutionResult(
        execution_run_id=run_id,
        test_case_id=test_case_id,
        flow_id=flow_id,
        status=status,
        duration_ms=duration_ms,
        error_message=error_message,
        logs=logs,
        result_json=result_json,
    )
    session.add(result)

    # update aggregate counters
    run = session.exec(select(ExecutionRun).where(ExecutionRun.id == run_id)).first()
    if run:
        if status == ResultStatus.PASSED:
            run.passed_tests += 1
        elif status == ResultStatus.SKIPPED:
            run.skipped_tests += 1
        else:
            run.failed_tests += 1
        session.add(run)

    session.commit()
    session.refresh(result)
    if run is not None:
        _emit_run(run, event_type="run.updated")
        publish(
            project_channel(run.project_id),
            "run.result",
            {
                "run_id": run.id,
                "result_id": result.id,
                "status": result.status.value if hasattr(result.status, "value") else str(result.status),
                "test_case_id": result.test_case_id,
                "flow_id": result.flow_id,
                "duration_ms": result.duration_ms,
            },
        )
    return result
