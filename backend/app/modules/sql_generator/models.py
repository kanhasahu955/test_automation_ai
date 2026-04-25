"""Generated SQL test models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class ExpectedResultType(str, Enum):
    ZERO_ROWS = "ZERO_ROWS"
    MATCH_COUNT = "MATCH_COUNT"
    THRESHOLD = "THRESHOLD"
    CUSTOM = "CUSTOM"


class GeneratedSqlTest(SQLModel, table=True):
    __tablename__ = "generated_sql_tests"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    stm_mapping_id: str | None = Field(default=None, foreign_key="stm_mappings.id", max_length=36)
    name: str = Field(max_length=255)
    sql_query: str = Field(sa_column=Column(Text, nullable=False))
    expected_result_type: ExpectedResultType = Field(default=ExpectedResultType.ZERO_ROWS)
    created_by_ai: bool = Field(default=False)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
