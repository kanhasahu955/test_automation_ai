"""Execution routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user
from app.modules.executions import service
from app.modules.executions.schemas import ExecutionReport, ExecutionRunRead
from app.modules.users.models import User

router = APIRouter(tags=["executions"])


@router.get("/projects/{project_id}/execution-runs", response_model=list[ExecutionRunRead])
def list_runs(
    project_id: str,
    limit: int = 50,
    schedule_id: str | None = None,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """List execution runs. Pass ``schedule_id`` to scope to a single schedule."""
    return service.list_runs(session, project_id, limit, schedule_id=schedule_id)


@router.get("/execution-runs/{run_id}/report", response_model=ExecutionReport)
def report(run_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get_report(session, run_id)
