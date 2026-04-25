"""Quality monitoring routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_data
from app.modules.quality_monitoring import service
from app.modules.quality_monitoring.schemas import (
    QualityResultRead,
    QualityRuleCreate,
    QualityRuleRead,
    QualityRuleUpdate,
)
from app.modules.users.models import User

router = APIRouter(tags=["quality-rules"])


@router.post(
    "/projects/{project_id}/quality-rules",
    response_model=QualityRuleRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_data)],
)
def create(project_id: str, payload: QualityRuleCreate, session: Session = Depends(get_session)):
    return service.create(session, project_id, payload)


@router.get("/projects/{project_id}/quality-rules", response_model=list[QualityRuleRead])
def list_(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_(session, project_id)


@router.get("/quality-rules/{rule_id}", response_model=QualityRuleRead)
def get_one(rule_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get(session, rule_id)


@router.put(
    "/quality-rules/{rule_id}",
    response_model=QualityRuleRead,
    dependencies=[Depends(require_data)],
)
def update(rule_id: str, payload: QualityRuleUpdate, session: Session = Depends(get_session)):
    return service.update(session, rule_id, payload)


@router.delete(
    "/quality-rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_data)],
)
def delete(rule_id: str, session: Session = Depends(get_session)):
    service.delete(session, rule_id)


@router.get("/quality-rules/{rule_id}/results", response_model=list[QualityResultRead])
def list_results(rule_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_results(session, rule_id)
