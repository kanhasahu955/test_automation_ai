"""Quality monitoring services."""
from __future__ import annotations

from sqlmodel import Session, select

from app.core.errors import NotFoundError
from app.modules.quality_monitoring.models import QualityResult, QualityRule
from app.modules.quality_monitoring.schemas import QualityRuleCreate, QualityRuleUpdate


def create(session: Session, project_id: str, payload: QualityRuleCreate) -> QualityRule:
    rule = QualityRule(project_id=project_id, **payload.model_dump())
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


def list_(session: Session, project_id: str) -> list[QualityRule]:
    return session.exec(
        select(QualityRule).where(QualityRule.project_id == project_id).order_by(QualityRule.created_at.desc())
    ).all()


def get(session: Session, rule_id: str) -> QualityRule:
    rule = session.exec(select(QualityRule).where(QualityRule.id == rule_id)).first()
    if not rule:
        raise NotFoundError("Quality rule not found")
    return rule


def update(session: Session, rule_id: str, payload: QualityRuleUpdate) -> QualityRule:
    rule = get(session, rule_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


def delete(session: Session, rule_id: str) -> None:
    rule = get(session, rule_id)
    session.delete(rule)
    session.commit()


def list_results(session: Session, rule_id: str) -> list[QualityResult]:
    return session.exec(
        select(QualityResult).where(QualityResult.quality_rule_id == rule_id).order_by(QualityResult.created_at.desc())
    ).all()
