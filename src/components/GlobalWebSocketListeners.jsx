"use client";

import { useEffect } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { useNotificationContext } from "../contexts/NotificationContext";
import { getNotificationTemplate } from "../lib/notificationTemplates";
import {
  notifyInsightGenerated,
  notifyInsightDeleted,
} from "../lib/notifications";

const GlobalWebSocketListeners = () => {
  const { socket, connected } = useWebSocketContext();
  const { addNotification } = useNotificationContext();

  useEffect(() => {
    if (!socket) return;

    // AI Insights events
    const handleInsightGenerated = (insight) => {
      console.log("[GlobalWebSocket] Insight generated:", insight.id);
      const template = getNotificationTemplate("ai:insight:generated", insight);
      if (template) {
        addNotification(template);
      }
    };

    const handleInsightDeleted = (data) => {
      console.log("[GlobalWebSocket] Insight deleted:", data.id);
      const template = getNotificationTemplate("ai:insight:deleted", data);
      if (template) {
        addNotification(template);
      }
    };

    // Stock transfer event
    const handleStockTransfer = (transfer) => {
      console.log("[GlobalWebSocket] Stock transferred:", transfer);
      const template = getNotificationTemplate("stock:transfer", transfer);
      if (template) {
        addNotification(template);
      }
    };

    // Supplier created event
    const handleSupplierCreated = (supplier) => {
      console.log("[GlobalWebSocket] Supplier created:", supplier);
      const template = getNotificationTemplate(
        "stock:supplier:created",
        supplier
      );
      if (template) {
        addNotification(template);
      }
    };

    // Supplier updated event
    const handleSupplierUpdated = (supplier) => {
      console.log("[GlobalWebSocket] Supplier updated:", supplier);
      const template = getNotificationTemplate(
        "stock:supplier:updated",
        supplier
      );
      if (template) {
        addNotification(template);
      }
    };

    // Supplier deleted event
    const handleSupplierDeleted = (data) => {
      console.log("[GlobalWebSocket] Supplier deleted:", data);
      const template = getNotificationTemplate("stock:supplier:deleted", data);
      if (template) {
        addNotification(template);
      }
    };

    socket.on("insight:generated", handleInsightGenerated);
    socket.on("insight:deleted", handleInsightDeleted);
    socket.on("stock:transfer", handleStockTransfer);
    socket.on("stock:supplier:created", handleSupplierCreated);
    socket.on("stock:supplier:updated", handleSupplierUpdated);
    socket.on("stock:supplier:deleted", handleSupplierDeleted);

    // Cleanup
    return () => {
      socket.off("insight:generated", handleInsightGenerated);
      socket.off("insight:deleted", handleInsightDeleted);
      socket.off("stock:transfer", handleStockTransfer);
      socket.off("stock:supplier:created", handleSupplierCreated);
      socket.off("stock:supplier:updated", handleSupplierUpdated);
      socket.off("stock:supplier:deleted", handleSupplierDeleted);
    };
  }, [socket, addNotification]);

  return null; // This component doesn't render anything
};

export default GlobalWebSocketListeners;
