"""SQL generator services."""
from __future__ import annotations

from sqlmodel import Session, select

from app.core.errors import NotFoundError
from app.modules.sql_generator.models import ExpectedResultType, GeneratedSqlTest
from app.modules.sql_generator.schemas import GeneratedSqlUpdate


def create(
    session: Session,
    project_id: str,
    name: str,
    sql_query: str,
    stm_mapping_id: str | None = None,
    expected_result_type: ExpectedResultType = ExpectedResultType.ZERO_ROWS,
    created_by_ai: bool = False,
) -> GeneratedSqlTest:
    record = GeneratedSqlTest(
        project_id=project_id,
        name=name,
        sql_query=sql_query,
        stm_mapping_id=stm_mapping_id,
        expected_result_type=expected_result_type,
        created_by_ai=created_by_ai,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_(session: Session, project_id: str) -> list[GeneratedSqlTest]:
    return session.exec(
        select(GeneratedSqlTest)
        .where(GeneratedSqlTest.project_id == project_id)
        .order_by(GeneratedSqlTest.created_at.desc())
    ).all()


def get(session: Session, sql_id: str) -> GeneratedSqlTest:
    record = session.exec(select(GeneratedSqlTest).where(GeneratedSqlTest.id == sql_id)).first()
    if not record:
        raise NotFoundError("Generated SQL not found")
    return record


def update(session: Session, sql_id: str, payload: GeneratedSqlUpdate) -> GeneratedSqlTest:
    record = get(session, sql_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def delete(session: Session, sql_id: str) -> None:
    record = get(session, sql_id)
    session.delete(record)
    session.commit()
