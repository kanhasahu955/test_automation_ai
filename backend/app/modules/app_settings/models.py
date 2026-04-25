"""App settings models — single key/value JSON store for global preferences."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime, func
from sqlmodel import Field, SQLModel


class AppSetting(SQLModel, table=True):
    """Single global preference, keyed by a stable string.

    Examples of keys we currently use:

    * ``llm`` - LLM provider/model/credentials/sampling.
    * ``notifications`` - notification channels and per-event toggles.

    The payload is JSON-typed so each section can evolve its own schema
    without a DB migration. Validation lives in the Pydantic DTOs.
    """

    __tablename__ = "app_settings"

    key: str = Field(primary_key=True, max_length=64)
    value: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
        ),
    )
    updated_by: str | None = Field(default=None, foreign_key="users.id", max_length=36)
