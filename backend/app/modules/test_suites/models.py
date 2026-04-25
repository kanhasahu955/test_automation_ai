"""Test suite + suite-case linker models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class SuiteType(str, Enum):
    SMOKE = "SMOKE"
    REGRESSION = "REGRESSION"
    SANITY = "SANITY"
    CUSTOM = "CUSTOM"


class TestSuite(SQLModel, table=True):
    __tablename__ = "test_suites"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    name: str = Field(max_length=255)
    description: str | None = Field(default=None, sa_column=Column(Text))
    suite_type: SuiteType = Field(default=SuiteType.CUSTOM)
    created_by: str | None = Field(default=None, foreign_key="users.id", max_length=36)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class TestSuiteCase(SQLModel, table=True):
    __tablename__ = "test_suite_cases"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    suite_id: str = Field(foreign_key="test_suites.id", max_length=36, index=True)
    test_case_id: str = Field(foreign_key="test_cases.id", max_length=36, index=True)
    execution_order: int = Field(default=1)
