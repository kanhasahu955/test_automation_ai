"""Data profiling models."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Numeric, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class ProfileStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DataProfilingRun(SQLModel, table=True):
    __tablename__ = "data_profiling_runs"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    data_source_id: str = Field(foreign_key="data_sources.id", max_length=36)
    status: ProfileStatus = Field(default=ProfileStatus.PENDING)
    started_at: datetime | None = None
    finished_at: datetime | None = None
    overall_quality_score: Decimal | None = Field(default=None, sa_column=Column(Numeric(5, 2)))
    summary_json: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
