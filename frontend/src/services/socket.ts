/**
 * Socket.IO client singleton.
 *
 * One ``Socket`` per browser tab — multiplexed across the whole app via
 * rooms (``project:<id>``, ``ops``) and request-correlation ids (AI streams).
 * Auth is the JWT in the engine.io handshake `auth` payload, re-read lazily
 * on every (re)connect so a refreshed access token is picked up without
 * tearing the singleton down.
 *
 * Lifecycle is driven by ``useAuth`` — login calls ``connectSocket()``,
 * logout / 401 calls ``disconnectSocket()``.
 *
 * The transport URL is derived from ``VITE_API_BASE_URL``: in dev we hit
 * ``http://localhost:8000`` via Vite's proxy, in prod the same origin
 * serves both ``/api`` and ``/socket.io`` through nginx.
 */
import { io, type Socket } from "socket.io-client";

import { getAccessToken } from "./apiClient";

type SocketStatus = "idle" | "connecting" | "connected" | "disconnected";

type StatusListener = (status: SocketStatus) => void;

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/**
 * If true, always use the page origin for Socket.IO (Vite / nginx must proxy
 * ``/socket.io`` to the API). Use when your API base is an absolute URL on
 * another port but the browser should still use same-origin + proxy to avoid
 * CORS for the socket handshake, or in Docker when the app and API share one
 * HTTP host.
 */
const socketSameOrigin =
  import.meta.env.VITE_SOCKET_SAME_ORIGIN === "1" || import.meta.env.VITE_SOCKET_SAME_ORIGIN === "true";

/**
 * Resolve the Socket.IO origin + path.
 *
 * The python-socketio server is mounted at ``/socket.io`` on the *root* of
 * the same ASGI app that serves FastAPI. We split ``VITE_API_BASE_URL``
 * into:
 *   - origin -> Socket.IO ``url``
 *   - the engine.io path is always ``/socket.io`` (server default)
 *
 * In dev (``VITE_API_BASE_URL`` is a relative ``/api/v1``) Vite proxies
 * ``/socket.io`` to the FastAPI host (see ``vite.config.ts``).
 *
 * **Important:** A full ``http://host:8000/...`` base URL makes the client
 * open the socket on :8000 (cross-origin from :3000). The API must then list
 * your page origin in ``CORS_ORIGINS`` for Socket.IO, *or* set
 * ``VITE_SOCKET_SAME_ORIGIN=true`` and proxy ``/socket.io`` on the page origin.
 */
function resolveSocketTarget(): { url: string; path: string } {
  if (socketSameOrigin) {
    return { url: window.location.origin, path: "/socket.io" };
  }
  if (/^https?:\/\//i.test(baseURL)) {
    const u = new URL(baseURL);
    return { url: u.origin, path: "/socket.io" };
  }
  return { url: window.location.origin, path: "/socket.io" };
}

let socket: Socket | null = null;
let status: SocketStatus = "idle";
const listeners = new Set<StatusListener>();

function setStatus(next: SocketStatus): void {
  if (status === next) return;
  status = next;
  for (const cb of listeners) cb(next);
}

/** Get (and create on first call) the singleton. Does not auto-connect. */
export function getSocket(): Socket {
  if (socket) return socket;
  const { url, path } = resolveSocketTarget();
  socket = io(url, {
    path,
    autoConnect: false,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8_000,
    // Lazy auth: on every (re)connect attempt, the client invokes this
    // callback to refresh the JWT. No socket teardown on token rotation.
    auth: (cb: (data: { token: string | null }) => void) => {
      cb({ token: getAccessToken() });
    },
  });

  socket.on("connect", () => setStatus("connected"));
  socket.on("disconnect", () => setStatus("disconnected"));
  socket.io.on("reconnect_attempt", () => setStatus("connecting"));
  socket.on("connect_error", (err: unknown) => {
    setStatus("disconnected");
    if (import.meta.env.MODE === "development") {
      // Typical causes: CORS (wrong CORS_ORIGINS vs your browser URL, e.g. 127.0.0.1
      // vs localhost), nginx not proxying /socket.io, or JWT rejected (not logged in).
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "[socket] connect_error",
        message,
        "(check VITE_API_BASE_URL / CORS / nginx / auth)",
      );
    }
  });

  return socket;
}

/** Connect (or reconnect) the singleton. Safe to call multiple times. */
export function connectSocket(): void {
  const s = getSocket();
  if (s.connected || status === "connecting") return;
  setStatus("connecting");
  s.connect();
}

/** Tear the singleton's connection down (e.g. on logout). */
export function disconnectSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  setStatus("idle");
}

/** Subscribe to status changes — used by ``useSocketStatus`` for UI. */
export function onSocketStatus(cb: StatusListener): () => void {
  listeners.add(cb);
  cb(status);
  return () => listeners.delete(cb);
}

export function getSocketStatus(): SocketStatus {
  return status;
}

export type { SocketStatus };
