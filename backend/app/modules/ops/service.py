"""Operations service — health checks for infra components.

This module is **defensive on purpose**: the Operations Console must keep
loading even if Redis is down, Celery has no workers, or Flower/Airflow
aren't running. Every call returns a :class:`ComponentHealth` with a clear
``status`` (`ok`, `degraded`, `down`, `unknown`) so the UI can render a
useful badge instead of crashing.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

import httpx
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlmodel import Session

from app.core.celery_app import celery_app
from app.core.config import settings
from app.modules.ops.schemas import (
    CeleryQueueStat,
    CeleryStatus,
    CeleryWorker,
    ComponentHealth,
    OperationalLinks,
    OperationsSnapshot,
    RedisStatus,
)

_REQUEST_TIMEOUT_S = 2.0
_CELERY_INSPECT_TIMEOUT_S = 2.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_snapshot(session: Session) -> OperationsSnapshot:
    """Return the full ops snapshot for the Operations Console page.

    Calls run in parallel where it pays off (the three external HTTP probes).
    """
    api = ComponentHealth(name="API", status="ok", url=f"{settings.API_PREFIX}/health")
    db = check_database(session)
    redis_status = check_redis()
    celery_status = check_celery()
    links = check_external_links()
    return OperationsSnapshot(
        api=api,
        database=db,
        redis=redis_status,
        celery=celery_status,
        links=links,
    )


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------


def check_database(session: Session) -> ComponentHealth:
    """Run ``SELECT 1`` against the configured DB and time it."""
    start = time.perf_counter()
    try:
        # Use the underlying SQLAlchemy ``execute`` for raw SQL — ``Session.exec``
        # is typed strictly for SQLModel ``Select`` statements.
        session.connection().execute(text("SELECT 1"))
        elapsed = (time.perf_counter() - start) * 1000.0
        return ComponentHealth(
            name="MySQL",
            status="ok",
            latency_ms=round(elapsed, 2),
            detail=f"{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}",
        )
    except Exception as exc:
        return ComponentHealth(name="MySQL", status="down", detail=str(exc)[:240])


# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------


def check_redis() -> RedisStatus:
    """Run ``PING`` + ``INFO`` against Redis and report headline stats.

    We probe the cache DB (``REDIS_URL``), then count keys per-DB and the
    RedBeat lock prefix so the UI can show how many schedules are registered.
    """
    start = time.perf_counter()
    try:
        client = Redis.from_url(settings.REDIS_URL, socket_timeout=_REQUEST_TIMEOUT_S)
        client.ping()
        elapsed = (time.perf_counter() - start) * 1000.0
        info = client.info("memory")
        clients = client.info("clients")
        keyspace = client.info("keyspace")
        db_keys = {db: int(meta.get("keys", 0)) for db, meta in keyspace.items()}
        redbeat_keys = _count_redbeat_keys(client)
        return RedisStatus(
            status="ok",
            latency_ms=round(elapsed, 2),
            used_memory_human=info.get("used_memory_human"),
            connected_clients=int(clients.get("connected_clients", 0)),
            redbeat_keys=redbeat_keys,
            db_keys=db_keys,
            detail=settings.REDIS_URL,
        )
    except RedisError as exc:
        return RedisStatus(status="down", detail=str(exc)[:240])
    except Exception as exc:
        return RedisStatus(status="down", detail=str(exc)[:240])


def _count_redbeat_keys(client: Redis) -> int:
    """Count keys under the RedBeat prefix (one per active schedule, plus locks)."""
    try:
        cursor = 0
        total = 0
        while True:
            # ``redis-py`` types ``scan`` as Awaitable for the async client; the
            # sync client returns a tuple at runtime so we ignore the type here.
            cursor, batch = client.scan(  # type: ignore[misc]
                cursor=cursor, match="qf:redbeat:*", count=200
            )
            total += len(batch)
            if cursor == 0:
                break
        return total
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------


def check_celery() -> CeleryStatus:
    """Inspect the Celery cluster — workers, registered tasks, queues.

    If no workers respond we still return a payload (status=degraded) so the
    UI can render the static queue config and a "no workers online" hint.
    """
    inspect = celery_app.control.inspect(timeout=_CELERY_INSPECT_TIMEOUT_S)
    try:
        ping = inspect.ping() or {}
    except Exception as exc:
        return CeleryStatus(status="down", detail=str(exc)[:240])

    if not ping:
        return CeleryStatus(
            status="degraded",
            detail="No workers responded to ping. Start one with `make worker`.",
            queues=_static_queues(),
        )

    try:
        active = inspect.active() or {}
        stats = inspect.stats() or {}
        active_queues = inspect.active_queues() or {}
        registered = inspect.registered() or {}
    except Exception:
        active, stats, active_queues, registered = {}, {}, {}, {}

    workers: list[CeleryWorker] = []
    for name, info in ping.items():
        worker_stats = stats.get(name, {}) or {}
        total = worker_stats.get("total", {}) or {}
        processed = sum(int(v) for v in total.values()) if total else 0
        wq = [q.get("name", "?") for q in active_queues.get(name, []) or []]
        workers.append(
            CeleryWorker(
                name=name,
                status="ok" if info.get("ok") == "pong" else "unknown",
                active=len(active.get(name, []) or []),
                processed=processed,
                queues=wq,
            )
        )

    tasks = sorted({t for ts in registered.values() for t in (ts or [])})
    queues = _aggregate_queues(active_queues)

    return CeleryStatus(
        status="ok",
        workers=workers,
        registered_tasks=tasks,
        queues=queues,
        detail=f"{len(workers)} worker(s) online",
    )


def _static_queues() -> list[CeleryQueueStat]:
    """Queues from celery routing config — used when no workers are online."""
    routes = celery_app.conf.task_routes or {}
    names = sorted({(cfg or {}).get("queue", "default") for cfg in routes.values()})
    if "default" not in names:
        names.append("default")
    return [CeleryQueueStat(name=q, length=0, workers=[]) for q in names]


def _aggregate_queues(active_queues: dict[str, list]) -> list[CeleryQueueStat]:
    queue_to_workers: dict[str, list[str]] = {}
    for worker, queues in (active_queues or {}).items():
        for q in queues or []:
            name = q.get("name", "?")
            queue_to_workers.setdefault(name, []).append(worker)
    out: list[CeleryQueueStat] = []
    for q in sorted(queue_to_workers.keys()):
        out.append(CeleryQueueStat(name=q, length=0, workers=queue_to_workers[q]))
    return out


# ---------------------------------------------------------------------------
# External UIs (Flower, Redis Commander, Airflow)
# ---------------------------------------------------------------------------


def check_external_links() -> OperationalLinks:
    """Probe the three optional dashboards in parallel."""
    targets = [
        ("Flower", settings.FLOWER_URL, "flower"),
        ("Redis Commander", settings.REDIS_COMMANDER_URL, "redis"),
        ("Airflow", settings.AIRFLOW_URL, "airflow"),
    ]
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda t: _probe_url(*t), targets))
    flower, redis_cmd, airflow = results
    return OperationalLinks(flower=flower, redis_commander=redis_cmd, airflow=airflow)


def _probe_url(name: str, url: str, docs_slug: str) -> ComponentHealth:
    """``GET <url>`` and report status/latency."""
    if not url:
        return ComponentHealth(
            name=name,
            status="unknown",
            detail="No URL configured.",
            url=None,
            docs_slug=docs_slug,
        )
    start = time.perf_counter()
    try:
        with httpx.Client(timeout=_REQUEST_TIMEOUT_S, follow_redirects=True) as client:
            resp = client.get(url)
        elapsed = (time.perf_counter() - start) * 1000.0
        status = "ok" if 200 <= resp.status_code < 400 else "degraded"
        return ComponentHealth(
            name=name,
            status=status,
            detail=f"HTTP {resp.status_code}",
            latency_ms=round(elapsed, 2),
            url=url,
            docs_slug=docs_slug,
        )
    except httpx.HTTPError as exc:
        return ComponentHealth(
            name=name,
            status="down",
            detail=str(exc)[:240] or "connection failed",
            url=url,
            docs_slug=docs_slug,
        )
