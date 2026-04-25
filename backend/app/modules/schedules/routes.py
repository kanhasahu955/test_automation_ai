"""Schedule routes.

REST surface for the in-app *Schedules* feature. Mirrors the conventions of
the test-suites module — tagged router, ``response_model`` everywhere,
``require_qa`` on mutating endpoints.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_qa
from app.modules.executions.schemas import ExecutionRunRead
from app.modules.executions.service import list_runs as list_execution_runs
from app.modules.schedules import cron, service
from app.modules.schedules.models import ScheduleStatus, ScheduleTargetType
from app.modules.schedules.schemas import (
    ScheduleCreate,
    SchedulePreviewRequest,
    SchedulePreviewResponse,
    ScheduleRead,
    ScheduleUpdate,
)
from app.modules.users.models import User

router = APIRouter(tags=["schedules"])


# ---------------------------------------------------------------------------
# Cron preview — used by the UI's CronBuilder to validate before save.
# ---------------------------------------------------------------------------
@router.post("/schedules/preview", response_model=SchedulePreviewResponse)
def preview(payload: SchedulePreviewRequest, _: User = Depends(get_current_user)):
    """Render the cron string + next *N* fire times for a cadence."""
    expression = cron.cadence_to_cron(payload.cadence)
    return SchedulePreviewResponse(
        cron_expression=expression,
        timezone=payload.timezone,
        next_runs=cron.next_runs(expression, payload.timezone, payload.occurrences),
        description=cron.cadence_description(payload.cadence),
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
@router.post(
    "/projects/{project_id}/schedules",
    response_model=ScheduleRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_qa)],
)
def create_schedule(
    project_id: str,
    payload: ScheduleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return service.create(session, project_id, payload, created_by=current_user.id)


@router.get("/projects/{project_id}/schedules", response_model=list[ScheduleRead])
def list_schedules(
    project_id: str,
    status_filter: ScheduleStatus | None = None,
    target_type: ScheduleTargetType | None = None,
    limit: int = 200,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.list_(
        session, project_id,
        status=status_filter, target_type=target_type, limit=limit,
    )


@router.get("/schedules/{schedule_id}", response_model=ScheduleRead)
def get_schedule(
    schedule_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.get(session, schedule_id)


@router.patch(
    "/schedules/{schedule_id}",
    response_model=ScheduleRead,
    dependencies=[Depends(require_qa)],
)
def update_schedule(
    schedule_id: str,
    payload: ScheduleUpdate,
    session: Session = Depends(get_session),
):
    return service.update(session, schedule_id, payload)


@router.delete(
    "/schedules/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_qa)],
)
def delete_schedule(
    schedule_id: str,
    session: Session = Depends(get_session),
):
    service.delete(session, schedule_id)


# ---------------------------------------------------------------------------
# Lifecycle helpers
# ---------------------------------------------------------------------------
@router.post(
    "/schedules/{schedule_id}/pause",
    response_model=ScheduleRead,
    dependencies=[Depends(require_qa)],
)
def pause_schedule(schedule_id: str, session: Session = Depends(get_session)):
    return service.set_status(session, schedule_id, ScheduleStatus.PAUSED)


@router.post(
    "/schedules/{schedule_id}/resume",
    response_model=ScheduleRead,
    dependencies=[Depends(require_qa)],
)
def resume_schedule(schedule_id: str, session: Session = Depends(get_session)):
    return service.set_status(session, schedule_id, ScheduleStatus.ACTIVE)


@router.post("/schedules/{schedule_id}/run-now", dependencies=[Depends(require_qa)])
def run_schedule_now(
    schedule_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Fire the schedule immediately — useful for ad-hoc smoke runs."""
    return service.trigger_now(session, schedule_id, triggered_by=current_user.id)


# ---------------------------------------------------------------------------
# History — runs launched by this schedule.
# ---------------------------------------------------------------------------
@router.get("/schedules/{schedule_id}/runs", response_model=list[ExecutionRunRead])
def list_schedule_runs(
    schedule_id: str,
    limit: int = 50,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    schedule = service.get(session, schedule_id)
    return list_execution_runs(session, schedule.project_id, limit, schedule_id=schedule.id)
