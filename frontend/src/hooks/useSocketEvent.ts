import { useEffect, useRef } from "react";

import { getSocket } from "@services/socket";

/**
 * Subscribe to a single Socket.IO event for the lifetime of the component.
 *
 * - Captures the latest handler in a ref so consumers can pass inline arrow
 *   functions without re-binding the listener on every parent render.
 * - Auto-detaches on unmount (and on `enabled` flipping false).
 *
 * Usage:
 *   useSocketEvent<RunUpdated>("run.updated", (data) => { ... })
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void,
  enabled = true,
): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    const fn = (data: T) => handlerRef.current(data);
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [event, enabled]);
}

export default useSocketEvent;
