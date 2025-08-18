"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, Clock, Star, ChefHat } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Query } from "appwrite";
import { DB_ATTENDANCE, COL_ATTENDANCE } from "@/lib/appwrite";

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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userDetailsCache, setUserDetailsCache] = useState(new Map());

  const { databases, client } = useApp();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const getUserDetails = useCallback(
    async (userId) => {
      if (userDetailsCache.has(userId)) {
        return userDetailsCache.get(userId);
      }

      try {
        if (userId === user.$id) {
          const userDetails = {
            name: user.name,
            labels: user.labels || [],
          };
          setUserDetailsCache((prev) => new Map(prev).set(userId, userDetails));
          return userDetails;
        }

        return { name: "Funcionário", labels: [] };
      } catch {
        return { name: "Funcionário", labels: [] };
      }
    },
    [user, userDetailsCache]
  );

  const fetchClockedInStaff = useCallback(async () => {
    if (!isManager) return;
    try {
      setLoading(true);

      const res = await databases.listDocuments(DB_ATTENDANCE, COL_ATTENDANCE, [
        Query.isNull("clockOut"),
        Query.orderDesc("clockIn"),
        Query.limit(50),
      ]);

      const staffWithDetails = res.documents.map((staff) => {
        // Merge both 'labels' and 'label' fields for compatibility
        let labelsArr = [];
        if (Array.isArray(staff.labels)) labelsArr = staff.labels;
        else if (Array.isArray(staff.label)) labelsArr = staff.label;
        else if (typeof staff.labels === "string") labelsArr = [staff.labels];
        else if (typeof staff.label === "string") labelsArr = [staff.label];

        return {
          ...staff,
          name: staff.name || "Unknown Staff",
          labels: labelsArr,
        };
      });

      setClockedInStaff(staffWithDetails);
      setLastStaffUpdate(Date.now());
    } catch (err) {
      console.error("Erro ao obter staff ativo:", err);
      setClockedInStaff([]);
    } finally {
      setLoading(false);
    }
  }, [isManager, databases]);

  useEffect(() => {
    if (!isManager) return;
    fetchClockedInStaff();
  }, [fetchClockedInStaff, isManager]);

  useEffect(() => {
    if (!isManager) return;

    const unsubscribe = client.subscribe(
      [`databases.${DB_ATTENDANCE}.collections.${COL_ATTENDANCE}.documents`],
      (response) => {
        const eventType = response.events[0];
        const payload = response.payload;

        if (eventType.includes(".create") && !payload.clockOut) {
          setClockedInStaff((prev) => {
            const exists = prev.some((s) => s.userId === payload.userId);
            if (exists) return prev;

            const newStaff = {
              ...payload,
              name: payload.name || "Unknown Staff",
              labels: Array.isArray(payload.labels) ? payload.labels : [],
            };

            return [newStaff, ...prev];
          });
        } else if (eventType.includes(".update") && payload.clockOut) {
          setClockedInStaff((prev) =>
            prev.filter((staff) => staff.userId !== payload.userId)
          );
        }

        setLastStaffUpdate(Date.now());

        setTimeout(fetchClockedInStaff, 500);
      }
    );

    const syncInterval = setInterval(() => {
      fetchClockedInStaff();
    }, 120000);

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
    };
  }, [isManager, fetchClockedInStaff, client, getUserDetails]);

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
    <div className="p-4 md:p-6 rounded-lg bg-black/80 border border-white/10 shadow-lg">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/20">
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
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
          {clockedInStaff.map((staff) => {
            const userLabels = Array.isArray(staff.labels) ? staff.labels : [];

            return (
              <div
                key={staff.$id}
                className="p-4 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Role Icon */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${getRoleBadgeStyle(
                        userLabels
                      )}`}
                    >
                      {getRoleIcon(userLabels)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">
                          {staff.name || "Funcionário"}
                        </h4>

                        {/* Role Badges - Display ALL labels */}
                        {userLabels.length > 0 ? (
                          userLabels.map((label) => (
                            <span
                              key={label}
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeStyle(
                                [label]
                              )}`}
                            >
                              {label}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
                            sem papel
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1.5 text-sm text-white/60">
                          <Clock size={14} />
                          <span>
                            Entrou às{" "}
                            {new Date(staff.clockIn).toLocaleTimeString(
                              "pt-PT",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
