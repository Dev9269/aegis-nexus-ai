import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { websocketUrl } from "../config/env";
import type { SecurityEvent } from "../types/api";

export type StreamState = "connecting" | "connected" | "reconnecting" | "unavailable";

interface RealtimeResult {
  state: StreamState;
  lastEvent: SecurityEvent | null;
}

export function useRealtime(enabled: boolean): RealtimeResult {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamState>(enabled ? "connecting" : "unavailable");
  const [lastEvent, setLastEvent] = useState<SecurityEvent | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState("unavailable");
      return;
    }

    let closed = false;
    let attempt = 0;
    let reconnectTimer: number | undefined;
    let heartbeatTimer: number | undefined;

    const connect = () => {
      if (closed) return;
      setState(attempt === 0 ? "connecting" : "reconnecting");
      let socket: WebSocket;
      try {
        socket = new WebSocket(websocketUrl());
      } catch {
        setState("unavailable");
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        if (closed) return;
        attempt = 0;
        setState("connected");
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        heartbeatTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, 25_000);
      };

      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data) as {
            type?: string;
            event?: SecurityEvent;
          };
          if (payload.type === "security_event" && payload.event) {
            setLastEvent(payload.event);
            queryClient.invalidateQueries({ queryKey: ["events"] });
            queryClient.invalidateQueries({ queryKey: ["overview"] });
            queryClient.invalidateQueries({ queryKey: ["incidents"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["identities"] });
            queryClient.invalidateQueries({ queryKey: ["identity"] });
          }
        } catch {
          // Ignore malformed realtime frames.
        }
      };

      socket.onerror = () => {
        if (!closed && socket.readyState !== WebSocket.OPEN) {
          setState("reconnecting");
        }
      };

      socket.onclose = (event) => {
        if (heartbeatTimer) window.clearInterval(heartbeatTimer);
        socketRef.current = null;
        if (closed) return;
        if (event.code === 4401) {
          setState("unavailable");
          return;
        }
        attempt += 1;
        setState("reconnecting");
        const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 15_000);
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, queryClient]);

  return { state, lastEvent };
}
