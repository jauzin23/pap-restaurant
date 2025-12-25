/**
 * Notification Priority System
 * Defines priority levels for notifications with visual and audio differences
 */

export const NotificationPriority = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
};

/**
 * Get priority-specific styling and behavior
 */
export const getPriorityConfig = (priority = NotificationPriority.NORMAL) => {
  const configs = {
    [NotificationPriority.LOW]: {
      duration: 4000,
      soundVolume: 0.1,
      className: "mesa-notification-low",
      borderWidth: "3px",
      animation: "none",
    },
    [NotificationPriority.NORMAL]: {
      duration: 5000,
      soundVolume: 0.15,
      className: "mesa-notification-normal",
      borderWidth: "4px",
      animation: "none",
    },
    [NotificationPriority.HIGH]: {
      duration: 7000,
      soundVolume: 0.2,
      className: "mesa-notification-high",
      borderWidth: "5px",
      animation: "pulse 2s infinite",
    },
    [NotificationPriority.URGENT]: {
      duration: 0, // Don't auto-dismiss
      soundVolume: 0.25,
      className: "mesa-notification-urgent",
      borderWidth: "6px",
      animation: "pulse 1s infinite",
    },
  };

  return configs[priority] || configs[NotificationPriority.NORMAL];
};

/**
 * Determine priority based on notification type and data
 */
export const determinePriority = (type, data) => {
  // Urgent priorities
  if (type === "stock" && data.alert_type === "critical") {
    return NotificationPriority.URGENT;
  }

  // High priorities
  if (
    type === "order" ||
    type === "takeaway" ||
    (type === "reservation" && data.status === "confirmed") ||
    type === "ai"
  ) {
    return NotificationPriority.HIGH;
  }

  // Low priorities
  if (type === "menu" || type === "table") {
    return NotificationPriority.LOW;
  }

  // Default: normal
  return NotificationPriority.NORMAL;
};
