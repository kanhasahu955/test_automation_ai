"""User business logic."""
from __future__ import annotations

from sqlmodel import Session, func, select

from app.core.errors import ConflictError, NotFoundError
from app.core.security import hash_password
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate, UserUpdate
from app.utils.pagination import PageParams


def create_user(session: Session, payload: UserCreate) -> User:
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise ConflictError("A user with this email already exists")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def get_user(session: Session, user_id: str) -> User:
    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise NotFoundError("User not found")
    return user


def list_users(session: Session, params: PageParams, search: str | None = None):
    query = select(User)
    count_query = select(func.count()).select_from(User)
    if search:
        like = f"%{search}%"
        query = query.where((User.name.ilike(like)) | (User.email.ilike(like)))
        count_query = count_query.where((User.name.ilike(like)) | (User.email.ilike(like)))
    total = session.exec(count_query).one()
    users = session.exec(
        query.order_by(User.created_at.desc()).offset(params.offset).limit(params.limit)
    ).all()
    return users, total


def update_user(session: Session, user_id: str, payload: UserUpdate) -> User:
    user = get_user(session, user_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("password"):
        user.password_hash = hash_password(data.pop("password"))
    for key, value in data.items():
        setattr(user, key, value)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def delete_user(session: Session, user_id: str) -> None:
    user = get_user(session, user_id)
    session.delete(user)
    session.commit()
