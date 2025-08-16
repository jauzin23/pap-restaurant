"use client";

import React from "react";
import { usePerformance } from "./PerformanceContext";

export default function PerformanceMonitor() {
  const { performanceMetrics, deviceCapabilities } = usePerformance();

  // Only show in development mode or when explicitly enabled
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const getPerformanceColor = () => {
    if (performanceMetrics.frameRate >= 50) return "good";
    if (performanceMetrics.frameRate >= 30) return "warning";
    return "poor";
  };

  const getPerformanceText = () => {
    const fps = performanceMetrics.frameRate;
    const status = deviceCapabilities.isLowPerformance ? " (Optimized)" : "";
    return `${fps}fps${status}`;
  };

  return (
    <div className={`performance-indicator ${getPerformanceColor()}`}>
      <div>{getPerformanceText()}</div>
      <div style={{ fontSize: "10px", opacity: 0.8 }}>
        {deviceCapabilities.hardwareConcurrency} cores
        {deviceCapabilities.reducedMotion && " • Reduced Motion"}
        {deviceCapabilities.reducedTransparency && " • Reduced Transparency"}
      </div>
    </div>
  );
}
