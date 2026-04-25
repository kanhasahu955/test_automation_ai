"""Test case routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_qa
from app.modules.test_cases import service
from app.modules.test_cases.schemas import TestCaseCreate, TestCaseRead, TestCaseUpdate
from app.modules.users.models import User
from app.utils.pagination import Page, PageParams, page_of, page_params

router = APIRouter(tags=["test-cases"])


@router.post(
    "/projects/{project_id}/test-cases",
    response_model=TestCaseRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_qa)],
)
def create(
    project_id: str,
    payload: TestCaseCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return service.create(session, project_id, payload, current_user.id)


@router.get("/projects/{project_id}/test-cases", response_model=Page[TestCaseRead])
def list_(
    project_id: str,
    search: str | None = None,
    params: PageParams = Depends(page_params),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    items, total = service.list_(session, project_id, params, search)
    return page_of(items, total, params)


@router.get("/test-cases/{test_case_id}", response_model=TestCaseRead)
def get_one(test_case_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get(session, test_case_id)


@router.put(
    "/test-cases/{test_case_id}",
    response_model=TestCaseRead,
    dependencies=[Depends(require_qa)],
)
def update(test_case_id: str, payload: TestCaseUpdate, session: Session = Depends(get_session)):
    return service.update(session, test_case_id, payload)


@router.delete(
    "/test-cases/{test_case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_qa)],
)
def delete(test_case_id: str, session: Session = Depends(get_session)):
    service.delete(session, test_case_id)
