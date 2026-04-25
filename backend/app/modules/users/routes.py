"""User REST routes (admin-only management).

Two ways to change a user's role:

* ``PUT  /users/{id}``         — full profile edit; ``role`` is one of many fields.
* ``PATCH /users/{id}/role``   — role-only rotation, the canonical "promote /
  demote" endpoint used by the in-app Users grid.

Both go through the same safety guards in :mod:`app.modules.users.service`
(can't demote the bootstrap admin, can't strip the last active admin, …).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import require_admin
from app.modules.users import service
from app.modules.users.schemas import UserCreate, UserRead, UserRoleUpdate, UserUpdate
from app.utils.pagination import Page, PageParams, page_of, page_params

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create(payload: UserCreate, session: Session = Depends(get_session)):
    return service.create_user(session, payload)


@router.get("", response_model=Page[UserRead])
def list_(
    search: str | None = None,
    params: PageParams = Depends(page_params),
    session: Session = Depends(get_session),
):
    items, total = service.list_users(session, params, search)
    return page_of([UserRead.model_validate(u) for u in items], total, params)


@router.get("/{user_id}", response_model=UserRead)
def get_one(user_id: str, session: Session = Depends(get_session)):
    return service.get_user(session, user_id)


@router.put("/{user_id}", response_model=UserRead)
def update(user_id: str, payload: UserUpdate, session: Session = Depends(get_session)):
    return service.update_user(session, user_id, payload)


@router.patch("/{user_id}/role", response_model=UserRead)
def update_role(
    user_id: str,
    payload: UserRoleUpdate,
    session: Session = Depends(get_session),
):
    """Rotate a user's role. Returns the updated user."""
    return service.set_role(session, user_id, payload.role)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(user_id: str, session: Session = Depends(get_session)):
    service.delete_user(session, user_id)
