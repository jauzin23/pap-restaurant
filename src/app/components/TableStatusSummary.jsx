"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, CheckCircle, Clock } from "lucide-react";
import { databases, client } from "@/lib/appwrite";
import { Query } from "appwrite";

const DATABASE_ID = "689c9a200025de0e8af2";
const TABLES_COLLECTION_ID = "689c9a26000b5abf71c8";

export default function TableStatusSummary() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTables();

    // Setup realtime subscription for table status changes
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

    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

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

  const freeTables = tables.filter((table) => table.status === "free").length;
  const occupiedTables = tables.filter(
    (table) => table.status === "occupied"
  ).length;
  const totalTables = tables.length;
  const occupancyRate =
    totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0;

  if (loading) {
    return (
      <div className="bg-neutral-950 rounded-xl border border-neutral-800 shadow-2xl p-8 md:p-10 m-12">
        <div className="animate-pulse">
          <div className="h-4 bg-neutral-800 rounded w-3/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-neutral-800 rounded"></div>
            <div className="h-8 bg-neutral-800 rounded"></div>
            <div className="h-8 bg-neutral-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-neutral-950 rounded-xl border border-neutral-800 shadow-2xl p-6 m-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center border border-neutral-700">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Status das Mesas</h3>
            <p className="text-sm text-neutral-400">
              Estado atual do restaurante
            </p>
          </div>
        </div>

        {/* Quick Status Indicator */}
        {totalTables > 0 && (
          <div className="text-right">
            <p className="text-xs text-neutral-400 mb-1">Estado Geral</p>
            <p
              className={`text-sm font-medium ${
                occupancyRate > 80
                  ? "text-red-400"
                  : occupancyRate > 50
                  ? "text-yellow-400"
                  : "text-green-400"
              }`}
            >
              {occupancyRate > 80
                ? "🔴 Muito ocupado"
                : occupancyRate > 50
                ? "🟡 Moderadamente ocupado"
                : "🟢 Disponível"}
            </p>
          </div>
        )}
      </div>

      {totalTables === 0 ? (
        <div className="text-center py-8">
          <p className="text-neutral-400">Nenhuma mesa configurada</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Summary Cards - Horizontal Layout */}
          <div className="flex gap-4">
            <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800 min-w-[120px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400">Total</p>
                  <p className="text-2xl font-bold text-white">{totalTables}</p>
                </div>
                <Users size={20} className="text-neutral-400" />
              </div>
            </div>

            <div className="bg-green-950/50 rounded-lg p-4 border border-green-800/50 min-w-[120px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-400">Livres</p>
                  <p className="text-2xl font-bold text-green-300">
                    {freeTables}
                  </p>
                </div>
                <CheckCircle size={20} className="text-green-400" />
              </div>
            </div>

            <div className="bg-red-950/50 rounded-lg p-4 border border-red-800/50 min-w-[120px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-400">Ocupadas</p>
                  <p className="text-2xl font-bold text-red-300">
                    {occupiedTables}
                  </p>
                </div>
                <Clock size={20} className="text-red-400" />
              </div>
            </div>
          </div>

          {/* Occupancy Rate - Horizontal */}
          <div className="flex-1 bg-neutral-900 rounded-lg p-4 border border-neutral-800 ml-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-neutral-300">
                Taxa de Ocupação
              </span>
              <span className="text-lg font-bold text-white">
                {occupancyRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-neutral-800 rounded-full h-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${occupancyRate}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-3 rounded-full ${
                  occupancyRate > 80
                    ? "bg-red-500"
                    : occupancyRate > 50
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
