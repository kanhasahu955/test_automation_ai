"""Notification services."""
from __future__ import annotations

from sqlmodel import Session, select

from app.modules.notifications.models import Notification, NotificationStatus
from app.modules.notifications.schemas import NotificationCreate


def create(session: Session, payload: NotificationCreate) -> Notification:
    record = Notification(**payload.model_dump())
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_(session: Session, project_id: str | None = None, limit: int = 100) -> list[Notification]:
    stmt = select(Notification).order_by(Notification.created_at.desc()).limit(limit)
    if project_id:
        stmt = stmt.where(Notification.project_id == project_id)
    return session.exec(stmt).all()


def mark_sent(session: Session, notification_id: str) -> None:
    record = session.exec(select(Notification).where(Notification.id == notification_id)).first()
    if record:
        record.status = NotificationStatus.SENT
        session.add(record)
        session.commit()
