"""No-code flow DTOs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.no_code_flows.models import FlowRuntime


class FlowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    test_case_id: str | None = None
    flow_json: dict[str, Any]
    runtime: FlowRuntime = FlowRuntime.PLAYWRIGHT


class FlowUpdate(BaseModel):
    name: str | None = None
    flow_json: dict[str, Any] | None = None
    runtime: FlowRuntime | None = None


class FlowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    test_case_id: str | None = None
    name: str
    flow_json: dict[str, Any]
    generated_script: str | None = None
    runtime: FlowRuntime
    created_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class FlowCompileResult(BaseModel):
    runtime: FlowRuntime
    script: str
    warnings: list[str] = []
