import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { getAuthToken } from "@/lib/api";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Custom hook for managing AI Insights WebSocket connection
 * Automatically connects, authenticates, and handles reconnection
 */
export function useAIInsightsWebSocket(callbacks = {}) {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const listenersRef = useRef({});

  const {
    onInsightCreated,
    onInsightUpdated,
    onInsightDeleted,
    onGenerationProgress,
    onGenerationComplete,
    onConnected,
    onDisconnected,
    onError,
  } = callbacks;

  const connect = useCallback(() => {
    const token = getAuthToken();

    if (!token) {
      console.warn("[AIInsightsWebSocket] No auth token available");
      return;
    }

    // Disconnect existing connection if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    console.log("[AIInsightsWebSocket] Connecting to", SOCKET_URL);

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Remove existing listeners to prevent duplicates
    Object.values(listenersRef.current).forEach((removeListener) =>
      removeListener()
    );
    listenersRef.current = {};

    // Connection events
    const connectListener = () => {
      console.log("[AIInsightsWebSocket] ✅ Connected:", socket.id);
      onConnected?.();
    };
    socket.on("connect", connectListener);
    listenersRef.current.connect = () => socket.off("connect", connectListener);

    const disconnectListener = (reason) => {
      console.log("[AIInsightsWebSocket] ❌ Disconnected:", reason);
      onDisconnected?.(reason);
    };
    socket.on("disconnect", disconnectListener);
    listenersRef.current.disconnect = () =>
      socket.off("disconnect", disconnectListener);

    const errorListener = (error) => {
      console.error("[AIInsightsWebSocket] Connection error:", error.message);
      onError?.(error);
    };
    socket.on("connect_error", errorListener);
    listenersRef.current.connect_error = () =>
      socket.off("connect_error", errorListener);

    // AI Insights events
    const insightGeneratedListener = (insight) => {
      console.log("[AIInsightsWebSocket] 🧠 Insight generated:", insight.id);
      onInsightCreated?.(insight);
    };
    socket.on("insight:generated", insightGeneratedListener);
    listenersRef.current["insight:generated"] = () =>
      socket.off("insight:generated", insightGeneratedListener);

    const insightUpdatedListener = (insight) => {
      console.log("[AIInsightsWebSocket] 🔄 Insight updated:", insight.id);
      onInsightUpdated?.(insight);
    };
    socket.on("insight:updated", insightUpdatedListener);
    listenersRef.current["insight:updated"] = () =>
      socket.off("insight:updated", insightUpdatedListener);

    const insightDeletedListener = (data) => {
      console.log("[AIInsightsWebSocket] 🗑️ Insight deleted:", data.id);
      onInsightDeleted?.(data);
    };
    socket.on("insight:deleted", insightDeletedListener);
    listenersRef.current["insight:deleted"] = () =>
      socket.off("insight:deleted", insightDeletedListener);

    socketRef.current = socket;
  }, [
    onInsightCreated,
    onInsightUpdated,
    onInsightDeleted,
    onGenerationProgress,
    onGenerationComplete,
    onConnected,
    onDisconnected,
    onError,
  ]);

  const disconnect = useCallback(() => {
    // Remove all listeners
    Object.values(listenersRef.current).forEach((removeListener) =>
      removeListener()
    );
    listenersRef.current = {};

    if (socketRef.current) {
      console.log("[AIInsightsWebSocket] Disconnecting...");
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn("[AIInsightsWebSocket] Cannot emit - socket not connected");
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    connected: socketRef.current?.connected || false,
    connect,
    disconnect,
    emit,
  };
}
