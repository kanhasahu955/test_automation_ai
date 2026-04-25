"""Security primitives: password hashing, JWT, encryption."""
from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _peppered(password: str) -> str:
    return f"{password}{settings.PASSWORD_PEPPER}"


def hash_password(password: str) -> str:
    return pwd_context.hash(_peppered(password))


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(_peppered(password), password_hash)
    except Exception:
        return False


def _create_token(
    subject: str,
    token_type: str,
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    now = datetime.now(UTC)
    if expires_delta is None:
        expires_delta = (
            timedelta(minutes=settings.ACCESS_TOKEN_EXPIRES_MINUTES)
            if token_type == "access"
            else timedelta(days=settings.REFRESH_TOKEN_EXPIRES_DAYS)
        )
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str, role: str | None = None) -> str:
    return _create_token(subject, "access", {"role": role} if role else None)


def create_refresh_token(subject: str) -> str:
    return _create_token(subject, "refresh")


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:  # pragma: no cover
        raise ValueError("Invalid token") from exc


# ---------- Symmetric encryption for stored secrets (DB credentials, etc.) ----------
def _fernet() -> Fernet:
    raw_key = settings.ENCRYPTION_KEY.encode()
    # Allow either a valid 32-byte url-safe base64 key, or derive one from any string.
    try:
        return Fernet(raw_key)
    except Exception:
        derived = base64.urlsafe_b64encode(raw_key.ljust(32, b"0")[:32])
        return Fernet(derived)


def encrypt_secret(plaintext: str) -> str:
    if plaintext is None:
        return ""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    return _fernet().decrypt(ciphertext.encode()).decode()
