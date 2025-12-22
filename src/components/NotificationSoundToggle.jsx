"use client";

import React, { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
} from "../lib/notificationSound";

/**
 * Notification sound toggle button
 * Can be placed in the top navigation bar or settings
 */
const NotificationSoundToggle = () => {
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setSoundEnabled(isNotificationSoundEnabled());
  }, []);

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    setNotificationSoundEnabled(newState);
  };

  return (
    <button
      onClick={toggleSound}
      title={soundEnabled ? "Desativar sons" : "Ativar sons"}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "8px",
        borderRadius: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.2s",
        color: soundEnabled ? "#52B788" : "#999",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(0,0,0,0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
    </button>
  );
};

export default NotificationSoundToggle;
