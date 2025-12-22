"use client";

import React, { useState, useContext } from "react";
import { Bell } from "lucide-react";
import { NotificationContext } from "../contexts/NotificationContext";
import NotificationHistory from "./NotificationHistory";

/**
 * Notification Bell Badge
 * Shows notification count and opens history panel
 */
const NotificationBadge = ({ className = "" }) => {
  const context = useContext(NotificationContext);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Safety check - if context not available, show badge without count
  if (!context) {
    return (
      <button
        onClick={() => {}}
        title="Notificações"
        className={`notification-badge-button ${className}`}
      >
        <Bell size={18} />
      </button>
    );
  }

  const { notifications } = context;

  // Count notifications from the last 30 minutes
  const recentCount = notifications.filter((notif) => {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    return new Date(notif.timestamp).getTime() > thirtyMinutesAgo;
  }).length;

  return (
    <>
      <button
        onClick={() => setIsHistoryOpen(true)}
        title="Ver histórico de notificações"
        className={`notification-badge-button ${className}`}
      >
        <Bell size={18} />
        {recentCount > 0 && (
          <span className="notification-badge-count">
            {recentCount > 99 ? "99+" : recentCount}
          </span>
        )}
      </button>

      <NotificationHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
    </>
  );
};

export default NotificationBadge;
