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
      console.warn("[StockWebSocket] No auth token available");
      return;
    }

    // Disconnect existing connection if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    console.log("[StockWebSocket] Connecting to", SOCKET_URL);

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
      console.log("[StockWebSocket] ✅ Connected:", socket.id);
      onConnected?.();
    });

    socket.on("disconnect", (reason) => {
      console.log("[StockWebSocket] ❌ Disconnected:", reason);
      onDisconnected?.(reason);
    });

    socket.on("connect_error", (error) => {
      console.error("[StockWebSocket] Connection error:", error.message);
      onError?.(error);
    });

    // Stock item events
    socket.on("stock:item:created", (item) => {
      console.log("[StockWebSocket] 📦 Item created:", item.name);
      onItemCreated?.(item);
    });

    socket.on("stock:item:updated", (item) => {
      console.log("[StockWebSocket] 🔄 Item updated:", item.name);
      onItemUpdated?.(item);
    });

    socket.on("stock:item:deleted", (data) => {
      console.log("[StockWebSocket] 🗑️ Item deleted:", data.id);
      onItemDeleted?.(data);
    });

    // Category events
    socket.on("stock:category:created", (category) => {
      console.log("[StockWebSocket] 📁 Category created:", category.name);
      onCategoryCreated?.(category);
    });

    socket.on("stock:category:updated", (category) => {
      console.log("[StockWebSocket] 📁 Category updated:", category.name);
      onCategoryUpdated?.(category);
    });

    socket.on("stock:category:deleted", (data) => {
      console.log("[StockWebSocket] 📁 Category deleted:", data.id);
      onCategoryDeleted?.(data);
    });

    // Supplier events
    socket.on("stock:supplier:created", (supplier) => {
      console.log("[StockWebSocket] 🚚 Supplier created:", supplier.name);
      onSupplierCreated?.(supplier);
    });

    socket.on("stock:supplier:updated", (supplier) => {
      console.log("[StockWebSocket] 🚚 Supplier updated:", supplier.name);
      onSupplierUpdated?.(supplier);
    });

    socket.on("stock:supplier:deleted", (data) => {
      console.log("[StockWebSocket] 🚚 Supplier deleted:", data.id);
      onSupplierDeleted?.(data);
    });

    // Location events
    socket.on("stock:location:created", (location) => {
      console.log("[StockWebSocket] 📍 Location created:", location.name);
      onLocationCreated?.(location);
    });

    socket.on("stock:location:updated", (location) => {
      console.log("[StockWebSocket] 📍 Location updated:", location.name);
      onLocationUpdated?.(location);
    });

    socket.on("stock:location:deleted", (data) => {
      console.log("[StockWebSocket] 📍 Location deleted:", data.id);
      onLocationDeleted?.(data);
    });

    // Inventory events
    socket.on("stock:inventory:updated", (inventory) => {
      console.log(
        "[StockWebSocket] 📦 Inventory updated:",
        inventory.stock_item_id
      );
      onInventoryUpdated?.(inventory);
    });

    socket.on("stock:inventory:deleted", (data) => {
      console.log("[StockWebSocket] 🗑️ Inventory deleted:", data.stock_item_id);
      onInventoryDeleted?.(data);
    });

    socket.on("stock:transfer", (transfer) => {
      console.log("[StockWebSocket] 🔄 Stock transferred:", transfer);
      onStockTransferred?.(transfer);
    });

    // Alert events
    socket.on("stock:alert:created", (alert) => {
      console.log("[StockWebSocket] ⚠️ Alert:", alert.message);
      onAlert?.(alert);
    });

    // Warehouse events
    socket.on("stock:warehouse:created", (warehouse) => {
      console.log("[StockWebSocket] 🏭 Warehouse created:", warehouse.name);
      onWarehouseCreated?.(warehouse);
    });

    socket.on("stock:warehouse:updated", (warehouse) => {
      console.log("[StockWebSocket] 🏭 Warehouse updated:", warehouse.name);
      onWarehouseUpdated?.(warehouse);
    });

    socket.on("stock:warehouse:deleted", (data) => {
      console.log("[StockWebSocket] 🏭 Warehouse deleted:", data.id);
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
        console.log("[StockWebSocket] 🔌 Disconnected and cleaned up");
      }
    };
  }, [connect]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false,
  };
}
