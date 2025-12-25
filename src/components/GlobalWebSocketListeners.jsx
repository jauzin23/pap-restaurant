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

    socket.on("insight:generated", handleInsightGenerated);
    socket.on("insight:deleted", handleInsightDeleted);

    // Cleanup
    return () => {
      socket.off("insight:generated", handleInsightGenerated);
      socket.off("insight:deleted", handleInsightDeleted);
    };
  }, [socket, addNotification]);

  return null; // This component doesn't render anything
};

export default GlobalWebSocketListeners;
