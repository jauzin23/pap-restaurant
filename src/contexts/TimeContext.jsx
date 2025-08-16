"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const TimeContext = createContext();

export const useTime = () => {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error("useTime must be used within a TimeProvider");
  }
  return context;
};

export const TimeProvider = ({ children }) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [clockTime, setClockTime] = useState(() => new Date());
  const [prevClockTime, setPrevClockTime] = useState(null);

  // Single consolidated timer - updates every second for clock, every 30 seconds for durations
  useEffect(() => {
    // Update clock every second
    const clockInterval = setInterval(() => {
      const newTime = new Date();
      setPrevClockTime(clockTime);
      setClockTime(newTime);
    }, 1000);

    // Update current time every 30 seconds for duration calculations
    const durationInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(durationInterval);
    };
  }, [clockTime]);

  const value = {
    currentTime, // For duration calculations (updates every 30s)
    clockTime, // For clock display (updates every 1s)
    prevClockTime, // For clock digit animations
  };

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
};
