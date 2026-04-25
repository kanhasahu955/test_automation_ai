"""Profiling routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_data
from app.modules.data_profiling import service
from app.modules.data_profiling.schemas import ProfilingRunRead
from app.modules.users.models import User

router = APIRouter(tags=["data-profiling"])


@router.post(
    "/data-sources/{ds_id}/profile",
    response_model=ProfilingRunRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_data)],
)
def trigger(ds_id: str, session: Session = Depends(get_session)):
    return service.trigger_profile(session, ds_id)


@router.get("/profiling-runs/{run_id}", response_model=ProfilingRunRead)
def get_run(run_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get(session, run_id)


@router.get("/projects/{project_id}/profiling-runs", response_model=list[ProfilingRunRead])
def list_(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_(session, project_id)
