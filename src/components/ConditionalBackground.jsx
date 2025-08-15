"use client";

import { usePathname } from "next/navigation";
import GridBackground from "./GridBackground";

export default function ConditionalBackground() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) return null;

  return <GridBackground />;
}
