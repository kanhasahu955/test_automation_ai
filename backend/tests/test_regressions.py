"""Tests for regression detection + dashboard overview.

Uses an in-memory SQLite database so we can exercise the full SQL path
without needing a real MySQL instance. We import every model module so
``SQLModel.metadata`` knows about all FK targets when creating tables.
"""
from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

# Importing the models attaches them to SQLModel.metadata
from app.modules.executions.models import (
    ExecutionResult,
    ExecutionRun,
    ResultStatus,
    RunStatus,
    RunType,
)
from app.modules.no_code_flows.models import NoCodeFlow  # noqa: F401  (FK target)
from app.modules.projects.models import Project
from app.modules.reports import service as reports_service
from app.modules.reports.regressions import detect_regressions
from app.modules.schedules.models import Schedule  # noqa: F401  (FK target)
from app.modules.test_cases.models import TestCase, TestType
from app.modules.test_suites.models import TestSuite  # noqa: F401  (FK target)
from app.modules.users.models import User  # noqa: F401  (FK target)
from app.utils.datetime import utc_now_naive


@pytest.fixture()
def session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _project(session: Session) -> Project:
    p = Project(name="Demo", description="d")
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


def _make_test_case(session: Session, project_id: str, title: str) -> TestCase:
    tc = TestCase(project_id=project_id, title=title, test_type=TestType.API)
    session.add(tc)
    session.commit()
    session.refresh(tc)
    return tc


def _make_run(
    session: Session,
    project_id: str,
    status: RunStatus,
    *,
    minutes_ago: int,
    passed: int = 0,
    failed: int = 0,
    skipped: int = 0,
) -> ExecutionRun:
    created = utc_now_naive() - timedelta(minutes=minutes_ago)
    r = ExecutionRun(
        project_id=project_id,
        run_type=RunType.MANUAL,
        status=status,
        passed_tests=passed,
        failed_tests=failed,
        skipped_tests=skipped,
        total_tests=passed + failed + skipped,
        started_at=created,
        finished_at=created if status in (RunStatus.PASSED, RunStatus.FAILED) else None,
        created_at=created,
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return r


def _make_result(
    session: Session,
    run: ExecutionRun,
    test_case_id: str,
    status: ResultStatus,
    *,
    error: str | None = None,
) -> ExecutionResult:
    res = ExecutionResult(
        execution_run_id=run.id,
        test_case_id=test_case_id,
        status=status,
        error_message=error,
        created_at=run.finished_at or run.created_at,
    )
    session.add(res)
    session.commit()
    session.refresh(res)
    return res


def test_no_history_returns_empty(session: Session):
    project = _project(session)
    assert detect_regressions(session, project.id) == []


def test_passing_to_failing_is_a_regression(session: Session):
    project = _project(session)
    tc = _make_test_case(session, project.id, "Login")

    older = _make_run(session, project.id, RunStatus.PASSED, minutes_ago=60, passed=1)
    _make_result(session, older, tc.id, ResultStatus.PASSED)

    latest = _make_run(session, project.id, RunStatus.FAILED, minutes_ago=10, failed=1)
    _make_result(session, latest, tc.id, ResultStatus.FAILED, error="Boom")

    items = detect_regressions(session, project.id)
    assert len(items) == 1
    item = items[0]
    assert item.test_case_id == tc.id
    assert item.title == "Login"
    assert item.current_status == "FAILED"
    assert item.previous_status == "PASSED"
    assert item.error_message == "Boom"


def test_consistently_failing_test_is_not_regression(session: Session):
    project = _project(session)
    tc = _make_test_case(session, project.id, "Always-broken")

    older = _make_run(session, project.id, RunStatus.FAILED, minutes_ago=60, failed=1)
    _make_result(session, older, tc.id, ResultStatus.FAILED)

    latest = _make_run(session, project.id, RunStatus.FAILED, minutes_ago=10, failed=1)
    _make_result(session, latest, tc.id, ResultStatus.FAILED)

    assert detect_regressions(session, project.id) == []


def test_running_runs_are_ignored(session: Session):
    """In-flight runs should never be considered when determining the latest status."""
    project = _project(session)
    tc = _make_test_case(session, project.id, "Login")

    older = _make_run(session, project.id, RunStatus.PASSED, minutes_ago=60, passed=1)
    _make_result(session, older, tc.id, ResultStatus.PASSED)

    failed = _make_run(session, project.id, RunStatus.FAILED, minutes_ago=20, failed=1)
    _make_result(session, failed, tc.id, ResultStatus.FAILED)

    in_flight = _make_run(session, project.id, RunStatus.RUNNING, minutes_ago=1)
    _make_result(session, in_flight, tc.id, ResultStatus.PASSED)

    items = detect_regressions(session, project.id)
    assert len(items) == 1, "Latest *finished* run still has the regression"


def test_error_status_counts_as_failure(session: Session):
    project = _project(session)
    tc = _make_test_case(session, project.id, "ErrorCase")

    older = _make_run(session, project.id, RunStatus.PASSED, minutes_ago=60, passed=1)
    _make_result(session, older, tc.id, ResultStatus.PASSED)

    latest = _make_run(session, project.id, RunStatus.FAILED, minutes_ago=10, failed=1)
    _make_result(session, latest, tc.id, ResultStatus.ERROR)

    items = detect_regressions(session, project.id)
    assert len(items) == 1 and items[0].current_status == "ERROR"


def test_overview_aggregates_counts(session: Session):
    project = _project(session)
    _make_test_case(session, project.id, "tc-1")
    _make_test_case(session, project.id, "tc-2")

    _make_run(session, project.id, RunStatus.PASSED, minutes_ago=10, passed=5)
    _make_run(session, project.id, RunStatus.FAILED, minutes_ago=5, failed=2)
    _make_run(session, project.id, RunStatus.RUNNING, minutes_ago=1, passed=0)

    overview = reports_service.overview(session, project.id)
    assert overview.test_cases.total == 2
    assert overview.executions.total == 3
    assert overview.executions.running == 1
    assert overview.executions.today_passed == 1
    assert overview.executions.today_failed == 1
    assert overview.executions.last_24h_pass_rate == 50.0


def test_overview_top_failing_tests(session: Session):
    project = _project(session)
    a = _make_test_case(session, project.id, "Most-broken")
    b = _make_test_case(session, project.id, "Less-broken")

    for i in range(3):
        run = _make_run(session, project.id, RunStatus.FAILED, minutes_ago=60 - i, failed=1)
        _make_result(session, run, a.id, ResultStatus.FAILED)
    for i in range(1):
        run = _make_run(session, project.id, RunStatus.FAILED, minutes_ago=30 - i, failed=1)
        _make_result(session, run, b.id, ResultStatus.FAILED)

    overview = reports_service.overview(session, project.id)
    titles = [t.title for t in overview.top_failing_tests]
    assert titles[0] == "Most-broken"
    assert overview.top_failing_tests[0].failures == 3
