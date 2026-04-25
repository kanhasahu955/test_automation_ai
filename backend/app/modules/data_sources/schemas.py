"""Data source DTOs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.data_sources.models import SourceType


class DataSourceBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source_type: SourceType
    host: str | None = None
    port: int | None = Field(default=None, ge=1, le=65535)
    database_name: str | None = None
    username: str | None = None
    extra_config: dict[str, Any] | None = None
    is_active: bool = True


class DataSourceCreate(DataSourceBase):
    password: str | None = None


class DataSourceUpdate(BaseModel):
    name: str | None = None
    host: str | None = None
    port: int | None = None
    database_name: str | None = None
    username: str | None = None
    password: str | None = None
    extra_config: dict[str, Any] | None = None
    is_active: bool | None = None


class DataSourceRead(DataSourceBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    created_at: datetime | None = None


class TestConnectionResult(BaseModel):
    ok: bool
    message: str


class DatabaseListResponse(BaseModel):
    """Catalog names: MySQL ``SHOW DATABASES`` (system DBs filtered); Postgres ``pg_database``."""

    databases: list[str] = Field(default_factory=list)


class LiveTableRead(BaseModel):
    """A physical table in the selected database (``schema`` is ``None`` for MySQL)."""

    schema_name: str | None = None
    table_name: str


class LiveColumnRead(BaseModel):
    """One column as reported by ``sqlalchemy.inspect``."""

    name: str
    data_type: str
    nullable: bool
    is_pk: bool
    is_fk: bool
    default: str | None = None
    autoincrement: bool | None = None
    comment: str | None = None


class LiveForeignKeyEdge(BaseModel):
    """One end of an FK: source column → target column (for ER / React Flow)."""

    constrained_schema: str | None = None
    constrained_table: str
    constrained_column: str
    referred_schema: str | None = None
    referred_table: str
    referred_column: str


class LiveTablesResponse(BaseModel):
    tables: list[LiveTableRead] = Field(default_factory=list)


class LiveColumnsResponse(BaseModel):
    columns: list[LiveColumnRead] = Field(default_factory=list)


class LiveRelationsResponse(BaseModel):
    relations: list[LiveForeignKeyEdge] = Field(default_factory=list)
