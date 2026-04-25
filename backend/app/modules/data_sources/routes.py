"""Data source routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_data
from app.modules.data_sources import service
from app.modules.data_sources.schemas import (
    DataSourceCreate,
    DataSourceRead,
    DataSourceUpdate,
    TestConnectionResult,
)
from app.modules.users.models import User

router = APIRouter(tags=["data-sources"])


@router.post(
    "/projects/{project_id}/data-sources",
    response_model=DataSourceRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_data)],
)
def create(project_id: str, payload: DataSourceCreate, session: Session = Depends(get_session)):
    return service.create(session, project_id, payload)


@router.get("/projects/{project_id}/data-sources", response_model=list[DataSourceRead])
def list_(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_(session, project_id)


@router.get("/data-sources/{ds_id}", response_model=DataSourceRead)
def get_one(ds_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get(session, ds_id)


@router.put("/data-sources/{ds_id}", response_model=DataSourceRead, dependencies=[Depends(require_data)])
def update(ds_id: str, payload: DataSourceUpdate, session: Session = Depends(get_session)):
    return service.update(session, ds_id, payload)


@router.delete(
    "/data-sources/{ds_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_data)],
)
def delete(ds_id: str, session: Session = Depends(get_session)):
    service.delete(session, ds_id)


@router.post(
    "/data-sources/{ds_id}/test-connection",
    response_model=TestConnectionResult,
    dependencies=[Depends(require_data)],
)
def test_connection(ds_id: str, session: Session = Depends(get_session)):
    ds = service.get(session, ds_id)
    return service.test_connection(ds)


@router.post("/data-sources/{ds_id}/scan-metadata", dependencies=[Depends(require_data)])
def scan_metadata(ds_id: str, session: Session = Depends(get_session)):
    """Trigger an async metadata scan job."""
    ds = service.get(session, ds_id)
    try:
        from app.workers.tasks import metadata_tasks

        metadata_tasks.scan_metadata.delay(ds.id)
    except Exception:
        pass
    return {"status": "queued", "data_source_id": ds.id}
