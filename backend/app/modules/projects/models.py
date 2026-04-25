"""Project models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class ProjectStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    name: str = Field(max_length=200, index=True)
    description: str | None = Field(default=None, sa_column=Column(Text))
    owner_id: str | None = Field(default=None, foreign_key="users.id", max_length=36)
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE)

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
