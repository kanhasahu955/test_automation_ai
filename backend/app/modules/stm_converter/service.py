"""STM services: upload + parse + generate validations."""
from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path

from fastapi import UploadFile
from sqlmodel import Session, select

from app.core.config import settings
from app.core.errors import NotFoundError, ValidationFailed
from app.modules.stm_converter.models import (
    STMDocument,
    STMMapping,
    STMStatus,
    ValidationType,
)
from app.modules.stm_converter.schemas import (
    STMDocumentCreateManual,
    STMDocumentUpdate,
    STMMappingCreate,
    STMMappingUpdate,
)
from app.utils.file_parser import parse_stm_excel
from app.utils.ids import new_id


def _ensure_uploads_dir() -> Path:
    path = Path(settings.UPLOADS_DIR) / "stm"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def upload(session: Session, project_id: str, file: UploadFile, uploaded_by: str) -> STMDocument:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise ValidationFailed("Only .xlsx / .xls files are accepted")
    target_dir = _ensure_uploads_dir()
    file_id = new_id()
    target_path = target_dir / f"{file_id}_{file.filename}"
    contents = await file.read()
    target_path.write_bytes(contents)

    doc = STMDocument(
        project_id=project_id,
        file_name=file.filename,
        file_path=str(target_path),
        status=STMStatus.UPLOADED,
        uploaded_by=uploaded_by,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    parse_document(session, doc.id)
    return doc


def parse_document(session: Session, document_id: str) -> list[STMMapping]:
    doc = session.exec(select(STMDocument).where(STMDocument.id == document_id)).first()
    if not doc:
        raise NotFoundError("STM document not found")
    if not os.path.exists(doc.file_path):
        doc.status = STMStatus.FAILED
        session.add(doc)
        session.commit()
        raise ValidationFailed("STM file not found on disk")

    try:
        records = parse_stm_excel(doc.file_path)
    except Exception as exc:
        doc.status = STMStatus.FAILED
        session.add(doc)
        session.commit()
        raise ValidationFailed(f"Failed to parse STM Excel: {exc}") from exc

    mappings: list[STMMapping] = []
    for record in records:
        validation_type = (record.get("validation_type") or "TRANSFORMATION_CHECK").upper().replace("-", "_")
        try:
            v_enum = ValidationType(validation_type)
        except ValueError:
            v_enum = ValidationType.TRANSFORMATION_CHECK
        mapping = STMMapping(
            stm_document_id=doc.id,
            source_table=record.get("source_table"),
            source_column=record.get("source_column"),
            target_table=record.get("target_table"),
            target_column=record.get("target_column"),
            join_key=record.get("join_key"),
            transformation_rule=record.get("transformation_rule"),
            validation_type=v_enum,
            mapping_json=record,
        )
        session.add(mapping)
        mappings.append(mapping)
    doc.status = STMStatus.PARSED
    session.add(doc)
    session.commit()
    return mappings


def list_documents(session: Session, project_id: str) -> list[STMDocument]:
    return session.exec(
        select(STMDocument).where(STMDocument.project_id == project_id).order_by(STMDocument.created_at.desc())
    ).all()


def list_mappings(session: Session, document_id: str) -> list[STMMapping]:
    return session.exec(
        select(STMMapping).where(STMMapping.stm_document_id == document_id).order_by(STMMapping.created_at)
    ).all()


# ---- Manual authoring ---------------------------------------------------------

def _get_document(session: Session, document_id: str) -> STMDocument:
    doc = session.exec(select(STMDocument).where(STMDocument.id == document_id)).first()
    if not doc:
        raise NotFoundError("STM document not found")
    return doc


def _get_mapping(session: Session, mapping_id: str) -> STMMapping:
    mapping = session.exec(select(STMMapping).where(STMMapping.id == mapping_id)).first()
    if not mapping:
        raise NotFoundError("STM mapping not found")
    return mapping


def update_document(
    session: Session, document_id: str, payload: STMDocumentUpdate
) -> STMDocument:
    doc = _get_document(session, document_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(doc, key, value)
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


def complete_document(
    session: Session, document_id: str, notes: str | None = None
) -> STMDocument:
    doc = _get_document(session, document_id)
    doc.is_completed = True
    doc.completed_at = datetime.now(UTC)
    if notes is not None:
        doc.notes = notes
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


def reopen_document(session: Session, document_id: str) -> STMDocument:
    doc = _get_document(session, document_id)
    doc.is_completed = False
    doc.completed_at = None
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


def delete_document(session: Session, document_id: str) -> None:
    doc = _get_document(session, document_id)
    mappings = session.exec(
        select(STMMapping).where(STMMapping.stm_document_id == doc.id)
    ).all()
    for mapping in mappings:
        session.delete(mapping)
    session.delete(doc)
    session.commit()


def create_manual_document(
    session: Session,
    project_id: str,
    payload: STMDocumentCreateManual,
    uploaded_by: str | None,
) -> STMDocument:
    """Create a virtual STM document the user will populate manually.

    No file is written to disk — we mark the status as PARSED so downstream
    tooling treats it like a successfully imported workbook.
    """
    doc = STMDocument(
        project_id=project_id,
        file_name=payload.file_name,
        file_path=f"manual:{new_id()}",
        status=STMStatus.PARSED,
        uploaded_by=uploaded_by,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return doc


def add_mapping(
    session: Session, document_id: str, payload: STMMappingCreate
) -> STMMapping:
    doc = _get_document(session, document_id)
    mapping = STMMapping(
        stm_document_id=doc.id,
        source_table=payload.source_table,
        source_column=payload.source_column,
        target_table=payload.target_table,
        target_column=payload.target_column,
        join_key=payload.join_key,
        transformation_rule=payload.transformation_rule,
        validation_type=payload.validation_type,
        mapping_json=payload.model_dump(mode="json"),
    )
    session.add(mapping)
    if doc.status != STMStatus.PARSED:
        doc.status = STMStatus.PARSED
        session.add(doc)
    session.commit()
    session.refresh(mapping)
    return mapping


def update_mapping(
    session: Session, mapping_id: str, payload: STMMappingUpdate
) -> STMMapping:
    mapping = _get_mapping(session, mapping_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(mapping, key, value)
    merged = (mapping.mapping_json or {}) | {k: v for k, v in data.items() if v is not None}
    mapping.mapping_json = merged
    session.add(mapping)
    session.commit()
    session.refresh(mapping)
    return mapping


def delete_mapping(session: Session, mapping_id: str) -> None:
    mapping = _get_mapping(session, mapping_id)
    session.delete(mapping)
    session.commit()


# ---- AI scenario generation --------------------------------------------------

def generate_ai_scenarios(
    session: Session,
    document_id: str,
    project_id: str,
    *,
    scenario: str,
    target_table: str | None,
    source_tables: list[str] | None,
    count: int,
    persist: bool,
    user_id: str | None,
) -> tuple[list[STMMapping], bool]:
    """Use the AI generator to draft STM mappings for a scenario.

    The output is normalized to fit `STMMapping` and (optionally) persisted.
    Returns the *(mappings, used_fallback)* tuple so callers can surface
    the fallback flag in the UI.
    """
    from app.modules.ai_generator import service as ai_service

    doc = _get_document(session, document_id)
    raw_items, used_fallback = ai_service.generate_stm_scenarios(
        session,
        scenario=scenario,
        target_table=target_table,
        source_tables=source_tables,
        count=count,
        project_id=project_id,
        user_id=user_id,
    )

    persisted: list[STMMapping] = []
    for item in raw_items:
        try:
            v_enum = ValidationType(
                str(item.get("validation_type", "TRANSFORMATION_CHECK"))
                .upper()
                .replace("-", "_")
            )
        except ValueError:
            v_enum = ValidationType.TRANSFORMATION_CHECK
        mapping = STMMapping(
            stm_document_id=doc.id,
            source_table=item.get("source_table"),
            source_column=item.get("source_column"),
            target_table=item.get("target_table") or target_table,
            target_column=item.get("target_column"),
            join_key=item.get("join_key"),
            transformation_rule=item.get("transformation_rule"),
            validation_type=v_enum,
            mapping_json=item,
        )
        if persist:
            session.add(mapping)
        persisted.append(mapping)
    if persist:
        if doc.status != STMStatus.PARSED:
            doc.status = STMStatus.PARSED
            session.add(doc)
        session.commit()
        for mapping in persisted:
            session.refresh(mapping)
    return persisted, used_fallback


def generate_sql_for_document(
    session: Session, document_id: str, project_id: str, use_ai: bool = True
):
    """Generate SQL validations for every mapping in the document."""
    from app.modules.ai_generator import service as ai_service
    from app.modules.sql_generator import service as sql_service
    from app.utils.sql_templates import render_validation_sql

    mappings = list_mappings(session, document_id)
    if not mappings:
        raise ValidationFailed("No mappings parsed for document")

    generated = []
    for mapping in mappings:
        sql: str | None = None
        if use_ai:
            try:
                sql = ai_service.generate_sql_from_mapping(mapping.mapping_json or {})
            except Exception:
                sql = None
        if not sql:
            sql = render_validation_sql(mapping.mapping_json or {})
        record = sql_service.create(
            session,
            project_id=project_id,
            stm_mapping_id=mapping.id,
            name=f"{mapping.target_table or 'tgt'}.{mapping.target_column or 'col'} validation",
            sql_query=sql,
            created_by_ai=use_ai,
        )
        generated.append(record)
    return generated
