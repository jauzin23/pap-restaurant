import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { getAuthToken } from "@/lib/api";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Custom hook for managing Stock WebSocket connection
 * Automatically connects, authenticates, and handles reconnection
 */
export function useStockWebSocket(callbacks = {}) {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const {
    onItemCreated,
    onItemUpdated,
    onItemDeleted,
    onCategoryCreated,
    onCategoryUpdated,
    onCategoryDeleted,
    onSupplierCreated,
    onSupplierUpdated,
    onSupplierDeleted,
    onLocationCreated,
    onLocationUpdated,
    onLocationDeleted,
    onWarehouseCreated,
    onWarehouseUpdated,
    onWarehouseDeleted,
    onInventoryUpdated,
    onInventoryDeleted,
    onStockTransferred,
    onAlert,
    onConnected,
    onDisconnected,
    onError,
  } = callbacks;

  const connect = useCallback(() => {
    const token = getAuthToken();

    if (!token) {
      return;
    }

    // Disconnect existing connection if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    socket.on("connect", () => {
      onConnected?.();
    });

    socket.on("disconnect", (reason) => {
      onDisconnected?.(reason);
    });

    socket.on("connect_error", (error) => {
      console.error("[StockWebSocket] Connection error:", error.message);
      onError?.(error);
    });

    // Stock item events
    socket.on("stock:item:created", (item) => {
      onItemCreated?.(item);
    });

    socket.on("stock:item:updated", (item) => {
      onItemUpdated?.(item);
    });

    socket.on("stock:item:deleted", (data) => {
      onItemDeleted?.(data);
    });

    // Category events
    socket.on("stock:category:created", (category) => {
      onCategoryCreated?.(category);
    });

    socket.on("stock:category:updated", (category) => {
      onCategoryUpdated?.(category);
    });

    socket.on("stock:category:deleted", (data) => {
      onCategoryDeleted?.(data);
    });

    // Supplier events
    socket.on("stock:supplier:created", (supplier) => {
      onSupplierCreated?.(supplier);
    });

    socket.on("stock:supplier:updated", (supplier) => {
      onSupplierUpdated?.(supplier);
    });

    socket.on("stock:supplier:deleted", (data) => {
      onSupplierDeleted?.(data);
    });

    // Location events
    socket.on("stock:location:created", (location) => {
      onLocationCreated?.(location);
    });

    socket.on("stock:location:updated", (location) => {
      onLocationUpdated?.(location);
    });

    socket.on("stock:location:deleted", (data) => {
      onLocationDeleted?.(data);
    });

    // Inventory events
    socket.on("stock:inventory:updated", (inventory) => {
      onInventoryUpdated?.(inventory);
    });

    socket.on("stock:inventory:deleted", (data) => {
      onInventoryDeleted?.(data);
    });

    socket.on("stock:transfer", (transfer) => {
      onStockTransferred?.(transfer);
    });

    // Alert events
    socket.on("stock:alert:created", (alert) => {
      onAlert?.(alert);
    });

    // Warehouse events
    socket.on("stock:warehouse:created", (warehouse) => {
      onWarehouseCreated?.(warehouse);
    });

    socket.on("stock:warehouse:updated", (warehouse) => {
      onWarehouseUpdated?.(warehouse);
    });

    socket.on("stock:warehouse:deleted", (data) => {
      onWarehouseDeleted?.(data);
    });

    // Ping/Pong to keep connection alive
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("ping");
      }
    }, 30000); // Every 30 seconds

    socket.on("pong", () => {
      // Connection is alive
    });

    // Store cleanup function
    socket._pingInterval = pingInterval;
    socketRef.current = socket;

    return socket;
  }, [
    onItemCreated,
    onItemUpdated,
    onItemDeleted,
    onCategoryCreated,
    onCategoryUpdated,
    onCategoryDeleted,
    onSupplierCreated,
    onSupplierUpdated,
    onSupplierDeleted,
    onLocationCreated,
    onLocationUpdated,
    onLocationDeleted,
    onWarehouseCreated,
    onWarehouseUpdated,
    onWarehouseDeleted,
    onInventoryUpdated,
    onInventoryDeleted,
    onStockTransferred,
    onAlert,
    onConnected,
    onDisconnected,
    onError,
  ]);

  useEffect(() => {
    const socket = connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (socket) {
        if (socket._pingInterval) {
          clearInterval(socket._pingInterval);
        }
        socket.removeAllListeners();
        socket.disconnect();
      }
    };
  }, [connect]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false,
  };
}
