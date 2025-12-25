"use client";

import React, { useState, useEffect } from "react";
import {
  UserCircle,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Coffee,
  ChefHat,
  Utensils,
  MapPin,
  Bell,
  Settings,
  LogOut,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import { getImageUrl as getImageUrlHelper } from "../../lib/api";
import DashboardCards from "./DashboardCards";
import "./StaffView.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const StaffView = ({
  username,
  userLabels,
  profileImg,
  onNavChange,
  user,
  onLoaded,
}) => {
  const { socket, connected } = useWebSocketContext();

  // Mock data for staff view
  const [staffStats, setStaffStats] = useState({
    activeOrders: 12,
    tablesToClean: 3,
    tasksAssigned: 8,
    shiftHours: 6.5,
  });

  const [onlineStaff, setOnlineStaff] = useState([]);

  const [recentActivity, setRecentActivity] = useState([]);

  const [currentShift, setCurrentShift] = useState({
    startTime: null,
    duration: "00:00:00",
    status: "offline",
    isWorking: false,
  });

  const [loading, setLoading] = useState(true);

  // Fetch staff attendance data
  const fetchStaffData = React.useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

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

        setOnlineStaff(transformedStaff);
      }
    } catch (error) {
      console.error("Failed to fetch staff data:", error);
    }
  }, []);

  // Fetch latest orders
  const fetchLatestOrders = React.useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/stats/latest-orders?limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data.orders || []);
      }
    } catch (error) {
      console.error("Failed to fetch latest orders:", error);
    }
  }, []);

  // Fetch current user's shift data
  const fetchCurrentUserShift = React.useCallback(async () => {
    if (!user?.id) return;

    const token = localStorage.getItem("auth_token");
    if (!token) return;

    try {
      // First check if user is currently working
      const usersResponse = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        const currentUserData =
          usersData.users?.find((u) => u.id === user.id) ||
          usersData.find((u) => u.id === user.id);

        if (!currentUserData?.is_working) {
          // User is not working
          setCurrentShift({
            startTime: null,
            duration: "00:00:00",
            status: "offline",
            isWorking: false,
          });
          return;
        }
      }

      // User is working, fetch attendance data to get clock-in time
      const response = await fetch(
        `${API_BASE_URL}/api/presencas/user/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const presencaData = await response.json();
        const latestEntrada = presencaData.presencas?.find(
          (p) => p.tipo_acao === "entrada"
        );

        if (latestEntrada) {
          setCurrentShift({
            startTime: new Date(latestEntrada.timestamp),
            duration: "", // Will be calculated in real-time
            status: "active",
            isWorking: true,
          });
        } else {
          // No clock-in record found, but user is marked as working
          setCurrentShift({
            startTime: null,
            duration: "00:00:00",
            status: "active",
            isWorking: true,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch current user shift:", error);
      setCurrentShift({
        startTime: null,
        duration: "00:00:00",
        status: "offline",
        isWorking: false,
      });
    }
  }, [user?.id]);

  // Simulate real-time updates
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchStaffData(), fetchLatestOrders()]);
      await fetchCurrentUserShift();
      setLoading(false);
      if (onLoaded) onLoaded();
    };

    loadData();

    const interval = setInterval(() => {
      setStaffStats((prev) => ({
        ...prev,
        activeOrders: Math.max(
          0,
          prev.activeOrders +
            (Math.random() > 0.7 ? 1 : Math.random() > 0.8 ? -1 : 0)
        ),
        tablesToClean: Math.max(
          0,
          prev.tablesToClean +
            (Math.random() > 0.9 ? 1 : Math.random() > 0.95 ? -1 : 0)
        ),
      }));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [fetchStaffData, fetchLatestOrders, fetchCurrentUserShift, onLoaded]);

  // Update shift duration in real-time
  useEffect(() => {
    if (!currentShift.startTime || !currentShift.isWorking) return;

    const updateDuration = () => {
      const start = currentShift.startTime;
      const now = new Date();
      const diff = now - start;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const duration = `${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

      setCurrentShift((prev) => ({
        ...prev,
        duration,
      }));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [currentShift.startTime, currentShift.isWorking]);

  // Work Duration Component
  const WorkDuration = ({ clockInTime }) => {
    const [duration, setDuration] = useState("");

    useEffect(() => {
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
    <div className="staff-view">
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
        </div>
      )}
      {/* Section Header */}
      <div className="manager-section-header">
        <div className="header-title-group">
          <h1>Painel do Funcionário</h1>
          <p>Gestão diária e acompanhamento de tarefas</p>
        </div>
      </div>

      {/* Quick Stats Dashboard */}
      <DashboardCards showAllMetrics={false} />

      {/* Main Content Grid */}
      <div className="staff-content-grid">
        {/* Row 1 - Current Shift & Online Team */}
        <div className="status-column">
          {/* Current Shift */}
          <div className="card chart-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Clock size={20} />
              </div>
              <div className="card-header-text">
                <h3>Turno Atual</h3>
                <p>Horário e horas trabalhadas</p>
              </div>
            </div>
            <div className="shift-info">
              <div className="shift-time">
                <span className="time">
                  {currentShift.isWorking
                    ? `Entrada: ${currentShift.startTime?.toLocaleTimeString(
                        "pt-PT",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}`
                    : "Fora de turno"}
                </span>
                <span className={`status ${currentShift.status}`}>
                  {currentShift.status === "active" ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="shift-details">
                <div className="detail-item">
                  <Clock size={16} />
                  <span>Duração: {currentShift.duration}</span>
                </div>
                <div className="detail-item">
                  <Calendar size={16} />
                  <span>
                    {currentShift.isWorking
                      ? `Trabalhando desde ${currentShift.startTime?.toLocaleDateString(
                          "pt-PT"
                        )}`
                      : "Sem registo de entrada"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Online Team Members */}
          <div className="card chart-card online-staff-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Users size={20} />
              </div>
              <div className="card-header-text">
                <h3>Equipa Online</h3>
                <p>
                  {onlineStaff.filter((s) => s.status === "online").length} de{" "}
                  {onlineStaff.length} funcionários
                </p>
              </div>
            </div>

            <div className="online-staff-list">
              {onlineStaff.filter((s) => s.status === "online").length === 0 ? (
                <div className="empty-state">
                  <Users size={48} color="#94a3b8" />
                  <p>Nenhum funcionário online no momento</p>
                </div>
              ) : (
                onlineStaff
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
        </div>

        {/* Row 2 - Quick Tasks & Recent Activity */}
        <div className="team-column">
          {/* Quick Tasks */}
          <div className="card chart-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <CheckCircle size={20} />
              </div>
              <div className="card-header-text">
                <h3>Tarefas Rápidas</h3>
                <p>Ações comuns do dia a dia</p>
              </div>
            </div>
            <div className="tasks-list">
              <button
                className="task-button"
                onClick={() => onNavChange("Ementa")}
              >
                <ChefHat size={18} />
                <span>Ementa</span>
              </button>
              <button
                className="task-button"
                onClick={() => onNavChange("Mesas")}
              >
                <MapPin size={18} />
                <span>Organizar Mesas</span>
              </button>
              <button
                className="task-button"
                onClick={() => onNavChange("Reservas")}
              >
                <Calendar size={18} />
                <span>Reservas Hoje</span>
              </button>
              <button
                className="task-button"
                onClick={() => onNavChange("Pagamentos")}
              >
                <Receipt size={18} />
                <span>Fechar Contas</span>
              </button>
            </div>
          </div>

          {/* Recent Activity - styled like Latest Orders */}
          {recentActivity.length > 0 && (
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
              <div className="orders-list-container">
                {recentActivity.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      padding: "1rem",
                      marginBottom: "0.75rem",
                      background: "rgba(0, 0, 0, 0.02)",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      border: "1px solid rgba(0, 0, 0, 0.05)",
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
                          {order.items_count} items •{" "}
                          {order.staff?.name || "Staff"}
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
                          {order.total_price?.toFixed(2) || "0.00"}€
                        </span>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                          {order.completed_at
                            ? new Date(order.completed_at).toLocaleString(
                                "pt-PT",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "Agora"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffView;
