"""Authentication service — register, login, refresh, logout.

Shape: a class that composes two repositories. Routes import the singleton
:data:`auth_service` (or instantiate :class:`AuthService` directly in tests).

Module-level functions (``register``, ``login``, …) are kept as thin
back-compat wrappers so older imports keep working — new code should call
``auth_service.<method>``.
"""
from __future__ import annotations

from datetime import timedelta

from sqlmodel import Session

from app.core.base import BaseService
from app.core.config import settings
from app.core.errors import AppError, ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.auth.models import RefreshToken
from app.modules.auth.repository import (
    RefreshTokenRepository,
    UserRepository,
    hash_token,
)
from app.modules.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.modules.users.models import User, UserRole
from app.modules.users.schemas import UserRead
from app.utils.datetime import utc_now_aware, utc_now_naive


class AuthService(BaseService):
    """Encapsulates registration, login, refresh & logout flows."""

    def __init__(
        self,
        users: UserRepository | None = None,
        tokens: RefreshTokenRepository | None = None,
    ) -> None:
        super().__init__()
        self._users = users or UserRepository()
        self._tokens = tokens or RefreshTokenRepository()

    # ------------------------------------------------------------------ public
    def register(self, session: Session, payload: RegisterRequest) -> TokenResponse:
        if self._users.get_by_email(session, payload.email) is not None:
            raise ConflictError("A user with this email already exists")
        user = User(
            name=payload.name,
            email=payload.email,
            password_hash=hash_password(payload.password),
            role=UserRole.QA_ENGINEER,
        )
        self._users.create(session, user)
        self.log.info("auth.register", user_id=user.id, email=user.email)
        return self._issue_tokens(session, user)

    def login(self, session: Session, payload: LoginRequest) -> TokenResponse:
        user = self._users.get_by_email(session, payload.email)
        if user is None or not user.is_active or not verify_password(
            payload.password, user.password_hash
        ):
            raise AppError(
                "Invalid email or password",
                code="invalid_credentials",
                status_code=401,
            )
        self.log.info("auth.login", user_id=user.id)
        return self._issue_tokens(session, user)

    def refresh(self, session: Session, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except ValueError as exc:
            raise AppError(
                "Invalid refresh token", code="invalid_token", status_code=401
            ) from exc
        if payload.get("type") != "refresh":
            raise AppError("Invalid token type", code="invalid_token", status_code=401)

        record = self._tokens.get_by_token(session, refresh_token)
        if (
            record is None
            or record.is_revoked
            or record.expires_at < utc_now_naive()
        ):
            raise AppError(
                "Refresh token expired or revoked",
                code="token_expired",
                status_code=401,
            )

        user = self._users.get(session, payload["sub"])
        if user is None or not user.is_active:
            raise AppError("User no longer active", code="user_inactive", status_code=401)

        self._tokens.revoke(session, record)
        return self._issue_tokens(session, user)

    def logout(self, session: Session, refresh_token: str) -> None:
        record = self._tokens.get_by_token(session, refresh_token)
        if record is not None:
            self._tokens.revoke(session, record)

    # ----------------------------------------------------------------- internal
    def _issue_tokens(self, session: Session, user: User) -> TokenResponse:
        access = create_access_token(user.id, role=user.role.value)
        refresh = create_refresh_token(user.id)
        self._store_refresh_token(session, user.id, refresh)
        return TokenResponse(
            access_token=access,
            refresh_token=refresh,
            user=UserRead.model_validate(user),
        )

    def _store_refresh_token(
        self, session: Session, user_id: str, refresh_token: str
    ) -> None:
        expires_at = utc_now_aware() + timedelta(days=settings.REFRESH_TOKEN_EXPIRES_DAYS)
        record = RefreshToken(
            user_id=user_id,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
        )
        self._tokens.create(session, record)


# Module-level singleton — preferred entry point in new code.
auth_service = AuthService()


# ---------------------------------------------------------------------------
# Back-compat shims (kept so older callers keep working).
# ---------------------------------------------------------------------------
def register(session: Session, payload: RegisterRequest) -> TokenResponse:
    return auth_service.register(session, payload)


def login(session: Session, payload: LoginRequest) -> TokenResponse:
    return auth_service.login(session, payload)


def refresh(session: Session, refresh_token: str) -> TokenResponse:
    return auth_service.refresh(session, refresh_token)


def logout(session: Session, refresh_token: str) -> None:
    auth_service.logout(session, refresh_token)


__all__ = [
    "AuthService",
    "auth_service",
    "login",
    "logout",
    "refresh",
    "register",
]
