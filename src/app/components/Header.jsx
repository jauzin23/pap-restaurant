"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
// Direct icon imports for smaller bundle
import { LogOut, Star, Users, ChefHat, Clock } from "lucide-react";

import { motion } from "framer-motion";
import {
  account,
  databases,
  client,
  DB_ATTENDANCE,
  COL_ATTENDANCE,
} from "@/lib/appwrite";
import { Query } from "appwrite";
const AnimatePresence = dynamic(
  () => import("framer-motion").then((mod) => mod.AnimatePresence),
  { ssr: false }
);

const Header = memo(function Header({ user, logo }) {
  const router = useRouter();
  const [time, setTime] = useState(() => new Date());
  const [userClockStatus, setUserClockStatus] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Update current time every 30 seconds for real-time duration calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds for more real-time feel
    return () => clearInterval(interval);
  }, []);

  // Fetch user clock status with real-time updates
  useEffect(() => {
    if (user?.$id) {
      fetchUserClockStatus();

      // Subscribe to real-time updates for attendance changes
      const unsubscribe = client.subscribe(
        `databases.${DB_ATTENDANCE}.collections.${COL_ATTENDANCE}.documents`,
        (response) => {
          if (
            response.events.some(
              (e) =>
                e.endsWith(".create") ||
                e.endsWith(".update") ||
                e.endsWith(".delete")
            )
          ) {
            // Check if the event is related to the current user
            if (response.payload && response.payload.userId === user.$id) {
              fetchUserClockStatus();
            }
          }
        }
      );

      return () => {
        if (unsubscribe && typeof unsubscribe === "function") {
          unsubscribe();
        }
      };
    }
  }, [user]);

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

  const digitAnimation = {
    initial: { opacity: 0, y: -5 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 5 },
    transition: { duration: 0.2 },
  };

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
    <header className="w-full flex justify-between items-center px-6 py-4 border-b border-white/10 bg-white/[0.02] shadow-lg backdrop-blur-sm">
      {/* Left: Logo + Title */}
      <div className="flex items-center space-x-3">
        <motion.div
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Image
            src={logo}
            alt="Logo"
            width={40}
            height={40}
            className="w-10 h-10 rounded-full border-2 border-white/20 shadow-lg"
          />
        </motion.div>
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
                .map((digit, i) => (
                  <AnimatePresence key={i} mode="wait">
                    <motion.span key={digit + i} {...digitAnimation}>
                      {digit}
                    </motion.span>
                  </AnimatePresence>
                ))}
              {idx < 2 && <span className="mx-1">:</span>}
            </span>
          ))}
        </div>

        {/* Check-in Status Badge */}
        <AnimatePresence>
          {userClockStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 backdrop-blur-sm"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-2 h-2 bg-green-400 rounded-full"
              />
              <Clock className="w-3 h-3 text-green-400" />
              <span className="text-xs font-semibold text-green-300">
                {formatDuration(userClockStatus.clockIn, currentTime)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Info + Roles */}
        <div className="flex flex-col md:flex-row md:items-center md:space-x-3">
          <div className="relative group">
            <span
              className={`text-sm font-semibold transition-colors duration-300 ${
                userClockStatus
                  ? "text-white"
                  : "text-red-400 hover:text-red-300"
              }`}
            >
              {user.name}
            </span>

            {/* Tooltip when not clocked in */}
            {!userClockStatus && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <div className="bg-red-500/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg border border-red-400/30 shadow-lg whitespace-nowrap">
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
        <motion.button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={clsx(
            "flex items-center space-x-2 transition-all duration-300 px-4 py-2 rounded-xl border",
            isLoggingOut
              ? "text-white/50 bg-white/[0.02] border-white/5 cursor-not-allowed"
              : "text-white/70 hover:text-red-400 hover:bg-white/[0.05] border-white/10 hover:border-red-400/30"
          )}
          whileHover={!isLoggingOut ? { x: 2, scale: 1.02 } : {}}
          whileTap={!isLoggingOut ? { scale: 0.98 } : {}}
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
        </motion.button>
      </div>
    </header>
  );
});

export default Header;
