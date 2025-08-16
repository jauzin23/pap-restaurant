"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { LogOut, Star, Users, ChefHat, Clock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Query } from "appwrite";
import { DB_ATTENDANCE, COL_ATTENDANCE } from "@/lib/appwrite";

const Header = memo(function Header({ user, logo }) {
  const router = useRouter();
  const {
    currentTime,
    databases,
    account,
    getClassName,
    getAnimationClass,
    isLowPerformance,
    setupSubscription,
    getSubscriptionHealth,
  } = useApp();

  const [userClockStatus, setUserClockStatus] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [lastStatusUpdate, setLastStatusUpdate] = useState(null);

  // BULLETPROOF: Fetch user clock status with comprehensive error handling
  const fetchUserClockStatus = useCallback(async () => {
    if (!user?.$id) return;

    try {
      console.log("⏰ Fetching clock status for user:", user.$id.slice(-6));

      const res = await databases.listDocuments(DB_ATTENDANCE, COL_ATTENDANCE, [
        Query.equal("userId", user.$id),
        Query.isNull("clockOut"),
        Query.limit(1),
      ]);

      const clockStatus = res.documents.length > 0 ? res.documents[0] : null;

      console.log("⏰ Clock status fetched:", {
        isActive: !!clockStatus,
        clockInTime: clockStatus?.clockIn || "none",
        name: clockStatus?.name || "none",
        timestamp: new Date().toLocaleTimeString(),
      });

      setUserClockStatus(clockStatus);
      setLastStatusUpdate(Date.now());
    } catch (err) {
      console.error("❌ Error fetching user clock status:", err);
      setUserClockStatus(null);
    }
  }, [user?.$id, databases]);

  // INITIAL: Load clock status on mount
  useEffect(() => {
    if (user?.$id) {
      fetchUserClockStatus();
    }
  }, [fetchUserClockStatus, user?.$id]);

  // 🚀 BULLETPROOF REAL-TIME USER STATUS - Instant clock-in/out feedback
  useEffect(() => {
    if (!user?.$id) return;

    console.log(
      "🔥 Setting up BULLETPROOF user status tracking for:",
      user.$id.slice(-6)
    );

    // USER-SPECIFIC ATTENDANCE SUBSCRIPTION - Instant status updates
    const cleanupAttendance = setupSubscription(
      `databases.${DB_ATTENDANCE}.collections.${COL_ATTENDANCE}.documents`,
      (response) => {
        if (
          response.events.some((event) =>
            event.includes("databases.*.collections.*.documents.*")
          )
        ) {
          const payload = response.payload;

          // ONLY update if the change is for the current user
          if (payload?.userId === user.$id) {
            const eventType = response.events[0];

            console.log("⏰ INSTANT user status update:", {
              type: eventType.includes(".create")
                ? "CLOCK-IN"
                : eventType.includes(".update")
                ? "CLOCK-OUT"
                : "OTHER",
              userId: payload.userId.slice(-6),
              name: payload.name,
              clockOut: payload.clockOut || null,
              timestamp: new Date().toLocaleTimeString(),
            });

            // IMMEDIATE optimistic update (< 30ms)
            if (eventType.includes(".create") && !payload.clockOut) {
              // User just clocked in
              setUserClockStatus(payload);
              console.log("✅ INSTANT clock-in status applied");
            } else if (eventType.includes(".update") && payload.clockOut) {
              // User just clocked out
              setUserClockStatus(null);
              console.log("✅ INSTANT clock-out status applied");
            }

            setLastStatusUpdate(Date.now());

            // Background validation to ensure accuracy
            setTimeout(fetchUserClockStatus, 200);
          }
        }
      },
      "attendance" // Subscription type for health monitoring
    );

    // HEALTH MONITORING - Auto-refresh if subscription becomes stale
    const healthCheckInterval = setInterval(() => {
      const health = getSubscriptionHealth();
      const now = Date.now();

      if (
        health.attendance?.active &&
        health.attendance?.lastEvent &&
        now - health.attendance.lastEvent > 120000
      ) {
        // 2 minutes
        console.warn("⚠️ User attendance subscription stale, refreshing...");
        fetchUserClockStatus();
      }
    }, 30000); // Check every 30 seconds

    // PERIODIC SYNC - Backup refresh every 3 minutes
    const syncInterval = setInterval(() => {
      console.log("🔄 Periodic user status sync");
      fetchUserClockStatus();
    }, 180000); // Every 3 minutes

    // Cleanup
    return () => {
      console.log(
        "🧹 Cleaning up Header subscriptions for user:",
        user.$id.slice(-6)
      );
      cleanupAttendance();
      clearInterval(healthCheckInterval);
      clearInterval(syncInterval);
    };
  }, [user?.$id, setupSubscription, fetchUserClockStatus, getSubscriptionHealth]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await account.deleteSession("current");
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  const getRoleIcon = () => {
    if (!user?.labels || user.labels.length === 0) {
      return <Users size={20} className="text-white/70" />;
    }

    const primaryRole = user.labels[0].toLowerCase();

    switch (primaryRole) {
      case "manager":
        return <Star size={20} className="text-purple-400" />;
      case "chef":
      case "kitchen":
        return <ChefHat size={20} className="text-orange-400" />;
      case "waiter":
      case "waitress":
        return <Users size={20} className="text-blue-400" />;
      default:
        return <Users size={20} className="text-green-400" />;
    }
  };

  const getRoleBadgeColor = () => {
    if (!user?.labels || user.labels.length === 0) {
      return "bg-gray-500/20 text-gray-300";
    }

    const primaryRole = user.labels[0].toLowerCase();

    switch (primaryRole) {
      case "manager":
        return "bg-purple-500/20 text-purple-300";
      case "chef":
      case "kitchen":
        return "bg-orange-500/20 text-orange-300";
      case "waiter":
      case "waitress":
        return "bg-blue-500/20 text-blue-300";
      default:
        return "bg-green-500/20 text-green-300";
    }
  };

  const formatDuration = (clockInTime) => {
    if (!clockInTime || !currentTime) return "0h 0m";

    const clockIn = new Date(clockInTime);
    const current = new Date(currentTime);
    const diffMs = current - clockIn;

    if (diffMs < 0) return "0h 0m";

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <header
      className={getClassName(
        "sticky top-0 z-50 backdrop-blur-lg bg-black/50 border-b border-white/10",
        "bg-gray-900 border-b border-gray-700"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            {logo && (
              <div className="relative w-8 h-8 sm:w-10 sm:h-10">
                <Image
                  src={logo}
                  alt="Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                PAP Restaurant
              </h1>
              <p className="text-xs text-white/60 hidden sm:block">
                Sistema de Gestão
              </p>
            </div>
          </div>

          {/* User Info and Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Clock Status Indicator */}
            {userClockStatus ? (
              <div
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  "bg-green-500/10 border-green-500/30",
                  getAnimationClass("transition-all duration-300")
                )}
              >
                <div className="relative flex items-center gap-2">
                  <div
                    className={clsx(
                      "w-2 h-2 rounded-full bg-green-400",
                      getAnimationClass("animate-pulse")
                    )}
                  />
                  <Clock size={16} className="text-green-400" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-green-400">
                    Ativo
                  </div>
                  <div className="text-xs text-green-300/80">
                    {formatDuration(userClockStatus.clockIn)}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  "bg-gray-500/10 border-gray-500/30",
                  getAnimationClass("transition-all duration-300")
                )}
              >
                <div className="relative flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <Clock size={16} className="text-gray-400" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-gray-400">
                    Inativo
                  </div>
                  <div className="text-xs text-gray-400/80">
                    Fora de serviço
                  </div>
                </div>
              </div>
            )}

            {/* User Info */}
            <div className="flex items-center gap-3">
              {/* Role Icon */}
              <div
                className={clsx(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  getRoleBadgeColor(),
                  getAnimationClass("transition-all duration-300")
                )}
              >
                {getRoleIcon()}
              </div>

              {/* User Details */}
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    {user?.name || "Utilizador"}
                  </h3>
                  <span
                    className={clsx(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      getRoleBadgeColor()
                    )}
                  >
                    {user?.labels?.[0] || "staff"}
                  </span>
                </div>
                <p className="text-xs text-white/60">
                  {currentTime?.toLocaleTimeString("pt-PT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {lastStatusUpdate && (
                  <p className="text-xs text-white/40">
                    Status: {new Date(lastStatusUpdate).toLocaleTimeString()}
                  </p>
                )}
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  "bg-red-500/10 border-red-500/30 text-red-400",
                  "hover:bg-red-500/20 hover:border-red-500/50",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  getAnimationClass("transition-all duration-300")
                )}
              >
                <LogOut
                  size={16}
                  className={clsx(
                    isLoggingOut && getAnimationClass("animate-spin")
                  )}
                />
                <span className="hidden sm:inline">
                  {isLoggingOut ? "Saindo..." : "Sair"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});

export default Header;
