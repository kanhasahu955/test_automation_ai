"""Execution run + result models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class RunType(str, Enum):
    MANUAL = "MANUAL"
    SCHEDULED = "SCHEDULED"
    CI_CD = "CI_CD"
    AIRFLOW = "AIRFLOW"


class RunStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PASSED = "PASSED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ResultStatus(str, Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    ERROR = "ERROR"


class ExecutionRun(SQLModel, table=True):
    __tablename__ = "execution_runs"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    suite_id: str | None = Field(default=None, foreign_key="test_suites.id", max_length=36)
    flow_id: str | None = Field(default=None, foreign_key="no_code_flows.id", max_length=36)
    schedule_id: str | None = Field(
        default=None,
        foreign_key="schedules.id",
        max_length=36,
        index=True,
        description="Set when the run was launched by a Schedule (RunType.SCHEDULED).",
    )
    triggered_by: str | None = Field(default=None, foreign_key="users.id", max_length=36)
    run_type: RunType = Field(default=RunType.MANUAL)
    status: RunStatus = Field(default=RunStatus.PENDING)
    started_at: datetime | None = None
    finished_at: datetime | None = None
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    skipped_tests: int = 0

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class ExecutionResult(SQLModel, table=True):
    __tablename__ = "execution_results"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    execution_run_id: str = Field(foreign_key="execution_runs.id", max_length=36, index=True)
    test_case_id: str | None = Field(default=None, foreign_key="test_cases.id", max_length=36)
    flow_id: str | None = Field(default=None, foreign_key="no_code_flows.id", max_length=36)
    status: ResultStatus
    duration_ms: int | None = None
    error_message: str | None = Field(default=None, sa_column=Column(Text))
    logs: str | None = Field(default=None, sa_column=Column(Text))
    screenshot_path: str | None = Field(default=None, max_length=500)
    video_path: str | None = Field(default=None, max_length=500)
    result_json: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
