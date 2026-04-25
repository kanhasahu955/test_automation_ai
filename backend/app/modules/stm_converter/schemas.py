"""STM DTOs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.stm_converter.models import STMStatus, ValidationType


class STMDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    file_name: str
    file_path: str
    status: STMStatus
    uploaded_by: str | None = None
    notes: str | None = None
    is_completed: bool = False
    completed_at: datetime | None = None
    created_at: datetime | None = None


class STMDocumentUpdate(BaseModel):
    """Editable fields on an STM document."""
    file_name: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = None


class STMDocumentCompleteRequest(BaseModel):
    notes: str | None = None


class STMMappingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    stm_document_id: str
    source_table: str | None = None
    source_column: str | None = None
    target_table: str | None = None
    target_column: str | None = None
    join_key: str | None = None
    transformation_rule: str | None = None
    validation_type: ValidationType
    mapping_json: dict[str, Any] | None = None
    created_at: datetime | None = None


# ---- Manual authoring ---------------------------------------------------------

class STMDocumentCreateManual(BaseModel):
    """Create an empty STM document the user will fill in mapping-by-mapping."""
    file_name: str = Field(min_length=1, max_length=255)


class STMMappingCreate(BaseModel):
    """Add (or AI-suggest) a single source-to-target mapping."""
    source_table: str | None = Field(default=None, max_length=255)
    source_column: str | None = Field(default=None, max_length=255)
    target_table: str | None = Field(default=None, max_length=255)
    target_column: str | None = Field(default=None, max_length=255)
    join_key: str | None = Field(default=None, max_length=255)
    transformation_rule: str | None = None
    validation_type: ValidationType = ValidationType.TRANSFORMATION_CHECK


class STMMappingUpdate(BaseModel):
    source_table: str | None = None
    source_column: str | None = None
    target_table: str | None = None
    target_column: str | None = None
    join_key: str | None = None
    transformation_rule: str | None = None
    validation_type: ValidationType | None = None


# ---- AI scenario generation --------------------------------------------------

class STMAiScenariosRequest(BaseModel):
    """Ask the AI to draft STM mappings from a free-form scenario."""
    scenario: str = Field(min_length=10)
    target_table: str | None = None
    source_tables: list[str] | None = None
    count: int = Field(default=6, ge=1, le=30)
    persist: bool = True


class STMAiScenariosResponse(BaseModel):
    mappings: list[STMMappingRead]
    used_fallback: bool = False


# ---- Existing actions --------------------------------------------------------

class STMGenerateSqlRequest(BaseModel):
    use_ai: bool = True


class STMRunValidationRequest(BaseModel):
    data_source_id: str | None = None
    allow_destructive: bool = False
