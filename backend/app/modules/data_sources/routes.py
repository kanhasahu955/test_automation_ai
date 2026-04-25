"""Data source routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_data
from app.modules.data_sources import service
from app.modules.data_sources.schemas import (
    DatabaseListResponse,
    DataSourceCreate,
    DataSourceRead,
    DataSourceUpdate,
    LiveColumnRead,
    LiveColumnsResponse,
    LiveForeignKeyEdge,
    LiveRelationsResponse,
    LiveTableRead,
    LiveTablesResponse,
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


@router.get(
    "/data-sources/{ds_id}/databases",
    response_model=DatabaseListResponse,
)
def list_databases(ds_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """List databases the credentials can see (no database name required in the connection)."""
    return DatabaseListResponse(databases=service.list_databases_on_server(session, ds_id))


@router.get(
    "/data-sources/{ds_id}/live/tables",
    response_model=LiveTablesResponse,
)
def live_tables(
    ds_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
    database: str = Query(..., min_length=1, max_length=128, description="Catalog to introspect"),
):
    """Live table list (MySQL/PostgreSQL) without a prior metadata scan."""
    try:
        rows = service.live_list_tables(session, ds_id, database)
        return LiveTablesResponse(tables=[LiveTableRead(**r) for r in rows])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    "/data-sources/{ds_id}/live/columns",
    response_model=LiveColumnsResponse,
)
def live_columns(
    ds_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
    database: str = Query(..., min_length=1, max_length=128),
    table: str = Query(..., min_length=1, max_length=256),
    schema: str | None = Query(
        default=None,
        max_length=256,
        description="Required for PostgreSQL (default public if omitted in UI)",
    ),
):
    try:
        # Allow PG clients to omit schema → public
        sch = schema
        ds = service.get(session, ds_id)
        if ds.source_type == "POSTGRESQL" and not (sch and sch.strip()):
            sch = "public"
        rows = service.live_list_columns(session, ds_id, database, table, sch)
        return LiveColumnsResponse(columns=[LiveColumnRead(**r) for r in rows])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get(
    "/data-sources/{ds_id}/live/relations",
    response_model=LiveRelationsResponse,
)
def live_relations(
    ds_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
    database: str = Query(..., min_length=1, max_length=128),
):
    """Foreign-key edges for ER / React Flow."""
    try:
        rows = service.live_list_relations(session, ds_id, database)
        return LiveRelationsResponse(relations=[LiveForeignKeyEdge(**r) for r in rows])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


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
