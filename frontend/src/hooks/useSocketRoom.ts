import { useEffect } from "react";

import { connectSocket, getSocket } from "@services/socket";

type Room =
  | { type: "project"; id: string }
  | { type: "ops" };

function roomEvent(room: Room, op: "join" | "leave"): { event: string; payload: unknown } {
  if (room.type === "project") {
    return { event: `${op}_project`, payload: { project_id: room.id } };
  }
  return { event: `${op}_ops`, payload: {} };
}

/**
 * Join a server-side Socket.IO room and re-join automatically on reconnect.
 *
 * The backend rooms model:
 *   - ``project:<id>``  — run / regression updates for one project
 *   - ``ops``           — operations console (10s snapshot broadcast)
 *
 * The hook:
 *   1. Calls ``connectSocket()`` so it works even before any other code
 *      has nudged the singleton awake.
 *   2. Emits a ``project:join`` / ``ops:join`` request once (on connect or
 *      mount, whichever is later).
 *   3. Re-emits on every ``connect`` so a transient disconnect doesn't leave
 *      the client out of the room after auto-reconnection.
 *   4. On unmount / dep change, emits the matching ``leave``.
 */
export function useSocketRoom(room: Room | null): void {
  const key = room ? (room.type === "project" ? `project:${room.id}` : "ops") : null;

  useEffect(() => {
    if (!room || !key) return;
    connectSocket();
    const socket = getSocket();
    const { event: joinEvent, payload } = roomEvent(room, "join");
    const { event: leaveEvent } = roomEvent(room, "leave");

    const join = () => socket.emit(joinEvent, payload);
    if (socket.connected) join();
    socket.on("connect", join);

    return () => {
      socket.off("connect", join);
      if (socket.connected) socket.emit(leaveEvent, payload);
    };
    // We deliberately depend on ``key`` (a stable string identity for the
    // room) rather than the ``room`` object so callers can pass a fresh
    // object literal on every render without thrashing the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export default useSocketRoom;
