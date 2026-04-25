"""Quality monitoring DTOs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.quality_monitoring.models import (
    QualityResultStatus,
    RuleType,
    Severity,
)


class QualityRuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    rule_type: RuleType
    table_name: str | None = None
    column_name: str | None = None
    rule_config: dict[str, Any] | None = None
    severity: Severity = Severity.MEDIUM
    is_active: bool = True


class QualityRuleCreate(QualityRuleBase):
    pass


class QualityRuleUpdate(BaseModel):
    name: str | None = None
    rule_type: RuleType | None = None
    table_name: str | None = None
    column_name: str | None = None
    rule_config: dict[str, Any] | None = None
    severity: Severity | None = None
    is_active: bool | None = None


class QualityRuleRead(QualityRuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    created_at: datetime | None = None


class QualityResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    quality_rule_id: str
    execution_run_id: str | None = None
    status: QualityResultStatus
    actual_value: str | None = None
    expected_value: str | None = None
    failed_count: int
    result_json: dict[str, Any] | None = None
    created_at: datetime | None = None
