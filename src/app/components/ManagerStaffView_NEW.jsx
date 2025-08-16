"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, Clock, Star, ChefHat } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Query } from "appwrite";
import { DB_ATTENDANCE, COL_ATTENDANCE } from "@/lib/appwrite";

// Simplified label assignment without external API calls
function getStaffLabels(userId, currentUserId, currentUserLabels) {
  // If it's the current user, use their actual labels
  if (userId === currentUserId) {
    return currentUserLabels || ["staff"];
  }
  // For other users, assign default staff label
  return ["staff"];
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

export default function ManagerStaffView({ user, isManager }) {
  const [clockedInStaff, setClockedInStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastStaffUpdate, setLastStaffUpdate] = useState(null);

  const {
    currentTime,
    databases,
    getClassName,
    getAnimationClass,
    setupSubscription,
    getSubscriptionHealth,
  } = useApp();

  // Helper functions for styling
  const getBackdropClass = (baseClass) =>
    getClassName(baseClass + " backdrop-blur-sm", baseClass);
  const getShadowClass = () => getClassName("shadow-lg", "");
  const getTransitionClass = (
    transitionClass = "transition-all duration-300"
  ) => getAnimationClass(transitionClass);

  // BULLETPROOF: Fetch clocked-in staff with comprehensive error handling
  const fetchClockedInStaff = useCallback(async () => {
    if (!isManager) return;

    try {
      setLoading(true);
      console.log("👥 Fetching clocked-in staff...");

      const res = await databases.listDocuments(DB_ATTENDANCE, COL_ATTENDANCE, [
        Query.isNull("clockOut"),
        Query.orderDesc("clockIn"),
        Query.limit(50), // Reasonable limit
      ]);

      // Assign labels without external API calls to avoid 404 errors
      const staffWithLabels = res.documents.map((staff) => ({
        ...staff,
        labels: getStaffLabels(staff.userId, user.$id, user.labels),
      }));

      console.log("👥 Staff loaded:", {
        count: staffWithLabels.length,
        staffIds: staffWithLabels.map((s) => s.userId.slice(-6)),
        timestamp: new Date().toLocaleTimeString(),
      });

      setClockedInStaff(staffWithLabels);
      setLastStaffUpdate(Date.now());
    } catch (err) {
      console.error("❌ Error fetching clocked-in staff:", err);
      setClockedInStaff([]);
    } finally {
      setLoading(false);
    }
  }, [isManager, user?.$id, user?.labels, databases]);

  // INITIAL: Load staff on mount
  useEffect(() => {
    if (!isManager) return;
    fetchClockedInStaff();
  }, [fetchClockedInStaff, isManager]);

  // 🚀 BULLETPROOF REAL-TIME STAFF TRACKING - Instant clock-in/out updates
  useEffect(() => {
    if (!isManager) return;

    console.log("🔥 Setting up BULLETPROOF staff attendance tracking");

    // ATTENDANCE SUBSCRIPTION - Instant staff updates
    const cleanupAttendance = setupSubscription(
      `databases.${DB_ATTENDANCE}.collections.${COL_ATTENDANCE}.documents`,
      async (response) => {
        if (
          response.events.some((event) =>
            event.includes("databases.*.collections.*.documents.*")
          )
        ) {
          const eventType = response.events[0];
          const payload = response.payload;

          console.log("👥 Staff attendance event:", {
            type: eventType.includes(".create")
              ? "CLOCK-IN"
              : eventType.includes(".update")
              ? "CLOCK-OUT"
              : "OTHER",
            userId: payload?.userId?.slice(-6) || "unknown",
            name: payload?.name || "unnamed",
            clockOut: payload?.clockOut || null,
            timestamp: new Date().toLocaleTimeString(),
          });

          // IMMEDIATE optimistic update
          if (eventType.includes(".create") && !payload.clockOut) {
            // New clock-in - add to list immediately
            const newStaff = {
              ...payload,
              labels: getStaffLabels(payload.userId, user.$id, user.labels),
            };

            setClockedInStaff((prev) => {
              // Avoid duplicates
              const exists = prev.some((s) => s.userId === payload.userId);
              if (exists) return prev;
              return [newStaff, ...prev];
            });

            console.log(
              "✅ INSTANT clock-in update applied for:",
              payload.name
            );
          } else if (eventType.includes(".update") && payload.clockOut) {
            // Clock-out - remove from list immediately
            setClockedInStaff((prev) =>
              prev.filter((staff) => staff.userId !== payload.userId)
            );

            console.log(
              "✅ INSTANT clock-out update applied for:",
              payload.name
            );
          }

          // Background validation - fetch fresh data to ensure accuracy
          setTimeout(fetchClockedInStaff, 300);
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
        now - health.attendance.lastEvent > 180000
      ) {
        // 3 minutes
        console.warn("⚠️ Staff attendance subscription stale, refreshing...");
        fetchClockedInStaff();
      }
    }, 60000); // Check every minute

    // PERIODIC SYNC - Backup refresh every 5 minutes
    const syncInterval = setInterval(() => {
      console.log("🔄 Periodic staff sync - ensuring accuracy");
      fetchClockedInStaff();
    }, 300000); // Every 5 minutes

    // Cleanup
    return () => {
      console.log("🧹 Cleaning up ManagerStaffView subscriptions");
      cleanupAttendance();
      clearInterval(healthCheckInterval);
      clearInterval(syncInterval);
    };
  }, [
    isManager,
    setupSubscription,
    fetchClockedInStaff,
    user?.$id,
    user?.labels,
    getSubscriptionHealth,
  ]);

  // Role badge styles
  const getRoleBadgeStyle = (labels) => {
    if (!labels || labels.length === 0) return "bg-gray-500/20 text-gray-400";

    const primaryLabel = labels[0].toLowerCase();

    switch (primaryLabel) {
      case "manager":
        return "bg-purple-500/20 text-purple-300";
      case "chef":
        return "bg-orange-500/20 text-orange-300";
      case "waiter":
      case "waitress":
        return "bg-blue-500/20 text-blue-300";
      case "kitchen":
        return "bg-red-500/20 text-red-300";
      default:
        return "bg-green-500/20 text-green-300";
    }
  };

  const getRoleIcon = (labels) => {
    if (!labels || labels.length === 0) return <Users size={14} />;

    const primaryLabel = labels[0].toLowerCase();

    switch (primaryLabel) {
      case "manager":
        return <Star size={14} />;
      case "chef":
      case "kitchen":
        return <ChefHat size={14} />;
      default:
        return <Users size={14} />;
    }
  };

  if (!isManager) {
    return null;
  }

  return (
    <div
      className={`p-4 md:p-6 rounded-lg ${getBackdropClass(
        "bg-black/40 border border-white/10"
      )} ${getShadowClass()}`}
    >
      <div
        className={`flex items-center justify-between mb-4 md:mb-6 ${getTransitionClass()}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/20 ${getTransitionClass()}`}
          >
            <Users size={18} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Staff Ativo</h3>
            <p className="text-sm text-white/60">
              {clockedInStaff.length}{" "}
              {clockedInStaff.length === 1
                ? "funcionário ativo"
                : "funcionários ativos"}
            </p>
            {lastStaffUpdate && (
              <p className="text-xs text-white/40 mt-1">
                Última atualização:{" "}
                {new Date(lastStaffUpdate).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div
            className={`w-8 h-8 border-2 border-white/30 border-t-white rounded-full ${getAnimationClass(
              "animate-spin"
            )}`}
          />
        </div>
      ) : clockedInStaff.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
            <Users size={24} className="text-white/30" />
          </div>
          <p className="text-white/50 text-lg font-medium">
            Nenhum funcionário ativo
          </p>
          <p className="text-white/30 text-sm mt-2">
            Aguardando entrada de funcionários...
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clockedInStaff.map((staff) => (
            <div
              key={staff.$id}
              className={`p-4 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] ${getTransitionClass()} group`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Role Icon */}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${getRoleBadgeStyle(
                      staff.labels
                    )} ${getTransitionClass()}`}
                  >
                    {getRoleIcon(staff.labels)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white group-hover:text-white/90 transition-colors">
                        {staff.name || "Funcionário"}
                      </h4>

                      {/* Role Badge */}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeStyle(
                          staff.labels
                        )} ${getTransitionClass()}`}
                      >
                        {staff.labels?.[0] || "staff"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1.5 text-sm text-white/60">
                        <Clock size={14} />
                        <span>
                          Entrou às{" "}
                          {new Date(staff.clockIn).toLocaleTimeString("pt-PT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duration */}
                <div className="text-right">
                  <div className="text-lg font-bold text-white">
                    {formatDuration(staff.clockIn, currentTime)}
                  </div>
                  <div className="text-sm text-white/50">trabalhadas</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
