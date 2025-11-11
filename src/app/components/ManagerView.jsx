"use client";

import React from "react";
import {
  MoreVertical,
  BarChart2,
  HandCoins,
  Logs,
  UserCircle,
  ExternalLink,
  Clock,
  Star,
  Grid,
  Edit,
  Package,
} from "lucide-react";
import { Avatars } from "appwrite";
import { useApp } from "@/contexts/AppContext";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import NumberFlow from "@number-flow/react";
import "./ManagerView.scss";
import { getImageUrl as getImageUrlHelper } from "../../lib/api";
import WeeklyRevenueChart from "./WeeklyRevenueChart";
import TableLayoutManager from "./TableLayout";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const ManagerView = ({
  expandedSections,
  toggleSection,
  staffUsers,
  username,
  userLabels,
  profileImg,
  randomColors,
  chartData,
  chartConfig,
  user, // Add user prop for table management
}) => {
  const { client } = useApp();
  const avatars = new Avatars(client);
  const { socket, connected } = useWebSocketContext();

  // State for table management view
  const [showTableManagement, setShowTableManagement] = React.useState(false);

  // State for real-time stats
  const [activeOrders, setActiveOrders] = React.useState(24);
  const [occupiedTables, setOccupiedTables] = React.useState({
    occupied: 18,
    total: 25,
  });
  const [todayReservations, setTodayReservations] = React.useState(32);
  const [dailyProfit, setDailyProfit] = React.useState(2.8);
  const [ordersServed, setOrdersServed] = React.useState(156);
  const [occupancyRate, setOccupancyRate] = React.useState(89);

  // Fetch initial stats
  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/orders/stats`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setActiveOrders(data.activeOrders || 24);
          setOccupiedTables(data.occupiedTables || { occupied: 18, total: 25 });
          setTodayReservations(data.todayReservations || 32);
          setDailyProfit(data.dailyProfit || 2.8);
          setOrdersServed(data.ordersServed || 156);
          setOccupancyRate(data.occupancyRate || 89);
        }
      } catch (error) {
        console.error("❌ Failed to fetch stats:", error);
      }
    };

    fetchStats();
  }, []);

  // WebSocket real-time updates
  React.useEffect(() => {
    if (!socket || !connected) return;

    console.log("🔌 ManagerView: Setting up WebSocket listeners");

    const handleOrderCreated = (order) => {
      console.log("📦 ManagerView: New order received", order);
      setActiveOrders((prev) => prev + 1);
      setOrdersServed((prev) => prev + 1);
    };

    const handleOrderUpdated = (order) => {
      console.log("📝 ManagerView: Order updated", order);
      // Recalculate stats based on order status changes
      if (order.status === "completo") {
        setActiveOrders((prev) => Math.max(0, prev - 1));
      }
    };

    const handleOrderDeleted = ({ id }) => {
      console.log("🗑️ ManagerView: Order deleted", id);
      setActiveOrders((prev) => Math.max(0, prev - 1));
    };

    const handleTableUpdated = (table) => {
      console.log("📍 ManagerView: Table updated", table);
      // Refresh occupancy stats when tables change
    };

    // Subscribe to events
    socket.on("order:created", handleOrderCreated);
    socket.on("order:updated", handleOrderUpdated);
    socket.on("order:deleted", handleOrderDeleted);
    socket.on("table:updated", handleTableUpdated);

    // Cleanup
    return () => {
      console.log("🔌 ManagerView: Cleaning up WebSocket listeners");
      socket.off("order:created", handleOrderCreated);
      socket.off("order:updated", handleOrderUpdated);
      socket.off("order:deleted", handleOrderDeleted);
      socket.off("table:updated", handleTableUpdated);
    };
  }, [socket, connected]);
  // Profile Image Component with fallback
  const ProfileImage = ({
    src,
    alt,
    className,
    size = 24,
    isCircular = false,
    userName,
  }) => {
    const [hasError, setHasError] = React.useState(false);

    // Generate Appwrite avatar fallback
    const getAppwriteAvatar = () => {
      if (!userName && !alt) return null;
      const name = userName || alt || "U";
      const avatarSize = typeof size === "number" ? size : 36;
      return avatars.getInitials(name, avatarSize, avatarSize);
    };

    // Handle custom API URLs for profile images
    const getImageUrl = (imageSrc) => {
      if (!imageSrc) return null;

      // If it's already a full URL, use it
      if (imageSrc.startsWith("http")) return imageSrc;

      // Use the helper to get S3 or API redirect URL
      return getImageUrlHelper("imagens-perfil", imageSrc);
    };

    const imageUrl = getImageUrl(src);
    const fallbackAvatar = getAppwriteAvatar();

    if (hasError || !imageUrl) {
      // Use Appwrite generated avatar as fallback
      if (fallbackAvatar) {
        return (
          <div
            className={`${className} ${
              isCircular ? "rounded-full" : "rounded-lg"
            } overflow-hidden`}
            style={{
              width: typeof size === "number" ? `${size}px` : size,
              height: typeof size === "number" ? `${size}px` : size,
            }}
          >
            <img
              src={fallbackAvatar}
              alt={alt}
              className="w-full h-full object-cover"
            />
          </div>
        );
      }

      // Ultimate fallback to icon
      return (
        <div
          className={`${className} flex items-center justify-center ${
            isCircular ? "rounded-full" : "rounded-lg"
          }`}
          style={{
            width: typeof size === "number" ? `${size}px` : size,
            height: typeof size === "number" ? `${size}px` : size,
            background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
          }}
        >
          <UserCircle
            size={typeof size === "number" ? Math.floor(size * 0.65) : 24}
            style={{ color: "#94a3b8" }}
          />
        </div>
      );
    }

    return (
      <div
        className={`${className} ${
          isCircular ? "rounded-full" : "rounded-lg"
        } overflow-hidden`}
        style={{
          width: typeof size === "number" ? `${size}px` : size,
          height: typeof size === "number" ? `${size}px` : size,
          backgroundColor: "#ffffff",
        }}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  };

  return (
    <div className="manager-view">
      {/* Section Header */}
      <div className="section-header">
        <h2 className="section-title">Análise de Desempenho</h2>
      </div>

      {/* Manager Dashboard Grid */}
      <div className="manager-dashboard-grid fade-in-delayed">
        <div className="center-section">
          <div className="progress-card card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <BarChart2 size={20} />
              </div>
              <div className="card-header-text">
                <h3>Receita Semanal</h3>
                <p>Últimos 7 dias</p>
              </div>
            </div>
            <WeeklyRevenueChart data={chartData} />
          </div>
        </div>
        <div className="right-section">
          <div className="time-tracker-card card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="card-header-text">
                <h3>Tempo Médio</h3>
                <p>Preparação de pedidos</p>
              </div>
            </div>
            <div className="time-circle">
              <svg viewBox="0 0 200 200" className="circle-svg">
                <defs>
                  <linearGradient
                    id="orangeGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#ff6b35" />
                    <stop offset="100%" stopColor="#ff8c5a" />
                  </linearGradient>
                </defs>
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="10"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  fill="none"
                  stroke="url(#orangeGradient)"
                  strokeWidth="10"
                  strokeDasharray="534"
                  strokeDashoffset="150"
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                />
              </svg>
              <div className="time-display">
                <div className="time">18min</div>
                <div className="time-label">Por Pedido</div>
              </div>
            </div>
          </div>

          <div className="onboarding-card card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Package size={20} />
              </div>
              <div className="card-header-text">
                <h3>Estado de Pedidos</h3>
                <p>
                  <NumberFlow value={activeOrders} /> ativos
                </p>
              </div>
            </div>
            <div className="onboarding-bars">
              <div className="progress-bar">
                <div className="bar-label">40%</div>
                <div className="bar-fill task"></div>
              </div>
              <div className="progress-bar">
                <div className="bar-label">35%</div>
                <div className="bar-fill progress"></div>
              </div>
              <div className="progress-bar">
                <div className="bar-label">25%</div>
                <div className="bar-fill incomplete"></div>
              </div>
            </div>
            <div className="legend">
              <span className="legend-item">
                <span className="dot task"></span> Pronto
              </span>
              <span className="legend-item">
                <span className="dot progress"></span> Preparando
              </span>
              <span className="legend-item">
                <span className="dot incomplete"></span> Pendente
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerView;
