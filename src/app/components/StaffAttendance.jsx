"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Clock, LogOut, LogIn, Timer } from "lucide-react";
import {
  databases,
  client,
  DB_ATTENDANCE,
  COL_ATTENDANCE,
} from "@/lib/appwrite";
import { Query } from "appwrite";

function formatDuration(clockInTime, currentTime = new Date()) {
  if (!clockInTime) return "0h 0m";

  const clockIn = new Date(clockInTime);
  const current = new Date(currentTime);
  const diffMs = current - clockIn;

  // Handle negative durations (shouldn't happen, but just in case)
  if (diffMs < 0) {
    return "0h 0m";
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export default function StaffAttendance({ user, isManager }) {
  const [clockedInStaff, setClockedInStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userClockStatus, setUserClockStatus] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    fetchClockedInStaff();
    fetchUserClockStatus();

    const unsubscribe = client.subscribe(
      `databases.${DB_ATTENDANCE}.collections.${COL_ATTENDANCE}.documents`,
      (response) => {
        if (
          response.events.some(
            (e) => e.endsWith(".create") || e.endsWith(".update")
          )
        ) {
          fetchClockedInStaff();
          fetchUserClockStatus();
        }
      }
    );

    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
    // eslint-disable-next-line
  }, [user]);

  async function fetchClockedInStaff() {
    try {
      // Get all records where clockOut is null (currently clocked in)
      const res = await databases.listDocuments(DB_ATTENDANCE, COL_ATTENDANCE, [
        Query.isNull("clockOut"),
        Query.orderDesc("clockIn"),
        Query.limit(50),
      ]);
      setClockedInStaff(res.documents);
    } catch (err) {
      console.error("Error fetching clocked in staff:", err);
      setClockedInStaff([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserClockStatus() {
    try {
      // Check if current user is clocked in
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

  async function handleClockIn() {
    try {
      await databases.createDocument(
        DB_ATTENDANCE,
        COL_ATTENDANCE,
        "unique()",
        {
          userId: user.$id,
          name: user.name,
          clockIn: new Date().toISOString(),
        }
      );
      // Data will be refreshed via realtime subscription
    } catch (err) {
      console.error("Error clocking in:", err);
      alert("Erro ao bater ponto de entrada. Tente novamente.");
    }
  }

  async function handleClockOut() {
    if (!userClockStatus) return;

    try {
      await databases.updateDocument(
        DB_ATTENDANCE,
        COL_ATTENDANCE,
        userClockStatus.$id,
        {
          clockOut: new Date().toISOString(),
        }
      );
      // Data will be refreshed via realtime subscription
    } catch (err) {
      console.error("Error clocking out:", err);
      alert("Erro ao bater ponto de saída. Tente novamente.");
    }
  }

  if (loading) {
    return (
      <div className="mx-6 my-6">
        <div className="bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/10 p-6 animate-pulse shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/10 rounded-lg" />
            <div className="h-5 bg-white/10 rounded w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-white/10 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-6 my-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-6 shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/10">
              <Timer size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Ponto</h3>
              <p className="text-sm text-white/70">
                {userClockStatus
                  ? `Em serviço há ${formatDuration(
                      userClockStatus.clockIn,
                      currentTime
                    )}`
                  : "Não está em serviço"}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            {!userClockStatus ? (
              <button
                onClick={handleClockIn}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-sm font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <LogIn size={16} />
                Entrada
              </button>
            ) : (
              <button
                onClick={handleClockOut}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <LogOut size={16} />
                Saída
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Staff Currently Clocked In (Only for Managers) */}
      {isManager && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/10 p-6 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-500/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-purple-500/20 shadow-lg shadow-purple-500/10">
              <Users size={18} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Staff em Serviço</h3>
              <p className="text-sm text-white/70">
                {clockedInStaff.length} funcionários ativos
              </p>
            </div>
          </div>

          {clockedInStaff.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={32} className="text-white/30 mx-auto mb-3" />
              <p className="text-white/60">Nenhum funcionário em serviço</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clockedInStaff.map((staff) => (
                <motion.div
                  key={staff.$id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white/[0.03] backdrop-blur-sm rounded-lg border border-white/10 p-4 hover:bg-white/[0.05] hover:border-white/20 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-semibold text-sm group-hover:text-white/90 transition-colors">
                      {staff.name}
                    </h4>
                    <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400/50"></div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-white/70">
                    <Clock size={12} />
                    <span>
                      Entrada:{" "}
                      {new Date(staff.clockIn).toLocaleTimeString("pt-PT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-white/60">
                    <span className="bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20">
                      {formatDuration(staff.clockIn, currentTime)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
