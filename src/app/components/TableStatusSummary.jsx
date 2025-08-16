"use client";

import React, { useState, useEffect } from "react";
import { Users, DollarSign } from "lucide-react";
import { useTime } from "@/contexts/TimeContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePerformance } from "@/components/PerformanceContext";
import {
  SUBSCRIPTION_CHANNELS,
  eventMatches,
  EVENT_PATTERNS,
} from "@/lib/subscriptionChannels";
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
  const { currentTime } = useTime();
  const { subscribe } = useSubscription();
  const {
    getBackdropClass,
    getAnimationClass,
    getTransitionClass,
    getShadowClass,
  } = usePerformance();

  // Update staff durations when currentTime changes (every 30 seconds)
  useEffect(() => {
    setClockedInStaff((prevStaff) =>
      prevStaff.map((staff) => ({
        ...staff,
        duration: getDuration(staff.clockIn),
      }))
    );
  }, [currentTime]);

  useEffect(() => {
    fetchTables();
    fetchRevenueAndOrders();
    fetchClockedInStaff();

    // Consolidated subscription for tables updates
    const unsubscribeTables = subscribe(
      SUBSCRIPTION_CHANNELS.TABLES(DATABASE_ID, TABLES_COLLECTION_ID),
      (response) => {
        if (eventMatches(response.events, EVENT_PATTERNS.UPDATE)) {
          const updatedTable = response.payload;
          setTables((prevTables) =>
            prevTables.map((table) =>
              table.$id === updatedTable.$id ? updatedTable : table
            )
          );
        }
      },
      { debounce: true, debounceDelay: 300 }
    );

    // Consolidated subscription for paid orders
    const unsubscribeOrders = subscribe(
      SUBSCRIPTION_CHANNELS.ORDERS(DATABASE_ID, COL_ORDERS),
      (response) => {
        if (
          eventMatches(response.events, [
            EVENT_PATTERNS.CREATE,
            EVENT_PATTERNS.UPDATE,
          ]) &&
          response.payload.status === "pago"
        ) {
          fetchRevenueAndOrders();
        }
      },
      { debounce: true, debounceDelay: 500 }
    );

    // Consolidated subscription for attendance changes
    const unsubscribeAttendance = subscribe(
      SUBSCRIPTION_CHANNELS.ATTENDANCE(DB_ATTENDANCE, COL_ATTENDANCE),
      (response) => {
        if (eventMatches(response.events, EVENT_PATTERNS.ALL_CRUD)) {
          fetchClockedInStaff();
        }
      },
      { debounce: true, debounceDelay: 500 }
    );

    return () => {
      unsubscribeTables();
      unsubscribeOrders();
      unsubscribeAttendance();
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
      <div className="grid grid-cols-1 gap-3 mx-2 lg:mx-6 my-4">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className={`${getBackdropClass(
              "bg-neutral-900/95"
            )} rounded-xl border border-white/10 p-5 ${getAnimationClass(
              "animate-pulse"
            )} ${getShadowClass()}`}
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
    <div
      className={`grid grid-cols-1 xl:grid-cols-2 gap-4 mx-2 lg:mx-6 my-4 ${getAnimationClass(
        "animate-fade-in-up"
      )}`}
    >
      {/* Card 1: Tables Analytics */}
      <div
        className={`${getBackdropClass(
          "bg-neutral-900/95"
        )} rounded-xl border border-white/10 p-4 md:p-5 hover:bg-white/[0.04] hover:border-white/20 ${getTransitionClass()} group ${getShadowClass()} hover:shadow-xl ${getAnimationClass(
          "animate-fade-in-up animate-stagger-1"
        )}`}
      >
        <div className="flex items-center gap-3 mb-3 md:mb-4">
          <div
            className={`w-9 h-9 md:w-10 md:h-10 bg-blue-500/10 ${getBackdropClass(
              "bg-blue-600/20"
            )} rounded-lg flex items-center justify-center border border-blue-500/20 ${getShadowClass()} shadow-blue-500/10`}
          >
            <Users
              size={16}
              className="text-blue-400 md:w-[18px] md:h-[18px]"
            />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-white">Mesas</h3>
            <p className="text-xs md:text-sm text-white/70">Estado atual</p>
          </div>
        </div>

        <div className="space-y-2 md:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm text-white/70">Total</span>
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
            <div
              className={`h-1.5 rounded-full ${getAnimationClass(
                "animate-progress-bar"
              )} ${
                occupancyRate > 80
                  ? "bg-red-400"
                  : occupancyRate > 50
                  ? "bg-yellow-400"
                  : "bg-emerald-400"
              }`}
              style={{ "--target-width": `${occupancyRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 2: Today's Revenue */}
      <div
        className={`${getBackdropClass(
          "bg-neutral-900/95"
        )} rounded-xl border border-white/10 p-4 md:p-5 hover:bg-white/[0.04] hover:border-white/20 ${getTransitionClass()} group ${getShadowClass()} hover:shadow-xl ${getAnimationClass(
          "animate-fade-in-up animate-stagger-2"
        )}`}
      >
        <div className="flex items-center gap-3 mb-3 md:mb-4">
          <div
            className={`w-9 h-9 md:w-10 md:h-10 bg-emerald-500/10 ${getBackdropClass(
              "bg-emerald-600/20"
            )} rounded-lg flex items-center justify-center border border-emerald-500/20 ${getShadowClass()} shadow-emerald-500/10`}
          >
            <DollarSign
              size={16}
              className="text-emerald-400 md:w-[18px] md:h-[18px]"
            />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-white">
              Faturação
            </h3>
            <p className="text-xs md:text-sm text-white/70">Ganhos de hoje</p>
          </div>
        </div>

        <div className="mb-4 md:mb-6">
          <div className="flex flex-col items-center justify-center gap-1 md:gap-2">
            <span className="text-lg md:text-xl text-emerald-500 font-semibold mb-1">
              Faturação
            </span>
            <div className="flex items-end gap-1 md:gap-2">
              <span className="text-xl md:text-2xl text-emerald-400 font-bold">
                €
              </span>
              <span
                className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-none"
                style={{
                  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                }}
              >
                {revenue !== null
                  ? revenue.toLocaleString("pt-PT", {
                      minimumFractionDigits: 2,
                    })
                  : "0.00"}
              </span>
            </div>
            <p className="text-sm text-white/60 mt-2 text-center font-medium tracking-wide">
              Pedidos pagos hoje
            </p>
          </div>
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
                className={`flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] ${getTransitionClass()} cursor-pointer group`}
              >
                <span
                  className={`font-mono text-white/80 text-sm group-hover:text-white ${getTransitionClass(
                    "transition-colors"
                  )}`}
                >
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
      </div>
    </div>
  );
}
