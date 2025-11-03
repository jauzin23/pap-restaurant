"use client";

import React, { createContext, useContext } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const socketData = useWebSocket();

  return (
    <WebSocketContext.Provider value={socketData}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within WebSocketProvider"
    );
  }

  return context;
};
