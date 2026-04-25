"""Metadata routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user
from app.modules.metadata import service
from app.modules.metadata.schemas import (
    MetadataColumnRead,
    MetadataSearchResults,
    MetadataSummary,
    MetadataTableRead,
)
from app.modules.users.models import User

router = APIRouter(tags=["metadata"])


@router.get("/data-sources/{ds_id}/metadata/tables", response_model=list[MetadataTableRead])
def list_tables(ds_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_tables(session, ds_id)


@router.get("/data-sources/{ds_id}/metadata/summary", response_model=MetadataSummary)
def get_summary(
    ds_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.get_summary(session, ds_id)


@router.get("/data-sources/{ds_id}/metadata/search", response_model=MetadataSearchResults)
def search(
    ds_id: str,
    q: str = Query("", min_length=0, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.search(session, ds_id, q, limit)


@router.get("/metadata/tables/{table_id}", response_model=MetadataTableRead)
def get_table(
    table_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.get_table(session, table_id)


@router.get("/metadata/tables/{table_id}/columns", response_model=list[MetadataColumnRead])
def list_columns(table_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_columns(session, table_id)


@router.get("/metadata/columns/{column_id}", response_model=MetadataColumnRead)
def get_column(
    column_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return service.get_column(session, column_id)
