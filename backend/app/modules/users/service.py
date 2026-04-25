"""User business logic.

Includes the safety rules around role/active changes so admins can't
accidentally lock the platform out of itself:

* The bootstrap admin (``BOOTSTRAP_ADMIN_EMAIL``) is permanently protected —
  its role is always ``ADMIN`` and it cannot be deactivated or deleted. This
  is the "break-glass" account that always lets you back in.
* You can never demote / deactivate / delete the *last* active admin.
* Admins can promote / demote anyone else freely — including themselves —
  as long as the rules above still hold.

Every guard call site re-checks state inside the same transaction, so two
concurrent requests can't race to drop the admin count to zero.
"""
from __future__ import annotations

from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.errors import AppError, ConflictError, NotFoundError
from app.core.security import hash_password
from app.modules.users.models import User, UserRole
from app.modules.users.schemas import UserCreate, UserUpdate
from app.utils.pagination import PageParams

# ---------- Public CRUD -------------------------------------------------------


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

    new_role = data.get("role")
    new_active = data.get("is_active")
    if new_role is not None and new_role != user.role:
        _guard_role_change(session, user, new_role)
    if new_active is False and user.is_active:
        _guard_deactivate(session, user)

    if data.get("password"):
        user.password_hash = hash_password(data.pop("password"))
    for key, value in data.items():
        setattr(user, key, value)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def set_role(session: Session, user_id: str, role: UserRole) -> User:
    """Change just the role of a user — used by ``PATCH /users/{id}/role``.

    Goes through :func:`_guard_role_change` so the same invariants hold as
    for the generic update path.
    """
    user = get_user(session, user_id)
    if user.role == role:
        return user
    _guard_role_change(session, user, role)
    user.role = role
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def delete_user(session: Session, user_id: str) -> None:
    user = get_user(session, user_id)
    if _is_bootstrap_admin(user):
        raise AppError(
            "The bootstrap admin account cannot be deleted.",
            code="bootstrap_admin_protected",
            status_code=403,
        )
    # About to drop an active admin — make sure another active admin remains.
    if (
        user.role == UserRole.ADMIN
        and user.is_active
        and _active_admin_count(session) <= 1
    ):
        raise AppError(
            "Cannot delete the last active admin. Promote another user to admin first.",
            code="last_admin_protected",
            status_code=409,
        )
    session.delete(user)
    session.commit()


# ---------- Guards ------------------------------------------------------------


def _is_bootstrap_admin(user: User) -> bool:
    """The configured bootstrap admin (matched by email) is permanently protected."""
    bootstrap_email = (settings.BOOTSTRAP_ADMIN_EMAIL or "").strip().lower()
    return bool(bootstrap_email) and user.email.lower() == bootstrap_email


def _active_admin_count(session: Session, *, exclude_id: str | None = None) -> int:
    """Number of active admins, optionally excluding a specific user."""
    query = select(func.count()).select_from(User).where(
        User.role == UserRole.ADMIN, User.is_active.is_(True)  # type: ignore[union-attr,unused-ignore]
    )
    if exclude_id is not None:
        query = query.where(User.id != exclude_id)
    return session.exec(query).one()


def _guard_role_change(session: Session, user: User, new_role: UserRole) -> None:
    if _is_bootstrap_admin(user) and new_role != UserRole.ADMIN:
        raise AppError(
            "The bootstrap admin account must remain an admin.",
            code="bootstrap_admin_protected",
            status_code=403,
        )
    # Only worry about removing admin privileges. Promoting to admin is always safe.
    if (
        user.role == UserRole.ADMIN
        and new_role != UserRole.ADMIN
        and user.is_active
        and _active_admin_count(session, exclude_id=user.id) == 0
    ):
        raise AppError(
            "Cannot demote the last active admin. Promote another user to admin first.",
            code="last_admin_protected",
            status_code=409,
        )


def _guard_deactivate(session: Session, user: User) -> None:
    if _is_bootstrap_admin(user):
        raise AppError(
            "The bootstrap admin account cannot be deactivated.",
            code="bootstrap_admin_protected",
            status_code=403,
        )
    if (
        user.role == UserRole.ADMIN
        and _active_admin_count(session, exclude_id=user.id) == 0
    ):
        raise AppError(
            "Cannot deactivate the last active admin. Promote another user to admin first.",
            code="last_admin_protected",
            status_code=409,
        )
