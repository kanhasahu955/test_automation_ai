"""Notification models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class Channel(str, Enum):
    EMAIL = "EMAIL"
    SLACK = "SLACK"
    TEAMS = "TEAMS"
    WEBHOOK = "WEBHOOK"


class NotificationStatus(str, Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str | None = Field(default=None, foreign_key="projects.id", max_length=36)
    channel: Channel
    recipient: str | None = Field(default=None, max_length=500)
    event_type: str | None = Field(default=None, max_length=100)
    message: str | None = Field(default=None, sa_column=Column(Text))
    status: NotificationStatus = Field(default=NotificationStatus.PENDING)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
