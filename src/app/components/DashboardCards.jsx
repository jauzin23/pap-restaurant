"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import {
  TrendingUp,
  HandCoins,
  ShoppingCart,
  Calendar,
  Star,
  ChefHat,
  Euro,
  Package,
  Clock,
  Activity,
} from "lucide-react";
import NumberFlow from "@number-flow/react";
import "./DashboardCards.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const DashboardCards = ({ customMetrics = null, showAllMetrics = false }) => {
  const [metrics, setMetrics] = useState({
    dailyRevenue: 2450.75,
    monthlyRevenue: 42500.0,
    activeOrders: 12,
    todayReservations: 8,
    kitchenEfficiency: null,
    workedHours: null,
  });

  const [isMounted, setIsMounted] = useState(false);

  // Track if this is the first render to prevent NumberFlow animation conflicts
  const firstRenderRef = useRef(true);

  // Fetch real data from API (only if customMetrics not provided)
  const { socket, connected } = useWebSocketContext();

  const fetchStats = useCallback(async () => {
    if (customMetrics) {
      setMetrics(customMetrics);
      return;
    }
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.warn("No auth token found");
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      const todayStart = `${today} 00:00:00`;
      const todayEnd = `${today} 23:59:59`;
      const [statsResponse, workedHoursResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/stats/live`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(
          `${API_BASE_URL}/api/presencas/resumo?date_from=${encodeURIComponent(
            todayStart
          )}&date_to=${encodeURIComponent(todayEnd)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        ),
      ]);
      let workedHours = null;
      if (workedHoursResponse.ok) {
        const workedData = await workedHoursResponse.json();
        workedHours = workedData.resumo?.total_horas || 0;
      }
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setMetrics({
          dailyRevenue: data.current?.revenue_today || 0,
          monthlyRevenue: data.current?.revenue_month || 0,
          activeOrders: data.current?.orders_in_progress || 0,
          todayReservations: data.current?.orders_today || 0,
          kitchenEfficiency: null,
          workedHours: workedHours,
        });
      } else {
        console.error("Stats API response not OK:", statsResponse.status);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    }
  }, [customMetrics]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Delay NumberFlow animation to prevent conflicts with loading screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      firstRenderRef.current = false;
    }, 800); // Wait longer for loading screen to fully fade out
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;
    const refreshEvents = [
      "order:paid",
      "order:created",
      "order:updated",
      "order:deleted",
    ];
    refreshEvents.forEach((event) => {
      socket.on(event, fetchStats);
    });
    return () => {
      refreshEvents.forEach((event) => {
        socket.off(event, fetchStats);
      });
    };
  }, [socket, connected, fetchStats]);

  const allCards = [
    {
      id: "daily-revenue",
      title: "Lucro Diário",
      value: metrics.dailyRevenue,
      format: "currency",
      icon: HandCoins,
      color: "#4e73df",
      textColor: "#4e73df",
      gradient: "linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%)",
      showInBasic: true,
    },
    {
      id: "monthly-revenue",
      title: "Lucro Mensal",
      value: metrics.monthlyRevenue,
      format: "currency",
      icon: TrendingUp,
      color: "#1cc88a",
      textColor: "#1cc88a",
      gradient: "linear-gradient(135deg, #1cc88a 0%, #28e89f 100%)",
      showInBasic: true,
    },
    {
      id: "active-orders",
      title: "Pedidos Ativos",
      value: metrics.activeOrders,
      format: "number",
      icon: ShoppingCart,
      color: "#36b9cc",
      textColor: "#36b9cc",
      gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
      showInBasic: true,
    },
    {
      id: "today-reservations",
      title: "Pedidos Hoje",
      value: metrics.todayReservations,
      format: "number",
      icon: Calendar,
      color: "#f6c23e",
      textColor: "#f6c23e",
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      showInBasic: true,
    },
    {
      id: "kitchen-efficiency",
      title: "Tempo Médio",
      subtitle: "minutos",
      value: metrics.kitchenEfficiency?.avg_total_time,
      format: "time",
      icon: Clock,
      color: "#a6c1ee",
      textColor: "#a6c1ee",
      gradient: "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)",
      showInBasic: false,
      hideIfNull: true,
    },
    {
      id: "worked-hours",
      title: "Horas Trabalhadas",
      subtitle: "hoje",
      value: metrics.workedHours,
      format: "hours",
      icon: Activity,
      color: "#10b981",
      textColor: "#10b981",
      gradient: "linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)",
      showInBasic: true,
      hideIfNull: true,
    },
  ];

  const cards = showAllMetrics
    ? allCards.filter((card) => !card.hideIfNull || card.value != null)
    : allCards.filter(
        (card) => card.showInBasic && (!card.hideIfNull || card.value != null)
      );

  return (
    <div className="dashboard-cards-wrapper">
      <div
        className="dashboard-cards"
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "nowrap",
          width: "100%",
        }}
      >
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="metric-card"
              style={{
                flex: "1 1 0",
                minWidth: "0",
              }}
            >
              <div className="metric-card__header">
                <div className="metric-card__icon-wrapper">
                  <Icon
                    size={24}
                    strokeWidth={2}
                    style={{
                      color: card.color,
                    }}
                  />
                </div>
              </div>
              <div className="metric-card__content">
                <div className="metric-card__title">{card.title}</div>
                <div className="metric-card__value">
                  <NumberFlow
                    key={`numberflow-${card.id}`}
                    value={isMounted ? card.value || 0 : 0}
                    format={{
                      minimumFractionDigits:
                        card.format === "currency" || card.format === "time"
                          ? 1
                          : 0,
                      maximumFractionDigits:
                        card.format === "currency" || card.format === "time"
                          ? 1
                          : 0,
                    }}
                    locales="pt-PT"
                  />
                  {card.format === "currency" && "€"}
                  {card.format === "percentage" && "%"}
                  {card.format === "time" && (
                    <span
                      style={{
                        fontSize: "0.6em",
                        marginLeft: "4px",
                        color: "#94a3b8",
                      }}
                    >
                      min
                    </span>
                  )}
                  {card.format === "hours" && (
                    <span
                      style={{
                        fontSize: "0.6em",
                        marginLeft: "4px",
                        color: "#94a3b8",
                      }}
                    >
                      h
                    </span>
                  )}
                </div>
              </div>
              <div className="metric-card__footer"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardCards;
