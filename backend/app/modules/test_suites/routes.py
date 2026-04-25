"""Test suite routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_qa
from app.modules.test_suites import service
from app.modules.test_suites.schemas import (
    RunSuiteRequest,
    SuiteCaseAdd,
    SuiteCaseRead,
    TestSuiteCreate,
    TestSuiteRead,
)
from app.modules.users.models import User

router = APIRouter(tags=["test-suites"])


@router.post(
    "/projects/{project_id}/test-suites",
    response_model=TestSuiteRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_qa)],
)
def create(
    project_id: str,
    payload: TestSuiteCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return service.create(session, project_id, payload, current_user.id)


@router.get("/projects/{project_id}/test-suites", response_model=list[TestSuiteRead])
def list_(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_(session, project_id)


@router.get("/test-suites/{suite_id}", response_model=TestSuiteRead)
def get_one(suite_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get(session, suite_id)


@router.post(
    "/test-suites/{suite_id}/cases",
    response_model=SuiteCaseRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_qa)],
)
def add_case(suite_id: str, payload: SuiteCaseAdd, session: Session = Depends(get_session)):
    return service.add_case(session, suite_id, payload)


@router.get("/test-suites/{suite_id}/cases", response_model=list[SuiteCaseRead])
def list_cases(suite_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_cases(session, suite_id)


@router.delete(
    "/test-suites/{suite_id}/cases/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_qa)],
)
def remove_case(suite_id: str, link_id: str, session: Session = Depends(get_session)):
    service.remove_case(session, suite_id, link_id)


@router.post("/test-suites/{suite_id}/run", dependencies=[Depends(require_qa)])
def run_suite(
    suite_id: str,
    payload: RunSuiteRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Trigger an execution run for the entire suite."""
    from app.modules.executions import service as exec_service

    return exec_service.create_suite_run(session, suite_id, current_user.id, payload.environment_id)
