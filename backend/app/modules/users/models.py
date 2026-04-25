"""User domain models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, SQLModel

from app.utils.ids import new_id


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    QA_MANAGER = "QA_MANAGER"
    QA_ENGINEER = "QA_ENGINEER"
    DATA_ENGINEER = "DATA_ENGINEER"
    DEVELOPER = "DEVELOPER"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=new_id, primary_key=True, max_length=36)
    name: str = Field(max_length=150)
    email: str = Field(max_length=255, unique=True, index=True)
    password_hash: str = Field(max_length=255)
    role: UserRole = Field(default=UserRole.QA_ENGINEER)
    is_active: bool = Field(default=True)

    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
        ),
    )
