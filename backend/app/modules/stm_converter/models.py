"""STM document + mapping models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class STMStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PARSED = "PARSED"
    FAILED = "FAILED"


class ValidationType(str, Enum):
    ROW_COUNT = "ROW_COUNT"
    NULL_CHECK = "NULL_CHECK"
    DUPLICATE_CHECK = "DUPLICATE_CHECK"
    TRANSFORMATION_CHECK = "TRANSFORMATION_CHECK"
    REFERENCE_CHECK = "REFERENCE_CHECK"


class STMDocument(SQLModel, table=True):
    __tablename__ = "stm_documents"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    file_name: str = Field(max_length=255)
    file_path: str = Field(max_length=500)
    status: STMStatus = Field(default=STMStatus.UPLOADED)
    uploaded_by: str | None = Field(default=None, foreign_key="users.id", max_length=36)

    notes: str | None = Field(default=None, sa_column=Column(Text))
    is_completed: bool = Field(default=False, index=True)
    completed_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class STMMapping(SQLModel, table=True):
    __tablename__ = "stm_mappings"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    stm_document_id: str = Field(foreign_key="stm_documents.id", max_length=36, index=True)
    source_table: str | None = Field(default=None, max_length=255)
    source_column: str | None = Field(default=None, max_length=255)
    target_table: str | None = Field(default=None, max_length=255)
    target_column: str | None = Field(default=None, max_length=255)
    join_key: str | None = Field(default=None, max_length=255)
    transformation_rule: str | None = Field(default=None, sa_column=Column(Text))
    validation_type: ValidationType = Field(default=ValidationType.TRANSFORMATION_CHECK)
    mapping_json: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
