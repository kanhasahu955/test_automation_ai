"""Auth routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user
from app.modules.auth import service
from app.modules.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.modules.users.models import User
from app.modules.users.schemas import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: Session = Depends(get_session)):
    return service.register(session, payload)


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    """OAuth2-compatible login endpoint.
    `username` is the email; `password` is the password.
    """
    payload = LoginRequest(email=form.username, password=form.password)
    return service.login(session, payload)


@router.post("/login-json", response_model=TokenResponse)
def login_json(payload: LoginRequest, session: Session = Depends(get_session)):
    return service.login(session, payload)


@router.post("/refresh-token", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, session: Session = Depends(get_session)):
    return service.refresh(session, payload.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, session: Session = Depends(get_session)):
    service.logout(session, payload.refresh_token)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user
