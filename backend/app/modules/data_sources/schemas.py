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
