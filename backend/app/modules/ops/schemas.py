"""Operations DTOs — what the in-app Operations Console renders."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

HealthStatus = Literal["ok", "degraded", "down", "unknown"]


class ComponentHealth(BaseModel):
    """Status for a single infrastructure component."""

    name: str
    status: HealthStatus
    detail: str | None = None
    latency_ms: float | None = None
    url: str | None = None
    docs_slug: str | None = None


class CeleryQueueStat(BaseModel):
    name: str
    length: int
    workers: list[str] = []


class CeleryWorker(BaseModel):
    name: str
    status: str
    active: int = 0
    processed: int = 0
    queues: list[str] = []


class CeleryStatus(BaseModel):
    status: HealthStatus
    detail: str | None = None
    workers: list[CeleryWorker] = []
    registered_tasks: list[str] = []
    queues: list[CeleryQueueStat] = []


class RedisStatus(BaseModel):
    status: HealthStatus
    detail: str | None = None
    latency_ms: float | None = None
    used_memory_human: str | None = None
    connected_clients: int | None = None
    redbeat_keys: int | None = None
    db_keys: dict[str, int] = {}


class OperationalLinks(BaseModel):
    """External UIs and whether they are reachable from the API host."""

    flower: ComponentHealth
    redis_commander: ComponentHealth
    airflow: ComponentHealth


class OperationsSnapshot(BaseModel):
    """Single payload that powers the Operations Console page."""

    api: ComponentHealth
    database: ComponentHealth
    redis: RedisStatus
    celery: CeleryStatus
    links: OperationalLinks
