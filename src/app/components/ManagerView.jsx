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
} from "lucide-react";
import { Avatars } from "appwrite";
import { useApp } from "@/contexts/AppContext";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import { useStatsWebSocket } from "@/hooks/useStatsWebSocket";
import NumberFlow from "@number-flow/react";
import { Select } from "antd";
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
import { getImageUrl as getImageUrlHelper } from "../../lib/api";
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
  const [avgBillData, setAvgBillData] = React.useState(null);
  const [kitchenEfficiency, setKitchenEfficiency] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

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

  // Fetch remaining statistics (not covered by WebSocket yet)
  React.useEffect(() => {
    const fetchRemainingStats = async () => {
      setLoading(true);
      const token = localStorage.getItem("auth_token");

      if (!token) {
        console.error("No authentication token found");
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [categories, hourly, revenue, weekly, kitchen, months, avgBill] =
          await Promise.all([
            fetch(`${API_BASE_URL}/stats/categories/performance`, {
              headers,
            }).then((r) => (r.ok ? r.json() : null)),
            fetch(`${API_BASE_URL}/stats/time/hourly`, { headers }).then((r) =>
              r.ok ? r.json() : null
            ),
            fetch(`${API_BASE_URL}/stats/revenue/overview`, { headers }).then(
              (r) => (r.ok ? r.json() : null)
            ),
            fetch(`${API_BASE_URL}/stats/time/weekly-pattern`, {
              headers,
            }).then((r) => (r.ok ? r.json() : null)),
            fetch(`${API_BASE_URL}/stats/operations/tempo-medio-resposta`, {
              headers,
            }).then((r) => (r.ok ? r.json() : null)),
            fetch(`${API_BASE_URL}/stats/time/available-months`, {
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
          setWeeklyPattern(
            weekly.days.map((d) => ({
              dia: d.day,
              diaCompleto: d.day,
              receita: d.revenue,
              receitaTakeaway: d.takeaway_revenue || 0,
              receitaPresencial: d.dinein_revenue || 0,
              pedidos: d.orders,
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

        if (avgBill) {
          setAvgBillData(avgBill);
        }
      } catch (error) {
        console.error("❌ Failed to fetch statistics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRemainingStats();
    // Refresh every 5 minutes (WebSocket handles real-time updates)
    const interval = setInterval(fetchRemainingStats, 300000);
    return () => clearInterval(interval);
  }, []);

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
  const COLORS = ["#ff6b35", "#ff6b35", "#ff6b35", "#ff6b35", "#ff6b35"];

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

  if (loading) {
    return (
      <div className="manager-view">
        <div className="section-header"></div>
        <div className="loading-container">
          <div className="loading-content"></div>
        </div>
      </div>
    );
  }

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
      {/* Dashboard Cards */}
      <DashboardCards
        showAllMetrics={true}
        customMetrics={{
          dailyRevenue: liveStats?.current?.revenue_today || 0,
          monthlyRevenue: monthlyRevenue,
          activeOrders: liveStats?.current?.orders_in_progress || 0,
          todayReservations: liveStats?.current?.orders_today || 0,
          kitchenEfficiency: kitchenEfficiency,
        }}
      />

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
      </div>

      {/* Secondary Charts Grid - Full Width */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Weekly Pattern */}
        {weeklyPattern.length > 0 && (
          <div
            className="card"
            style={{ padding: "1.5rem", borderRadius: "1.5rem" }}
          >
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Activity size={20} />
              </div>
              <div className="card-header-text">
                <h3>Padrão Semanal</h3>
                <p>Vendas Totais, Takeaway e Presenciais</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={weeklyPattern}
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
                  dot={{ r: 6, fill: "#4facfe" }}
                />
                <Line
                  type="monotone"
                  dataKey="receitaTakeaway"
                  name="Takeaway"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 6, fill: "#10b981" }}
                />
                <Line
                  type="monotone"
                  dataKey="receitaPresencial"
                  name="Presencial"
                  stroke="#ff6b35"
                  strokeWidth={3}
                  dot={{ r: 6, fill: "#ff6b35" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly Pattern */}
        {monthlyPattern.length > 0 && availableMonths.length > 0 && (
          <div
            className="card"
            style={{ padding: "1.5rem", borderRadius: "1.5rem" }}
          >
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
                style={{ width: 200 }}
                className="custom-select"
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
          <div
            className="card"
            style={{ padding: "1.5rem", borderRadius: "1.5rem" }}
          >
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
            <div
              className="card"
              style={{ padding: "1.5rem", borderRadius: "1.5rem" }}
            >
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
                  style={{ width: 200 }}
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
    </div>
  );
};

export default ManagerView;
