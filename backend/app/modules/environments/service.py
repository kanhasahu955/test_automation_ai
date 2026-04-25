"""Environment services."""
from __future__ import annotations

from sqlmodel import Session, select

from app.core.errors import NotFoundError
from app.modules.environments.models import Environment
from app.modules.environments.schemas import EnvironmentCreate, EnvironmentUpdate


def create(session: Session, project_id: str, payload: EnvironmentCreate) -> Environment:
    env = Environment(project_id=project_id, **payload.model_dump())
    session.add(env)
    session.commit()
    session.refresh(env)
    return env


def list_by_project(session: Session, project_id: str) -> list[Environment]:
    return session.exec(
        select(Environment).where(Environment.project_id == project_id).order_by(Environment.created_at.desc())
    ).all()


def get(session: Session, env_id: str) -> Environment:
    env = session.exec(select(Environment).where(Environment.id == env_id)).first()
    if not env:
        raise NotFoundError("Environment not found")
    return env


def update(session: Session, env_id: str, payload: EnvironmentUpdate) -> Environment:
    env = get(session, env_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(env, key, value)
    session.add(env)
    session.commit()
    session.refresh(env)
    return env


def delete(session: Session, env_id: str) -> None:
    env = get(session, env_id)
    session.delete(env)
    session.commit()
