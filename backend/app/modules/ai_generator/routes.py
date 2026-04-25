"""AI generator HTTP routes.

Token-by-token streaming for the AI Studio is delivered over Socket.IO
(``ai:generate-test-cases`` / ``ai:suggest-edge-cases`` events handled in
``app.core.socketio``) — these REST endpoints are kept for one-shot
non-streaming calls and for clients that don't speak Socket.IO.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user
from app.modules.ai_generator import service
from app.modules.ai_generator.schemas import (
    AiStatusResponse,
    AnalyzeFailureRequest,
    AnalyzeFailureResponse,
    EdgeCasesRequest,
    EdgeCasesResponse,
    GenerateFlowRequest,
    GenerateFlowResponse,
    GenerateSqlRequest,
    GenerateSqlResponse,
    GenerateTestCasesRequest,
    GenerateTestCasesResponse,
)
from app.modules.users.models import User

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status", response_model=AiStatusResponse)
def ai_status(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Whether the AI generator has a usable LLM configured right now."""
    return AiStatusResponse(**service.get_status(session))


@router.post("/generate-test-cases", response_model=GenerateTestCasesResponse)
def generate_test_cases(
    payload: GenerateTestCasesRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    result = service.generate_test_cases(
        session, payload.requirement, payload.count, payload.project_id, current_user.id
    )
    return GenerateTestCasesResponse(**result)


@router.post("/generate-no-code-flow", response_model=GenerateFlowResponse)
def generate_flow(
    payload: GenerateFlowRequest,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return GenerateFlowResponse(**service.generate_no_code_flow(session, payload.scenario))


@router.post("/generate-sql-validation", response_model=GenerateSqlResponse)
def generate_sql(
    payload: GenerateSqlRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    sql = service.generate_sql_from_mapping(payload.mapping_json, session, payload.project_id, current_user.id)
    return GenerateSqlResponse(sql=sql)


@router.post("/analyze-failure", response_model=AnalyzeFailureResponse)
def analyze_failure(
    payload: AnalyzeFailureRequest,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return AnalyzeFailureResponse(**service.analyze_failure(
        session, payload.test_name, payload.error_message, payload.logs
    ))


@router.post("/suggest-edge-cases", response_model=EdgeCasesResponse)
def edge_cases(
    payload: EdgeCasesRequest,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return EdgeCasesResponse(**service.suggest_edge_cases(session, payload.requirement))
