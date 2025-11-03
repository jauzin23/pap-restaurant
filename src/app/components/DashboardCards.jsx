"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  HandCoins,
  ShoppingCart,
  Calendar,
  Star,
} from "lucide-react";
import NumberFlow from "@number-flow/react";
import "./DashboardCards.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const DashboardCards = () => {
  const [metrics, setMetrics] = useState({
    dailyRevenue: 2450.75,
    monthlyRevenue: 42500.0,
    activeOrders: 12,
    todayReservations: 8,
  });

  // Fetch real data from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/orders/stats`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setMetrics({
            dailyRevenue: data.dailyRevenue || 2450.75,
            monthlyRevenue: data.monthlyRevenue || 42500.0,
            activeOrders: data.activeOrders || 12,
            todayReservations: data.todayReservations || 8,
          });
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    {
      id: "daily-revenue",
      title: "Lucro Diário",
      value: metrics.dailyRevenue,
      format: "currency",
      icon: HandCoins,
      color: "#4e73df",
      textColor: "#4e73df",
    },
    {
      id: "monthly-revenue",
      title: "Lucro Mensal",
      value: metrics.monthlyRevenue,
      format: "currency",
      icon: TrendingUp,
      color: "#1cc88a",
      textColor: "#1cc88a",
    },
    {
      id: "active-orders",
      title: "Pedidos Ativos",
      value: metrics.activeOrders,
      format: "number",
      icon: ShoppingCart,
      color: "#36b9cc",
      textColor: "#36b9cc",
    },
    {
      id: "today-reservations",
      title: "Reservas Hoje",
      value: metrics.todayReservations,
      format: "number",
      icon: Calendar,
      color: "#f6c23e",
      textColor: "#f6c23e",
    },
  ];

  return (
    <div className="">
      <h2 className="dashboard-cards__title">Estatística</h2>
      <div className="dashboard-cards">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="metric-card"
              style={{ animationDelay: `${0.2 + index * 0.1}s` }}
            >
              <div className="metric-card__header">
                <div
                  className="metric-card__icon-wrapper"
                  style={{ backgroundColor: `${card.color}15` }}
                >
                  <Icon
                    size={24}
                    strokeWidth={2}
                    style={{ color: card.color }}
                  />
                </div>
              </div>
              <div className="metric-card__content">
                <div className="metric-card__title">{card.title}</div>
                <div className="metric-card__value">
                  <NumberFlow
                    value={card.value}
                    format={{
                      minimumFractionDigits: card.format === "currency" ? 2 : 0,
                      maximumFractionDigits: card.format === "currency" ? 2 : 0,
                    }}
                    locales="pt-PT"
                  />
                  {card.format === "currency" && "€"}
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
