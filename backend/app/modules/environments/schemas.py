"""Environment DTOs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EnvironmentBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: str | None = Field(default=None, max_length=500)
    db_connection_id: str | None = Field(default=None, max_length=36)
    variables: dict[str, Any] | None = None


class EnvironmentCreate(EnvironmentBase):
    pass


class EnvironmentUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    db_connection_id: str | None = None
    variables: dict[str, Any] | None = None


class EnvironmentRead(EnvironmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    created_at: datetime | None = None
