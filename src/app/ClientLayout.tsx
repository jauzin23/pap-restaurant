"use client";

// Import Ant Design v5 patch for React 19 compatibility
import "@ant-design/v5-patch-for-react-19";

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
