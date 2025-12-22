/**
 * Keyboard shortcuts for notification system
 */

let shortcutsEnabled = true;

/**
 * Initialize keyboard shortcuts
 */
export const initializeNotificationShortcuts = (notificationContext) => {
  if (typeof window === "undefined") return;

  const handleKeyPress = (event) => {
    if (!shortcutsEnabled) return;

    // ESC - Clear all notifications
    if (event.key === "Escape" && event.ctrlKey) {
      event.preventDefault();
      notificationContext.clearAll();
      console.log("⌨️ Cleared all notifications (Ctrl+Esc)");
    }
  };

  window.addEventListener("keydown", handleKeyPress);

  // Return cleanup function
  return () => {
    window.removeEventListener("keydown", handleKeyPress);
  };
};

/**
 * Enable/disable keyboard shortcuts
 */
export const setShortcutsEnabled = (enabled) => {
  shortcutsEnabled = enabled;
};

/**
 * Check if shortcuts are enabled
 */
export const areShortcutsEnabled = () => {
  return shortcutsEnabled;
};
