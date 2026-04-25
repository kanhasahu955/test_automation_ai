"""Audit log routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import require_admin
from app.modules.audit_logs import service
from app.modules.audit_logs.schemas import AuditLogRead

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[AuditLogRead])
def list_(limit: int = 200, session: Session = Depends(get_session)):
    return service.list_(session, limit)
