"""Initial bootstrap: ensure admin user exists."""
from __future__ import annotations

from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import hash_password
from app.modules.users.models import User, UserRole


def ensure_admin_user(session: Session) -> None:
    existing = session.exec(select(User).where(User.email == settings.BOOTSTRAP_ADMIN_EMAIL)).first()
    if existing:
        return
    admin = User(
        name=settings.BOOTSTRAP_ADMIN_NAME,
        email=settings.BOOTSTRAP_ADMIN_EMAIL,
        password_hash=hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
        role=UserRole.ADMIN,
        is_active=True,
    )
    session.add(admin)
    session.commit()
