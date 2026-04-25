"""Environment models."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class Environment(SQLModel, table=True):
    __tablename__ = "environments"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    name: str = Field(max_length=100)
    base_url: str | None = Field(default=None, max_length=500)
    db_connection_id: str | None = Field(default=None, max_length=36)
    variables: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
