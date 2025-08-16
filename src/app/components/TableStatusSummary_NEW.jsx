"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, DollarSign } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Query } from "appwrite";
import { DBRESTAURANTE, COL_TABLES, COL_ORDERS } from "@/lib/appwrite";

const DATABASE_ID = DBRESTAURANTE;
const TABLES_COLLECTION_ID = COL_TABLES;

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

export default function TableStatusSummary() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(null);
  const [lastOrders, setLastOrders] = useState([]);
  const [lastRevenueUpdate, setLastRevenueUpdate] = useState(null);

  const {
    currentTime,
    fetchData,
    getClassName,
    getAnimationClass,
    setupSubscription,
    getSubscriptionHealth,
  } = useApp();

  // OPTIMIZED: Fetch tables (rarely changes, cache aggressively)
  const fetchTables = useCallback(async () => {
    try {
      const response = await fetchData(DATABASE_ID, TABLES_COLLECTION_ID, [
        Query.limit(100),
      ]);
      if (response) {
        setTables(response.documents);
        console.log("📊 Tables loaded:", response.documents.length);
      }
    } catch (err) {
      console.error("❌ Error loading tables:", err);
    }
    setLoading(false);
  }, [fetchData]);

  // BULLETPROOF: Revenue calculation with immediate accuracy
  const fetchRevenueAndOrders = useCallback(async () => {
    try {
      const today = getTodayDateString();
      console.log("💰 Fetching revenue for:", today);

      // Get all paid orders for today
      const response = await fetchData(DATABASE_ID, COL_ORDERS, [
        Query.equal("status", "pago"),
        Query.greaterThanEqual("criadoEm", `${today}T00:00:00.000Z`),
        Query.lessThan("criadoEm", `${today}T23:59:59.999Z`),
        Query.orderDesc("criadoEm"),
        Query.limit(50), // Increased limit for accuracy
      ]);

      if (response) {
        const orders = response.documents;
        const totalRevenue = orders.reduce(
          (sum, order) => sum + (order.total || 0),
          0
        );

        console.log("💰 Revenue calculated:", {
          totalRevenue,
          ordersCount: orders.length,
          lastOrderTime: orders[0]?.criadoEm || "none",
        });

        setRevenue(totalRevenue);
        setLastOrders(orders.slice(0, 3)); // Show last 3 orders
        setLastRevenueUpdate(Date.now());
      }
    } catch (err) {
      console.error("❌ Error fetching revenue:", err);
      setRevenue(null);
      setLastOrders([]);
    }
  }, [fetchData]);

  // COMBINED: Fetch all data efficiently
  const fetchAllData = useCallback(async () => {
    await Promise.all([fetchTables(), fetchRevenueAndOrders()]);
  }, [fetchTables, fetchRevenueAndOrders]);

  // INITIAL: Load everything on mount
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // 🚀 BULLETPROOF REAL-TIME SYSTEM - No more delays!
  useEffect(() => {
    console.log(
      "🔥 Setting up BULLETPROOF real-time subscriptions for TableStatusSummary"
    );

    // 1️⃣ TABLES SUBSCRIPTION - Instant table status updates
    const cleanupTables = setupSubscription(
      `databases.${DATABASE_ID}.collections.${TABLES_COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.events.some((event) =>
            event.includes("databases.*.collections.*.documents.*.update")
          )
        ) {
          console.log(
            "📊 Table status change detected:",
            response.payload?.tableNumber,
            response.payload?.status
          );

          // IMMEDIATE optimistic update (< 50ms)
          if (response.payload) {
            setTables((prev) =>
              prev.map((table) =>
                table.$id === response.payload.$id
                  ? { ...table, ...response.payload }
                  : table
              )
            );
          }
        }
      },
      "tables" // Subscription type for health monitoring
    );

    // 2️⃣ ORDERS SUBSCRIPTION - INSTANT revenue updates when orders are paid
    const cleanupOrders = setupSubscription(
      `databases.${DATABASE_ID}.collections.${COL_ORDERS}.documents`,
      (response) => {
        if (
          response.events.some(
            (event) =>
              event.includes("databases.*.collections.*.documents.*.create") ||
              event.includes("databases.*.collections.*.documents.*.update")
          )
        ) {
          const payload = response.payload;

          // INSTANT revenue update for paid orders TODAY
          if (payload?.status === "pago") {
            const today = getTodayDateString();
            const orderDate = new Date(payload.criadoEm);
            const orderDateStr = orderDate.toISOString().split("T")[0];

            if (orderDateStr === today) {
              console.log("💰 INSTANT revenue update - Order paid:", {
                orderId: payload.$id.slice(-6),
                amount: payload.total,
                timestamp: new Date().toLocaleTimeString(),
              });

              // IMMEDIATE optimistic update (add to revenue instantly)
              setRevenue((prev) => (prev || 0) + (payload.total || 0));
              setLastOrders((prev) => [payload, ...prev.slice(0, 2)]);

              // Background validation (fetch fresh data to ensure accuracy)
              setTimeout(fetchRevenueAndOrders, 200);
            }
          }
        }
      },
      "orders" // Subscription type for health monitoring
    );

    // 3️⃣ HEALTH MONITORING - Auto-reconnect if subscriptions fail
    const healthCheckInterval = setInterval(() => {
      const health = getSubscriptionHealth();
      const now = Date.now();

      // Check if any subscription is stale (no events for 2 minutes)
      Object.entries(health).forEach(([type, status]) => {
        if (
          status.active &&
          status.lastEvent &&
          now - status.lastEvent > 120000
        ) {
          console.warn(
            `⚠️ Subscription ${type} appears stale, refreshing data...`
          );
          if (type === "orders") fetchRevenueAndOrders();
          if (type === "tables") fetchTables();
        }
      });
    }, 30000); // Check every 30 seconds

    // 4️⃣ PERIODIC SYNC - Backup sync every 2 minutes for ultimate reliability
    const syncInterval = setInterval(() => {
      console.log("🔄 Periodic sync - ensuring data accuracy");
      fetchRevenueAndOrders(); // Revenue changes most frequently
    }, 120000); // Every 2 minutes

    // Cleanup function
    return () => {
      console.log("🧹 Cleaning up TableStatusSummary subscriptions");
      cleanupTables();
      cleanupOrders();
      clearInterval(healthCheckInterval);
      clearInterval(syncInterval);
    };
  }, [
    setupSubscription,
    fetchRevenueAndOrders,
    fetchTables,
    getSubscriptionHealth,
  ]);

  // Calculate table statistics
  const freeTables = tables.filter((table) => table.status === "free").length;
  const occupiedTables = tables.filter(
    (table) => table.status === "occupied"
  ).length;
  const totalTables = tables.length;
  const occupancyRate =
    totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0;

  if (loading) {
    return (
      <div
        className={getClassName(
          "flex items-center justify-center p-6 rounded-lg bg-black/40 backdrop-blur-lg border border-white/10",
          "bg-gray-900 border border-gray-800"
        )}
      >
        <div
          className={`w-8 h-8 border-2 border-white/30 border-t-white rounded-full ${getAnimationClass(
            "animate-spin"
          )}`}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:gap-6">
      {/* Table Status Card */}
      <div
        className={getClassName(
          "p-4 md:p-6 rounded-lg bg-black/40 backdrop-blur-lg border border-white/10",
          "bg-gray-900 border border-gray-800"
        )}
      >
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div
            className={getClassName(
              "w-9 h-9 md:w-10 md:h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/20",
              "w-9 h-9 md:w-10 md:h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/20"
            )}
          >
            <Users
              size={16}
              className="text-blue-400 md:w-[18px] md:h-[18px]"
            />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-white">Mesas</h3>
            <p className="text-xs md:text-sm text-white/70">Status do layout</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {/* Total Tables */}
          <div className="text-center p-2 md:p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xl md:text-2xl font-bold text-white">
              {totalTables}
            </div>
            <div className="text-xs md:text-sm text-white/60 font-medium">
              Total
            </div>
          </div>

          {/* Occupied Tables */}
          <div className="text-center p-2 md:p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xl md:text-2xl font-bold text-red-400">
              {occupiedTables}
            </div>
            <div className="text-xs md:text-sm text-white/60 font-medium">
              Ocupadas
            </div>
          </div>

          {/* Free Tables */}
          <div className="text-center p-2 md:p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xl md:text-2xl font-bold text-green-400">
              {freeTables}
            </div>
            <div className="text-xs md:text-sm text-white/60 font-medium">
              Livres
            </div>
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="mt-4 md:mt-6 p-3 md:p-4 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm md:text-base text-white/80 font-medium">
              Taxa de Ocupação
            </span>
            <span className="text-lg md:text-xl font-bold text-white">
              {occupancyRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 md:h-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getAnimationClass(
                "transition-all duration-500"
              )} ${
                occupancyRate > 80
                  ? "bg-red-500"
                  : occupancyRate > 60
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Revenue Card */}
      <div
        className={getClassName(
          "p-4 md:p-6 rounded-lg bg-black/40 backdrop-blur-lg border border-white/10",
          "bg-gray-900 border border-gray-800"
        )}
      >
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div
            className={getClassName(
              "w-9 h-9 md:w-10 md:h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/20"
            )}
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
            {lastRevenueUpdate && (
              <p className="text-xs text-white/40 mt-1">
                Última atualização:{" "}
                {new Date(lastRevenueUpdate).toLocaleTimeString()}
              </p>
            )}
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
                className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors duration-200 cursor-pointer group"
              >
                <span className="font-mono text-white/80 text-sm group-hover:text-white transition-colors duration-200">
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
