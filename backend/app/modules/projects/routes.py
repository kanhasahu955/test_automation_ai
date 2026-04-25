"""Project routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_manager
from app.modules.projects import service
from app.modules.projects.schemas import ProjectCreate, ProjectRead, ProjectUpdate
from app.modules.users.models import User
from app.utils.pagination import Page, PageParams, page_of, page_params

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_manager)],
)
def create(
    payload: ProjectCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return service.create_project(session, payload, owner_id=current_user.id)


@router.get("", response_model=Page[ProjectRead])
def list_(
    search: str | None = None,
    params: PageParams = Depends(page_params),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    items, total = service.list_projects(session, params, search)
    return page_of([ProjectRead.model_validate(p) for p in items], total, params)


@router.get("/{project_id}", response_model=ProjectRead)
def get_one(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get_project(session, project_id)


@router.put(
    "/{project_id}",
    response_model=ProjectRead,
    dependencies=[Depends(require_manager)],
)
def update(project_id: str, payload: ProjectUpdate, session: Session = Depends(get_session)):
    return service.update_project(session, project_id, payload)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_manager)],
)
def delete(project_id: str, session: Session = Depends(get_session)):
    service.delete_project(session, project_id)
