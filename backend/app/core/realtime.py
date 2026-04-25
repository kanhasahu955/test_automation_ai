"""Realtime pub/sub backbone — Redis-backed fan-out for Socket.IO.

A single async Redis client is shared by the Socket.IO bridge so we can
multiplex events across all browser tabs over one TCP connection per
process. Events flow through:

* ``qf:project:{project_id}``  — run state changes, new results, regressions.
  Powers Dashboard + Executions live updates (replaces 5-15s polling).
* ``qf:ai:{stream_id}``         — reserved for future Celery-driven AI
  streams (today, AI streaming runs in-process and emits directly to the
  requesting socket; we keep the channel namespace open).

The publisher API is **best-effort**: a Redis outage MUST NOT break the
write that triggered the event (e.g. saving an execution result). We log
and swallow.

The subscribe side is consumed exclusively by the Socket.IO bridge in
``app.core.socketio`` — see ``_bridge_loop`` there.
"""
from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any

from redis.asyncio import Redis as AsyncRedis
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.logger import get_logger

log = get_logger("realtime")


# Single shared async client for the API process.  Lazily constructed on first
# use so importing this module never makes a network call (test-friendly).
_async_client: AsyncRedis | None = None
_async_lock = asyncio.Lock()


async def _get_client() -> AsyncRedis:
    global _async_client
    if _async_client is not None:
        return _async_client
    async with _async_lock:
        if _async_client is None:
            _async_client = AsyncRedis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=15,
                health_check_interval=30,
            )
    return _async_client


# ---------------------------------------------------------------------------
# Channel naming
# ---------------------------------------------------------------------------


def project_channel(project_id: str) -> str:
    return f"qf:project:{project_id}"


def ai_channel(stream_id: str) -> str:
    return f"qf:ai:{stream_id}"


# ---------------------------------------------------------------------------
# Publish (sync + async)
# ---------------------------------------------------------------------------


def _envelope(event_type: str, data: dict[str, Any]) -> str:
    return json.dumps(
        {
            "type": event_type,
            "ts": datetime.now(UTC).isoformat(),
            "data": data,
        },
        default=str,
    )


def publish(channel: str, event_type: str, data: dict[str, Any]) -> None:
    """Fire-and-forget publish from sync code (e.g. inside a SQLAlchemy commit).

    Uses a short-lived sync Redis client so we don't need an event loop. If
    Redis is down we log a warning — never propagate the failure to the
    caller, which is usually a critical write path.
    """
    try:
        # Local import keeps this module light when realtime isn't used.
        from redis import Redis

        client = Redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        client.publish(channel, _envelope(event_type, data))
    except RedisError as exc:
        log.warning("realtime.publish_failed", channel=channel, error=str(exc))
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("realtime.publish_failed", channel=channel, error=str(exc))


async def apublish(channel: str, event_type: str, data: dict[str, Any]) -> None:
    """Async publish — preferred when already inside the event loop."""
    try:
        client = await _get_client()
        await client.publish(channel, _envelope(event_type, data))
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("realtime.publish_failed", channel=channel, error=str(exc))


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


async def aclose() -> None:
    """Close the shared async client. Called from FastAPI ``lifespan`` shutdown."""
    global _async_client
    if _async_client is None:
        return
    try:
        await _async_client.aclose()
    finally:
        _async_client = None
