"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
// Direct icon imports for smaller bundle
import { LogOut, Star, Users, ChefHat, Clock } from "lucide-react";
import { useTime } from "@/contexts/TimeContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePerformance } from "@/components/PerformanceContext";
import {
  SUBSCRIPTION_CHANNELS,
  eventMatches,
  EVENT_PATTERNS,
} from "@/lib/subscriptionChannels";

import {
  account,
  databases,
  client,
  DB_ATTENDANCE,
  COL_ATTENDANCE,
} from "@/lib/appwrite";
import { Query } from "appwrite";

const Header = memo(function Header({ user, logo }) {
  const router = useRouter();
  const { clockTime: time, prevClockTime: prevTime, currentTime } = useTime();
  const { subscribe } = useSubscription();
  const {
    getBackdropClass,
    getAnimationClass,
    getTransitionClass,
    getShadowClass,
  } = usePerformance();
  const [userClockStatus, setUserClockStatus] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showClockStatus, setShowClockStatus] = useState(false);

  // Fetch user clock status with optimized real-time updates
  useEffect(() => {
    if (user?.$id) {
      fetchUserClockStatus();

      // Subscribe to optimized attendance updates
      const unsubscribe = subscribe(
        SUBSCRIPTION_CHANNELS.ATTENDANCE(DB_ATTENDANCE, COL_ATTENDANCE),
        (response) => {
          if (eventMatches(response.events, EVENT_PATTERNS.ALL_CRUD)) {
            // Only update if the event is related to the current user
            if (response.payload && response.payload.userId === user.$id) {
              fetchUserClockStatus();
            }
          }
        },
        { debounce: true, debounceDelay: 300 } // Debounce rapid updates
      );

      return unsubscribe;
    }
  }, [user, subscribe]);

  // Manage clock status animation
  useEffect(() => {
    if (userClockStatus && !showClockStatus) {
      setShowClockStatus(true);
    } else if (!userClockStatus && showClockStatus) {
      // Delay hiding to allow exit animation
      const timeout = setTimeout(() => setShowClockStatus(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [userClockStatus, showClockStatus]);

  async function fetchUserClockStatus() {
    try {
      const res = await databases.listDocuments(DB_ATTENDANCE, COL_ATTENDANCE, [
        Query.equal("userId", user.$id),
        Query.isNull("clockOut"),
        Query.limit(1),
      ]);
      setUserClockStatus(res.documents.length > 0 ? res.documents[0] : null);
    } catch (err) {
      console.error("Error fetching user clock status:", err);
      setUserClockStatus(null);
    }
  }

  function formatDuration(clockInTime, currentTime = new Date()) {
    if (!clockInTime) return "0h 0m";

    const clockIn = new Date(clockInTime);
    const current = new Date(currentTime);
    const diffMs = current - clockIn;

    if (diffMs < 0) return "0h 0m";

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      // Delete the current session
      await account.deleteSession("current");

      // Redirect to login page
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      // Even if logout fails, redirect to login
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }, [router, isLoggingOut]);

  const formatTimeParts = useCallback((date) => {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return { h, m, s };
  }, []);

  const timeParts = formatTimeParts(time);

  function formatDuration(clockInTime, currentTime = new Date()) {
    if (!clockInTime) return "0h 0m";

    const clockIn = new Date(clockInTime);
    const current = new Date(currentTime);
    const diffMs = current - clockIn;

    if (diffMs < 0) return "0h 0m";

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  // Custom role styles
  const roleStyles = {
    manager: {
      color:
        "bg-gradient-to-r from-yellow-500 to-amber-500 text-black border border-yellow-400/30",
      icon: Star,
    },
    staff: {
      color:
        "bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400/30",
      icon: Users,
    },
    chef: {
      color:
        "bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-400/30",
      icon: ChefHat,
    },
  };

  return (
    <header
      className={`w-full flex justify-between items-center px-6 py-4 border-b border-white/10 ${getBackdropClass(
        "bg-neutral-900/95"
      )} ${getShadowClass()}`}
    >
      {/* Left: Logo + Title */}
      <div className="flex items-center space-x-3">
        <div
          className={getTransitionClass(
            "transition-transform duration-200 hover:scale-105"
          )}
        >
          <Image
            src={logo}
            alt="Logo"
            width={40}
            height={40}
            className={`w-10 h-10 rounded-full border-2 border-white/20 ${getShadowClass()}`}
          />
        </div>
        <h1 className="text-xl font-bold text-white tracking-wide">Mesa+</h1>
      </div>

      {/* Right: Clock + Check-in Status + User Info + Logout */}
      <div className="flex items-center space-x-4">
        {/* Clock */}
        <div className={clsx("font-mono text-sm text-white/70 hidden md:flex")}>
          {["h", "m", "s"].map((part, idx) => (
            <span key={idx} className="flex">
              {Object.values(timeParts)
                [idx].split("")
                .map((digit, i) => {
                  const prevDigit =
                    prevTime &&
                    Object.values(formatTimeParts(prevTime))[idx]?.split("")[i];
                  const hasChanged = prevDigit !== digit;
                  return (
                    <span
                      key={digit + i}
                      className={
                        hasChanged
                          ? getAnimationClass("animate-clock-digit")
                          : ""
                      }
                    >
                      {digit}
                    </span>
                  );
                })}
              {idx < 2 && <span className="mx-1">:</span>}
            </span>
          ))}
        </div>

        {/* Check-in Status Badge */}
        {userClockStatus && (
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 ${getBackdropClass(
              "bg-neutral-800/90"
            )} ${
              showClockStatus
                ? getAnimationClass("animate-slide-in-right")
                : "fade-exit-active"
            }`}
          >
            <div
              className={`w-2 h-2 bg-green-400 rounded-full ${getAnimationClass(
                "animate-pulse-slow"
              )}`}
            />
            <Clock className="w-3 h-3 text-green-400" />
            <span className="text-xs font-semibold text-green-300">
              {formatDuration(userClockStatus.clockIn, currentTime)}
            </span>
          </div>
        )}

        {/* User Info + Roles */}
        <div className="flex flex-col md:flex-row md:items-center md:space-x-3">
          <div className="relative group">
            <span
              className={`text-sm font-semibold ${getTransitionClass(
                "transition-colors duration-300"
              )} ${
                userClockStatus
                  ? "text-white"
                  : "text-red-400 hover:text-red-300"
              }`}
            >
              {user.name}
            </span>

            {/* Tooltip when not clocked in */}
            {!userClockStatus && (
              <div
                className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 ${getTransitionClass(
                  "transition-opacity duration-200"
                )} pointer-events-none z-50`}
              >
                <div
                  className={`bg-red-500/90 ${getBackdropClass(
                    "bg-red-600/95"
                  )} text-white text-xs px-3 py-1.5 rounded-lg border border-red-400/30 ${getShadowClass()} whitespace-nowrap`}
                >
                  Tens de picar o ponto
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-500/90"></div>
                </div>
              </div>
            )}
          </div>

          {user.labels && user.labels.length > 0 && (
            <div className="flex space-x-2 mt-1 md:mt-0">
              {user.labels.map((label) => {
                const style = roleStyles[label] || {
                  color: "bg-white/10 text-white/80 border border-white/20",
                  icon: null,
                };
                const Icon = style.icon;
                return (
                  <span
                    key={label}
                    className={clsx(
                      "flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all duration-200 shadow-sm",
                      style.color,
                      "hover:brightness-110 hover:scale-105"
                    )}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    <span className="capitalize">{label}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={clsx(
            "flex items-center space-x-2 transition-all duration-300 px-4 py-2 rounded-xl border",
            isLoggingOut
              ? "text-white/50 bg-white/[0.02] border-white/5 cursor-not-allowed"
              : "text-white/70 hover:text-red-400 hover:bg-white/[0.05] border-white/10 hover:border-red-400/30 hover-slide-right"
          )}
        >
          {isLoggingOut ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
              <span className="text-sm font-semibold">Saindo...</span>
            </>
          ) : (
            <>
              <LogOut className="w-4 h-4" strokeWidth={2} />
              <span className="text-sm font-semibold">Logout</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
});

export default Header;
