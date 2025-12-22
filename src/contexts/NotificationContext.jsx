"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { NotificationContainer } from "../components/CustomNotification";
import { playNotificationSound } from "../lib/notificationSound";
import {
  determinePriority,
  getPriorityConfig,
} from "../lib/notificationPriority";
import { initializeNotificationShortcuts } from "../lib/notificationShortcuts";

const NotificationContext = createContext(null);

// Export context for direct useContext usage in components
export { NotificationContext };

// Generate unique IDs
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [visibleNotifications, setVisibleNotifications] = useState([]);
  const maxVisible = 5;

  const addNotification = useCallback((notificationData) => {
    const id = generateId();

    // Determine priority
    const priority = determinePriority(
      notificationData.type,
      notificationData.data || {}
    );
    const priorityConfig = getPriorityConfig(priority);

    const newNotification = {
      id,
      timestamp: new Date(),
      duration: notificationData.duration || priorityConfig.duration,
      priority,
      ...notificationData,
    };

    // Play notification sound with priority-based volume
    playNotificationSound(newNotification.type, priorityConfig.soundVolume);

    // Add to visible notifications (max 5)
    setVisibleNotifications((prev) =>
      [...prev, newNotification].slice(-maxVisible)
    );

    // Store in state for history tracking (keep last 50)
    setNotifications((prev) => [...prev, newNotification].slice(-50));
  }, []);

  const removeNotification = useCallback((id) => {
    setVisibleNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setVisibleNotifications([]);
    setNotifications([]);
  }, []);

  // Configure notification globally and initialize shortcuts
  useEffect(() => {
    // Initialize keyboard shortcuts
    const cleanup = initializeNotificationShortcuts({
      clearAll,
      removeNotification,
    });

    return cleanup;
  }, [clearAll, removeNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        visibleNotifications,
        addNotification,
        removeNotification,
        clearAll,
      }}
    >
      <NotificationContainer
        notifications={visibleNotifications}
        onClose={removeNotification}
      />
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within NotificationProvider"
    );
  }
  return context;
};
