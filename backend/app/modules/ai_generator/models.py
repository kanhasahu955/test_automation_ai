"""AI prompt history models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class PromptType(str, Enum):
    TEST_CASE_GENERATION = "TEST_CASE_GENERATION"
    SQL_GENERATION = "SQL_GENERATION"
    FAILURE_ANALYSIS = "FAILURE_ANALYSIS"
    FLOW_GENERATION = "FLOW_GENERATION"


class AIPromptHistory(SQLModel, table=True):
    __tablename__ = "ai_prompt_history"
    model_config = {"protected_namespaces": ()}

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str | None = Field(default=None, foreign_key="projects.id", max_length=36)
    user_id: str | None = Field(default=None, foreign_key="users.id", max_length=36)
    prompt_type: PromptType
    input_prompt: str = Field(sa_column=Column(Text, nullable=False))
    output_response: str | None = Field(default=None, sa_column=Column(Text))
    model_name: str | None = Field(default=None, max_length=100)
    token_usage: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
