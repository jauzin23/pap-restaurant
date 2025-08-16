"use client";

import React from "react";
import { AppProvider } from "../contexts/AppContext";

interface ClientLayoutProps {
  children: React.ReactNode;
  geistSans?: { variable: string };
  geistMono?: { variable: string };
}

// Simple client wrapper that only provides AppProvider context
export default function ClientLayout({ children }: ClientLayoutProps) {
  return <AppProvider>{children}</AppProvider>;
}
