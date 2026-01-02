import { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { getAuthToken } from "../lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const useWebSocket = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    const token = getAuthToken();

    if (!token) {
      return null;
    }

    // Create socket connection with optimized settings
    const newSocket = io(API_BASE_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // Exponential backoff max
      reconnectionAttempts: Infinity, // Never give up reconnecting
      timeout: 20000, // Connection timeout
      transports: ["websocket", "polling"], // Try WebSocket first, fallback to polling
      upgrade: true, // Allow transport upgrade
      rememberUpgrade: true, // Remember successful upgrades
      autoConnect: true,
    });

    socketRef.current = newSocket;

    // Connection established
    newSocket.on("connect", () => {
      if (mountedRef.current) {
        setConnected(true);
        setReconnecting(false);
        setReconnectAttempt(0);
      }
    });

    // Connection lost
    newSocket.on("disconnect", (reason) => {
      if (mountedRef.current) {
        setConnected(false);

        // If disconnect was due to transport error or server issue, try to reconnect
        if (
          reason === "transport error" ||
          reason === "transport close" ||
          reason === "ping timeout"
        ) {
          setReconnecting(true);
        }
      }
    });

    // Connection error
    newSocket.on("connect_error", (error) => {
      console.error("❌ WebSocket connection error:", error.message);
      if (mountedRef.current) {
        setConnected(false);
        setReconnecting(true);
      }
    });

    // Reconnecting
    newSocket.io.on("reconnect_attempt", (attempt) => {
      if (mountedRef.current) {
        setReconnecting(true);
        setReconnectAttempt(attempt);
      }
    });

    // Reconnected
    newSocket.io.on("reconnect", (attempt) => {
      if (mountedRef.current) {
        setConnected(true);
        setReconnecting(false);
        setReconnectAttempt(0);
      }
    });

    // Failed to reconnect after all attempts (won't happen with Infinity, but keep for safety)
    newSocket.io.on("reconnect_failed", () => {
      console.error("❌ WebSocket reconnection failed - will keep trying...");
      if (mountedRef.current) {
        setReconnecting(true);
        // Manual retry after a delay
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && socketRef.current) {
            socketRef.current.connect();
          }
        }, 5000);
      }
    });

    // Reconnection error
    newSocket.io.on("reconnect_error", (error) => {
      console.error("❌ WebSocket reconnection error:", error.message);
    });

    return newSocket;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const newSocket = connect();
    if (newSocket) {
      setSocket(newSocket);
    }

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return { socket, connected, reconnecting, reconnectAttempt };
};
