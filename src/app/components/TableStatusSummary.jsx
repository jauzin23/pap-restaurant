"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, CheckCircle, Clock, DollarSign, Timer } from "lucide-react";
import {
  databases,
  client,
  account,
  COL_ORDERS,
  DB_ATTENDANCE,
  COL_ATTENDANCE,
} from "@/lib/appwrite";
import { Query } from "appwrite";

const DATABASE_ID = "689c9a200025de0e8af2";
const TABLES_COLLECTION_ID = "689c9a26000b5abf71c8";

function getTodayDateString() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

export default function TableStatusSummary() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(null);
  const [clockedInStaff, setClockedInStaff] = useState([]);
  const [lastOrders, setLastOrders] = useState([]);

  useEffect(() => {
    fetchTables();
    fetchRevenueAndOrders();
    fetchClockedInStaff();

    const durationInterval = setInterval(() => {
      setClockedInStaff((prevStaff) =>
        prevStaff.map((staff) => ({
          ...staff,
          duration: getDuration(staff.clockIn),
        }))
      );
    }, 30000); // Update every 30 seconds

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${TABLES_COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${TABLES_COLLECTION_ID}.documents.*.update`
          )
        ) {
          const updatedTable = response.payload;
          setTables((prevTables) =>
            prevTables.map((table) =>
              table.$id === updatedTable.$id ? updatedTable : table
            )
          );
        }
      }
    );

    // Setup realtime subscription for paid orders
    const unsubscribeOrders = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COL_ORDERS}.documents`,
      (response) => {
        // Only update if a paid order is created or updated
        if (
          response.events.some(
            (e) => e.endsWith(".create") || e.endsWith(".update")
          ) &&
          response.payload.status === "pago"
        ) {
          fetchRevenueAndOrders();
        }
      }
    );

    // Setup realtime subscription for attendance changes
    const unsubscribeAttendance = client.subscribe(
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
      clearInterval(durationInterval);
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
      if (unsubscribeOrders && typeof unsubscribeOrders === "function") {
        unsubscribeOrders();
      }
      if (
        unsubscribeAttendance &&
        typeof unsubscribeAttendance === "function"
      ) {
        unsubscribeAttendance();
      }
    };
    // eslint-disable-next-line
  }, []);

  const fetchClockedInStaff = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const response = await databases.listDocuments(
        DB_ATTENDANCE,
        COL_ATTENDANCE,
        [
          Query.greaterThanEqual("clockIn", todayStart.toISOString()),
          Query.lessThan("clockIn", todayEnd.toISOString()),
          Query.isNull("clockOut"),
        ]
      );

      // Get user details for each attendance record
      const staffWithDetails = await Promise.all(
        response.documents.map(async (attendance) => {
          try {
            const userResponse = await account.get(attendance.userId);
            return {
              name: attendance.userName || userResponse.name,
              role: userResponse.labels?.[0] || "staff",
              clockIn: attendance.clockIn,
              duration: getDuration(attendance.clockIn),
            };
          } catch (error) {
            console.error("Error fetching user details:", error);
            return {
              name: attendance.userName,
              role: "staff",
              clockIn: attendance.clockIn,
              duration: getDuration(attendance.clockIn),
            };
          }
        })
      );

      setClockedInStaff(staffWithDetails);
    } catch (error) {
      console.error("Error fetching clocked-in staff:", error);
      setClockedInStaff([]);
    }
  };

  const getDuration = (clockInTime) => {
    const start = new Date(clockInTime);
    const now = new Date();
    const diff = now - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  async function fetchTables() {
    try {
      const res = await databases.listDocuments(
        DATABASE_ID,
        TABLES_COLLECTION_ID,
        [Query.limit(100)]
      );
      setTables(res.documents);
    } catch (err) {
      console.error("Erro ao carregar mesas:", err);
    }
    setLoading(false);
  }

  async function fetchRevenueAndOrders() {
    try {
      // Get all paid orders for today
      const today = getTodayDateString();
      const res = await databases.listDocuments(DATABASE_ID, COL_ORDERS, [
        Query.equal("status", "pago"),
        Query.greaterThanEqual("criadoEm", `${today}T00:00:00.000Z`),
        Query.lessThan("criadoEm", `${today}T23:59:59.999Z`),
        Query.orderDesc("criadoEm"),
        Query.limit(10),
      ]);
      const orders = res.documents;
      // Revenue
      const totalRevenue = orders.reduce(
        (sum, order) => sum + (order.total || 0),
        0
      );
      setRevenue(totalRevenue);
      setLastOrders(orders.slice(0, 2));
    } catch (err) {
      setRevenue(null);
      setLastOrders([]);
    }
  }

  const freeTables = tables.filter((table) => table.status === "free").length;
  const occupiedTables = tables.filter(
    (table) => table.status === "occupied"
  ).length;
  const totalTables = tables.length;
  const occupancyRate =
    totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mx-6 my-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/10 p-5 animate-pulse shadow-lg"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-white/10 rounded-lg" />
              <div className="h-3 bg-white/10 rounded w-20" />
            </div>
            <div className="h-8 bg-white/10 rounded w-16 mb-2" />
            <div className="h-2 bg-white/10 rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  // Real staff type summary from clocked-in staff
  const staffTypes = clockedInStaff.reduce((acc, s) => {
    // Map role to Portuguese display names
    const roleMap = {
      manager: "Gerente",
      chef: "Cozinheiro",
      staff: "Garçom",
    };
    const displayRole = roleMap[s.role] || "Garçom";
    acc[displayRole] = (acc[displayRole] || 0) + 1;
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-1 md:grid-cols-3 gap-4 mx-6 my-4"
    >
      {/* Card 1: Tables Analytics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/10 p-5 hover:bg-white/[0.04] hover:border-white/20 transition-all duration-300 group shadow-lg hover:shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-500/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/10">
            <Users size={18} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Mesas</h3>
            <p className="text-sm text-white/70">Estado atual</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Total</span>
            <span className="text-xl font-bold text-white">{totalTables}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Livres</span>
            <span className="text-xl font-bold text-emerald-400">
              {freeTables}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/70">Ocupadas</span>
            <span className="text-xl font-bold text-red-400">
              {occupiedTables}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-white/70">Taxa de Ocupação</span>
            <span
              className={`text-sm font-semibold ${
                occupancyRate > 80
                  ? "text-red-400"
                  : occupancyRate > 50
                  ? "text-yellow-400"
                  : "text-emerald-400"
              }`}
            >
              {occupancyRate.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${occupancyRate}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className={`h-1.5 rounded-full ${
                occupancyRate > 80
                  ? "bg-red-400"
                  : occupancyRate > 50
                  ? "bg-yellow-400"
                  : "bg-emerald-400"
              }`}
            />
          </div>
        </div>
      </motion.div>

      {/* Card 2: Today's Revenue */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/10 p-5 hover:bg-white/[0.04] hover:border-white/20 transition-all duration-300 group shadow-lg hover:shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-500/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
            <DollarSign size={18} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Faturação</h3>
            <p className="text-sm text-white/70">Ganhos de hoje</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-sm text-emerald-400 font-semibold">€</span>
            <span className="text-2xl font-bold text-white tracking-tight">
              {revenue !== null
                ? revenue.toLocaleString("pt-PT", { minimumFractionDigits: 2 })
                : "0.00"}
            </span>
          </div>
          <p className="text-sm text-white/70 mt-1">Pedidos pagos hoje</p>
        </div>

        <div className="pt-4 border-t border-white/10">
          <div className="mb-2 text-sm text-white/70 font-semibold">
            Últimos pedidos pagos
          </div>
          {lastOrders.length === 0 && (
            <div className="text-sm text-white/50 italic">
              Nenhum pedido hoje
            </div>
          )}
          <div className="space-y-2">
            {lastOrders.map((order) => (
              <div
                key={order.$id}
                className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-300 cursor-pointer group"
              >
                <span className="font-mono text-white/80 text-sm group-hover:text-white transition-colors">
                  #{order.$id.slice(-6)}
                </span>
                <span className="font-bold text-emerald-400 text-sm">
                  €
                  {(order.total || 0).toLocaleString("pt-PT", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Card 3: Staff on Duty */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/10 p-5 hover:bg-white/[0.04] hover:border-white/20 transition-all duration-300 group shadow-lg hover:shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-500/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-purple-500/20 shadow-lg shadow-purple-500/10">
            <Clock size={18} className="text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Staff</h3>
            <p className="text-sm text-white/70">Em serviço</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white tracking-tight">
              {clockedInStaff.length}
            </span>
            <span className="text-sm text-white/70 font-medium">total</span>
          </div>
        </div>

        <div className="space-y-2">
          {Object.entries(staffTypes).map(([type, count]) => (
            <div
              key={type}
              className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-300 group cursor-pointer"
            >
              <span className="text-sm text-white/80 capitalize font-medium group-hover:text-white transition-colors">
                {type}
              </span>
              <span className="text-sm font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
                {count}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
