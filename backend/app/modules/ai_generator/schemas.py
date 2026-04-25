"""AI generator DTOs."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class GenerateTestCasesRequest(BaseModel):
    requirement: str = Field(min_length=10)
    count: int = Field(default=5, ge=1, le=20)
    project_id: str | None = None


class GenerateTestCasesResponse(BaseModel):
    items: list[dict[str, Any]]
    raw: str | None = None
    used_fallback: bool = False


class GenerateSqlRequest(BaseModel):
    mapping_json: dict[str, Any]
    project_id: str | None = None


class GenerateSqlResponse(BaseModel):
    sql: str
    used_fallback: bool = False


class AnalyzeFailureRequest(BaseModel):
    test_name: str
    error_message: str
    logs: str | None = None


class AnalyzeFailureResponse(BaseModel):
    summary: str
    likely_root_cause: str
    suggested_fix: str
    is_flaky: bool = False
    raw: str | None = None


class GenerateFlowRequest(BaseModel):
    scenario: str = Field(min_length=10)
    runtime_hint: str | None = None


class GenerateFlowResponse(BaseModel):
    flow_json: dict[str, Any]
    used_fallback: bool = False


class EdgeCasesRequest(BaseModel):
    requirement: str = Field(min_length=10)


class EdgeCasesResponse(BaseModel):
    edge_cases: list[str]
    used_fallback: bool = False
