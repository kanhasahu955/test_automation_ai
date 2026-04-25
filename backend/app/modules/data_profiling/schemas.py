"""Profiling DTOs."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.modules.data_profiling.models import ProfileStatus


class ProfilingRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    data_source_id: str
    status: ProfileStatus
    started_at: datetime | None = None
    finished_at: datetime | None = None
    overall_quality_score: Decimal | None = None
    summary_json: dict[str, Any] | None = None
    created_at: datetime | None = None
