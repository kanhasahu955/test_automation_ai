"""Operations routes — power the in-app Operations Console."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.core.permissions import get_current_user
from app.modules.ops import service
from app.modules.ops.schemas import (
    CeleryStatus,
    ComponentHealth,
    OperationalLinks,
    OperationsSnapshot,
    RedisStatus,
)
from app.modules.users.models import User

router = APIRouter(prefix="/ops", tags=["ops"])


@router.get("/snapshot", response_model=OperationsSnapshot)
def snapshot(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> OperationsSnapshot:
    """Single-call snapshot: API, MySQL, Redis, Celery and external dashboards."""
    return service.get_snapshot(session)


@router.get("/database", response_model=ComponentHealth)
def database(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> ComponentHealth:
    """Run ``SELECT 1`` against the configured DB."""
    return service.check_database(session)


@router.get("/redis", response_model=RedisStatus)
def redis(_: User = Depends(get_current_user)) -> RedisStatus:
    """``PING`` Redis and report keyspace + memory headlines."""
    return service.check_redis()


@router.get("/celery", response_model=CeleryStatus)
def celery(_: User = Depends(get_current_user)) -> CeleryStatus:
    """Inspect the Celery cluster — workers, queues, registered tasks."""
    return service.check_celery()


@router.get("/links", response_model=OperationalLinks)
def links(_: User = Depends(get_current_user)) -> OperationalLinks:
    """Reachability of Flower, Redis Commander, and Airflow."""
    return service.check_external_links()
