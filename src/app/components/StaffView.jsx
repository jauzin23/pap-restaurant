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
  LogIn,
  Timer,
} from "lucide-react";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import { getImageUrl as getImageUrlHelper } from "../../lib/api";
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

  // Big list of vibrant colors for username
  const USERNAME_COLORS = React.useMemo(
    () => [
      "#FF6B6B", // Coral Red
      "#4ECDC4", // Turquoise
      "#45B7D1", // Sky Blue
      "#FFA07A", // Light Salmon
      "#98D8C8", // Mint
      "#F7DC6F", // Golden Yellow
      "#BB8FCE", // Lavender
      "#85C1E2", // Powder Blue
      "#F8B739", // Amber
      "#52B788", // Emerald Green
      "#F06292", // Pink
      "#7C4DFF", // Deep Purple
      "#FF7043", // Deep Orange
      "#26C6DA", // Cyan
      "#9CCC65", // Light Green
      "#AB47BC", // Purple
      "#EC407A", // Hot Pink
      "#5C6BC0", // Indigo
      "#FFCA28", // Amber Yellow
      "#66BB6A", // Green
      "#EF5350", // Red
      "#42A5F5", // Blue
      "#FF6B35", // Orange (Mesa+ brand)
      "#8E44AD", // Violet
      "#3498DB", // Dodger Blue
      "#E74C3C", // Alizarin
      "#1ABC9C", // Turquoise
      "#F39C12", // Orange
      "#9B59B6", // Amethyst
      "#2ECC71", // Nephritis
      "#E67E22", // Carrot
      "#16A085", // Green Sea
      "#D35400", // Pumpkin
      "#C0392B", // Pomegranate
      "#27AE60", // Green
      "#2980B9", // Belize Blue
      "#8E44AD", // Wisteria
      "#FF6348", // Tomato
      "#FF4757", // Radical Red
      "#5F27CD", // Purple
      "#00D2D3", // Bright Cyan
      "#FF9FF3", // Fuchsia Pink
      "#54A0FF", // French Sky Blue
      "#48DBFB", // Bright Turquoise
      "#1DD1A1", // Caribbean Green
      "#10AC84", // Green Darner Tail
      "#FF9F43", // Orange Yellow
      "#EE5A6F", // Watermelon
      "#C44569", // Blush Pink
      "#F8B739", // Saffron
    ],
    []
  );

  // Random color for username - refreshed on every load
  const [usernameColor, setUsernameColor] = useState("");

  // Select random color on component mount
  useEffect(() => {
    const randomColor =
      USERNAME_COLORS[Math.floor(Math.random() * USERNAME_COLORS.length)];
    setUsernameColor(randomColor);
  }, [USERNAME_COLORS]);

  // Mock data for staff view
  const [staffStats, setStaffStats] = useState({
    activeOrders: 12,
    tablesToClean: 3,
    tasksAssigned: 8,
    shiftHours: 6.5,
  });

  const [onlineStaff, setOnlineStaff] = useState([]);

  const [recentActivity, setRecentActivity] = useState([]);

  const [activeOrders, setActiveOrders] = useState([]);

  const [currentShift, setCurrentShift] = useState({
    startTime: null,
    duration: "00:00:00",
    status: "offline",
    isWorking: false,
  });

  const [loading, setLoading] = useState(true);

  // Helper function to get initials
  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Helper function to format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "--:--";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  // Fetch active orders for staff view
  const fetchActiveOrders = React.useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/stats/active-orders-staff`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setActiveOrders(data.activeOrders || []);
      }
    } catch (error) {
      console.error("Failed to fetch active orders:", error);
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
      await Promise.all([
        fetchStaffData(),
        fetchLatestOrders(),
        fetchActiveOrders(),
      ]);
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
  }, [
    fetchStaffData,
    fetchLatestOrders,
    fetchActiveOrders,
    fetchCurrentUserShift,
    onLoaded,
  ]);

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

  // WebSocket listeners for real-time active orders updates
  useEffect(() => {
    if (!socket || !connected) return;

    const handleOrderEvent = () => {
      fetchActiveOrders();
    };

    socket.on("order:created", handleOrderEvent);
    socket.on("order:updated", handleOrderEvent);
    socket.on("order:paid", handleOrderEvent);
    socket.on("order:deleted", handleOrderEvent);
    socket.on("takeaway:created", handleOrderEvent);
    socket.on("takeaway:updated", handleOrderEvent);
    socket.on("takeaway:completed", handleOrderEvent);

    return () => {
      socket.off("order:created", handleOrderEvent);
      socket.off("order:updated", handleOrderEvent);
      socket.off("order:paid", handleOrderEvent);
      socket.off("order:deleted", handleOrderEvent);
      socket.off("takeaway:created", handleOrderEvent);
      socket.off("takeaway:updated", handleOrderEvent);
      socket.off("takeaway:completed", handleOrderEvent);
    };
  }, [socket, connected, fetchActiveOrders]);

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

  // Determine greeting based on current time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : "Boa tarde";
  const firstName = username?.split(" ")[0] || username;

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
          <h1>
            {greeting},{" "}
            <span style={{ color: usernameColor }}>{firstName}</span>.
          </h1>
          <p>Gestão diária e acompanhamento de tarefas</p>
        </div>
      </div>

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
                      )} H`
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
                      ? `A trabalhar desde ${currentShift.startTime?.toLocaleDateString(
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
                        </div>
                        <div className="staff-details">
                          <div className="staff-info">
                            <span className="staff-name">{staff.name}</span>
                            <span className="staff-role">{staff.role}</span>
                          </div>
                          <div className="work-time">
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

        {/* Row 2 - Active Orders & Recent Activity */}
        <div className="orders-row">
          {/* Active Orders */}
          <div className="card chart-card active-orders-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <ShoppingBag size={20} />
              </div>
              <div className="card-header-text">
                <h3>Pedidos Ativos</h3>
                <p>
                  {activeOrders.length}{" "}
                  {activeOrders.length === 1 ? "pedido" : "pedidos"} em
                  andamento
                </p>
              </div>
            </div>

            <div className="active-orders-list">
              {activeOrders.length === 0 ? (
                <div className="empty-state">
                  <ShoppingBag size={48} color="#94a3b8" />
                  <p>Nenhum pedido ativo no momento</p>
                </div>
              ) : (
                activeOrders.map((order, index) => {
                  const timeDiff = Math.floor(
                    (new Date() - new Date(order.created_at)) / 60000
                  );
                  const timeText =
                    timeDiff < 1
                      ? "Agora"
                      : timeDiff < 60
                      ? `${timeDiff} min`
                      : `${Math.floor(timeDiff / 60)}h ${timeDiff % 60}m`;

                  return (
                    <div key={order.id || index} className="active-order-card">
                      <div className="order-icon-wrapper">
                        {order.type === "takeaway" ? (
                          <ShoppingBag size={20} color="#10b981" />
                        ) : (
                          <Coffee size={20} color="#4facfe" />
                        )}
                      </div>

                      <div className="order-info-section">
                        <div className="order-label-text">
                          {order.type === "takeaway"
                            ? `Takeaway - ${order.customer_name}`
                            : order.layout_names
                            ? `${order.layout_names} - Mesa ${order.table_numbers}`
                            : `Mesa ${order.table_numbers}`}
                        </div>
                        <div className="order-meta-text">
                          {timeText} • {order.items_count}{" "}
                          {order.items_count === 1 ? "item" : "items"} •{" "}
                          <span
                            className={`status-badge status-${order.status}`}
                          >
                            {order.status === "pendente" && "Pendente"}
                            {order.status === "aceite" && "Aceite"}
                            {order.status === "preparando" && "A Preparar"}
                            {order.status === "pronto" && "Pronto"}
                            {order.status === "entregue" && "Entregue"}
                          </span>
                        </div>
                      </div>

                      <div className="order-total-amount">
                        {order.total_amount.toFixed(2)}€
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Activity - styled like Latest Orders */}
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
            <div className="active-orders-list">
              {recentActivity.length === 0 ? (
                <div className="empty-state">
                  <Receipt size={48} color="#94a3b8" />
                  <p>Nenhum pedido concluído hoje</p>
                </div>
              ) : (
                recentActivity.map((order) => {
                  const timeText = order.completed_at
                    ? new Date(order.completed_at).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Agora";

                  return (
                    <div key={order.id} className="active-order-card">
                      <div className="order-icon-wrapper">
                        {order.type === "takeaway" ? (
                          <ShoppingBag size={20} color="#10b981" />
                        ) : (
                          <Coffee size={20} color="#4facfe" />
                        )}
                      </div>

                      <div className="order-info-section">
                        <div className="order-label-text">
                          {order.type === "takeaway"
                            ? `Takeaway - ${order.customer_name}`
                            : `Mesa ${order.table_number}`}
                        </div>
                        <div className="order-meta-text">
                          {timeText} • {order.items_count}{" "}
                          {order.items_count === 1 ? "item" : "items"} •{" "}
                          {order.staff?.name || "Staff"}
                        </div>
                      </div>

                      <div className="order-total-amount">
                        {order.total_price?.toFixed(2) || "0.00"}€
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Row 3 - Quick Tasks */}
        <div className="tasks-row">
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
        </div>
      </div>
    </div>
  );
};

export default StaffView;
