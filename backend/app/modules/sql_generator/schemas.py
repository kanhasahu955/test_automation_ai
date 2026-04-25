"""SQL generator DTOs."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.sql_generator.models import ExpectedResultType


class GeneratedSqlBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sql_query: str
    expected_result_type: ExpectedResultType = ExpectedResultType.ZERO_ROWS
    stm_mapping_id: str | None = None


class GeneratedSqlCreate(GeneratedSqlBase):
    created_by_ai: bool = False


class GeneratedSqlUpdate(BaseModel):
    name: str | None = None
    sql_query: str | None = None
    expected_result_type: ExpectedResultType | None = None


class GeneratedSqlRead(GeneratedSqlBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    created_by_ai: bool
    created_at: datetime | None = None
