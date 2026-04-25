"""Metadata explorer models."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Numeric, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class MetadataTable(SQLModel, table=True):
    __tablename__ = "metadata_tables"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    data_source_id: str = Field(foreign_key="data_sources.id", max_length=36, index=True)
    schema_name: str | None = Field(default=None, max_length=255)
    table_name: str = Field(max_length=255)
    row_count: int | None = None
    table_type: str | None = Field(default=None, max_length=100)
    last_scanned_at: datetime | None = None
    quality_score: Decimal | None = Field(default=None, sa_column=Column(Numeric(5, 2)))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class MetadataColumn(SQLModel, table=True):
    __tablename__ = "metadata_columns"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    metadata_table_id: str = Field(foreign_key="metadata_tables.id", max_length=36, index=True)
    column_name: str = Field(max_length=255)
    data_type: str | None = Field(default=None, max_length=100)
    is_nullable: bool | None = None
    is_primary_key: bool = Field(default=False)
    is_foreign_key: bool = Field(default=False)
    distinct_count: int | None = None
    null_count: int | None = None
    null_percentage: Decimal | None = Field(default=None, sa_column=Column(Numeric(5, 2)))
    min_value: str | None = None
    max_value: str | None = None
    sample_values: list[Any] | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
