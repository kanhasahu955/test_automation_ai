"""Schedule DTOs.

The cadence DTOs intentionally use a *discriminated union* on ``kind`` so the
frontend can pick a friendly preset (Hourly / Daily / Weekly / Monthly) and
the backend can produce the exact cron expression. ``CustomCadence`` is the
escape hatch for power users.
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.schedules.models import (
    CadenceKind,
    ScheduleStatus,
    ScheduleTargetType,
)


# ---------------------------------------------------------------------------
# Cadence DTOs (input only — server stores cron + cadence_config JSON)
# ---------------------------------------------------------------------------
class _CadenceBase(BaseModel):
    """Common to all cadences."""

    model_config = ConfigDict(extra="forbid")


class HourlyCadence(_CadenceBase):
    kind: Literal[CadenceKind.HOURLY] = CadenceKind.HOURLY
    minute: int = Field(default=0, ge=0, le=59, description="Minute of the hour to fire.")


class DailyCadence(_CadenceBase):
    kind: Literal[CadenceKind.DAILY] = CadenceKind.DAILY
    hour: int = Field(default=2, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)


class WeeklyCadence(_CadenceBase):
    kind: Literal[CadenceKind.WEEKLY] = CadenceKind.WEEKLY
    hour: int = Field(default=2, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    days_of_week: list[int] = Field(
        default_factory=lambda: [1],
        description="0=Sunday … 6=Saturday. Multiple values OK.",
    )

    @field_validator("days_of_week")
    @classmethod
    def _dows_in_range(cls, v: list[int]) -> list[int]:
        if not v:
            raise ValueError("Pick at least one day of the week.")
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("Day-of-week must be 0..6 (0=Sunday).")
        return sorted(set(v))


class MonthlyCadence(_CadenceBase):
    kind: Literal[CadenceKind.MONTHLY] = CadenceKind.MONTHLY
    day_of_month: int = Field(default=1, ge=1, le=31)
    hour: int = Field(default=2, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)


class CustomCadence(_CadenceBase):
    kind: Literal[CadenceKind.CUSTOM] = CadenceKind.CUSTOM
    expression: str = Field(
        min_length=1,
        max_length=128,
        description="Standard 5-field crontab expression (minute hour dom month dow).",
    )


Cadence = Annotated[
    HourlyCadence | DailyCadence | WeeklyCadence | MonthlyCadence | CustomCadence,
    Field(discriminator="kind"),
]


# ---------------------------------------------------------------------------
# Schedule DTOs
# ---------------------------------------------------------------------------
class ScheduleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    target_type: ScheduleTargetType
    target_id: str = Field(min_length=1, max_length=36)
    cadence: Cadence
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    status: ScheduleStatus = ScheduleStatus.ACTIVE
    expires_at: datetime | None = None


class ScheduleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    cadence: Cadence | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    status: ScheduleStatus | None = None
    expires_at: datetime | None = None


class ScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    name: str
    description: str | None
    target_type: ScheduleTargetType
    target_id: str
    cadence_kind: CadenceKind
    cadence_config: dict[str, Any] | None
    cron_expression: str
    timezone: str
    status: ScheduleStatus
    expires_at: datetime | None
    last_run_at: datetime | None
    last_run_id: str | None
    next_run_at: datetime | None
    total_runs: int
    success_runs: int
    failure_runs: int
    created_by: str | None
    created_at: datetime | None
    updated_at: datetime | None


class SchedulePreviewRequest(BaseModel):
    """Used by the frontend's cron builder to validate a cadence before save."""

    model_config = ConfigDict(extra="forbid")

    cadence: Cadence
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    occurrences: int = Field(default=5, ge=1, le=50)


class SchedulePreviewResponse(BaseModel):
    cron_expression: str
    timezone: str
    next_runs: list[datetime]
    description: str
