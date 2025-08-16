"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, Clock, Star, ChefHat } from "lucide-react";
import {
  databases,
  client,
  DB_ATTENDANCE,
  COL_ATTENDANCE,
} from "@/lib/appwrite";
import { Query } from "appwrite";

// Mock function to assign random labels for demo purposes
// In a real app, this would come from the user's actual account data
function getRandomLabels() {
  const possibleLabels = [["staff"], ["chef"], ["manager"], ["staff", "chef"]];
  return possibleLabels[Math.floor(Math.random() * possibleLabels.length)];
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
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every 30 seconds for more real-time feel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchClockedInStaff = useCallback(async () => {
    if (!isManager) return;

    try {
      setLoading(true);
      const res = await databases.listDocuments(DB_ATTENDANCE, COL_ATTENDANCE, [
        Query.isNull("clockOut"),
        Query.orderDesc("clockIn"),
      ]);

      // For now, we'll mock the labels since we don't have them in attendance records
      // In a real app, you'd store user roles in the attendance record or have a separate users collection
      const staffWithLabels = res.documents.map((staff) => ({
        ...staff,
        labels: staff.userId === user.$id ? user.labels : getRandomLabels(), // Mock labels for demo
      }));

      setClockedInStaff(staffWithLabels);
    } catch (err) {
      console.error("Error fetching clocked in staff:", err);
      setClockedInStaff([]);
    } finally {
      setLoading(false);
    }
  }, [isManager, user.$id, user.labels]);

  useEffect(() => {
    if (isManager) {
      fetchClockedInStaff();

      // Subscribe to real-time updates
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
            fetchClockedInStaff();
          }
        }
      );

      return () => {
        if (unsubscribe && typeof unsubscribe === "function") {
          unsubscribe();
        }
      };
    }
  }, [isManager, fetchClockedInStaff]);

  // Role badge styles
  const getRoleBadge = (label) => {
    switch (label) {
      case "manager":
        return {
          color:
            "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-300 border-yellow-400/30",
          icon: Star,
        };
      case "chef":
        return {
          color:
            "bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-300 border-red-400/30",
          icon: ChefHat,
        };
      case "staff":
        return {
          color:
            "bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-300 border-blue-400/30",
          icon: Users,
        };
      default:
        return {
          color: "bg-white/10 text-white/80 border-white/20",
          icon: Users,
        };
    }
  };

  // Don't render if not a manager
  if (!isManager) return null;

  return (
    <div className="px-6 pb-4">
      <div className="bg-white/[0.02] backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-2xl hover:bg-white/[0.03] hover:border-white/20 transition-all duration-300 mx-6 animate-fade-in-up animate-stagger-3">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/30 shadow-lg">
            <Users className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Staff Ativo</h3>
            <p className="text-sm text-white/60">
              {clockedInStaff.length}{" "}
              {clockedInStaff.length === 1
                ? "funcionário ativo"
                : "funcionários ativos"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : clockedInStaff.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
              <Clock className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/60 text-sm font-medium">
              Nenhum funcionário em serviço
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 lg:gap-4">
            {clockedInStaff.map((staff, index) => (
              <div
                key={staff.$id}
                className="bg-white/[0.03] backdrop-blur-sm rounded-xl border border-white/10 p-4 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 group animate-scale-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white text-sm group-hover:text-blue-200 transition-colors duration-300">
                    {staff.name}
                  </h4>
                  <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400/50">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75"></div>
                  </div>
                </div>

                {/* Role badges */}
                {staff.labels && staff.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {staff.labels.map((label) => {
                      const badge = getRoleBadge(label);
                      const Icon = badge.icon;
                      return (
                        <span
                          key={label}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-all duration-200 ${badge.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span className="capitalize">{label}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-white/50" />
                  <span className="text-xs text-white/70 font-medium">
                    {formatDuration(staff.clockIn, currentTime)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
