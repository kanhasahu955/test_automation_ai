"""Tests for the Operations module.

We focus on the **defensive** behaviour: every probe must return a typed
status payload even when the dependency is unavailable, because the
Operations Console is exactly the page users open *when* something is
broken.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.modules.ops import service as ops_service
from app.modules.ops.schemas import (
    ComponentHealth,
    OperationalLinks,
    OperationsSnapshot,
)


def _make_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------


def test_check_database_ok() -> None:
    """A live SQLite engine returns ``status=ok`` with non-negative latency."""
    with _make_session() as session:
        health = ops_service.check_database(session)
    assert health.status == "ok"
    assert health.latency_ms is not None
    assert health.latency_ms >= 0


def test_check_database_down_when_engine_broken() -> None:
    """A broken session is reported as ``down`` with the error message."""
    fake_session = MagicMock(spec=Session)
    fake_session.connection.return_value.execute.side_effect = RuntimeError(
        "connection refused"
    )

    health = ops_service.check_database(fake_session)
    assert health.status == "down"
    assert "connection refused" in (health.detail or "")


# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------


class _FakeRedis:
    def __init__(self) -> None:
        self.called: list[str] = []

    @classmethod
    def from_url(cls, *_args, **_kwargs) -> _FakeRedis:
        return cls()

    def ping(self) -> bool:
        self.called.append("ping")
        return True

    def info(self, section: str) -> dict:
        return {
            "memory": {"used_memory_human": "1.2M"},
            "clients": {"connected_clients": 3},
            "keyspace": {"db0": {"keys": 12, "expires": 0}},
        }[section]

    def scan(self, cursor: int = 0, match: str = "", count: int = 200):
        return 0, [b"qf:redbeat:foo", b"qf:redbeat:bar"]


def test_check_redis_ok() -> None:
    with patch("app.modules.ops.service.Redis", _FakeRedis):
        status = ops_service.check_redis()
    assert status.status == "ok"
    assert status.used_memory_human == "1.2M"
    assert status.connected_clients == 3
    assert status.redbeat_keys == 2
    assert status.db_keys == {"db0": 12}


def test_check_redis_down() -> None:
    class _BrokenRedis:
        @classmethod
        def from_url(cls, *_args, **_kwargs):
            raise RuntimeError("connection refused")

    with patch("app.modules.ops.service.Redis", _BrokenRedis):
        status = ops_service.check_redis()
    assert status.status == "down"
    assert status.detail
    assert "connection refused" in status.detail


# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------


class _FakeInspect:
    def __init__(self, *, with_workers: bool) -> None:
        self.with_workers = with_workers

    def ping(self):
        return {"celery@worker1": {"ok": "pong"}} if self.with_workers else {}

    def active(self):
        return {"celery@worker1": [{"id": "t1"}, {"id": "t2"}]}

    def stats(self):
        return {"celery@worker1": {"total": {"execution.run": 7, "ai.task": 3}}}

    def active_queues(self):
        return {"celery@worker1": [{"name": "execution"}, {"name": "default"}]}

    def registered(self):
        return {"celery@worker1": ["execution.run", "ai.task"]}


def test_check_celery_ok() -> None:
    fake_inspect = _FakeInspect(with_workers=True)
    with patch("app.modules.ops.service.celery_app") as mock_app:
        mock_app.control.inspect.return_value = fake_inspect
        status = ops_service.check_celery()

    assert status.status == "ok"
    assert len(status.workers) == 1
    worker = status.workers[0]
    assert worker.name == "celery@worker1"
    assert worker.active == 2
    assert worker.processed == 10
    assert "execution" in worker.queues
    assert {q.name for q in status.queues} == {"execution", "default"}
    assert status.registered_tasks == ["ai.task", "execution.run"]


def test_check_celery_degraded_when_no_workers() -> None:
    fake_inspect = _FakeInspect(with_workers=False)
    with patch("app.modules.ops.service.celery_app") as mock_app:
        mock_app.control.inspect.return_value = fake_inspect
        # Static queue config still comes from celery_app.conf.task_routes
        mock_app.conf.task_routes = {
            "execution.*": {"queue": "executions"},
            "ai.*": {"queue": "ai"},
        }
        status = ops_service.check_celery()

    assert status.status == "degraded"
    assert status.detail and "No workers" in status.detail
    assert {q.name for q in status.queues} >= {"executions", "ai", "default"}


def test_check_celery_down_when_broker_unreachable() -> None:
    failing_inspect = MagicMock()
    failing_inspect.ping.side_effect = RuntimeError("broker unreachable")
    with patch("app.modules.ops.service.celery_app") as mock_app:
        mock_app.control.inspect.return_value = failing_inspect
        status = ops_service.check_celery()

    assert status.status == "down"
    assert "broker unreachable" in (status.detail or "")


# ---------------------------------------------------------------------------
# External link probes
# ---------------------------------------------------------------------------


def _mock_handler(request: httpx.Request) -> httpx.Response:
    url = str(request.url)
    if "5555" in url:
        return httpx.Response(200, text="ok")
    if "8081" in url:
        return httpx.Response(401, text="unauthorized")
    raise httpx.ConnectError("connection refused")


def test_check_external_links_mixed_states() -> None:
    """Probe results are derived from each component's HTTP response."""
    transport = httpx.MockTransport(_mock_handler)
    real_client_cls = httpx.Client

    class _PatchedClient:
        def __init__(self, *_args, **kwargs) -> None:
            self._client = real_client_cls(
                transport=transport,
                timeout=kwargs.get("timeout", 2.0),
                follow_redirects=kwargs.get("follow_redirects", False),
            )

        def __enter__(self):
            return self._client

        def __exit__(self, *exc) -> None:
            self._client.close()

    with patch("app.modules.ops.service.httpx.Client", _PatchedClient):
        links = ops_service.check_external_links()

    assert links.flower.status == "ok"
    assert links.redis_commander.status == "degraded"  # 401 is reachable but bad
    assert links.airflow.status == "down"


# ---------------------------------------------------------------------------
# End-to-end snapshot
# ---------------------------------------------------------------------------


def test_get_snapshot_aggregates_components() -> None:
    """``get_snapshot`` must return a populated :class:`OperationsSnapshot` even
    when individual probes fail."""
    fake_links = OperationalLinks(
        flower=ComponentHealth(name="Flower", status="ok"),
        redis_commander=ComponentHealth(name="Redis Commander", status="ok"),
        airflow=ComponentHealth(name="Airflow", status="unknown"),
    )
    with (
        _make_session() as session,
        patch("app.modules.ops.service.Redis", _FakeRedis),
        patch("app.modules.ops.service.celery_app") as mock_app,
        patch(
            "app.modules.ops.service.check_external_links",
            return_value=fake_links,
        ),
    ):
        mock_app.control.inspect.return_value = _FakeInspect(with_workers=True)
        snap = ops_service.get_snapshot(session)

    assert isinstance(snap, OperationsSnapshot)
    assert snap.api.status == "ok"
    assert snap.database.status == "ok"
    assert snap.redis.status == "ok"
    assert snap.celery.status == "ok"
