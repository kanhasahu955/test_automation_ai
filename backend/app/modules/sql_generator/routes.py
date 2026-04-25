"""SQL generator routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_data
from app.modules.sql_generator import service
from app.modules.sql_generator.schemas import (
    GeneratedSqlCreate,
    GeneratedSqlRead,
    GeneratedSqlUpdate,
)
from app.modules.users.models import User

router = APIRouter(tags=["sql-tests"])


@router.post(
    "/projects/{project_id}/sql-tests",
    response_model=GeneratedSqlRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_data)],
)
def create(project_id: str, payload: GeneratedSqlCreate, session: Session = Depends(get_session)):
    return service.create(
        session,
        project_id=project_id,
        name=payload.name,
        sql_query=payload.sql_query,
        stm_mapping_id=payload.stm_mapping_id,
        expected_result_type=payload.expected_result_type,
        created_by_ai=payload.created_by_ai,
    )


@router.get("/projects/{project_id}/sql-tests", response_model=list[GeneratedSqlRead])
def list_(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_(session, project_id)


@router.get("/sql-tests/{sql_id}", response_model=GeneratedSqlRead)
def get_one(sql_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.get(session, sql_id)


@router.put(
    "/sql-tests/{sql_id}",
    response_model=GeneratedSqlRead,
    dependencies=[Depends(require_data)],
)
def update(sql_id: str, payload: GeneratedSqlUpdate, session: Session = Depends(get_session)):
    return service.update(session, sql_id, payload)


@router.delete(
    "/sql-tests/{sql_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_data)],
)
def delete(sql_id: str, session: Session = Depends(get_session)):
    service.delete(session, sql_id)
