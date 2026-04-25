"""Schedule models.

A *Schedule* represents a recurring (or one-off) execution of a target entity
— a test suite, a no-code flow, or an STM document. The cron expression is
authoritative; the structured ``cadence_kind`` / ``cadence_config`` columns
are kept for round-tripping the UI builder. Beat scheduling itself is handled
by RedBeat (Redis-backed Celery scheduler), so this row is the *source of
truth* the API edits and RedBeat is the *runtime mirror*.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class ScheduleTargetType(str, Enum):
    """What kind of entity the schedule executes when it fires."""

    TEST_SUITE = "TEST_SUITE"
    NO_CODE_FLOW = "NO_CODE_FLOW"
    STM_DOCUMENT = "STM_DOCUMENT"


class CadenceKind(str, Enum):
    """High-level preset the UI builder offers; ``CUSTOM`` carries raw cron."""

    HOURLY = "HOURLY"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    CUSTOM = "CUSTOM"


class ScheduleStatus(str, Enum):
    """Lifecycle of a schedule row."""

    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"


class Schedule(SQLModel, table=True):
    __tablename__ = "schedules"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)

    name: str = Field(max_length=200, index=True)
    description: str | None = Field(default=None, sa_column=Column(Text))

    target_type: ScheduleTargetType = Field(index=True)
    target_id: str = Field(max_length=36, index=True)

    cadence_kind: CadenceKind = Field(default=CadenceKind.DAILY)
    cadence_config: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    cron_expression: str = Field(max_length=128)
    timezone: str = Field(default="UTC", max_length=64)

    status: ScheduleStatus = Field(default=ScheduleStatus.ACTIVE, index=True)

    # Optional stop date: if set, beat will not fire after this timestamp.
    expires_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True)),
    )

    # Last fire info — written by the dispatcher task.
    last_run_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True)),
    )
    last_run_id: str | None = Field(default=None, max_length=36)

    # Pre-computed next-fire time. Refreshed on save; the UI shows it directly.
    next_run_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), index=True),
    )

    # Counters for at-a-glance reliability metrics.
    total_runs: int = Field(default=0)
    success_runs: int = Field(default=0)
    failure_runs: int = Field(default=0)

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
