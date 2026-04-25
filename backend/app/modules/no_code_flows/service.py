"""No-code flow services."""
from __future__ import annotations

from sqlmodel import Session, select

from app.core.errors import NotFoundError
from app.modules.no_code_flows.compiler import compile_flow
from app.modules.no_code_flows.models import NoCodeFlow
from app.modules.no_code_flows.schemas import (
    FlowCompileResult,
    FlowCreate,
    FlowUpdate,
)


def create(session: Session, project_id: str, payload: FlowCreate, created_by: str) -> NoCodeFlow:
    flow = NoCodeFlow(
        project_id=project_id,
        created_by=created_by,
        name=payload.name,
        test_case_id=payload.test_case_id,
        flow_json=payload.flow_json,
        runtime=payload.runtime,
    )
    session.add(flow)
    session.commit()
    session.refresh(flow)
    return flow


def list_(session: Session, project_id: str) -> list[NoCodeFlow]:
    return session.exec(
        select(NoCodeFlow).where(NoCodeFlow.project_id == project_id).order_by(NoCodeFlow.created_at.desc())
    ).all()


def get(session: Session, flow_id: str) -> NoCodeFlow:
    flow = session.exec(select(NoCodeFlow).where(NoCodeFlow.id == flow_id)).first()
    if not flow:
        raise NotFoundError("Flow not found")
    return flow


def update(session: Session, flow_id: str, payload: FlowUpdate) -> NoCodeFlow:
    flow = get(session, flow_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(flow, key, value)
    session.add(flow)
    session.commit()
    session.refresh(flow)
    return flow


def compile_and_save(session: Session, flow_id: str) -> FlowCompileResult:
    flow = get(session, flow_id)
    script, warnings = compile_flow(flow.flow_json, flow.runtime)
    flow.generated_script = script
    session.add(flow)
    session.commit()
    return FlowCompileResult(runtime=flow.runtime, script=script, warnings=warnings)


def delete(session: Session, flow_id: str) -> None:
    flow = get(session, flow_id)
    session.delete(flow)
    session.commit()
