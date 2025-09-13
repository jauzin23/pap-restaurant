"use client";

import React from "react";
import { AppProvider } from "../contexts/AppContext";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return <AppProvider>{children}</AppProvider>;
}
