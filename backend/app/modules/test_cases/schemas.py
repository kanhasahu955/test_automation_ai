"""Test case DTOs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.test_cases.models import TestPriority, TestStatus, TestType


class TestStepCreate(BaseModel):
    step_order: int = Field(ge=1, default=1)
    action: str
    input_data: dict[str, Any] | None = None
    expected_result: str | None = None


class TestStepRead(TestStepCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    test_case_id: str
    created_at: datetime | None = None


class TestCaseBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    test_type: TestType = TestType.MANUAL
    priority: TestPriority = TestPriority.MEDIUM
    status: TestStatus = TestStatus.DRAFT
    preconditions: str | None = None
    expected_result: str | None = None


class TestCaseCreate(TestCaseBase):
    steps: list[TestStepCreate] = Field(default_factory=list)


class TestCaseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    test_type: TestType | None = None
    priority: TestPriority | None = None
    status: TestStatus | None = None
    preconditions: str | None = None
    expected_result: str | None = None
    steps: list[TestStepCreate] | None = None


class TestCaseRead(TestCaseBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    created_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    steps: list[TestStepRead] = Field(default_factory=list)
