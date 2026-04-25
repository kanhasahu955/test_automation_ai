"""Reports DTOs."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DashboardKPIs(BaseModel):
    project_id: str
    total_test_cases: int
    automated_test_cases: int
    manual_test_cases: int
    pass_rate: float
    fail_rate: float
    flaky_tests: int
    avg_execution_time_ms: float
    data_quality_score: float
    failed_quality_rules: int
    schema_drift_count: int
    stm_validation_failures: int
    latest_run_status: str | None = None
    latest_run_at: datetime | None = None


class QualityScoreBreakdown(BaseModel):
    test_pass_rate: float
    data_quality: float
    automation_coverage: float
    defect_leakage: float
    pipeline_stability: float
    final_score: float


class TrendPoint(BaseModel):
    """Per-day trend bucket.

    ``passed`` / ``failed`` / ``skipped`` are absolute test-result counts so the UI
    can plot stacked area / bar charts in addition to the percentage rates.
    """

    date: datetime
    pass_rate: float
    fail_rate: float
    runs: int
    passed: int = 0
    failed: int = 0
    skipped: int = 0


class TrendReport(BaseModel):
    project_id: str
    points: list[TrendPoint]


# ---------------------------------------------------------------------------
# Quality Overview — single payload that drives the home dashboard.
# ---------------------------------------------------------------------------


class TestCaseCounts(BaseModel):
    total: int = 0
    automated: int = 0
    manual: int = 0
    ready: int = 0
    draft: int = 0


class ExecutionCounts(BaseModel):
    total: int = 0
    running: int = 0
    pending: int = 0
    today_total: int = 0
    today_passed: int = 0
    today_failed: int = 0
    last_24h_pass_rate: float = 0.0


class ScheduleCounts(BaseModel):
    total: int = 0
    active: int = 0
    paused: int = 0
    next_fire_at: datetime | None = None


class TopFailingTest(BaseModel):
    test_case_id: str
    title: str
    failures: int
    last_failed_at: datetime | None = None


class ActivityItem(BaseModel):
    """A flattened recent run for the activity feed."""

    run_id: str
    status: str
    run_type: str
    suite_id: str | None = None
    flow_id: str | None = None
    schedule_id: str | None = None
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    skipped_tests: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime | None = None


class QualityOverview(BaseModel):
    project_id: str
    test_cases: TestCaseCounts
    executions: ExecutionCounts
    schedules: ScheduleCounts
    regressions_count: int = 0
    top_failing_tests: list[TopFailingTest] = []
    recent_activity: list[ActivityItem] = []


# ---------------------------------------------------------------------------
# Regressions
# ---------------------------------------------------------------------------


class RegressionItem(BaseModel):
    """A test that **passed** in the previous finished run and **failed** in the latest one."""

    test_case_id: str
    title: str
    current_status: str
    previous_status: str
    current_run_id: str
    previous_run_id: str
    broken_at: datetime | None = None
    error_message: str | None = None
