"""Auth-related repositories: users + refresh tokens.

These wrap the SQL details so :class:`AuthService` can stay focused on
business rules (token rotation, password validation, …).
"""
from __future__ import annotations

import hashlib

from sqlmodel import Session, select

from app.core.base import BaseRepository
from app.modules.auth.models import RefreshToken
from app.modules.users.models import User


def hash_token(token: str) -> str:
    """SHA-256 hex of a refresh token (we never persist the plaintext)."""
    return hashlib.sha256(token.encode()).hexdigest()


class UserRepository(BaseRepository[User]):
    """Data-access for users."""

    model = User

    def get_by_email(self, session: Session, email: str) -> User | None:
        return session.exec(select(User).where(User.email == email)).first()


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    """Data-access for refresh-token records."""

    model = RefreshToken

    def get_by_token(self, session: Session, refresh_token: str) -> RefreshToken | None:
        return session.exec(
            select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
        ).first()

    def revoke(self, session: Session, record: RefreshToken) -> None:
        record.is_revoked = True
        session.add(record)
        session.commit()


__all__ = ["RefreshTokenRepository", "UserRepository", "hash_token"]
