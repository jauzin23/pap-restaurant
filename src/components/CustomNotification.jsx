"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import "./CustomNotification.scss";

/**
 * Custom Notification Component
 * Displays notifications in a stack at the top-right corner
 */
const CustomNotification = ({ notification, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!notification.duration || notification.duration === 0) return;

    const timeout = setTimeout(() => {
      handleClose();
    }, notification.duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [notification.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 300);
  };

  return (
    <div
      className={`custom-notification ${isExiting ? "exiting" : ""} ${
        notification.priority || "normal"
      }`}
    >
      <div className="notification-icon">{notification.icon}</div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
      </div>
      <button
        className="notification-close"
        onClick={handleClose}
        aria-label="Fechar notificação"
      >
        <X size={16} />
      </button>
    </div>
  );
};

/**
 * Notification Container
 * Manages the stack of visible notifications
 */
export const NotificationContainer = ({ notifications, onClose }) => {
  return (
    <div className="custom-notifications-container">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            zIndex: 10000 - index,
          }}
        >
          <CustomNotification notification={notification} onClose={onClose} />
        </div>
      ))}
    </div>
  );
};

export default CustomNotification;
