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

  const { databases, client, users } = useApp();

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
      } catch (error) {
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
  }, [isManager, databases, getUserDetails]);

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
    if (!labels || labels.length === 0)
      return <Users size={16} style={{ color: "#000000" }} />;

    const primaryLabel = labels[0].toLowerCase();

    switch (primaryLabel) {
      case "manager":
        return <Star size={16} style={{ color: "#000000" }} />;
      case "chef":
      case "kitchen":
        return <ChefHat size={16} style={{ color: "#000000" }} />;
      default:
        return <Users size={16} style={{ color: "#000000" }} />;
    }
  };

  if (!isManager) {
    return null;
  }

  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #222222",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Dashboard-style Header */}
      <div
        style={{
          padding: "24px",
          borderBottom: "1px solid #222222",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            style={{
              width: "32px",
              height: "32px",
              background: "#ffffff",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Users size={16} style={{ color: "#000000" }} />
          </div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              margin: "0",
              color: "#ffffff",
            }}
          >
            Staff Ativo
          </h3>
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "#888888",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontWeight: "500",
          }}
        >
          {clockedInStaff.length}{" "}
          {clockedInStaff.length === 1 ? "ativo" : "ativos"}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      ) : clockedInStaff.length === 0 ? (
        <div className="text-center py-12">
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "#ffffff",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <Users size={32} style={{ color: "#000000" }} />
          </div>
          <p
            style={{
              fontSize: "18px",
              fontWeight: "600",
              margin: "0 0 8px 0",
              color: "#ffffff",
            }}
          >
            Nenhum funcionário ativo
          </p>
          <p style={{ fontSize: "14px", color: "#888888", margin: "0" }}>
            Aguardando entrada de funcionários...
          </p>
        </div>
      ) : (
        <div>
          {clockedInStaff.map((staff) => {
            const userLabels = Array.isArray(staff.labels) ? staff.labels : [];

            return (
              <div
                key={staff.$id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "16px 24px",
                  borderBottom: "1px solid #222222",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.background = "rgba(255, 255, 255, 0.02)")
                }
                onMouseLeave={(e) =>
                  (e.target.style.background = "transparent")
                }
              >
                {/* Item Icon */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    background: "#ffffff",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: "0",
                  }}
                >
                  {getRoleIcon(userLabels)}
                </div>

                {/* Item Content */}
                <div style={{ flex: "1" }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "500",
                      marginBottom: "2px",
                      color: "#ffffff",
                    }}
                  >
                    {staff.name || "Funcionário"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#888888" }}>
                    Entrou às{" "}
                    {new Date(staff.clockIn).toLocaleTimeString("pt-PT", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {userLabels.length > 0 && ` • ${userLabels.join(", ")}`}
                  </div>
                </div>

                {/* Item Meta */}
                <div style={{ textAlign: "right", flexShrink: "0" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#888888",
                      marginBottom: "2px",
                    }}
                  >
                    {formatDuration(staff.clockIn, currentTime)}
                  </div>
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#00ff00",
                      marginLeft: "auto",
                      boxShadow: "0 0 4px #00ff00",
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dashboard-style Footer */}
      <div style={{ padding: "20px 24px", textAlign: "center" }}>
        <button
          style={{
            background: "#ffffff",
            color: "#000000",
            border: "none",
            padding: "10px 20px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          VER TODO O STAFF
        </button>
      </div>
    </div>
  );
}
