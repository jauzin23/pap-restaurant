"use client";

import React from "react";

/**
 * Error Boundary for Notification System
 * Prevents notification errors from crashing the entire app
 */
class NotificationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("❌ Notification System Error:", error, errorInfo);

    // Log to monitoring service if available
    if (typeof window !== "undefined" && window.reportError) {
      window.reportError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI or just children without notifications
      console.warn(
        "⚠️ Notification system encountered an error. Continuing without notifications."
      );
      return this.props.children;
    }

    return this.props.children;
  }
}

export default NotificationErrorBoundary;
