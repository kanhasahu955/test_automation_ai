"""Data profiling services."""
from __future__ import annotations

from sqlmodel import Session, select

from app.core.errors import NotFoundError
from app.modules.data_profiling.models import DataProfilingRun, ProfileStatus
from app.modules.data_sources.models import DataSource


def trigger_profile(session: Session, data_source_id: str) -> DataProfilingRun:
    ds = session.exec(select(DataSource).where(DataSource.id == data_source_id)).first()
    if not ds:
        raise NotFoundError("Data source not found")
    run = DataProfilingRun(
        project_id=ds.project_id,
        data_source_id=ds.id,
        status=ProfileStatus.PENDING,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    try:
        from app.workers.tasks import profiling_tasks

        profiling_tasks.run_profiling.delay(run.id)
    except Exception:
        pass
    return run


def get(session: Session, run_id: str) -> DataProfilingRun:
    run = session.exec(select(DataProfilingRun).where(DataProfilingRun.id == run_id)).first()
    if not run:
        raise NotFoundError("Profiling run not found")
    return run


def list_(session: Session, project_id: str) -> list[DataProfilingRun]:
    return session.exec(
        select(DataProfilingRun)
        .where(DataProfilingRun.project_id == project_id)
        .order_by(DataProfilingRun.created_at.desc())
    ).all()
