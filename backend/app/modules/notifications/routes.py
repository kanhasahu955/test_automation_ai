"""Notification routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_admin
from app.modules.notifications import service
from app.modules.notifications.schemas import NotificationCreate, NotificationRead
from app.modules.users.models import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post(
    "",
    response_model=NotificationRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create(payload: NotificationCreate, session: Session = Depends(get_session)):
    return service.create(session, payload)


@router.get("", response_model=list[NotificationRead])
def list_(
    project_id: str | None = None,
    limit: int = 100,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.list_(session, project_id, limit)
