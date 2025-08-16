"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const PerformanceContext = createContext();

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error("usePerformance must be used within a PerformanceProvider");
  }
  return context;
};

export const PerformanceProvider = ({ children }) => {
  const [deviceCapabilities, setDeviceCapabilities] = useState({
    isLowPerformance: false,
    reducedMotion: false,
    reducedTransparency: false,
    isTouch: false,
    memoryStatus: "unknown",
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
  });

  useEffect(() => {
    const detectDeviceCapabilities = () => {
      // Check for user preferences
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const prefersReducedTransparency = window.matchMedia(
        "(prefers-reduced-transparency: reduce)"
      ).matches;
      const isTouchDevice = "ontouchstart" in window;

      // Basic performance detection
      const isLowEndDevice = navigator.hardwareConcurrency <= 2;

      // Memory detection (if available)
      let memoryStatus = "unknown";
      if ("memory" in performance) {
        const memInfo = performance.memory;
        const memoryRatio = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
        memoryStatus = memoryRatio > 0.85 ? "low" : "normal";
      }

      // GPU detection via WebGL context
      let hasWeakGPU = false;
      try {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl) {
          const renderer = gl.getParameter(gl.RENDERER);
          // Common patterns for integrated/weak GPUs
          hasWeakGPU = /intel|integrated|software|mesa/i.test(renderer);
        }
      } catch (e) {
        hasWeakGPU = true; // Assume weak if WebGL fails
      }

      // Combine factors for overall performance assessment
      const isLowPerformance =
        isLowEndDevice || hasWeakGPU || memoryStatus === "low";

      setDeviceCapabilities({
        isLowPerformance,
        reducedMotion: prefersReducedMotion,
        reducedTransparency: prefersReducedTransparency,
        isTouch: isTouchDevice,
        memoryStatus,
        hardwareConcurrency: navigator.hardwareConcurrency || 4,
      });
    };

    detectDeviceCapabilities();

    // Listen for preference changes
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const transparencyQuery = window.matchMedia(
      "(prefers-reduced-transparency: reduce)"
    );

    motionQuery.addEventListener("change", detectDeviceCapabilities);
    transparencyQuery.addEventListener("change", detectDeviceCapabilities);

    return () => {
      motionQuery.removeEventListener("change", detectDeviceCapabilities);
      transparencyQuery.removeEventListener("change", detectDeviceCapabilities);
    };
  }, []);

  // Performance-aware CSS class generators
  const getBackdropClass = (fallbackBg = "bg-neutral-900/95") => {
    if (
      deviceCapabilities.isLowPerformance ||
      deviceCapabilities.reducedTransparency
    ) {
      return fallbackBg; // Solid background instead of backdrop-blur
    }
    return "backdrop-blur-sm bg-white/[0.02]";
  };

  const getAnimationClass = (animationClass, fallback = "") => {
    if (
      deviceCapabilities.reducedMotion ||
      deviceCapabilities.isLowPerformance
    ) {
      return fallback; // No animation or simpler fallback
    }
    return animationClass;
  };

  const getTransitionClass = (
    transitionClass = "transition-all duration-300"
  ) => {
    if (
      deviceCapabilities.reducedMotion ||
      deviceCapabilities.isLowPerformance
    ) {
      return "transition-none"; // Instant transitions
    }
    return transitionClass;
  };

  const getShadowClass = (shadowClass = "shadow-lg") => {
    if (deviceCapabilities.isLowPerformance) {
      return "shadow-sm"; // Lighter shadow to reduce GPU load
    }
    return shadowClass;
  };

  // Performance monitoring
  const [performanceMetrics, setPerformanceMetrics] = useState({
    frameRate: 60,
    isOptimized: true,
    lastUpdate: Date.now(),
  });

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId;

    const measureFrameRate = (currentTime) => {
      frameCount++;

      if (currentTime >= lastTime + 1000) {
        // Update every second
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));

        setPerformanceMetrics((prev) => ({
          frameRate: fps,
          isOptimized: fps >= 30, // Consider sub-30fps as poor performance
          lastUpdate: Date.now(),
        }));

        frameCount = 0;
        lastTime = currentTime;
      }

      animationId = requestAnimationFrame(measureFrameRate);
    };

    // Only monitor performance in development or when explicitly enabled
    if (process.env.NODE_ENV === "development") {
      animationId = requestAnimationFrame(measureFrameRate);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  const value = {
    deviceCapabilities,
    performanceMetrics,
    getBackdropClass,
    getAnimationClass,
    getTransitionClass,
    getShadowClass,

    // Utility methods
    shouldReduceMotion: () =>
      deviceCapabilities.reducedMotion || deviceCapabilities.isLowPerformance,
    shouldReduceTransparency: () =>
      deviceCapabilities.reducedTransparency ||
      deviceCapabilities.isLowPerformance,
    isLowEndDevice: () => deviceCapabilities.isLowPerformance,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};
