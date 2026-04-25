"""No-code flow routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_qa
from app.modules.no_code_flows import service
from app.modules.no_code_flows.schemas import (
    FlowCompileResult,
    FlowCreate,
    FlowRead,
    FlowUpdate,
)
from app.modules.users.models import User

router = APIRouter(tags=["no-code-flows"])


@router.post(
    "/projects/{project_id}/flows",
    response_model=FlowRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_qa)],
)
def create(
    project_id: str,
    payload: FlowCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return service.create(session, project_id, payload, current_user.id)


@router.get("/projects/{project_id}/flows", response_model=list[FlowRead])
def list_(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_(session, project_id)


@router.get("/flows/{flow_id}", response_model=FlowRead)
def get_one(flow_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get(session, flow_id)


@router.put("/flows/{flow_id}", response_model=FlowRead, dependencies=[Depends(require_qa)])
def update(flow_id: str, payload: FlowUpdate, session: Session = Depends(get_session)):
    return service.update(session, flow_id, payload)


@router.post(
    "/flows/{flow_id}/compile",
    response_model=FlowCompileResult,
    dependencies=[Depends(require_qa)],
)
def compile_(flow_id: str, session: Session = Depends(get_session)):
    return service.compile_and_save(session, flow_id)


@router.post("/flows/{flow_id}/run", dependencies=[Depends(require_qa)])
def run_flow(flow_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    from app.modules.executions import service as exec_service

    return exec_service.create_flow_run(session, flow_id, current_user.id)


@router.delete("/flows/{flow_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_qa)])
def delete(flow_id: str, session: Session = Depends(get_session)):
    service.delete(session, flow_id)
