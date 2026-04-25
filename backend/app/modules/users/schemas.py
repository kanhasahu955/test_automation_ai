"""User DTOs."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.users.models import UserRole


class UserBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    role: UserRole = UserRole.QA_ENGINEER


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserRoleUpdate(BaseModel):
    """Body for ``PATCH /users/{id}/role`` — single-purpose role rotation."""

    role: UserRole


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
