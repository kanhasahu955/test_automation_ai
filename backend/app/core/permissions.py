"""Authentication & RBAC dependencies."""
from __future__ import annotations

from collections.abc import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_session
from app.core.security import decode_token
from app.modules.users.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_PREFIX}/auth/login", auto_error=True
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise credentials_exc from exc

    if payload.get("type") != "access":
        raise credentials_exc

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exc

    user = session.exec(select(User).where(User.id == user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exc
    return user


def require_roles(*roles: UserRole):
    allowed: Iterable[UserRole] = roles

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted for this action",
            )
        return user

    return dependency


require_admin = require_roles(UserRole.ADMIN)
require_manager = require_roles(UserRole.ADMIN, UserRole.QA_MANAGER)
require_qa = require_roles(
    UserRole.ADMIN, UserRole.QA_MANAGER, UserRole.QA_ENGINEER
)
require_data = require_roles(
    UserRole.ADMIN, UserRole.QA_MANAGER, UserRole.DATA_ENGINEER
)
