"""Test suite services."""
from __future__ import annotations

from sqlmodel import Session, func, select

from app.core.errors import NotFoundError
from app.modules.test_suites.models import TestSuite, TestSuiteCase
from app.modules.test_suites.schemas import (
    SuiteCaseAdd,
    TestSuiteCreate,
    TestSuiteRead,
)


def _to_read(session: Session, suite: TestSuite) -> TestSuiteRead:
    case_count = session.exec(
        select(func.count()).select_from(TestSuiteCase).where(TestSuiteCase.suite_id == suite.id)
    ).one()
    return TestSuiteRead(**TestSuite.model_validate(suite).model_dump(), case_count=case_count)


def create(session: Session, project_id: str, payload: TestSuiteCreate, created_by: str) -> TestSuiteRead:
    suite = TestSuite(project_id=project_id, created_by=created_by, **payload.model_dump())
    session.add(suite)
    session.commit()
    session.refresh(suite)
    return _to_read(session, suite)


def list_(session: Session, project_id: str) -> list[TestSuiteRead]:
    suites = session.exec(
        select(TestSuite).where(TestSuite.project_id == project_id).order_by(TestSuite.created_at.desc())
    ).all()
    return [_to_read(session, s) for s in suites]


def get(session: Session, suite_id: str) -> TestSuiteRead:
    suite = session.exec(select(TestSuite).where(TestSuite.id == suite_id)).first()
    if not suite:
        raise NotFoundError("Test suite not found")
    return _to_read(session, suite)


def add_case(session: Session, suite_id: str, payload: SuiteCaseAdd) -> TestSuiteCase:
    suite = session.exec(select(TestSuite).where(TestSuite.id == suite_id)).first()
    if not suite:
        raise NotFoundError("Test suite not found")
    link = TestSuiteCase(
        suite_id=suite_id,
        test_case_id=payload.test_case_id,
        execution_order=payload.execution_order,
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


def remove_case(session: Session, suite_id: str, link_id: str) -> None:
    link = session.exec(
        select(TestSuiteCase).where(TestSuiteCase.id == link_id, TestSuiteCase.suite_id == suite_id)
    ).first()
    if not link:
        raise NotFoundError("Suite case not found")
    session.delete(link)
    session.commit()


def list_cases(session: Session, suite_id: str) -> list[TestSuiteCase]:
    return session.exec(
        select(TestSuiteCase)
        .where(TestSuiteCase.suite_id == suite_id)
        .order_by(TestSuiteCase.execution_order)
    ).all()
