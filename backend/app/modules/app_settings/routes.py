"""Settings routes (admin-only writes)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_admin
from app.modules.app_settings import service
from app.modules.app_settings.schemas import (
    LlmSettingsRead,
    LlmSettingsUpdate,
    LlmTestRequest,
    LlmTestResult,
    NotificationSettings,
)
from app.modules.users.models import User

router = APIRouter(prefix="/settings", tags=["settings"])


# ---------- LLM ---------------------------------------------------------------

@router.get("/llm", response_model=LlmSettingsRead)
def get_llm(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.get_llm(session)


@router.put(
    "/llm",
    response_model=LlmSettingsRead,
    dependencies=[Depends(require_admin)],
)
def update_llm(
    payload: LlmSettingsUpdate,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return service.update_llm(session, payload, current.id)


@router.post(
    "/llm/test",
    response_model=LlmTestResult,
    dependencies=[Depends(require_admin)],
)
def test_llm(
    payload: LlmTestRequest,
    session: Session = Depends(get_session),
):
    return service.test_llm(session, payload)


# ---------- Notifications -----------------------------------------------------

@router.get("/notifications", response_model=NotificationSettings)
def get_notifications(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.get_notifications(session)


@router.put(
    "/notifications",
    response_model=NotificationSettings,
    dependencies=[Depends(require_admin)],
)
def update_notifications(
    payload: NotificationSettings,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return service.update_notifications(session, payload, current.id)
