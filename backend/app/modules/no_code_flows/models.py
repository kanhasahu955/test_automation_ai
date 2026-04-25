"""No-code flow models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Text, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class FlowRuntime(str, Enum):
    PLAYWRIGHT = "PLAYWRIGHT"
    PYTEST_API = "PYTEST_API"
    SQL = "SQL"


class NoCodeFlow(SQLModel, table=True):
    __tablename__ = "no_code_flows"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    project_id: str = Field(foreign_key="projects.id", max_length=36, index=True)
    test_case_id: str | None = Field(default=None, foreign_key="test_cases.id", max_length=36)
    name: str = Field(max_length=255)
    flow_json: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    generated_script: str | None = Field(default=None, sa_column=Column(Text))
    runtime: FlowRuntime = Field(default=FlowRuntime.PLAYWRIGHT)
    created_by: str | None = Field(default=None, foreign_key="users.id", max_length=36)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
        ),
    )
