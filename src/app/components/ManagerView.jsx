"use client";

import React from "react";
import {
  MoreVertical,
  BarChart2,
  HandCoins,
  Logs,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Users,
  ExternalLink,
  Clock,
  Star,
  Grid,
  Edit,
} from "lucide-react";
import { Avatars } from "appwrite";
import { useApp } from "@/contexts/AppContext";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
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
          className={`${className} bg-gray-100 flex items-center justify-center ${
            isCircular ? "rounded-full" : "rounded-lg"
          }`}
          style={{
            width: typeof size === "number" ? `${size}px` : size,
            height: typeof size === "number" ? `${size}px` : size,
          }}
        >
          <UserCircle
            size={typeof size === "number" ? Math.floor(size * 0.7) : 24}
            className="text-gray-400"
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
          backgroundColor: "#f8fafc",
        }}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          style={{
            backgroundColor: "transparent",
          }}
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
              {stat.value}
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
                    {item.value}
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
          <div
            className="profile-card scale-in"
            style={{ marginBottom: "8px" }}
          >
            <div className="profile-image">
              <ProfileImage
                src={profileImg}
                alt={username || "Chef Marco"}
                className="w-full aspect-square object-cover rounded-lg"
                size="100%"
                userName={username}
              />
              <div className="profile-info">
                <div className="profile-overlay"></div>
                <h3>{username ? username : "User"}</h3>
                {userLabels.length > 0 ? (
                  <p>{userLabels.join(", ")}</p>
                ) : (
                  <p>Sem Cargo</p>
                )}
              </div>
            </div>
          </div>

          <div className="accordion-section slide-in-up">
            <button
              className={`accordion-header${
                expandedSections.inventory ? " active" : ""
              }`}
              onClick={() => toggleSection("inventory")}
            >
              <span>Stock e Inventário</span>
              {expandedSections.inventory ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </button>
            {expandedSections.inventory && (
              <div
                className={`accordion-content ${
                  expandedSections.inventory ? "expanded" : ""
                }`}
              >
                <div className="device-item">
                  <img
                    src="https://images.unsplash.com/photo-1519864600265-abb23847ef2c?w=100&h=100&fit=crop"
                    alt="Geladeira Industrial"
                    className="device-image"
                  />
                  <div className="device-info">
                    <h4>Geladeira Industrial</h4>
                    <p>Temperatura OK</p>
                  </div>
                  <button className="device-menu">
                    <MoreVertical size={18} />
                  </button>
                </div>
                <div className="device-item">
                  <img
                    src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&h=100&fit=crop"
                    alt="Despensa"
                    className="device-image"
                  />
                  <div className="device-info">
                    <h4>Despensa</h4>
                    <p>Stock Baixo</p>
                  </div>
                  <button className="device-menu">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="accordion-section">
            <button
              className={`accordion-header${
                expandedSections.kitchen ? " active" : ""
              }`}
              onClick={() => toggleSection("kitchen")}
            >
              <span>Equipamentos</span>
              {expandedSections.kitchen ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </button>
            {expandedSections.kitchen && (
              <div
                className={`accordion-content ${
                  expandedSections.kitchen ? "expanded" : ""
                }`}
              >
                <div className="device-item">
                  <img
                    src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=100&h=100&fit=crop"
                    alt="Forno Profissional"
                    className="device-image"
                  />
                  <div className="device-info">
                    <h4>Forno Profissional</h4>
                    <p>Manutenção OK</p>
                  </div>
                  <button className="device-menu">
                    <MoreVertical size={18} />
                  </button>
                </div>
                <div className="device-item">
                  <img
                    src="https://images.unsplash.com/photo-1464306076886-debede6bbf94?w=100&h=100&fit=crop"
                    alt="Fogão Industrial"
                    className="device-image"
                  />
                  <div className="device-info">
                    <h4>Fogão Industrial</h4>
                    <p>Manutenção em breve</p>
                  </div>
                  <button className="device-menu">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="accordion-section">
            <button
              className={`accordion-header${
                expandedSections.staff ? " active" : ""
              }`}
              onClick={() => toggleSection("staff")}
            >
              <span>Gestão de Staff</span>
              {expandedSections.staff ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </button>
            {expandedSections.staff && (
              <div
                className={`accordion-content staff-management ${
                  expandedSections.staff ? "expanded" : ""
                }`}
              >
                {staffUsers.length === 0 ? (
                  <div className="staff-empty-state">
                    <div className="empty-state-icon">
                      <Users size={32} />
                    </div>
                    <h4>Nenhum funcionário ativo</h4>
                    <p>Aguardando entrada de funcionários...</p>
                  </div>
                ) : (
                  <>
                    <div className="staff-header">
                      <div className="staff-count">
                        <Users size={16} />
                        <span>{staffUsers.length} </span>
                      </div>
                      <button
                        className="staff-manage-btn"
                        onClick={() =>
                          window.open("/staff-management", "_blank")
                        }
                        title="Gerir Staff"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>

                    <div className="staff-list">
                      {staffUsers.map((user, idx) => (
                        <div
                          className="staff-member-card"
                          key={user.$id || user.id || idx}
                        >
                          <div className="staff-member-avatar">
                            <ProfileImage
                              src={
                                user.profileImg ||
                                user.profile_image ||
                                user.avatar
                              }
                              alt={user.name || user.email || "Funcionário"}
                              className="staff-avatar"
                              size={32}
                              isCircular={true}
                              userName={user.name || user.email}
                            />
                            <div className="online-indicator"></div>
                          </div>

                          <div className="staff-member-info">
                            <h4 className="staff-name">
                              {user.name || user.email || "Funcionário"}
                            </h4>
                            <div className="staff-role">
                              <div className="staff-time-badge">
                                <Clock size={8} />
                                <span>2h</span>
                              </div>
                              {user.labels && user.labels.length > 0 ? (
                                <span
                                  className={`role-badge ${user.labels[0].toLowerCase()}`}
                                >
                                  {user.labels[0]}
                                </span>
                              ) : user.roles && user.roles.length > 0 ? (
                                <span className="role-badge default">
                                  {user.roles[0]}
                                </span>
                              ) : (
                                <span className="role-badge default">
                                  Sem Cargo
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="staff-member-actions">
                            <button className="staff-menu-btn">
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="accordion-section">
            <button
              className={`accordion-header${
                expandedSections.finances ? " active" : ""
              }`}
              onClick={() => toggleSection("finances")}
            >
              <span>Resumo Financeiro</span>
              {expandedSections.finances ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </button>
            {expandedSections.finances && (
              <div
                className={`accordion-content ${
                  expandedSections.finances ? "expanded" : ""
                }`}
              >
                <div className="finance-item">
                  <h4>Receita Mensal</h4>
                  <p>€78.2K</p>
                </div>
                <div className="finance-item">
                  <h4>Despesas</h4>
                  <p>€54.6K</p>
                </div>
                <div className="finance-item">
                  <h4>Lucro</h4>
                  <p>€23.6K</p>
                </div>
              </div>
            )}
          </div>
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
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  fill="none"
                  stroke="#f0f0f0"
                  strokeWidth="8"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="85"
                  fill="none"
                  stroke="#FF6B35"
                  strokeWidth="8"
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
