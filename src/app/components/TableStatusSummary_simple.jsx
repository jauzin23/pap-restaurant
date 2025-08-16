"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, DollarSign } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Query } from "appwrite";
import { DBRESTAURANTE, COL_TABLES, COL_ORDERS } from "@/lib/appwrite";

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

export default function TableStatusSummary() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);
  const [lastOrders, setLastOrders] = useState([]);

  const { databases, client } = useApp();

  // Buscar mesas
  const loadTables = useCallback(async () => {
    try {
      const response = await databases.listDocuments(
        DBRESTAURANTE,
        COL_TABLES,
        [Query.limit(100)]
      );
      setTables(response.documents);
      console.log("Mesas carregadas:", response.documents.length);
    } catch (err) {
      console.error("Erro ao carregar mesas:", err);
    }
    setLoading(false);
  }, [databases]);

  // Buscar faturação
  const loadRevenue = useCallback(async () => {
    try {
      const today = getTodayDateString();

      const response = await databases.listDocuments(
        DBRESTAURANTE,
        COL_ORDERS,
        [
          Query.equal("status", "pago"),
          Query.greaterThanEqual("criadoEm", `${today}T00:00:00.000Z`),
          Query.lessThan("criadoEm", `${today}T23:59:59.999Z`),
          Query.orderDesc("criadoEm"),
          Query.limit(20),
        ]
      );

      const orders = response.documents;
      const total = orders.reduce((sum, order) => sum + (order.total || 0), 0);

      setRevenue(total);
      setLastOrders(orders.slice(0, 3));
      console.log("Faturação carregada:", total, "€");
    } catch (err) {
      console.error("Erro ao carregar faturação:", err);
      setRevenue(0);
      setLastOrders([]);
    }
  }, [databases]);

  // Carregar dados iniciais
  useEffect(() => {
    loadTables();
    loadRevenue();
  }, [loadTables, loadRevenue]);

  // REAL-TIME simples para mesas
  useEffect(() => {
    if (!client) return;

    console.log("Configurando tempo real para mesas");
    const unsubscribe = client.subscribe(
      `databases.${DBRESTAURANTE}.collections.${COL_TABLES}.documents`,
      (response) => {
        console.log("Mesa atualizada:", response.payload?.tableNumber);
        loadTables(); // Recarregar mesas
      }
    );

    return () => unsubscribe();
  }, [client, loadTables]);

  // REAL-TIME simples para pedidos
  useEffect(() => {
    if (!client) return;

    console.log("Configurando tempo real para pedidos");
    const unsubscribe = client.subscribe(
      `databases.${DBRESTAURANTE}.collections.${COL_ORDERS}.documents`,
      (response) => {
        if (response.payload?.status === "pago") {
          console.log("Pedido pago - atualizando faturação");
          loadRevenue(); // Recarregar faturação
        }
      }
    );

    return () => unsubscribe();
  }, [client, loadRevenue]);

  // Calcular estatísticas das mesas
  const mesasLivres = tables.filter((table) => table.status === "free").length;
  const mesasOcupadas = tables.filter(
    (table) => table.status === "occupied"
  ).length;
  const totalMesas = tables.length;
  const percentagemOcupacao =
    totalMesas > 0 ? (mesasOcupadas / totalMesas) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 rounded-lg bg-black/40 backdrop-blur-lg border border-white/10">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:gap-6">
      {/* Card das Mesas */}
      <div className="p-4 md:p-6 rounded-lg bg-black/40 backdrop-blur-lg border border-white/10">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/20">
            <Users
              size={16}
              className="text-blue-400 md:w-[18px] md:h-[18px]"
            />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-white">Mesas</h3>
            <p className="text-xs md:text-sm text-white/70">Estado das mesas</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <div className="text-center p-2 md:p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xl md:text-2xl font-bold text-white">
              {totalMesas}
            </div>
            <div className="text-xs md:text-sm text-white/60 font-medium">
              Total
            </div>
          </div>
          <div className="text-center p-2 md:p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xl md:text-2xl font-bold text-red-400">
              {mesasOcupadas}
            </div>
            <div className="text-xs md:text-sm text-white/60 font-medium">
              Ocupadas
            </div>
          </div>
          <div className="text-center p-2 md:p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div className="text-xl md:text-2xl font-bold text-green-400">
              {mesasLivres}
            </div>
            <div className="text-xs md:text-sm text-white/60 font-medium">
              Livres
            </div>
          </div>
        </div>

        <div className="mt-4 md:mt-6 p-3 md:p-4 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm md:text-base text-white/80 font-medium">
              Taxa de Ocupação
            </span>
            <span className="text-lg md:text-xl font-bold text-white">
              {percentagemOcupacao.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 md:h-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentagemOcupacao > 80
                  ? "bg-red-500"
                  : percentagemOcupacao > 60
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{ width: `${percentagemOcupacao}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card da Faturação */}
      <div className="p-4 md:p-6 rounded-lg bg-black/40 backdrop-blur-lg border border-white/10">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/20">
            <DollarSign
              size={16}
              className="text-emerald-400 md:w-[18px] md:h-[18px]"
            />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-white">
              Faturação
            </h3>
            <p className="text-xs md:text-sm text-white/70">Vendas de hoje</p>
          </div>
        </div>

        <div className="mb-4 md:mb-6">
          <div className="flex flex-col items-center justify-center gap-1 md:gap-2">
            <div className="flex items-end gap-1 md:gap-2">
              <span className="text-xl md:text-2xl text-emerald-400 font-bold">
                €
              </span>
              <span className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-none">
                {revenue.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-sm text-white/60 mt-2 text-center font-medium">
              Pedidos pagos hoje
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10">
          <div className="mb-2 text-sm text-white/70 font-semibold">
            Últimos pedidos pagos
          </div>
          {lastOrders.length === 0 ? (
            <div className="text-sm text-white/50 italic">
              Nenhum pedido hoje
            </div>
          ) : (
            <div className="space-y-2">
              {lastOrders.map((order) => (
                <div
                  key={order.$id}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                >
                  <span className="font-mono text-white/80 text-sm">
                    #{order.$id.slice(-6)}
                  </span>
                  <span className="font-bold text-emerald-400 text-sm">
                    €{" "}
                    {(order.total || 0).toLocaleString("pt-PT", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
