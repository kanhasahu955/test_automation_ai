"""Reusable Pydantic base schemas.

These are intentionally small. Modules can extend them to share a consistent
read-shape across the API, without forcing every entity to grow extra columns.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Pydantic base for read schemas backed by SQLModel/SQLAlchemy rows."""

    model_config = ConfigDict(from_attributes=True)


class EntityRead(ORMModel):
    """Common columns shared by most read responses."""

    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class JobQueuedResponse(BaseModel):
    """Standard envelope for endpoints that enqueue async work."""

    status: str = "queued"
    job_id: str | None = None
    resource_id: str | None = None
    message: str | None = None


class IdsCreatedResponse(BaseModel):
    """Envelope for bulk-create endpoints."""

    ids: list[str]
    count: int


class OkResponse(BaseModel):
    """Tiny OK envelope used by destructive/no-content endpoints."""

    ok: bool = True
    message: str | None = None
    data: dict[str, Any] | None = None
