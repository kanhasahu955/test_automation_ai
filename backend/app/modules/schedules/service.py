"""Schedule services: CRUD, RedBeat sync, manual trigger, run history."""
from __future__ import annotations

from sqlmodel import Session, select

from app.core.errors import NotFoundError, ValidationFailed
from app.modules.executions.models import ExecutionRun
from app.modules.no_code_flows.models import NoCodeFlow
from app.modules.schedules import cron, redbeat_sync
from app.modules.schedules.models import (
    CadenceKind,
    Schedule,
    ScheduleStatus,
    ScheduleTargetType,
)
from app.modules.schedules.schemas import (
    Cadence,
    ScheduleCreate,
    ScheduleUpdate,
)
from app.modules.stm_converter.models import STMDocument
from app.modules.test_suites.models import TestSuite


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _validate_target(session: Session, project_id: str, target_type: ScheduleTargetType, target_id: str) -> None:
    """Guard rail: the schedule's target must exist within this project."""
    table = {
        ScheduleTargetType.TEST_SUITE: TestSuite,
        ScheduleTargetType.NO_CODE_FLOW: NoCodeFlow,
        ScheduleTargetType.STM_DOCUMENT: STMDocument,
    }[target_type]
    target = session.exec(select(table).where(table.id == target_id)).first()
    if not target:
        raise ValidationFailed(f"{target_type.value} with id {target_id} not found")
    target_project_id = getattr(target, "project_id", None)
    if target_project_id and target_project_id != project_id:
        raise ValidationFailed(
            f"{target_type.value} {target_id} does not belong to project {project_id}"
        )


def _apply_cadence(schedule: Schedule, cadence: Cadence, *, timezone: str) -> None:
    """Mutate ``schedule`` to reflect the given cadence + timezone."""
    expression = cron.cadence_to_cron(cadence)
    schedule.cron_expression = expression
    schedule.cadence_kind = cron.cadence_kind(cadence)
    schedule.cadence_config = cron.cadence_config(cadence)
    schedule.timezone = timezone
    schedule.next_run_at = cron.next_run_at(expression, timezone)


def _sync_redbeat(schedule: Schedule) -> None:
    redbeat_sync.upsert(
        schedule.id,
        cron_expression=schedule.cron_expression,
        timezone=schedule.timezone,
        enabled=schedule.status == ScheduleStatus.ACTIVE,
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
def create(session: Session, project_id: str, payload: ScheduleCreate, *, created_by: str) -> Schedule:
    _validate_target(session, project_id, payload.target_type, payload.target_id)

    schedule = Schedule(
        project_id=project_id,
        name=payload.name,
        description=payload.description,
        target_type=payload.target_type,
        target_id=payload.target_id,
        cadence_kind=CadenceKind.DAILY,  # overwritten by _apply_cadence
        cron_expression="0 0 * * *",     # overwritten by _apply_cadence
        timezone=payload.timezone,
        status=payload.status,
        expires_at=payload.expires_at,
        created_by=created_by,
    )
    _apply_cadence(schedule, payload.cadence, timezone=payload.timezone)

    session.add(schedule)
    session.commit()
    session.refresh(schedule)

    _sync_redbeat(schedule)
    return schedule


def update(session: Session, schedule_id: str, payload: ScheduleUpdate) -> Schedule:
    schedule = get(session, schedule_id)

    if payload.name is not None:
        schedule.name = payload.name
    if payload.description is not None:
        schedule.description = payload.description
    if payload.expires_at is not None:
        schedule.expires_at = payload.expires_at
    if payload.status is not None:
        schedule.status = payload.status

    if payload.cadence is not None:
        tz = payload.timezone or schedule.timezone
        _apply_cadence(schedule, payload.cadence, timezone=tz)
    elif payload.timezone is not None and payload.timezone != schedule.timezone:
        schedule.timezone = payload.timezone
        schedule.next_run_at = cron.next_run_at(schedule.cron_expression, schedule.timezone)

    session.add(schedule)
    session.commit()
    session.refresh(schedule)

    _sync_redbeat(schedule)
    return schedule


def get(session: Session, schedule_id: str) -> Schedule:
    schedule = session.exec(select(Schedule).where(Schedule.id == schedule_id)).first()
    if not schedule:
        raise NotFoundError("Schedule not found")
    return schedule


def list_(
    session: Session,
    project_id: str,
    *,
    status: ScheduleStatus | None = None,
    target_type: ScheduleTargetType | None = None,
    limit: int = 200,
) -> list[Schedule]:
    stmt = (
        select(Schedule)
        .where(Schedule.project_id == project_id)
        .order_by(Schedule.created_at.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(Schedule.status == status)
    if target_type:
        stmt = stmt.where(Schedule.target_type == target_type)
    return session.exec(stmt).all()


def set_status(session: Session, schedule_id: str, status: ScheduleStatus) -> Schedule:
    schedule = get(session, schedule_id)
    schedule.status = status
    if status == ScheduleStatus.ACTIVE:
        schedule.next_run_at = cron.next_run_at(schedule.cron_expression, schedule.timezone)
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    _sync_redbeat(schedule)
    return schedule


def delete(session: Session, schedule_id: str) -> None:
    schedule = get(session, schedule_id)
    session.delete(schedule)
    session.commit()
    redbeat_sync.remove(schedule_id)


# ---------------------------------------------------------------------------
# Execution helpers
# ---------------------------------------------------------------------------
def trigger_now(session: Session, schedule_id: str, *, triggered_by: str) -> dict:
    """Manually fire a schedule from the UI ("Run now" button).

    Returns the launched execution-run id; the caller can poll it via the
    standard ``/execution-runs/{id}/report`` endpoint.
    """
    schedule = get(session, schedule_id)
    return _launch_run(session, schedule, triggered_by=triggered_by)


def dispatch(session: Session, schedule_id: str) -> dict:
    """Called by the Celery beat dispatcher task when a schedule fires."""
    schedule = get(session, schedule_id)
    if schedule.status != ScheduleStatus.ACTIVE:
        return {"ok": False, "reason": "schedule_not_active"}
    return _launch_run(session, schedule, triggered_by=None, scheduled=True)


def _launch_run(
    session: Session,
    schedule: Schedule,
    *,
    triggered_by: str | None,
    scheduled: bool = False,
) -> dict:
    """Create the appropriate ExecutionRun + enqueue the worker task."""
    from app.modules.executions import service as exec_service
    from app.modules.executions.models import RunType
    from app.utils.datetime import utc_now_naive

    run_record: ExecutionRun
    if schedule.target_type == ScheduleTargetType.TEST_SUITE:
        run_dto = exec_service.create_suite_run(
            session, schedule.target_id, triggered_by or "scheduler"
        )
        run_record = session.exec(
            select(ExecutionRun).where(ExecutionRun.id == run_dto.id)
        ).one()
    elif schedule.target_type == ScheduleTargetType.NO_CODE_FLOW:
        run_dto = exec_service.create_flow_run(
            session, schedule.target_id, triggered_by or "scheduler"
        )
        run_record = session.exec(
            select(ExecutionRun).where(ExecutionRun.id == run_dto.id)
        ).one()
    elif schedule.target_type == ScheduleTargetType.STM_DOCUMENT:
        run_record = _launch_stm_run(session, schedule, triggered_by=triggered_by)
    else:  # pragma: no cover — exhausted enum.
        raise ValidationFailed(f"Unsupported target type {schedule.target_type}")

    run_record.schedule_id = schedule.id
    if scheduled:
        run_record.run_type = RunType.SCHEDULED
    schedule.last_run_at = utc_now_naive()
    schedule.last_run_id = run_record.id
    schedule.total_runs += 1
    schedule.next_run_at = cron.next_run_at(schedule.cron_expression, schedule.timezone)
    session.add(run_record)
    session.add(schedule)
    session.commit()

    return {"ok": True, "run_id": run_record.id, "schedule_id": schedule.id}


def _launch_stm_run(
    session: Session, schedule: Schedule, *, triggered_by: str | None
) -> ExecutionRun:
    """Create an ExecutionRun for an STM-validation schedule and enqueue the worker."""
    from app.modules.executions.models import ExecutionRun, RunStatus, RunType

    doc = session.exec(
        select(STMDocument).where(STMDocument.id == schedule.target_id)
    ).first()
    if not doc:
        raise ValidationFailed("STM document target no longer exists")

    run = ExecutionRun(
        project_id=schedule.project_id,
        triggered_by=triggered_by,
        run_type=RunType.MANUAL,
        status=RunStatus.PENDING,
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    try:
        from app.workers.tasks import stm_tasks

        stm_tasks.run_stm_validation.delay(
            schedule.target_id, None, triggered_by, False
        )
    except Exception:
        # No broker in dev — caller still gets a run row.
        pass
    return run
