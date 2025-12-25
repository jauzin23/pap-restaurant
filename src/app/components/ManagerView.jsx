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
  TrendingUp,
  TrendingDown,
  Euro,
  Users,
  ShoppingCart,
  ChefHat,
  Utensils,
  PieChart,
  Activity,
  Calendar,
  Receipt,
  ShoppingBag,
  Coffee,
  X,
  ImageIcon,
} from "lucide-react";
import { Avatars } from "appwrite";
import { useApp } from "@/contexts/AppContext";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import { useStatsWebSocket } from "@/hooks/useStatsWebSocket";
import NumberFlow from "@number-flow/react";
import { Select } from "antd";
import { createPortal } from "react-dom";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import "./ManagerView.scss";
import { getImageUrl as getImageUrlHelper, getImageUrl } from "../../lib/api";
import TableLayoutManager from "./TableLayout";
import DashboardCards from "./DashboardCards";

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
  onLoaded,
}) => {
  const { client } = useApp();
  const avatars = new Avatars(client);
  const { socket, connected } = useWebSocketContext();

  // Use WebSocket hook for real-time stats
  const {
    liveStats,
    staffStats,
    topItems: topItemsData,
    kitchenStats,
    loading: statsLoading,
  } = useStatsWebSocket();

  // State for table management view
  const [showTableManagement, setShowTableManagement] = React.useState(false);

  // State for real-time stats
  const [monthlyRevenue, setMonthlyRevenue] = React.useState(0);

  // Statistics data states
  const [topSellingItems, setTopSellingItems] = React.useState([]);
  const [categoryPerformance, setCategoryPerformance] = React.useState([]);
  const [hourlyRevenue, setHourlyRevenue] = React.useState([]);
  const [staffPerformance, setStaffPerformance] = React.useState([]);
  const [revenueOverview, setRevenueOverview] = React.useState(null);
  const [weeklyPattern, setWeeklyPattern] = React.useState([]);
  const [monthlyPattern, setMonthlyPattern] = React.useState([]);
  const [availableMonths, setAvailableMonths] = React.useState([]);
  const [selectedMonth, setSelectedMonth] = React.useState("");
  const [availableWeeks, setAvailableWeeks] = React.useState([]);
  const [selectedWeek, setSelectedWeek] = React.useState(0);
  const [avgBillData, setAvgBillData] = React.useState(null);
  const [kitchenEfficiency, setKitchenEfficiency] = React.useState(null);
  const [latestOrders, setLatestOrders] = React.useState([]);
  const [selectedOrder, setSelectedOrder] = React.useState(null);
  const [orderModalVisible, setOrderModalVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [staffData, setStaffData] = React.useState([]);
  const [staffLoading, setStaffLoading] = React.useState(true);

  // Track all loading states to ensure onLoaded is called only when everything is ready
  const [allDataLoaded, setAllDataLoaded] = React.useState(false);

  // Track if onLoaded has been called to prevent multiple calls
  const onLoadedCalled = React.useRef(false);

  // Fetch latest orders function
  const fetchLatestOrders = React.useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/stats/latest-orders?limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data?.orders) {
          setLatestOrders(data.orders);
        }
      }
    } catch (error) {
      console.error("Failed to fetch latest orders:", error);
    }
  }, []);

  // Fetch staff attendance data
  const fetchStaffData = React.useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setStaffLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const usersArray = data?.users || data || [];

        // For each user, fetch their latest clock-in time if they're working
        const transformedStaff = await Promise.all(
          usersArray.map(async (user) => {
            let clockInTime = null;

            if (user.is_working) {
              try {
                const presencaResponse = await fetch(
                  `${API_BASE_URL}/api/presencas/user/${user.id}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                if (presencaResponse.ok) {
                  const presencaData = await presencaResponse.json();
                  const latestEntrada = presencaData.presencas?.find(
                    (p) => p.tipo_acao === "entrada"
                  );
                  if (latestEntrada) {
                    clockInTime = latestEntrada.timestamp;
                  }
                }
              } catch (err) {
                console.error("Error fetching presenca for user:", err);
              }
            }

            return {
              id: user.id,
              name: user.name || user.username || "Sem Nome",
              role: user.labels?.[0] || "staff",
              profile_image: user.profile_image
                ? getImageUrlHelper("imagens-perfil", user.profile_image)
                : "",
              status: user.is_working ? "online" : "offline",
              isWorking: user.is_working || false,
              clockInTime: clockInTime,
            };
          })
        );

        setStaffData(transformedStaff);
      }
    } catch (error) {
      console.error("Failed to fetch staff data:", error);
    } finally {
      setStaffLoading(false);
    }
  }, []);

  // Initial data fetch
  React.useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  // WebSocket listeners for real-time updates
  React.useEffect(() => {
    if (!socket || !connected) return;

    const handleTakeawayCompleted = () => {
      fetchLatestOrders();
    };

    const handleStatsUpdated = () => {
      fetchLatestOrders();
    };

    const handlePresencaRegistada = (data) => {
      fetchStaffData();
    };

    socket.on("takeaway:completed", handleTakeawayCompleted);
    socket.on("stats:updated", handleStatsUpdated);
    socket.on("presenca:registada", handlePresencaRegistada);

    return () => {
      socket.off("takeaway:completed", handleTakeawayCompleted);
      socket.off("stats:updated", handleStatsUpdated);
      socket.off("presenca:registada", handlePresencaRegistada);
    };
  }, [socket, connected, fetchLatestOrders, fetchStaffData]);

  // Update states when WebSocket data arrives
  React.useEffect(() => {
    if (liveStats?.current) {
      setMonthlyRevenue(liveStats.current.revenue_month || 0);
    }
  }, [liveStats]);

  React.useEffect(() => {
    if (staffStats?.staff) {
      setStaffPerformance(
        staffStats.staff.slice(0, 5).map((s) => ({
          user_id: s.user_id,
          name: s.name.split(" ")[0],
          fullName: s.name,
          profile_image: s.profile_image,
          orders: s.orders_handled,
          prepared: s.orders_prepared,
          delivered: s.orders_delivered,
        }))
      );
    }
  }, [staffStats]);

  React.useEffect(() => {
    if (topItemsData?.items) {
      setTopSellingItems(
        topItemsData.items.slice(0, 5).map((item) => ({
          nome: item.item_name,
          vendido: item.times_sold,
          receita: item.total_revenue,
          image_url: item.image_url,
        }))
      );
    }
  }, [topItemsData]);

  React.useEffect(() => {
    if (kitchenStats?.response_times) {
      setKitchenEfficiency(kitchenStats.response_times);
    }
  }, [kitchenStats]);

  // Comprehensive loading check - ensure all data is loaded before calling onLoaded
  React.useEffect(() => {
    // Check if all required data has been loaded
    const isAllDataReady =
      !statsLoading && // WebSocket stats are loaded
      !staffLoading && // Staff data is loaded
      latestOrders.length >= 0 && // Orders have been attempted (even if empty)
      categoryPerformance.length >= 0 && // Categories attempted
      hourlyRevenue.length >= 0 && // Hourly data attempted
      weeklyPattern.length >= 0; // Weekly pattern attempted

    if (isAllDataReady && !allDataLoaded) {
      setAllDataLoaded(true);
    }
  }, [
    statsLoading,
    staffLoading,
    latestOrders.length,
    categoryPerformance.length,
    hourlyRevenue.length,
    weeklyPattern.length,
    allDataLoaded,
  ]);

  // Call onLoaded only when all data is truly loaded
  React.useEffect(() => {
    if (allDataLoaded && onLoaded && !onLoadedCalled.current) {
      onLoadedCalled.current = true;
      onLoaded();
    }
  }, [allDataLoaded, onLoaded]);

  // Fetch remaining statistics (not covered by WebSocket yet)
  React.useEffect(() => {
    const fetchRemainingStats = async () => {
      // Don't set loading=true during initial load - global loading handles this
      // Only set loading=true for refresh cycles
      if (onLoadedCalled.current) {
        setLoading(true);
      }
      const token = localStorage.getItem("auth_token");

      if (!token) {
        console.error("No authentication token found");
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [
          categories,
          hourly,
          revenue,
          weekly,
          kitchen,
          months,
          weeks,
          avgBill,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/stats/categories/performance`, {
            headers,
          }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API_BASE_URL}/stats/time/hourly`, { headers }).then((r) =>
            r.ok ? r.json() : null
          ),
          fetch(`${API_BASE_URL}/stats/revenue/overview`, { headers }).then(
            (r) => (r.ok ? r.json() : null)
          ),
          fetch(
            `${API_BASE_URL}/stats/time/weekly-pattern?week=${selectedWeek}`,
            {
              headers,
            }
          ).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API_BASE_URL}/stats/operations/tempo-medio-resposta`, {
            headers,
          }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API_BASE_URL}/stats/time/available-months`, {
            headers,
          }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API_BASE_URL}/stats/time/available-weeks`, {
            headers,
          }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API_BASE_URL}/stats/customers/avg-bill`, {
            headers,
          }).then((r) => (r.ok ? r.json() : null)),
        ]);

        // Update chart data
        if (categories?.categories) {
          setCategoryPerformance(
            categories.categories.map((cat) => ({
              name: cat.category,
              value: cat.total_revenue,
              percentage: cat.percentage_of_revenue,
            }))
          );
        }

        if (hourly?.hourly_data) {
          setHourlyRevenue(
            hourly.hourly_data.map((h) => ({
              hora: `${h.hour}:00`,
              receita: h.revenue,
              pedidos: h.orders_count,
            }))
          );
        }

        if (revenue) {
          setRevenueOverview(revenue);
        }

        if (weekly?.days) {
          const dayMap = {
            Seg: "Segunda-feira",
            Ter: "Terça-feira",
            Qua: "Quarta-feira",
            Qui: "Quinta-feira",
            Sex: "Sexta-feira",
            Sáb: "Sábado",
            Dom: "Domingo",
          };
          setWeeklyPattern(
            weekly.days.map((d) => ({
              dia: d.day,
              diaCompleto: dayMap[d.day] || d.day,
              receita: d.revenue,
              receitaTakeaway: d.takeaway_revenue || 0,
              receitaPresencial: d.dinein_revenue || 0,
              pedidos: d.orders,
              itemsVendidos: d.items_sold || 0,
            }))
          );
        }

        if (kitchen?.response_times) {
          setKitchenEfficiency(kitchen.response_times);
        }

        if (months?.months) {
          setAvailableMonths(months.months);
          // Set current month as default
          if (months.months.length > 0 && !selectedMonth) {
            setSelectedMonth(months.months[0].value);
          }
        }

        if (weeks?.weeks) {
          setAvailableWeeks(weeks.weeks);
        }

        if (avgBill) {
          setAvgBillData(avgBill);
        }

        // Fetch latest orders
        await fetchLatestOrders();
      } catch (error) {
        console.error("❌ Failed to fetch statistics:", error);
      } finally {
        setLoading(false);
        // onLoaded is now handled comprehensively in a separate useEffect
      }
    };

    fetchRemainingStats();
    // Refresh every 5 minutes (WebSocket handles real-time updates)
    const interval = setInterval(fetchRemainingStats, 300000);
    return () => clearInterval(interval);
  }, [fetchLatestOrders]);

  // Fetch weekly pattern when selected week changes
  React.useEffect(() => {
    const fetchWeeklyPattern = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      try {
        const weekly = await fetch(
          `${API_BASE_URL}/stats/time/weekly-pattern?week=${selectedWeek}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then((r) => (r.ok ? r.json() : null));

        if (weekly?.days) {
          const dayMap = {
            Seg: "Segunda-feira",
            Ter: "Terça-feira",
            Qua: "Quarta-feira",
            Qui: "Quinta-feira",
            Sex: "Sexta-feira",
            Sáb: "Sábado",
            Dom: "Domingo",
          };
          setWeeklyPattern(
            weekly.days.map((d) => ({
              dia: d.day,
              diaCompleto: dayMap[d.day] || d.day,
              receita: d.revenue,
              receitaTakeaway: d.takeaway_revenue || 0,
              receitaPresencial: d.dinein_revenue || 0,
              pedidos: d.orders,
              itemsVendidos: d.items_sold || 0,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch weekly pattern:", error);
      }
    };

    fetchWeeklyPattern();
  }, [selectedWeek]);

  // Fetch monthly pattern when selected month changes
  React.useEffect(() => {
    if (!selectedMonth) return;

    const fetchMonthlyPattern = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      try {
        const response = await fetch(
          `${API_BASE_URL}/stats/time/monthly-pattern?month=${selectedMonth}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data?.days) {
            setMonthlyPattern(
              data.days.map((d) => ({
                dia: d.day,
                receita: d.revenue,
                receitaTakeaway: d.takeaway_revenue || 0,
                receitaPresencial: d.dinein_revenue || 0,
                pedidos: d.orders,
                ticketMedio: d.avg_order_value,
              }))
            );
          }
        }
      } catch (error) {
        console.error("❌ Failed to fetch monthly pattern:", error);
      }
    };

    fetchMonthlyPattern();
  }, [selectedMonth]);

  // Chart colors
  const COLORS = ["#3498DB", "#2980B9", "#1F4E79", "#154360", "#0B2630"];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => {
            const isInteger =
              entry.name === "Pedidos" || entry.dataKey === "count";
            return (
              <p
                key={index}
                className="tooltip-item"
                style={{ color: entry.color }}
              >
                {entry.name}:{" "}
                <strong>
                  {typeof entry.value === "number" && entry.value !== null
                    ? isInteger
                      ? Math.round(entry.value)
                      : entry.value.toFixed(2)
                    : entry.value || "0"}
                </strong>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

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

  // Work Duration Display Component
  const WorkDuration = ({ clockInTime }) => {
    const [duration, setDuration] = React.useState("");

    React.useEffect(() => {
      if (!clockInTime) return;

      const updateDuration = () => {
        const start = new Date(clockInTime);
        const now = new Date();
        const diff = now - start;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setDuration(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
            2,
            "0"
          )}:${String(seconds).padStart(2, "0")}`
        );
      };

      updateDuration();
      const interval = setInterval(updateDuration, 1000);

      return () => clearInterval(interval);
    }, [clockInTime]);

    return <span className="work-duration">{duration}</span>;
  };

  return (
    <div className="manager-view">
      {/* Section Header */}
      <div className="manager-section-header">
        <div className="header-title-group">
          <h1>Painel de Gestão</h1>
          <p>Análise de desempenho e estatísticas do restaurante</p>
        </div>
      </div>

      {/* Dashboard Cards */}
      <DashboardCards showAllMetrics={true} />

      {/* Online Staff Card */}
      <div className="card chart-card online-staff-card">
        <div className="card-header-modern">
          <div className="card-icon-wrapper">
            <Users size={20} />
          </div>
          <div className="card-header-text">
            <h3>Equipa Online</h3>
            <p>
              {staffData.filter((s) => s.status === "online").length} de{" "}
              {staffData.length} funcionários
            </p>
          </div>
        </div>

        <div className="online-staff-list">
          {staffData.filter((s) => s.status === "online").length === 0 ? (
            <div className="empty-state">
              <Users size={48} color="#94a3b8" />
              <p>Nenhum funcionário online no momento</p>
            </div>
          ) : (
            staffData
              .filter((s) => s.status === "online")
              .map((staff) => (
                <div key={staff.id} className="online-staff-item">
                  <div className="staff-card-inner">
                    <div className="staff-avatar-wrapper">
                      {staff.profile_image ? (
                        <img
                          src={staff.profile_image}
                          alt={staff.name}
                          className="staff-avatar"
                        />
                      ) : (
                        <div className="staff-avatar staff-avatar-placeholder">
                          <UserCircle size={28} />
                        </div>
                      )}
                      <span className="online-indicator">
                        <span className="pulse-ring"></span>
                        <span className="pulse-dot"></span>
                      </span>
                    </div>
                    <div className="staff-details">
                      <div className="staff-info">
                        <span className="staff-name">{staff.name}</span>
                        <span className="staff-role">{staff.role}</span>
                      </div>
                      <div className="work-time">
                        <Clock size={14} />
                        {staff.clockInTime ? (
                          <WorkDuration clockInTime={staff.clockInTime} />
                        ) : (
                          <span className="work-duration">--:--:--</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="charts-grid">
        {/* Top Selling Items - Horizontal Bars */}
        {topSellingItems.length > 0 && (
          <div className="card chart-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Utensils size={20} />
              </div>
              <div className="card-header-text">
                <h3>Itens Mais Vendidos</h3>
                <p>Top 5 produtos</p>
              </div>
            </div>

            <div className="chart-container">
              {topSellingItems.map((item, index) => (
                <div key={index} className="top-item-row">
                  {/* Image and Name */}
                  <div className="item-info">
                    <img
                      src={item.image_url || "/placeholder-food.png"}
                      alt={item.nome}
                      onError={(e) => {
                        e.target.src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 8h1a4 4 0 0 1 0 8h-1'/%3E%3Cpath d='M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z'/%3E%3Cline x1='6' y1='1' x2='6' y2='4'/%3E%3Cline x1='10' y1='1' x2='10' y2='4'/%3E%3Cline x1='14' y1='1' x2='14' y2='4'/%3E%3C/svg%3E";
                      }}
                    />
                    <span>{item.nome}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="item-progress-container">
                    <div className="progress-bar-wrapper">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${
                            (item.vendido / topSellingItems[0].vendido) * 100
                          }%`,
                          background: COLORS[index % COLORS.length],
                        }}
                      >
                        <span>{item.vendido}</span>
                      </div>
                    </div>
                    <span className="item-revenue">
                      {item.receita ? item.receita.toFixed(2) : "0.00"}€
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff Performance - Modern Cards */}
        {staffPerformance.length > 0 && (
          <div className="card staff-performance-section">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Users size={20} />
              </div>
              <div className="card-header-text">
                <h3>Desempenho da Equipa</h3>
                <p>Top 5 funcionários</p>
              </div>
            </div>

            <div className="staff-performance-cards">
              {staffPerformance.map((staff, index) => (
                <div
                  key={index}
                  className="staff-card"
                  onClick={() =>
                    (window.location.href = `/profile?userId=${staff.user_id}`)
                  }
                  style={{ cursor: "pointer" }}
                >
                  {staff.profile_image ? (
                    <div className="staff-avatar-wrapper">
                      <img
                        src={staff.profile_image}
                        alt={staff.fullName || staff.name}
                      />
                    </div>
                  ) : (
                    <div
                      className="staff-rank-badge"
                      style={{ background: COLORS[index % COLORS.length] }}
                    >
                      #{index + 1}
                    </div>
                  )}

                  <div className="staff-info-section">
                    <div className="staff-name-text">
                      {staff.fullName || staff.name}
                    </div>
                    <div className="staff-stats-text">
                      {staff.orders} pedidos • {staff.prepared} preparados •{" "}
                      {staff.delivered} entregues
                    </div>
                  </div>

                  <div className="staff-total-count">{staff.orders}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest Orders Card */}
        {latestOrders.length > 0 && (
          <div className="card chart-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Receipt size={20} />
              </div>
              <div className="card-header-text">
                <h3>Últimos Pedidos</h3>
                <p>Pedidos de hoje (presenciais e takeaway)</p>
              </div>
            </div>
            <div style={{ height: "400px", overflowY: "auto" }}>
              {latestOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setOrderModalVisible(true);
                  }}
                  style={{
                    padding: "1rem",
                    marginBottom: "0.75rem",
                    background: "rgba(0, 0, 0, 0.02)",
                    borderRadius: "1.5rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: "1px solid #d1d5db",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.04)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.02)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        {order.type === "takeaway" ? (
                          <ShoppingBag size={16} color="#10b981" />
                        ) : (
                          <Coffee size={16} color="#4facfe" />
                        )}
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>
                          {order.type === "takeaway"
                            ? order.customer_name
                            : `Mesa ${order.table_number}`}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          marginLeft: "24px",
                        }}
                      >
                        {order.items_count} items • {order.staff.name}
                      </div>
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "16px",
                          color: "#1e293b",
                        }}
                      >
                        {order.total_price.toFixed(2)}€
                      </span>
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                        {new Date(order.completed_at).toLocaleString("pt-PT", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Secondary Charts Grid - Full Width */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          marginBottom: "0.5rem",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {/* Weekly Pattern */}
        {weeklyPattern.length > 0 && (
          <div className="card chart-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Activity size={20} />
              </div>
              <div className="card-header-text">
                <h3>Padrão Semanal</h3>
                <p>Vendas Totais, Takeaway e Presenciais</p>
              </div>
              {availableWeeks.length > 0 && (
                <Select
                  value={selectedWeek}
                  onChange={setSelectedWeek}
                  style={{ maxWidth: 200, width: "100%" }}
                  className="month-select"
                  options={availableWeeks.map((week) => ({
                    value: week.offset,
                    label: week.display,
                  }))}
                />
              )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={weeklyPattern}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="dia" stroke="#94a3b8" />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  label={{
                    value: "Receita (€)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  domain={[0, "auto"]}
                  tickFormatter={(value) => `${Math.round(value)}€`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#a855f7"
                  tick={false}
                  axisLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  labelFormatter={(label) => {
                    const entry = weeklyPattern.find((d) => d.dia === label);
                    return entry?.diaCompleto || label;
                  }}
                  formatter={(value, name) => {
                    if (name === "Items Vendidos") {
                      return [Math.round(value), name];
                    }
                    return [`${value.toFixed(2)}€`, name];
                  }}
                  contentStyle={{
                    borderRadius: "1.5rem",
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    background: "rgba(255, 255, 255, 0.98)",
                    padding: "12px 16px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  }}
                  labelStyle={{
                    fontWeight: 600,
                    fontSize: "13px",
                    color: "#2d3748",
                    marginBottom: "6px",
                  }}
                  itemStyle={{
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="receita"
                  name="Total"
                  stroke="#4facfe"
                  strokeWidth={3}
                  dot={{
                    r: 5,
                    fill: "#4facfe",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="receitaTakeaway"
                  name="Takeaway"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{
                    r: 5,
                    fill: "#10b981",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="receitaPresencial"
                  name="Presencial"
                  stroke="#ff6b35"
                  strokeWidth={3}
                  dot={{
                    r: 5,
                    fill: "#ff6b35",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="itemsVendidos"
                  name="Items Vendidos"
                  stroke="#a855f7"
                  strokeWidth={3}
                  dot={{
                    r: 5,
                    fill: "#a855f7",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly Pattern */}
        {monthlyPattern.length > 0 && availableMonths.length > 0 && (
          <div className="card chart-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Activity size={20} />
              </div>
              <div className="card-header-text">
                <h3>Padrão Mensal</h3>
                <p style={{ margin: 0 }}>
                  Vendas Totais, Takeaway e Presenciais
                </p>
              </div>
              <Select
                value={selectedMonth}
                onChange={(value) => setSelectedMonth(value)}
                style={{ maxWidth: 200, width: "100%" }}
                className="month-select"
                options={availableMonths.map((month) => ({
                  value: month.value,
                  label: month.label,
                }))}
              />
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={monthlyPattern}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="dia" stroke="#94a3b8" />
                <YAxis
                  stroke="#94a3b8"
                  label={{
                    value: "Receita (€)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  formatter={(value, name) => [`${value.toFixed(2)}€`, name]}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="receita"
                  name="Total"
                  stroke="#4facfe"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#4facfe" }}
                />
                <Line
                  type="monotone"
                  dataKey="receitaTakeaway"
                  name="Takeaway"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#10b981" }}
                />
                <Line
                  type="monotone"
                  dataKey="receitaPresencial"
                  name="Presencial"
                  stroke="#ff6b35"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#ff6b35" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Hourly Revenue */}
        {hourlyRevenue.length > 0 && (
          <div className="card chart-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <BarChart2 size={20} />
              </div>
              <div className="card-header-text">
                <h3>Receita por Hora</h3>
                <p>Hoje</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={hourlyRevenue}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ff6b35" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hora" stroke="#94a3b8" />
                <YAxis
                  stroke="#94a3b8"
                  label={{
                    value: "Receita (€)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke="#ff6b35"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Average Bill Analysis */}
        {avgBillData &&
          monthlyPattern.length > 0 &&
          availableMonths.length > 0 && (
            <div className="card chart-card">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <Euro size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Valor Médio Diário</h3>
                  <p style={{ margin: 0 }}>Média paga por pedido</p>
                </div>
                <Select
                  value={selectedMonth}
                  onChange={(value) => setSelectedMonth(value)}
                  style={{ maxWidth: 200, width: "100%" }}
                  className="custom-select"
                  options={availableMonths.map((month) => ({
                    value: month.value,
                    label: month.label,
                  }))}
                />
              </div>

              {/* Summary Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                <div
                  style={{
                    padding: "1rem",
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Média Geral
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      color: "#1e293b",
                    }}
                  >
                    {avgBillData.avg_bill?.toFixed(2)}€
                  </div>
                </div>
                <div
                  style={{
                    padding: "1rem",
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Mediana
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      color: "#1e293b",
                    }}
                  >
                    {avgBillData.median_bill?.toFixed(2)}€
                  </div>
                </div>
                <div
                  style={{
                    padding: "1rem",
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Mínimo
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      color: "#1e293b",
                    }}
                  >
                    {avgBillData.min_bill?.toFixed(2)}€
                  </div>
                </div>
                <div
                  style={{
                    padding: "1rem",
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "1rem",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Máximo
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      color: "#1e293b",
                    }}
                  >
                    {avgBillData.max_bill?.toFixed(2)}€
                  </div>
                </div>
              </div>

              {/* Daily Average Chart */}
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={monthlyPattern}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="dia" stroke="#94a3b8" />
                  <YAxis
                    stroke="#667eea"
                    label={{
                      value: "Valor Médio (€)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `${value.toFixed(2)}€`,
                      "Valor Médio",
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="ticketMedio"
                    name="Valor Médio"
                    stroke="#667eea"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#667eea" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
      </div>

      {/* Order Detail Modal */}
      {orderModalVisible &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: "600px" }}>
              {/* Modal Header */}
              <div className="modal-header">
                <div className="header-text">
                  <h2>
                    {selectedOrder?.type === "takeaway" ? (
                      <>
                        <ShoppingBag
                          size={20}
                          style={{ display: "inline", marginRight: "8px" }}
                        />
                        Pedido Takeaway
                      </>
                    ) : (
                      <>
                        <Coffee
                          size={20}
                          style={{ display: "inline", marginRight: "8px" }}
                        />
                        Pedido Presencial
                      </>
                    )}
                  </h2>
                  <p>
                    {selectedOrder &&
                      new Date(selectedOrder.completed_at).toLocaleString(
                        "pt-PT",
                        {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                  </p>
                </div>
                <button
                  onClick={() => setOrderModalVisible(false)}
                  className="close-button"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="modal-content">
                {selectedOrder && (
                  <>
                    {/* Order Info Card */}
                    <div className="order-info-card">
                      {selectedOrder.type === "takeaway" ? (
                        <div className="info-grid">
                          <div className="info-row">
                            <span className="info-label">Cliente</span>
                            <span className="info-value">
                              {selectedOrder.customer_name}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Telefone</span>
                            <span className="info-value">
                              {selectedOrder.customer_phone}
                            </span>
                          </div>
                          {selectedOrder.customer_email && (
                            <div className="info-row">
                              <span className="info-label">Email</span>
                              <span className="info-value">
                                {selectedOrder.customer_email}
                              </span>
                            </div>
                          )}
                          <div className="info-row info-divider">
                            <span className="info-label">Atendido</span>
                            <div className="staff-info">
                              {selectedOrder.staff.profile_image && (
                                <img
                                  src={`https://pap-imagens.s3.amazonaws.com/imagens-perfil/${selectedOrder.staff.profile_image}`}
                                  alt={selectedOrder.staff.name}
                                  className="staff-avatar"
                                />
                              )}
                              <span className="info-value">
                                {selectedOrder.staff.name}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="info-grid">
                          <div className="info-row">
                            <span className="info-label">Mesa</span>
                            <span className="info-value table-number">
                              {selectedOrder.table_number}
                            </span>
                          </div>
                          <div className="info-row info-divider">
                            <span className="info-label">Processado</span>
                            <div className="staff-info">
                              {selectedOrder.staff.profile_image && (
                                <img
                                  src={`https://pap-imagens.s3.amazonaws.com/imagens-perfil/${selectedOrder.staff.profile_image}`}
                                  alt={selectedOrder.staff.name}
                                  className="staff-avatar"
                                />
                              )}
                              <span className="info-value">
                                {selectedOrder.staff.name}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Items Section */}
                    {selectedOrder.items && selectedOrder.items.length > 0 && (
                      <div className="items-section">
                        <h4 className="items-title">
                          Items ({selectedOrder.items_count})
                        </h4>
                        <div className="items-list">
                          {selectedOrder.items.map((item, index) => {
                            const imageUrl =
                              item.image_id &&
                              item.image_id !== "undefined" &&
                              item.image_id !== "null"
                                ? `https://pap-imagens.s3.amazonaws.com/imagens-menu/${item.image_id}`
                                : null;

                            return (
                              <div key={item.id || index} className="item-card">
                                <div className="item-image-wrapper">
                                  {imageUrl ? (
                                    <img src={imageUrl} alt={item.item_name} />
                                  ) : (
                                    <Utensils
                                      className="placeholder-icon"
                                      size={24}
                                    />
                                  )}
                                </div>
                                <div className="item-details">
                                  <div className="item-name">
                                    {item.item_name}
                                  </div>
                                  <div className="item-meta">
                                    <span>{item.item_category}</span>
                                    {item.quantity && (
                                      <>
                                        <span>•</span>
                                        <span>Qty: {item.quantity}</span>
                                      </>
                                    )}
                                  </div>
                                  {item.notas && (
                                    <div className="item-note">
                                      📝 {item.notas}
                                    </div>
                                  )}
                                </div>
                                <div className="item-price">
                                  {item.quantity
                                    ? (item.price * item.quantity).toFixed(2)
                                    : parseFloat(item.price).toFixed(2)}
                                  €
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Total Card */}
                    <div className="total-card">
                      <span className="total-label">Total</span>
                      <span className="total-amount">
                        {selectedOrder.total_price.toFixed(2)}€
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default ManagerView;
