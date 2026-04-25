"""Audit log services."""
from __future__ import annotations

from typing import Any

from sqlmodel import Session, select

from app.modules.audit_logs.models import AuditLog


def record(
    session: Session,
    action: str,
    user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


def list_(session: Session, limit: int = 200) -> list[AuditLog]:
    return session.exec(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
