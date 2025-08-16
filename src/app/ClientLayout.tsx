"use client";

import React from "react";
import { AppProvider } from "../contexts/AppContext";

interface ClientLayoutProps {
  children: React.ReactNode;
  geistSans?: { variable: string };
  geistMono?: { variable: string };
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return <AppProvider>{children}</AppProvider>;
}
