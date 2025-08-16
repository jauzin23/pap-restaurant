import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./performance-styles.css";
import ConditionalBackground from "../components/ConditionalBackground";
import { TimeProvider } from "../contexts/TimeContext";
import { SubscriptionProvider } from "../contexts/SubscriptionContext";
import { PerformanceProvider } from "../components/PerformanceContext";
import PerformanceMonitor from "../components/PerformanceMonitor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mesa+",
  description: "O melhor software para restaurantes!",
  icons: {
    icon: "/logo-icon.svg",
    shortcut: "/logo-icon.svg",
    apple: "/logo-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black`}
      >
        <TimeProvider>
          <SubscriptionProvider>
            <PerformanceProvider>
              <ConditionalBackground />
              <PerformanceMonitor />
              {/* Content */}
              <div className="relative z-10 flex flex-col min-h-screen">
                {children}
              </div>
            </PerformanceProvider>
          </SubscriptionProvider>
        </TimeProvider>
      </body>
    </html>
  );
}
