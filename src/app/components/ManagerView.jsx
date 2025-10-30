"use client";

import React from "react";
import {
  MoreVertical,
  BarChart2,
  HandCoins,
  Logs,
  UserCircle,
  Users,
  ExternalLink,
  Clock,
  Star,
  Grid,
  Edit,
  Package,
  Wrench,
  Wallet,
} from "lucide-react";
import { Avatars } from "appwrite";
import { useApp } from "@/contexts/AppContext";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import NumberFlow from '@number-flow/react';
import "./ManagerView.scss";
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

      // For your custom API, construct the correct URL
      // Try different URL patterns based on your API endpoints
      if (imageSrc) {
        // First try the direct files endpoint
        const directUrl = `${API_BASE_URL}/files/imagens-perfil/${imageSrc}`;

        // For compatibility, also try the preview endpoint
        const previewUrl = `${API_BASE_URL}/v1/storage/buckets/user-images/files/${imageSrc}/preview`;

        // Return the direct URL first (this should work based on your API)
        return directUrl;
      }

      return imageSrc;
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
      {/* Stats Bar */}
      <div className="stats-bar fade-in-delayed">
        {[
          {
            label: "Pedidos Ativos",
            value: String(activeOrders),
            type: "active",
          },
          {
            label: "Mesas Ocupadas",
            value: `${occupiedTables.occupied}/${occupiedTables.total}`,
            type: "highlight",
          },
          {
            label: "Reservas Hoje",
            value: String(todayReservations),
            type: "",
          },
        ].map((stat, index) => (
          <div key={index} className="stat-item scale-innow ">
            <span className="stat-label">{stat.label}</span>
            <button className={`stat-btn hover-button ${stat.type}`}>
              <NumberFlow value={parseFloat(stat.value) || 0} />
            </button>
          </div>
        ))}
        <div className="summary-stats fade-in-delayed">
          {[
            {
              icon: HandCoins,
              value: String(dailyProfit),
              unit: "K",
              label: "Profit Diário",
            },
            {
              icon: Logs,
              value: String(ordersServed),
              unit: "",
              label: "Pedidos Atendidos",
            },
            {
              icon: BarChart2,
              value: String(occupancyRate),
              unit: "%",
              label: "Ocupação",
            },
          ].map((item, index) => (
            <div key={index} className="summary-item slide-in-left">
              <div className="summary-icon-value-col">
                <div className="summary-icon-value-row">
                  <span className="summary-icon">
                    <item.icon size={12} />
                  </span>
                  <span className="summary-number">
                    <NumberFlow value={parseFloat(item.value) || 0} />
                    {item.unit && (
                      <span className="summary-unit">{item.unit}</span>
                    )}
                  </span>
                </div>
                <span className="summary-label left-align">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manager Dashboard Grid */}
      <div className="manager-dashboard-grid fade-in-delayed">
        <div className="left-section slide-in-left">
          <button
            className="nav-card-btn"
            onClick={() => window.open("/stock", "_blank")}
          >
            <span className="nav-card-text">Equipamentos</span>
            <Wrench size={48} className="nav-card-icon" />
          </button>

          <button
            className="nav-card-btn"
            onClick={() => window.open("/staff-management", "_blank")}
          >
            <span className="nav-card-text">Gestão de Staff</span>
            <Users size={48} className="nav-card-icon" />
          </button>

          <button
            className="nav-card-btn"
            onClick={() => window.open("/dash2", "_blank")}
          >
            <span className="nav-card-text">Resumo Financeiro</span>
            <Wallet size={48} className="nav-card-icon" />
          </button>
        </div>

        <div className="center-section">
          <div className="progress-card card">
            <WeeklyRevenueChart data={chartData} />
          </div>

          <div className="calendar-section">
            <div className="calendar-header">
              <div className="month">Agosto</div>
              <div className="month current">Setembro 2024</div>
              <div className="month">Outubro</div>
            </div>
            <div className="calendar-days">
              <div className="day-column">
                <div className="day-header">Seg</div>
                <div className="day-number">22</div>
              </div>
              <div className="day-column">
                <div className="day-header">Ter</div>
                <div className="day-number">23</div>
              </div>
              <div className="day-column">
                <div className="day-header">Qua</div>
                <div className="day-number">24</div>
              </div>
              <div className="day-column">
                <div className="day-header">Qui</div>
                <div className="day-number">25</div>
              </div>
              <div className="day-column">
                <div className="day-header">Sex</div>
                <div className="day-number">26</div>
              </div>
              <div className="day-column">
                <div className="day-header">Sáb</div>
                <div className="day-number">27</div>
              </div>
            </div>

            <div className="calendar-events">
              <div className="event-time">12:00</div>
              <div className="event-card team-sync">
                <div className="event-title">Almoço - Reserva Grupo</div>
                <div className="event-subtitle">Mesa 12-15 • 16 pessoas</div>
                <div className="event-avatars">
                  <div className="avatar"></div>
                  <div className="avatar"></div>
                  <div className="avatar"></div>
                </div>
              </div>
              <div className="event-time">14:30</div>
              <div className="event-time">16:00</div>
              <div className="event-card onboarding">
                <div className="event-title">Reunião de Fornecedores</div>
                <div className="event-subtitle">Novos produtos da época</div>
                <div className="event-avatars">
                  <div className="avatar"></div>
                  <div className="avatar"></div>
                </div>
              </div>
              <div className="event-time">19:30</div>
              <div className="event-card dinner">
                <div className="event-title">Jantar VIP</div>
                <div className="event-subtitle">
                  Mesa reservada • Menu degustação
                </div>
                <div className="event-avatars">
                  <div className="avatar"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="right-section">
          <div className="time-tracker-card card">
            <div className="card-header">
              <h3>Tempo Médio</h3>
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
            <div className="card-header">
              <h3>Pedidos</h3>
              <span className="percentage">{activeOrders}</span>
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
