"""Test suite DTOs."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.test_suites.models import SuiteType


class TestSuiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    suite_type: SuiteType = SuiteType.CUSTOM


class TestSuiteRead(TestSuiteCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    created_by: str | None = None
    created_at: datetime | None = None
    case_count: int = 0


class SuiteCaseAdd(BaseModel):
    test_case_id: str
    execution_order: int = 1


class SuiteCaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    suite_id: str
    test_case_id: str
    execution_order: int


class RunSuiteRequest(BaseModel):
    environment_id: str | None = None
    triggered_by_label: str | None = "manual"
