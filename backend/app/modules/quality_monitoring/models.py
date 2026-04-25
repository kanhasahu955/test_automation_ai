"""Quality rule + result models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class RuleType(str, Enum):
    NOT_NULL = "NOT_NULL"
    UNIQUE = "UNIQUE"
    RANGE = "RANGE"
    REGEX = "REGEX"
    ROW_COUNT = "ROW_COUNT"
    FRESHNESS = "FRESHNESS"
    CUSTOM_SQL = "CUSTOM_SQL"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class QualityResultStatus(str, Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    WARNING = "WARNING"


class QualityRule(SQLModel, table=True):
    __tablename__ = "quality_rules"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    name: str = Field(max_length=255)
    rule_type: RuleType
    table_name: str | None = Field(default=None, max_length=255)
    column_name: str | None = Field(default=None, max_length=255)
    rule_config: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    severity: Severity = Field(default=Severity.MEDIUM)
    is_active: bool = Field(default=True)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class QualityResult(SQLModel, table=True):
    __tablename__ = "quality_results"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    quality_rule_id: str = Field(foreign_key="quality_rules.id", max_length=36, index=True)
    execution_run_id: str | None = Field(default=None, foreign_key="execution_runs.id", max_length=36)
    status: QualityResultStatus
    actual_value: str | None = Field(default=None, sa_column=Column(Text))
    expected_value: str | None = Field(default=None, sa_column=Column(Text))
    failed_count: int = 0
    result_json: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
