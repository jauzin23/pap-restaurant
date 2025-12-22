"use client";

import React from "react";
import { AppProvider } from "../contexts/AppContext";
import { WebSocketProvider } from "../contexts/WebSocketContext";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <AppProvider>
      <WebSocketProvider>{children}</WebSocketProvider>
    </AppProvider>
  );
}
