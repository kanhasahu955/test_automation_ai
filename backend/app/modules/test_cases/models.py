"""Test case + test step models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class TestType(str, Enum):
    MANUAL = "MANUAL"
    API = "API"
    UI = "UI"
    SQL = "SQL"
    DATA_QUALITY = "DATA_QUALITY"
    NO_CODE = "NO_CODE"


class TestPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TestStatus(str, Enum):
    DRAFT = "DRAFT"
    READY = "READY"
    DEPRECATED = "DEPRECATED"


class TestCase(SQLModel, table=True):
    __tablename__ = "test_cases"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    title: str = Field(max_length=255, index=True)
    description: str | None = Field(default=None, sa_column=Column(Text))
    test_type: TestType = Field(default=TestType.MANUAL)
    priority: TestPriority = Field(default=TestPriority.MEDIUM)
    status: TestStatus = Field(default=TestStatus.DRAFT)
    preconditions: str | None = Field(default=None, sa_column=Column(Text))
    expected_result: str | None = Field(default=None, sa_column=Column(Text))
    created_by: str | None = Field(default=None, foreign_key="users.id", max_length=36)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
        ),
    )


class TestStep(SQLModel, table=True):
    __tablename__ = "test_steps"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    test_case_id: str = Field(foreign_key="test_cases.id", max_length=36, index=True)
    step_order: int = Field(default=1)
    action: str = Field(sa_column=Column(Text, nullable=False))
    input_data: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    expected_result: str | None = Field(default=None, sa_column=Column(Text))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
