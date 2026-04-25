"""Environment routes (nested under projects)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_manager
from app.modules.environments import service
from app.modules.environments.schemas import (
    EnvironmentCreate,
    EnvironmentRead,
    EnvironmentUpdate,
)
from app.modules.users.models import User

router = APIRouter(tags=["environments"])


@router.post(
    "/projects/{project_id}/environments",
    response_model=EnvironmentRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_manager)],
)
def create(project_id: str, payload: EnvironmentCreate, session: Session = Depends(get_session)):
    return service.create(session, project_id, payload)


@router.get("/projects/{project_id}/environments", response_model=list[EnvironmentRead])
def list_(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_by_project(session, project_id)


@router.get("/environments/{env_id}", response_model=EnvironmentRead)
def get_one(env_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get(session, env_id)


@router.put(
    "/environments/{env_id}",
    response_model=EnvironmentRead,
    dependencies=[Depends(require_manager)],
)
def update(env_id: str, payload: EnvironmentUpdate, session: Session = Depends(get_session)):
    return service.update(session, env_id, payload)


@router.delete(
    "/environments/{env_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_manager)],
)
def delete(env_id: str, session: Session = Depends(get_session)):
    service.delete(session, env_id)
