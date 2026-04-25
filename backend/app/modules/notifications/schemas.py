"""Notification DTOs."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.modules.notifications.models import Channel, NotificationStatus


class NotificationCreate(BaseModel):
    channel: Channel
    recipient: str | None = None
    event_type: str | None = None
    message: str | None = None
    project_id: str | None = None


class NotificationRead(NotificationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: NotificationStatus
    created_at: datetime | None = None
