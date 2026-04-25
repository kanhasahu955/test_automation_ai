"""Socket.IO server — bidirectional realtime layer.

Replaces the previous Server-Sent Events (SSE) layer with a Socket.IO
endpoint mounted alongside FastAPI on the same ASGI app. We get:

* **Auto-reconnect with exponential backoff** baked into the client.
* **Rooms** for tenant-scoped fan-out (``project:<id>``, ``ops``).
* **Acknowledgements** on emit, perfect for the AI streaming
  request/response pattern (correlate via ``request_id``).
* **WebSocket primary, long-polling fallback** so corporate proxies that
  block Upgrade still work transparently.

# Architecture

```
              ┌────────────────────────┐
              │  Celery / API workers  │
              │   call publish() via   │
              │   core.realtime         │
              └───────────┬────────────┘
                          │ Redis PUB/SUB
                          ▼
   qf:project:*  ───┐
                    │
                    ▼
   ┌────────────────────────────────────┐
   │   socketio bridge (this module)    │  ──► sio.emit(...)
   │   - psubscribe('qf:project:*')     │       to room 'project:<id>'
   │   - on message → emit to room      │
   └────────────────────────────────────┘
                          │
                          ▼
                ┌──────────────────────┐
                │   Browser clients    │
                │ (socket.io-client v4)│
                └──────────────────────┘
```

The OPS health snapshot is emitted by a server-side periodic loop that
**only runs while at least one client is in the ``ops`` room**, so we
don't waste DB/Redis/Celery probes when nobody is watching.

AI streaming runs inline as a Socket.IO event handler: the client emits
``ai:generate-test-cases`` with a ``request_id`` and we stream
``ai:meta`` / ``ai:token`` / ``ai:parsed`` / ``ai:done`` back to that
specific sid (room=sid by default). The synchronous OpenAI client runs
in a thread executor so we never block the event loop.

# Auth

The handshake's ``auth`` payload (``io({ auth: { token } })``) carries
the JWT. We validate it the same way ``get_current_user`` does and
attach the resolved ``user_id`` to the socket session via
``sio.save_session``. A bad/missing token raises ``ConnectionRefusedError``
which Socket.IO propagates to the client as a connect error.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
from typing import Any

import socketio
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import engine
from app.core.logger import get_logger
from app.core.realtime import _get_client as _get_async_redis
from app.core.security import decode_token
from app.modules.users.models import User

log = get_logger("socketio")


def _engineio_cors_allowed() -> list[str] | str:
    """CORS for the Engine.IO / Socket.IO HTTP handshakes (separate from FastAPI).

    If this list does not include the browser's exact ``Origin`` (including
    ``http://127.0.0.1:3000`` vs ``http://localhost:3000``), the first polling
    request often fails with **403** before the Socket.IO ``connect`` handler runs.

    Outside production we allow all origins so local and staging URLs work
    without duplicating every hostname variant in ``CORS_ORIGINS``. In
    production, mirror ``CORS_ORIGINS`` (set in env / YAML for your real UI hosts).
    """
    if not settings.is_production:
        return "*"
    origins = list(settings.CORS_ORIGINS) if settings.CORS_ORIGINS else []
    return origins if origins else "*"


# ---------------------------------------------------------------------------
# Server instance — single AsyncServer for the API process.
# ---------------------------------------------------------------------------
#
# We deliberately do NOT use ``socketio.AsyncRedisManager`` here even though
# we have Redis available: the Redis pub/sub bridge below already does the
# fan-out for us, and using both would duplicate every emit. If we ever scale
# the API horizontally beyond one process, switch the manager and remove the
# bridge in the same change.

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=_engineio_cors_allowed(),
    logger=False,
    engineio_logger=False,
    # 60s ping timeout matches our nginx default; a tab that misses two
    # pings (~80s) is treated as gone, which keeps the ops subscriber
    # counter accurate.
    ping_interval=25,
    ping_timeout=60,
)


# ---------------------------------------------------------------------------
# Bookkeeping for the ops snapshot loop.
# ---------------------------------------------------------------------------

_ops_lock = asyncio.Lock()
_ops_subscribers = 0  # connected sids currently in the 'ops' room

# Background task handles, populated by ``start_background_tasks``. The set
# of in-flight one-shot tasks (initial-snapshot pushes, AI streams) is kept
# in ``_inflight`` so the GC doesn't collect them mid-flight (RUF006).
_bridge_task: asyncio.Task[None] | None = None
_ops_task: asyncio.Task[None] | None = None
_stop_event: asyncio.Event | None = None
_inflight: set[asyncio.Task[None]] = set()


def _spawn(coro) -> asyncio.Task[None]:
    """Create a tracked background task that survives until completion."""
    task = asyncio.create_task(coro)
    _inflight.add(task)
    task.add_done_callback(_inflight.discard)
    return task


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def _resolve_user_id(token: str | None) -> str | None:
    """Validate a JWT exactly the way the HTTP auth dependency does.

    Returns the user id on success, ``None`` on any failure. We never log
    the token itself.
    """
    if not token:
        return None
    try:
        payload = decode_token(token)
    except ValueError:
        return None
    if payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    # We hit the DB once per connect to be sure the user wasn't deactivated
    # between login and now. Cheap (PK lookup) and the connect path runs
    # once per tab.
    try:
        with Session(engine) as session:
            user = session.exec(select(User).where(User.id == user_id)).first()
            if user is None or not user.is_active:
                return None
    except Exception as exc:  # pragma: no cover - DB outage shouldn't kill the layer
        log.warning("socketio.user_lookup_failed", error=str(exc))
        return None
    return user_id


# ---------------------------------------------------------------------------
# Connection lifecycle
# ---------------------------------------------------------------------------


@sio.event
async def connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None) -> None:
    """Validate the JWT before accepting the socket.

    ``auth`` comes from ``io({ auth: { token } })`` on the client. We also
    accept a fallback ``Authorization: Bearer <token>`` HTTP header so
    server-to-server probes (curl, integration tests) work without a
    custom client wrapper.
    """
    token: str | None = None
    if auth and isinstance(auth, dict):
        token = auth.get("token")
    if not token:
        header = environ.get("HTTP_AUTHORIZATION", "")
        if header.lower().startswith("bearer "):
            token = header.split(" ", 1)[1].strip()

    user_id = _resolve_user_id(token)
    if not user_id:
        log.info("socketio.connect_refused", sid=sid)
        # Rejects the handshake — client sees a ``connect_error``.
        raise ConnectionRefusedError("invalid_or_missing_token")

    await sio.save_session(sid, {"user_id": user_id, "in_ops": False})
    log.info("socketio.connect", sid=sid, user_id=user_id)


@sio.event
async def disconnect(sid: str) -> None:
    """Decrement the ops subscriber count if this sid was watching ops."""
    global _ops_subscribers
    try:
        sess = await sio.get_session(sid)
    except KeyError:
        return
    if sess.get("in_ops"):
        async with _ops_lock:
            _ops_subscribers = max(0, _ops_subscribers - 1)
    log.debug("socketio.disconnect", sid=sid)


# ---------------------------------------------------------------------------
# Room management — clients ask us to join/leave per page.
# ---------------------------------------------------------------------------


@sio.event
async def join_project(sid: str, data: dict[str, Any] | None) -> dict[str, Any]:
    """Subscribe the socket to ``project:<id>`` events.

    Idempotent: re-joining the same project is a no-op. Returning a dict
    triggers the client's ack callback so it can wait for room membership
    before issuing dependent fetches.
    """
    project_id = (data or {}).get("project_id")
    if not project_id or not isinstance(project_id, str):
        return {"ok": False, "error": "project_id required"}
    await sio.enter_room(sid, _project_room(project_id))
    return {"ok": True, "room": _project_room(project_id)}


@sio.event
async def leave_project(sid: str, data: dict[str, Any] | None) -> dict[str, Any]:
    project_id = (data or {}).get("project_id")
    if project_id and isinstance(project_id, str):
        await sio.leave_room(sid, _project_room(project_id))
    return {"ok": True}


@sio.event
async def join_ops(sid: str, _data: Any = None) -> dict[str, Any]:
    """Subscribe the socket to the ``ops`` room and bump the snapshot loop."""
    global _ops_subscribers
    sess = await sio.get_session(sid)
    if sess.get("in_ops"):
        return {"ok": True, "room": "ops"}

    await sio.enter_room(sid, "ops")
    sess["in_ops"] = True
    await sio.save_session(sid, sess)
    async with _ops_lock:
        _ops_subscribers += 1
    _spawn(_send_initial_ops_snapshot(sid))
    return {"ok": True, "room": "ops"}


@sio.event
async def leave_ops(sid: str, _data: Any = None) -> dict[str, Any]:
    global _ops_subscribers
    sess = await sio.get_session(sid)
    if sess.get("in_ops"):
        await sio.leave_room(sid, "ops")
        sess["in_ops"] = False
        await sio.save_session(sid, sess)
        async with _ops_lock:
            _ops_subscribers = max(0, _ops_subscribers - 1)
    return {"ok": True}


def _project_room(project_id: str) -> str:
    return f"project:{project_id}"


# ---------------------------------------------------------------------------
# AI streaming — request/response over Socket.IO
# ---------------------------------------------------------------------------
#
# Client emits ``ai:generate-test-cases`` with a ``request_id`` and the
# server streams back ``ai:meta`` -> ``ai:token`` x N -> ``ai:parsed`` ->
# ``ai:done`` (or ``ai:error`` then ``ai:done`` on failure). All events
# carry the ``request_id`` so the client can correlate concurrent calls.


async def _stream_ai_to_client(
    sid: str,
    request_id: str,
    generator_factory,
) -> None:
    """Run a sync ai_generator stream() generator and emit each tuple back to ``sid``.

    The OpenAI client is sync; running it inline would block uvicorn's
    loop. We hop into a thread, push each tuple onto an asyncio.Queue, and
    drain the queue back into ``sio.emit`` on the loop.
    """
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[tuple[str, dict[str, Any]] | None] = asyncio.Queue()

    def producer() -> None:
        try:
            with Session(engine) as session:
                for event_type, payload in generator_factory(session):
                    asyncio.run_coroutine_threadsafe(
                        queue.put((event_type, payload)), loop
                    ).result()
        except Exception as exc:  # pragma: no cover - defensive
            log.warning("socketio.ai_producer_failed", error=str(exc))
            asyncio.run_coroutine_threadsafe(
                queue.put(("error", {"message": str(exc), "code": "ai_stream_failed"})),
                loop,
            ).result()
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop).result()

    task = loop.run_in_executor(None, producer)
    try:
        while True:
            item = await queue.get()
            if item is None:
                # Always send a final ``ai:done`` so the client can flip
                # the streaming flag even if the generator forgot.
                await sio.emit(
                    "ai:done",
                    {"request_id": request_id},
                    room=sid,
                )
                return
            event_type, payload = item
            await sio.emit(
                f"ai:{event_type}",
                {"request_id": request_id, **payload},
                room=sid,
            )
    finally:
        task.cancel()


@sio.on("ai:generate-test-cases")
async def ai_generate_test_cases(sid: str, data: dict[str, Any]) -> dict[str, Any]:
    """Token-by-token AI test case generation.

    Returns immediately with an ack so the client knows the server
    accepted the request; the real payload arrives as ``ai:*`` events.
    """
    sess = await sio.get_session(sid)
    user_id = sess.get("user_id")

    request_id = (data or {}).get("request_id") or "req"
    requirement = (data or {}).get("requirement", "")
    count = int((data or {}).get("count", 5))
    project_id = (data or {}).get("project_id")

    def factory(session: Session):
        from app.modules.ai_generator import service as ai_service

        return ai_service.stream_test_cases(
            session, requirement, count, project_id, user_id,
        )

    _spawn(_stream_ai_to_client(sid, request_id, factory))
    return {"ok": True, "request_id": request_id}


@sio.on("ai:suggest-edge-cases")
async def ai_suggest_edge_cases(sid: str, data: dict[str, Any]) -> dict[str, Any]:
    request_id = (data or {}).get("request_id") or "req"
    requirement = (data or {}).get("requirement", "")

    def factory(session: Session):
        from app.modules.ai_generator import service as ai_service

        return ai_service.stream_edge_cases(session, requirement)

    _spawn(_stream_ai_to_client(sid, request_id, factory))
    return {"ok": True, "request_id": request_id}


# ---------------------------------------------------------------------------
# Redis pub/sub bridge — fan executions / regression / project events out to
# the matching Socket.IO rooms. Existing callers (executions service,
# Celery workers) continue to call ``app.core.realtime.publish()`` from
# sync code; we don't need to change them.
# ---------------------------------------------------------------------------


async def _bridge_loop(stop_event: asyncio.Event) -> None:
    """Reconnecting Redis psubscribe → Socket.IO emit forwarder."""
    backoff = 1
    while not stop_event.is_set():
        pubsub = None
        try:
            client = await _get_async_redis()
            pubsub = client.pubsub(ignore_subscribe_messages=True)
            await pubsub.psubscribe("qf:project:*")
            log.info("socketio.bridge.subscribed")
            backoff = 1

            while not stop_event.is_set():
                # Short timeout so we react to shutdown promptly.
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=15.0
                )
                if msg is None:
                    continue
                if msg.get("type") not in {"pmessage", "message"}:
                    continue
                channel = msg.get("channel")
                if isinstance(channel, bytes):
                    channel = channel.decode()
                raw = msg.get("data")
                if not raw:
                    continue
                try:
                    envelope = json.loads(raw)
                except (TypeError, ValueError):
                    log.warning("socketio.bridge.bad_payload", channel=channel)
                    continue
                event_type = envelope.get("type", "message")
                payload = envelope.get("data") or {}
                if isinstance(channel, str) and channel.startswith("qf:project:"):
                    project_id = channel.split(":", 2)[-1]
                    await sio.emit(
                        event_type,
                        payload,
                        room=_project_room(project_id),
                    )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("socketio.bridge.crashed", error=str(exc), backoff=backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)
        finally:
            if pubsub is not None:
                with contextlib.suppress(Exception):
                    await pubsub.aclose()


# ---------------------------------------------------------------------------
# Ops snapshot loop — ticks every OPS_REFRESH_SECONDS but skips work when
# nobody is watching. The snapshot probe touches DB + Redis + Celery so it's
# the most expensive thing we push.
# ---------------------------------------------------------------------------

OPS_REFRESH_SECONDS = 10


def _take_ops_snapshot() -> dict[str, Any]:
    """Synchronous snapshot helper, intended for ``asyncio.to_thread``."""
    from app.modules.ops import service as ops_service

    with Session(engine) as session:
        return ops_service.get_snapshot(session).model_dump(mode="json")


async def _send_initial_ops_snapshot(sid: str) -> None:
    """Push one snapshot to a freshly joined client without waiting a tick."""
    try:
        snapshot = await asyncio.to_thread(_take_ops_snapshot)
        await sio.emit("ops.snapshot", snapshot, room=sid)
    except Exception as exc:  # pragma: no cover - defensive
        await sio.emit("ops.error", {"message": str(exc)}, room=sid)


async def _ops_loop(stop_event: asyncio.Event) -> None:
    """Periodic ops snapshot broadcast — gated on at least one subscriber."""
    while not stop_event.is_set():
        # Sleep ``OPS_REFRESH_SECONDS`` but wake immediately on shutdown.
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(stop_event.wait(), timeout=OPS_REFRESH_SECONDS)
        if stop_event.is_set():
            return
        if _ops_subscribers <= 0:
            continue
        try:
            snapshot = await asyncio.to_thread(_take_ops_snapshot)
            await sio.emit("ops.snapshot", snapshot, room="ops")
        except Exception as exc:  # pragma: no cover - defensive
            log.warning("socketio.ops.tick_failed", error=str(exc))
            await sio.emit("ops.error", {"message": str(exc)}, room="ops")


# ---------------------------------------------------------------------------
# Lifecycle hooks called from FastAPI's ``lifespan``
# ---------------------------------------------------------------------------


async def start_background_tasks() -> None:
    """Start the Redis bridge + ops loop. Idempotent."""
    global _bridge_task, _ops_task, _stop_event
    if _bridge_task is not None and not _bridge_task.done():
        return
    _stop_event = asyncio.Event()
    _bridge_task = asyncio.create_task(_bridge_loop(_stop_event), name="sio-bridge")
    _ops_task = asyncio.create_task(_ops_loop(_stop_event), name="sio-ops")
    log.info("socketio.background_tasks.started")


async def stop_background_tasks() -> None:
    """Stop the Redis bridge + ops loop on shutdown."""
    global _bridge_task, _ops_task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    for task in (_bridge_task, _ops_task):
        if task is None:
            continue
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await task
    _bridge_task = None
    _ops_task = None
    _stop_event = None
    log.info("socketio.background_tasks.stopped")


def build_asgi_app(fastapi_app):
    """Wrap a FastAPI app with the Socket.IO ASGI middleware.

    Mounts at ``/socket.io`` (Socket.IO's default). Other paths fall
    through to FastAPI unchanged.
    """
    return socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")


__all__ = [
    "build_asgi_app",
    "sio",
    "start_background_tasks",
    "stop_background_tasks",
]
