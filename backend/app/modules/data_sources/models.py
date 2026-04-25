"""Data source models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class SourceType(str, Enum):
    MYSQL = "MYSQL"
    POSTGRESQL = "POSTGRESQL"
    SNOWFLAKE = "SNOWFLAKE"
    BIGQUERY = "BIGQUERY"
    API = "API"


class DataSource(SQLModel, table=True):
    __tablename__ = "data_sources"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    name: str = Field(max_length=255)
    source_type: SourceType
    host: str | None = Field(default=None, max_length=255)
    port: int | None = None
    database_name: str | None = Field(default=None, max_length=255)
    username: str | None = Field(default=None, max_length=255)
    encrypted_password: str | None = Field(default=None, sa_column=Column(Text))
    extra_config: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    is_active: bool = Field(default=True)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
