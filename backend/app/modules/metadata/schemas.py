"""Metadata DTOs."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MetadataTableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    data_source_id: str
    schema_name: str | None = None
    table_name: str
    row_count: int | None = None
    table_type: str | None = None
    last_scanned_at: datetime | None = None
    quality_score: Decimal | None = None
    created_at: datetime | None = None


class MetadataColumnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    metadata_table_id: str
    column_name: str
    data_type: str | None = None
    is_nullable: bool | None = None
    is_primary_key: bool
    is_foreign_key: bool
    distinct_count: int | None = None
    null_count: int | None = None
    null_percentage: Decimal | None = None
    min_value: str | None = None
    max_value: str | None = None
    sample_values: list[Any] | None = None


class MetadataSummary(BaseModel):
    """Connection-level KPIs surfaced on the data discovery page."""

    table_count: int = 0
    column_count: int = 0
    total_rows: int = 0
    avg_quality_score: float | None = None
    last_scanned_at: datetime | None = None


class MetadataColumnHit(BaseModel):
    """Search hit describing a column and its parent table at a glance."""

    id: str
    metadata_table_id: str
    column_name: str
    data_type: str | None = None
    table_name: str
    schema_name: str | None = None


class MetadataSearchResults(BaseModel):
    tables: list[MetadataTableRead] = Field(default_factory=list)
    columns: list[MetadataColumnHit] = Field(default_factory=list)
