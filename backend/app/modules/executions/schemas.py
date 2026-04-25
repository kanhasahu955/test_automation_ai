"""Execution DTOs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.modules.executions.models import ResultStatus, RunStatus, RunType


class ExecutionRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    suite_id: str | None = None
    flow_id: str | None = None
    schedule_id: str | None = None
    triggered_by: str | None = None
    run_type: RunType
    status: RunStatus
    started_at: datetime | None = None
    finished_at: datetime | None = None
    total_tests: int
    passed_tests: int
    failed_tests: int
    skipped_tests: int
    created_at: datetime | None = None


class ExecutionResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    execution_run_id: str
    test_case_id: str | None = None
    test_name: str | None = None  # joined from test_cases.title for display only
    flow_id: str | None = None
    flow_name: str | None = None  # joined from no_code_flows.name for display only
    status: ResultStatus
    duration_ms: int | None = None
    error_message: str | None = None
    logs: str | None = None
    screenshot_path: str | None = None
    video_path: str | None = None
    result_json: dict[str, Any] | None = None
    created_at: datetime | None = None


class ExecutionReport(BaseModel):
    run: ExecutionRunRead
    results: list[ExecutionResultRead]
