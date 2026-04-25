"""Reports services & dashboard aggregations."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.config import settings
from app.modules.executions.models import (
    ExecutionResult,
    ExecutionRun,
    ResultStatus,
    RunStatus,
)
from app.modules.quality_monitoring.models import QualityResult, QualityResultStatus
from app.modules.reports.regressions import detect_regressions
from app.modules.reports.schemas import (
    ActivityItem,
    DashboardKPIs,
    ExecutionCounts,
    QualityOverview,
    QualityScoreBreakdown,
    RegressionItem,
    ScheduleCounts,
    TestCaseCounts,
    TopFailingTest,
    TrendPoint,
    TrendReport,
)
from app.modules.schedules.models import Schedule, ScheduleStatus
from app.modules.test_cases.models import TestCase, TestStatus, TestType
from app.utils.datetime import utc_now_naive


def dashboard(session: Session, project_id: str) -> DashboardKPIs:
    total = session.exec(
        select(func.count()).select_from(TestCase).where(TestCase.project_id == project_id)
    ).one()
    automated = session.exec(
        select(func.count())
        .select_from(TestCase)
        .where(TestCase.project_id == project_id, TestCase.test_type != TestType.MANUAL)
    ).one()
    manual = total - automated

    runs = session.exec(
        select(ExecutionRun)
        .where(ExecutionRun.project_id == project_id)
        .order_by(ExecutionRun.created_at.desc())
        .limit(settings.REPORT_RECENT_RUNS_LIMIT)
    ).all()
    total_results = sum(r.passed_tests + r.failed_tests + r.skipped_tests for r in runs)
    passed = sum(r.passed_tests for r in runs)
    failed = sum(r.failed_tests for r in runs)
    pass_rate = (passed / total_results * 100) if total_results else 0.0
    fail_rate = (failed / total_results * 100) if total_results else 0.0

    avg_duration = session.exec(
        select(func.avg(ExecutionResult.duration_ms))
        .join(ExecutionRun, ExecutionResult.execution_run_id == ExecutionRun.id)
        .where(ExecutionRun.project_id == project_id)
    ).one() or 0

    failed_rules = session.exec(
        select(func.count())
        .select_from(QualityResult)
        .where(QualityResult.status == QualityResultStatus.FAILED)
    ).one()

    latest = runs[0] if runs else None
    return DashboardKPIs(
        project_id=project_id,
        total_test_cases=total,
        automated_test_cases=automated,
        manual_test_cases=manual,
        pass_rate=round(pass_rate, 2),
        fail_rate=round(fail_rate, 2),
        flaky_tests=0,
        avg_execution_time_ms=float(avg_duration or 0),
        data_quality_score=88.0,
        failed_quality_rules=failed_rules,
        schema_drift_count=0,
        stm_validation_failures=0,
        latest_run_status=latest.status.value if latest else None,
        latest_run_at=latest.created_at if latest else None,
    )


def quality_score(session: Session, project_id: str) -> QualityScoreBreakdown:
    """Score = 30% pass + 20% DQ + 20% automation + 15% defect-leakage + 15% pipeline."""
    kpis = dashboard(session, project_id)
    test_pass_rate = kpis.pass_rate
    automation_coverage = (
        (kpis.automated_test_cases / kpis.total_test_cases * 100)
        if kpis.total_test_cases else 0.0
    )
    data_quality = kpis.data_quality_score
    defect_leakage = 85.0
    pipeline_stability = 90.0
    final = (
        0.30 * test_pass_rate
        + 0.20 * data_quality
        + 0.20 * automation_coverage
        + 0.15 * defect_leakage
        + 0.15 * pipeline_stability
    )
    return QualityScoreBreakdown(
        test_pass_rate=round(test_pass_rate, 2),
        data_quality=round(data_quality, 2),
        automation_coverage=round(automation_coverage, 2),
        defect_leakage=round(defect_leakage, 2),
        pipeline_stability=round(pipeline_stability, 2),
        final_score=round(final, 2),
    )


def trend(session: Session, project_id: str, days: int = 14) -> TrendReport:
    cutoff = utc_now_naive() - timedelta(days=days)
    runs = session.exec(
        select(ExecutionRun)
        .where(
            ExecutionRun.project_id == project_id,
            ExecutionRun.created_at >= cutoff,
        )
        .order_by(ExecutionRun.created_at.asc())
    ).all()

    bucket: dict[str, list[ExecutionRun]] = {}
    for r in runs:
        if not r.created_at:
            continue
        key = r.created_at.date().isoformat()
        bucket.setdefault(key, []).append(r)

    points: list[TrendPoint] = []
    for key, items in bucket.items():
        passed = sum(i.passed_tests for i in items)
        failed = sum(i.failed_tests for i in items)
        skipped = sum(i.skipped_tests for i in items)
        total = passed + failed + skipped
        points.append(TrendPoint(
            date=datetime.fromisoformat(key),
            pass_rate=round((passed / total * 100) if total else 0, 2),
            fail_rate=round((failed / total * 100) if total else 0, 2),
            runs=len(items),
            passed=passed,
            failed=failed,
            skipped=skipped,
        ))
    return TrendReport(project_id=project_id, points=points)


# ---------------------------------------------------------------------------
# Quality Overview — single payload that drives the home dashboard.
# ---------------------------------------------------------------------------


def overview(
    session: Session,
    project_id: str,
    *,
    activity_limit: int = 8,
    top_failures_limit: int = 5,
) -> QualityOverview:
    """Return everything the home dashboard needs in a single call."""
    test_cases = _test_case_counts(session, project_id)
    executions = _execution_counts(session, project_id)
    schedules = _schedule_counts(session, project_id)
    activity = _recent_activity(session, project_id, limit=activity_limit)
    top_failing = _top_failing_tests(session, project_id, limit=top_failures_limit)
    regressions = detect_regressions(session, project_id, history_runs=20, limit=50)

    return QualityOverview(
        project_id=project_id,
        test_cases=test_cases,
        executions=executions,
        schedules=schedules,
        regressions_count=len(regressions),
        top_failing_tests=top_failing,
        recent_activity=activity,
    )


def regressions(session: Session, project_id: str, *, limit: int = 50) -> list[RegressionItem]:
    """Public wrapper for the route handler."""
    return detect_regressions(session, project_id, history_runs=20, limit=limit)


def _test_case_counts(session: Session, project_id: str) -> TestCaseCounts:
    total = session.exec(
        select(func.count()).select_from(TestCase).where(TestCase.project_id == project_id)
    ).one()
    automated = session.exec(
        select(func.count())
        .select_from(TestCase)
        .where(TestCase.project_id == project_id, TestCase.test_type != TestType.MANUAL)
    ).one()
    ready = session.exec(
        select(func.count())
        .select_from(TestCase)
        .where(TestCase.project_id == project_id, TestCase.status == TestStatus.READY)
    ).one()
    draft = session.exec(
        select(func.count())
        .select_from(TestCase)
        .where(TestCase.project_id == project_id, TestCase.status == TestStatus.DRAFT)
    ).one()
    return TestCaseCounts(
        total=int(total or 0),
        automated=int(automated or 0),
        manual=int((total or 0) - (automated or 0)),
        ready=int(ready or 0),
        draft=int(draft or 0),
    )


def _execution_counts(session: Session, project_id: str) -> ExecutionCounts:
    base = select(func.count()).select_from(ExecutionRun).where(ExecutionRun.project_id == project_id)
    total = session.exec(base).one()
    running = session.exec(
        select(func.count())
        .select_from(ExecutionRun)
        .where(ExecutionRun.project_id == project_id, ExecutionRun.status == RunStatus.RUNNING)
    ).one()
    pending = session.exec(
        select(func.count())
        .select_from(ExecutionRun)
        .where(ExecutionRun.project_id == project_id, ExecutionRun.status == RunStatus.PENDING)
    ).one()

    cutoff = utc_now_naive() - timedelta(hours=24)
    runs_24h = session.exec(
        select(ExecutionRun)
        .where(ExecutionRun.project_id == project_id, ExecutionRun.created_at >= cutoff)
    ).all()
    today_total = len(runs_24h)
    today_passed = sum(1 for r in runs_24h if r.status == RunStatus.PASSED)
    today_failed = sum(1 for r in runs_24h if r.status == RunStatus.FAILED)
    finished_24h = today_passed + today_failed
    last_24h_pass_rate = (today_passed / finished_24h * 100) if finished_24h else 0.0

    return ExecutionCounts(
        total=int(total or 0),
        running=int(running or 0),
        pending=int(pending or 0),
        today_total=today_total,
        today_passed=today_passed,
        today_failed=today_failed,
        last_24h_pass_rate=round(last_24h_pass_rate, 2),
    )


def _schedule_counts(session: Session, project_id: str) -> ScheduleCounts:
    total = session.exec(
        select(func.count()).select_from(Schedule).where(Schedule.project_id == project_id)
    ).one()
    active = session.exec(
        select(func.count())
        .select_from(Schedule)
        .where(Schedule.project_id == project_id, Schedule.status == ScheduleStatus.ACTIVE)
    ).one()
    paused = session.exec(
        select(func.count())
        .select_from(Schedule)
        .where(Schedule.project_id == project_id, Schedule.status == ScheduleStatus.PAUSED)
    ).one()
    next_fire = session.exec(
        select(Schedule.next_run_at)
        .where(
            Schedule.project_id == project_id,
            Schedule.status == ScheduleStatus.ACTIVE,
            Schedule.next_run_at.is_not(None),
        )
        .order_by(Schedule.next_run_at.asc())
        .limit(1)
    ).first()
    return ScheduleCounts(
        total=int(total or 0),
        active=int(active or 0),
        paused=int(paused or 0),
        next_fire_at=next_fire,
    )


def _recent_activity(session: Session, project_id: str, *, limit: int) -> list[ActivityItem]:
    runs = session.exec(
        select(ExecutionRun)
        .where(ExecutionRun.project_id == project_id)
        .order_by(ExecutionRun.created_at.desc())
        .limit(limit)
    ).all()
    return [
        ActivityItem(
            run_id=r.id,
            status=r.status.value,
            run_type=r.run_type.value,
            suite_id=r.suite_id,
            flow_id=r.flow_id,
            schedule_id=r.schedule_id,
            total_tests=r.total_tests,
            passed_tests=r.passed_tests,
            failed_tests=r.failed_tests,
            skipped_tests=r.skipped_tests,
            started_at=r.started_at,
            finished_at=r.finished_at,
            created_at=r.created_at,
        )
        for r in runs
    ]


def _top_failing_tests(
    session: Session, project_id: str, *, limit: int
) -> list[TopFailingTest]:
    """Aggregate failures across the last ``REPORT_RECENT_RUNS_LIMIT`` runs."""
    recent_runs = session.exec(
        select(ExecutionRun.id)
        .where(ExecutionRun.project_id == project_id)
        .order_by(ExecutionRun.created_at.desc())
        .limit(settings.REPORT_RECENT_RUNS_LIMIT)
    ).all()
    if not recent_runs:
        return []

    run_ids = list(recent_runs)
    rows = session.exec(
        select(ExecutionResult)
        .where(
            ExecutionResult.execution_run_id.in_(run_ids),
            ExecutionResult.status.in_([ResultStatus.FAILED, ResultStatus.ERROR]),
            ExecutionResult.test_case_id.is_not(None),
        )
    ).all()
    if not rows:
        return []

    grouped: dict[str, list[ExecutionResult]] = defaultdict(list)
    for r in rows:
        if r.test_case_id:
            grouped[r.test_case_id].append(r)

    title_lookup = {
        tc.id: tc.title
        for tc in session.exec(
            select(TestCase).where(TestCase.id.in_(list(grouped.keys())))
        ).all()
    }

    items: list[TopFailingTest] = []
    for tc_id, results in grouped.items():
        last_failed_at = max((r.created_at for r in results if r.created_at), default=None)
        items.append(
            TopFailingTest(
                test_case_id=tc_id,
                title=title_lookup.get(tc_id, "(deleted test case)"),
                failures=len(results),
                last_failed_at=last_failed_at,
            )
        )
    items.sort(key=lambda i: (i.failures, i.last_failed_at or datetime.min), reverse=True)
    return items[:limit]
