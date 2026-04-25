"""Audit log models."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    user_id: str | None = Field(default=None, foreign_key="users.id", max_length=36)
    action: str = Field(max_length=255)
    entity_type: str | None = Field(default=None, max_length=100)
    entity_id: str | None = Field(default=None, max_length=36)
    old_value: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    new_value: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    ip_address: str | None = Field(default=None, max_length=100)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
