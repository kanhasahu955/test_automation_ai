"""STM routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user, require_data
from app.modules.stm_converter import service
from app.modules.stm_converter.schemas import (
    STMAiScenariosRequest,
    STMAiScenariosResponse,
    STMDocumentCompleteRequest,
    STMDocumentCreateManual,
    STMDocumentRead,
    STMDocumentUpdate,
    STMGenerateSqlRequest,
    STMMappingCreate,
    STMMappingRead,
    STMMappingUpdate,
    STMRunValidationRequest,
)
from app.modules.users.models import User

router = APIRouter(tags=["stm"])


@router.post(
    "/projects/{project_id}/stm/upload",
    response_model=STMDocumentRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_data)],
)
async def upload(
    project_id: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await service.upload(session, project_id, file, current_user.id)


@router.get("/projects/{project_id}/stm/documents", response_model=list[STMDocumentRead])
def list_documents(project_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_documents(session, project_id)


@router.get("/stm/{stm_document_id}/mappings", response_model=list[STMMappingRead])
def list_mappings(stm_document_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return service.list_mappings(session, stm_document_id)


@router.post(
    "/projects/{project_id}/stm/manual",
    response_model=STMDocumentRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_data)],
)
def create_manual(
    project_id: str,
    payload: STMDocumentCreateManual,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create an empty STM document for manual mapping authoring."""
    return service.create_manual_document(session, project_id, payload, current_user.id)


@router.patch(
    "/stm/documents/{stm_document_id}",
    response_model=STMDocumentRead,
    dependencies=[Depends(require_data)],
)
def update_document(
    stm_document_id: str,
    payload: STMDocumentUpdate,
    session: Session = Depends(get_session),
):
    return service.update_document(session, stm_document_id, payload)


@router.post(
    "/stm/documents/{stm_document_id}/complete",
    response_model=STMDocumentRead,
    dependencies=[Depends(require_data)],
)
def complete_document(
    stm_document_id: str,
    payload: STMDocumentCompleteRequest,
    session: Session = Depends(get_session),
):
    return service.complete_document(session, stm_document_id, payload.notes)


@router.post(
    "/stm/documents/{stm_document_id}/reopen",
    response_model=STMDocumentRead,
    dependencies=[Depends(require_data)],
)
def reopen_document(
    stm_document_id: str,
    session: Session = Depends(get_session),
):
    return service.reopen_document(session, stm_document_id)


@router.delete(
    "/stm/documents/{stm_document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_data)],
)
def delete_document(
    stm_document_id: str,
    session: Session = Depends(get_session),
):
    service.delete_document(session, stm_document_id)


@router.post(
    "/stm/{stm_document_id}/mappings",
    response_model=STMMappingRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_data)],
)
def add_mapping(
    stm_document_id: str,
    payload: STMMappingCreate,
    session: Session = Depends(get_session),
):
    return service.add_mapping(session, stm_document_id, payload)


@router.patch(
    "/stm/mappings/{mapping_id}",
    response_model=STMMappingRead,
    dependencies=[Depends(require_data)],
)
def patch_mapping(
    mapping_id: str,
    payload: STMMappingUpdate,
    session: Session = Depends(get_session),
):
    return service.update_mapping(session, mapping_id, payload)


@router.delete(
    "/stm/mappings/{mapping_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_data)],
)
def remove_mapping(mapping_id: str, session: Session = Depends(get_session)):
    service.delete_mapping(session, mapping_id)


@router.post(
    "/projects/{project_id}/stm/{stm_document_id}/ai-scenarios",
    response_model=STMAiScenariosResponse,
    dependencies=[Depends(require_data)],
)
def ai_scenarios(
    project_id: str,
    stm_document_id: str,
    payload: STMAiScenariosRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Use the AI generator to draft STM mappings for a free-form scenario."""
    mappings, used_fallback = service.generate_ai_scenarios(
        session,
        stm_document_id,
        project_id,
        scenario=payload.scenario,
        target_table=payload.target_table,
        source_tables=payload.source_tables,
        count=payload.count,
        persist=payload.persist,
        user_id=current_user.id,
    )
    return STMAiScenariosResponse(
        mappings=[STMMappingRead.model_validate(m) for m in mappings],
        used_fallback=used_fallback,
    )


@router.post(
    "/projects/{project_id}/stm/{stm_document_id}/generate-sql",
    dependencies=[Depends(require_data)],
)
def generate_sql(
    project_id: str,
    stm_document_id: str,
    payload: STMGenerateSqlRequest,
    session: Session = Depends(get_session),
):
    records = service.generate_sql_for_document(session, stm_document_id, project_id, payload.use_ai)
    return {"generated": len(records), "ids": [r.id for r in records]}


@router.post(
    "/stm/{stm_document_id}/run-validation",
    dependencies=[Depends(require_data)],
)
def run_validation(
    stm_document_id: str,
    payload: STMRunValidationRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Trigger SQL validation runner asynchronously."""
    try:
        from app.workers.tasks import stm_tasks

        stm_tasks.run_stm_validation.delay(
            stm_document_id, payload.data_source_id, current_user.id, payload.allow_destructive
        )
    except Exception:
        pass
    return {"status": "queued", "stm_document_id": stm_document_id}
