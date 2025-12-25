"use client";

// Import Ant Design v5 patch for React 19 compatibility
import "@ant-design/v5-patch-for-react-19";

import React from "react";
import { Toaster } from "sonner";
import { AppProvider } from "../contexts/AppContext";
import { NotificationProvider } from "../contexts/NotificationContext";
import { WebSocketProvider } from "../contexts/WebSocketContext";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <AppProvider>
      <NotificationProvider>
        <WebSocketProvider>
          {children}
          <Toaster
            position="top-right"
            closeButton
            duration={4000}
            theme="dark"
            className="custom-toaster"
          />
        </WebSocketProvider>
      </NotificationProvider>
    </AppProvider>
  );
}
