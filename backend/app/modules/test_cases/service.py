"""Test case services."""
from __future__ import annotations

from sqlmodel import Session, func, select

from app.core.errors import NotFoundError
from app.modules.test_cases.models import TestCase, TestStep
from app.modules.test_cases.schemas import (
    TestCaseCreate,
    TestCaseRead,
    TestCaseUpdate,
    TestStepCreate,
    TestStepRead,
)
from app.utils.pagination import PageParams


def _to_read(session: Session, tc: TestCase) -> TestCaseRead:
    steps = session.exec(
        select(TestStep).where(TestStep.test_case_id == tc.id).order_by(TestStep.step_order)
    ).all()
    return TestCaseRead(
        **TestCase.model_validate(tc).model_dump(),
        steps=[TestStepRead.model_validate(s) for s in steps],
    )


def create(session: Session, project_id: str, payload: TestCaseCreate, created_by: str) -> TestCaseRead:
    tc = TestCase(
        project_id=project_id,
        created_by=created_by,
        **payload.model_dump(exclude={"steps"}),
    )
    session.add(tc)
    session.flush()
    for idx, step in enumerate(payload.steps, start=1):
        session.add(
            TestStep(
                test_case_id=tc.id,
                step_order=step.step_order or idx,
                action=step.action,
                input_data=step.input_data,
                expected_result=step.expected_result,
            )
        )
    session.commit()
    session.refresh(tc)
    return _to_read(session, tc)


def get(session: Session, test_case_id: str) -> TestCaseRead:
    tc = session.exec(select(TestCase).where(TestCase.id == test_case_id)).first()
    if not tc:
        raise NotFoundError("Test case not found")
    return _to_read(session, tc)


def list_(
    session: Session,
    project_id: str,
    params: PageParams,
    search: str | None = None,
):
    query = select(TestCase).where(TestCase.project_id == project_id)
    count_query = select(func.count()).select_from(TestCase).where(TestCase.project_id == project_id)
    if search:
        like = f"%{search}%"
        query = query.where(TestCase.title.ilike(like))
        count_query = count_query.where(TestCase.title.ilike(like))
    total = session.exec(count_query).one()
    items = session.exec(
        query.order_by(TestCase.created_at.desc()).offset(params.offset).limit(params.limit)
    ).all()
    return [_to_read(session, tc) for tc in items], total


def update(session: Session, test_case_id: str, payload: TestCaseUpdate) -> TestCaseRead:
    tc = session.exec(select(TestCase).where(TestCase.id == test_case_id)).first()
    if not tc:
        raise NotFoundError("Test case not found")

    data = payload.model_dump(exclude_unset=True)
    steps_payload = data.pop("steps", None)
    for key, value in data.items():
        setattr(tc, key, value)
    session.add(tc)

    if steps_payload is not None:
        existing = session.exec(select(TestStep).where(TestStep.test_case_id == tc.id)).all()
        for step in existing:
            session.delete(step)
        session.flush()
        for idx, step in enumerate(steps_payload, start=1):
            step_data = TestStepCreate(**step) if isinstance(step, dict) else step
            session.add(
                TestStep(
                    test_case_id=tc.id,
                    step_order=step_data.step_order or idx,
                    action=step_data.action,
                    input_data=step_data.input_data,
                    expected_result=step_data.expected_result,
                )
            )
    session.commit()
    session.refresh(tc)
    return _to_read(session, tc)


def delete(session: Session, test_case_id: str) -> None:
    tc = session.exec(select(TestCase).where(TestCase.id == test_case_id)).first()
    if not tc:
        raise NotFoundError("Test case not found")
    for step in session.exec(select(TestStep).where(TestStep.test_case_id == tc.id)).all():
        session.delete(step)
    session.delete(tc)
    session.commit()
