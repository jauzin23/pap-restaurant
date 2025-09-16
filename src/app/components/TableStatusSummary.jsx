"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, DollarSign, RefreshCw, AlertCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Query } from "appwrite";
import { DBRESTAURANTE, COL_TABLES, COL_ORDERS } from "@/lib/appwrite";
import CountUp from "./CountUp";
import "./table-status-summary-redesigned.scss";

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

    const unsubscribe = client.subscribe(
      `databases.${DBRESTAURANTE}.collections.${COL_TABLES}.documents`,
      (response) => {
        loadTables(); // Recarregar mesas
      }
    );

    return () => unsubscribe();
  }, [client, loadTables]);

  // REAL-TIME simples para pedidos
  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.subscribe(
      `databases.${DBRESTAURANTE}.collections.${COL_ORDERS}.documents`,
      (response) => {
        if (response.payload?.status === "pago") {
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
      <div className="table-status-summary-redesigned">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <div className="loading-text">Carregando dados...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="table-status-summary-redesigned">
      <div className="section-header">
        <Users className="header-icon" size={18} />
        <h3 className="header-title">Status das Mesas & Faturação</h3>
        <button
          onClick={() => {
            loadTables();
            loadRevenue();
          }}
          className="refresh-btn"
          disabled={loading}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tables Grid */}
      <div className="table-grid">
        {tables.slice(0, 12).map((table) => (
          <div
            key={table.$id}
            className={`table-card ${
              table.status === "free"
                ? "available"
                : table.status === "occupied"
                ? "occupied"
                : "reserved"
            }`}
          >
            <div className="table-number">
              Mesa {table.numero || table.number}
            </div>
            <div className="table-status">
              {table.status === "free"
                ? "Livre"
                : table.status === "occupied"
                ? "Ocupada"
                : "Reservada"}
            </div>
            <div className="table-capacity">{table.capacity || 4} lugares</div>
          </div>
        ))}
      </div>

      {/* Status Summary */}
      <div className="status-summary">
        <div className="status-item available">
          <div className="status-count">{mesasLivres}</div>
          <div className="status-label">Livres</div>
        </div>
        <div className="divider"></div>
        <div className="status-item occupied">
          <div className="status-count">{mesasOcupadas}</div>
          <div className="status-label">Ocupadas</div>
        </div>
        <div className="divider"></div>
        <div className="status-item">
          <div className="status-count">€{revenue.toFixed(2)}</div>
          <div className="status-label">Hoje</div>
        </div>
        <div className="divider"></div>
        <div className="status-item">
          <div className="status-count">{percentagemOcupacao.toFixed(0)}%</div>
          <div className="status-label">Ocupação</div>
        </div>
      </div>
    </div>
  );
}
