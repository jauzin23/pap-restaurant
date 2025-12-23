"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  UserCircle,
  Users,
  MessageCircle,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  UserCheck,
  X,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Award,
  Activity,
  Euro,
  Zap,
  Target,
  BarChart3,
  PieChart,
  Timer,
} from "lucide-react";
import { Table, Tag, Button, Input, Avatar, message, Select } from "antd";
import NumberFlow from "@number-flow/react";
import {
  LineChart,
  Line,
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
  Area,
  AreaChart,
} from "recharts";
import { auth, users, getAuthToken, getImageUrl } from "../../lib/api";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import "./ManagerStaffView.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const ManagerStaffView = () => {
  const { socket, connected } = useWebSocketContext();

  // State declarations
  const [searchQuery, setSearchQuery] = useState("");
  const [staffData, setStaffData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isManager, setIsManager] = useState(false);

  // Team statistics state
  const [teamStats, setTeamStats] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("30"); // days

  // Create user modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    name: "",
    telefone: "",
    nif: "",
    contrato: "",
    ferias: false,
    labels: [],
  });

  // Calculate date range based on period
  const getDateRange = () => {
    const dataFim = new Date().toISOString().slice(0, 10);
    const dataInicio = new Date(
      Date.now() - parseInt(selectedPeriod) * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);
    return { dataInicio, dataFim };
  };

  // Load team statistics
  const loadTeamStats = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const { dataInicio, dataFim } = getDateRange();
      const response = await fetch(
        `${API_BASE_URL}/stats/team/comprehensive?date_from=${dataInicio}&date_to=${dataFim}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTeamStats(data);
      }
    } catch (error) {
      console.error("Error loading team stats:", error);
    }
  };

  // Load staff data
  const loadStaffData = async () => {
    try {
      setRefreshing(true);
      const response = await users.list();
      const allUsers = response.users || response || [];

      if (!Array.isArray(allUsers)) {
        console.error("Users data is not an array:", allUsers);
        setStaffData([]);
        return;
      }

      const transformedStaff = allUsers.map((u) => {
        const role =
          u.labels && u.labels.length > 0 ? u.labels[0] : "Funcionário";

        return {
          key: u.id || u.$id,
          id: u.id || u.$id,
          name: u.name || u.username || u.email,
          username: u.username,
          role: role,
          email: u.email,
          telefone: u.telefone || "",
          hoursWorked: u.hrs || 0,
          status: u.status || "offline",
          profileImg: u.profile_image
            ? getImageUrl("imagens-perfil", u.profile_image)
            : "",
          ferias: u.ferias || false,
          contrato: u.contrato || "N/A",
          labels: u.labels || [],
        };
      });

      setStaffData(transformedStaff);
    } catch (err) {
      console.error("Error fetching staff users:", err);
      setStaffData([]);
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await auth.get();
        setCurrentUser(user);
        const userIsManager =
          user.labels?.includes("manager") ||
          user.labels?.includes("Manager") ||
          user.labels?.includes("gerente") ||
          user.labels?.includes("Gerente");
        setIsManager(userIsManager);
      } catch (error) {
        console.error("Error loading current user:", error);
      }
    };

    loadCurrentUser();
    loadStaffData();
    loadTeamStats();
  }, []);

  // Reload stats when period changes
  useEffect(() => {
    if (!isLoading) {
      loadTeamStats();
    }
  }, [selectedPeriod]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket || !connected) return;

    const handleUserCreated = () => {
      loadStaffData();
      loadTeamStats();
    };

    const handleUserUpdated = () => {
      loadStaffData();
      loadTeamStats();
    };

    const handleStatsUpdated = () => {
      loadTeamStats();
    };

    socket.on("user:created", handleUserCreated);
    socket.on("user:updated", handleUserUpdated);
    socket.on("stats:updated", handleStatsUpdated);

    return () => {
      socket.off("user:created", handleUserCreated);
      socket.off("user:updated", handleUserUpdated);
      socket.off("stats:updated", handleStatsUpdated);
    };
  }, [socket, connected]);

  // Filter staff data
  const filteredStaffData = staffData.filter((staff) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      staff.name.toLowerCase().includes(query) ||
      staff.email.toLowerCase().includes(query) ||
      (staff.telefone && staff.telefone.toLowerCase().includes(query)) ||
      (staff.role && staff.role.toLowerCase().includes(query))
    );
  });

  // Form handlers
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      email: "",
      username: "",
      password: "",
      name: "",
      telefone: "",
      nif: "",
      contrato: "",
      ferias: false,
      labels: [],
    });
  };

  const openCreateModal = () => {
    resetForm();
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    resetForm();
  };

  const handleCreateUser = async () => {
    if (
      !formData.email ||
      !formData.username ||
      !formData.password ||
      !formData.name
    ) {
      message.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    if (formData.password.length < 6) {
      message.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setCreatingUser(true);

    try {
      const token = getAuthToken();
      const userData = {
        email: formData.email,
        username: formData.username,
        password: formData.password,
        name: formData.name,
      };

      if (formData.telefone) userData.telefone = formData.telefone;
      if (formData.nif) userData.nif = formData.nif;
      if (formData.contrato) userData.contrato = formData.contrato;
      if (formData.labels.length > 0) userData.labels = formData.labels;
      userData.ferias = formData.ferias;

      const response = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar utilizador");
      }

      message.success(`Utilizador ${formData.name} criado com sucesso!`);
      closeCreateModal();
      loadStaffData();
      loadTeamStats();
    } catch (error) {
      console.error("Error creating user:", error);
      message.error(error.message || "Erro ao criar utilizador");
    } finally {
      setCreatingUser(false);
    }
  };

  // Chart configuration
  const COLORS = ["#ff6b35", "#4ecdc4", "#45b7d1", "#f7dc6f", "#bb8fce"];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p
              key={index}
              className="tooltip-item"
              style={{ color: entry.color }}
            >
              {entry.name}: <strong>{entry.value}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="manager-staff-view">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <div className="loading-text">A carregar equipa...</div>
        </div>
      </div>
    );
  }

  // Calculate basic stats
  const totalStaff = teamStats?.overview?.total_staff || staffData.length;
  const onlineStaff = teamStats?.overview?.online_staff || 0;
  const onVacation = teamStats?.overview?.on_vacation || 0;
  const totalHours = teamStats?.overview?.total_weekly_hours || 0;

  return (
    <div className="manager-staff-view">
      <div className="staff-container">
        {/* Header Card */}
        <div className="stock-header-card">
          <div className="stock-header-card__content">
            <div className="stock-header-card__left">
              <h1 className="stock-header-card__title">Gestão de Equipa</h1>
              <p className="stock-header-card__description">
                Análise completa de performance, atividade e estatísticas da
                equipa
              </p>
              <div className="stock-header-card__actions">
                <Select
                  value={selectedPeriod}
                  onChange={setSelectedPeriod}
                  style={{ width: 150 }}
                  size="large"
                  options={[
                    { value: "7", label: "Últimos 7 dias" },
                    { value: "30", label: "Últimos 30 dias" },
                    { value: "90", label: "Últimos 90 dias" },
                  ]}
                />
                <button
                  onClick={() => {
                    loadStaffData();
                    loadTeamStats();
                  }}
                  disabled={refreshing}
                  className="stock-header-card__btn stock-header-card__btn--secondary"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Atualizar
                </button>
                {isManager && (
                  <button
                    onClick={openCreateModal}
                    className="stock-header-card__btn stock-header-card__btn--primary"
                  >
                    <UserPlus size={16} />
                    Adicionar
                  </button>
                )}
              </div>
            </div>
            <div className="stock-header-card__right">
              <div className="stock-header-card__circles">
                <div className="circle circle-1"></div>
                <div className="circle circle-2"></div>
                <div className="circle circle-3"></div>
                <div className="circle circle-4"></div>
                <div className="circle circle-5"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview Grid */}
        <div className="stats-section">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Total Funcionários</span>
              <Users className="stat-icon" />
            </div>
            <div className="stat-value info">
              <NumberFlow value={totalStaff} />
            </div>
            <div className="stat-description">Membros da equipa</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Online</span>
              <UserCheck className="stat-icon" />
            </div>
            <div className="stat-value success">
              <NumberFlow value={onlineStaff} />
            </div>
            <div className="stat-description">Ativos agora</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">De Férias</span>
              <Calendar className="stat-icon" />
            </div>
            <div className="stat-value warning">
              <NumberFlow value={onVacation} />
            </div>
            <div className="stat-description">Em descanso</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Horas/Semana</span>
              <Clock className="stat-icon" />
            </div>
            <div className="stat-value info">
              <NumberFlow value={totalHours} />h
            </div>
            <div className="stat-description">Horas contratuais</div>
          </div>
        </div>

        {/* Charts Grid - ManagerView Inspired */}
        {teamStats && (
          <div className="charts-grid">
            {/* Top Performers by Orders */}
            <div className="card chart-card">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <Award size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Top Performers - Pedidos</h3>
                  <p>Funcionários com mais pedidos processados</p>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamStats.top_performers.by_orders}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="value"
                      fill="#ff6b35"
                      radius={[8, 8, 0, 0]}
                      name="Pedidos"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Performers by Revenue */}
            <div className="card chart-card">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <Euro size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Top Performers - Receita</h3>
                  <p>Funcionários com maior receita processada</p>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamStats.top_performers.by_revenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="value"
                      fill="#4ecdc4"
                      radius={[8, 8, 0, 0]}
                      name="Receita (€)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fastest Staff */}
            <div className="card chart-card">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <Zap size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Staff Mais Rápido</h3>
                  <p>Menor tempo médio de entrega</p>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamStats.top_performers.by_speed}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="value"
                      fill="#45b7d1"
                      radius={[8, 8, 0, 0]}
                      name="Tempo (min)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Role Distribution */}
            <div className="card chart-card">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <PieChart size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Distribuição por Função</h3>
                  <p>Pedidos processados por role</p>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={teamStats.role_breakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) =>
                        `${entry.role}: ${entry.orders_handled}`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="orders_handled"
                      nameKey="role"
                    >
                      {teamStats.role_breakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Hourly Activity Pattern */}
            <div className="card chart-card span-2">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <Activity size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Padrão de Atividade por Hora</h3>
                  <p>Volume de pedidos e staff ativo ao longo do dia</p>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={teamStats.hourly_activity}>
                    <defs>
                      <linearGradient
                        id="colorOrders"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#ff6b35"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#ff6b35"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorStaff"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#4ecdc4"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#4ecdc4"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Hora",
                        position: "insideBottom",
                        offset: -5,
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="orders_count"
                      stroke="#ff6b35"
                      fillOpacity={1}
                      fill="url(#colorOrders)"
                      name="Pedidos"
                    />
                    <Area
                      type="monotone"
                      dataKey="active_staff"
                      stroke="#4ecdc4"
                      fillOpacity={1}
                      fill="url(#colorStaff)"
                      name="Staff Ativo"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Performance Trend */}
            <div className="card chart-card span-2">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <TrendingUp size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Performance Diária da Equipa</h3>
                  <p>Pedidos totais e tempo médio de conclusão</p>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={teamStats.daily_performance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(date) =>
                        new Date(date).toLocaleDateString("pt-PT", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      }
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      labelFormatter={(date) =>
                        new Date(date).toLocaleDateString("pt-PT")
                      }
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="total_orders"
                      stroke="#ff6b35"
                      strokeWidth={2}
                      name="Total Pedidos"
                      dot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="avg_time"
                      stroke="#4ecdc4"
                      strokeWidth={2}
                      name="Tempo Médio (min)"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Staff Details Table */}
        <div className="main-content-card">
          <div className="content-controls">
            <Input
              placeholder="Pesquisar funcionário..."
              prefix={<Search size={18} style={{ color: "#9ca3af" }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: "500px", borderRadius: "12px" }}
              size="large"
            />
          </div>

          <Table
            columns={[
              {
                title: "Funcionário",
                dataIndex: "name",
                key: "name",
                render: (text, record) => (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <Avatar
                      size={48}
                      src={record.profileImg}
                      icon={<UserCircle />}
                      style={{
                        backgroundColor: "#f0f0f0",
                        border: "2px solid #e5e7eb",
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#1a1a1a",
                          fontSize: "14px",
                        }}
                      >
                        {text}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        {record.email}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                title: "Função",
                dataIndex: "role",
                key: "role",
                render: (role) => (
                  <Tag
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {role}
                  </Tag>
                ),
              },
              {
                title: "Estado",
                dataIndex: "status",
                key: "status",
                render: (status) => {
                  const isOnline = status === "online";
                  return (
                    <Tag
                      color={isOnline ? "success" : "default"}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: isOnline ? "#10b981" : "#6b7280",
                        }}
                      />
                      {isOnline ? "Online" : "Offline"}
                    </Tag>
                  );
                },
              },
              {
                title: "Horas/Semana",
                dataIndex: "hoursWorked",
                key: "hoursWorked",
                sorter: (a, b) => a.hoursWorked - b.hoursWorked,
                render: (hours) => (
                  <span style={{ fontWeight: 700, color: "#059669" }}>
                    <NumberFlow value={hours} />h
                  </span>
                ),
              },
              {
                title: "Performance",
                key: "performance",
                render: (_, record) => {
                  const staffStats = teamStats?.staff_details?.find(
                    (s) => s.user_id === record.id
                  );
                  if (!staffStats)
                    return <span style={{ color: "#9ca3af" }}>-</span>;
                  return (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background:
                            staffStats.performance_score >= 70
                              ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                              : staffStats.performance_score >= 40
                              ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                              : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                          color: "white",
                          fontWeight: 700,
                          fontSize: "14px",
                        }}
                      >
                        {staffStats.performance_score}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        {staffStats.orders.total} pedidos
                      </div>
                    </div>
                  );
                },
              },
              {
                title: "Ações",
                key: "actions",
                render: (_, record) => (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Button
                      type="primary"
                      size="small"
                      icon={<Eye size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/profile/${record.id}`;
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      Ver
                    </Button>
                  </div>
                ),
              },
            ]}
            dataSource={filteredStaffData}
            loading={refreshing}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} de ${total} funcionários`,
            }}
            onRow={(record) => ({
              onClick: () => {
                window.location.href = `/profile/${record.id}`;
              },
              style: { cursor: "pointer" },
            })}
          />
        </div>

        {/* Create User Modal */}
        {createModalOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div className="modal-overlay" onClick={closeCreateModal}>
              <div
                className="modal-container"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <div className="header-text">
                    <h2>
                      <UserCircle
                        size={20}
                        style={{ display: "inline", marginRight: "8px" }}
                      />
                      Adicionar Novo Funcionário
                    </h2>
                    <p>Preencha os dados do novo funcionário</p>
                  </div>
                  <button
                    onClick={closeCreateModal}
                    className="close-button"
                    disabled={creatingUser}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="modal-content">
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Nome Completo *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ex: João Silva"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="email@exemplo.com"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>Username *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="username"
                        value={formData.username}
                        onChange={(e) =>
                          handleInputChange("username", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Senha *</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Mínimo 6 caracteres"
                        value={formData.password}
                        onChange={(e) =>
                          handleInputChange("password", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>Telefone</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="+351 XXX XXX XXX"
                        value={formData.telefone}
                        onChange={(e) =>
                          handleInputChange("telefone", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>NIF</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="123456789"
                        value={formData.nif}
                        onChange={(e) =>
                          handleInputChange("nif", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>Tipo de Contrato</label>
                      <select
                        className="form-select"
                        value={formData.contrato}
                        onChange={(e) =>
                          handleInputChange("contrato", e.target.value)
                        }
                        disabled={creatingUser}
                      >
                        <option value="">Selecione o tipo</option>
                        <option value="Efetivo">Efetivo</option>
                        <option value="Estagiário">Estagiário</option>
                        <option value="Temporário">Temporário</option>
                        <option value="Freelancer">Freelancer</option>
                      </select>
                    </div>

                    <div className="form-group full-width">
                      <label>Funções / Labels</label>
                      <div className="labels-checkboxes">
                        {[
                          { value: "manager", label: "Manager" },
                          {
                            value: "Empregado de Mesa",
                            label: "Empregado de Mesa",
                          },
                          { value: "chef", label: "Chef" },
                          { value: "Limpeza", label: "Limpeza" },
                          { value: "Rececionista", label: "Rececionista" },
                        ].map((role) => (
                          <div key={role.value} className="label-checkbox-item">
                            <input
                              type="checkbox"
                              id={`role-${role.value}`}
                              checked={formData.labels.includes(role.value)}
                              onChange={(e) => {
                                const newLabels = e.target.checked
                                  ? [...formData.labels, role.value]
                                  : formData.labels.filter(
                                      (l) => l !== role.value
                                    );
                                handleInputChange("labels", newLabels);
                              }}
                              disabled={creatingUser}
                            />
                            <label htmlFor={`role-${role.value}`}>
                              {role.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="form-group full-width">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.ferias}
                          onChange={(e) =>
                            handleInputChange("ferias", e.target.checked)
                          }
                          disabled={creatingUser}
                        />
                        <span>De férias</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    onClick={closeCreateModal}
                    className="footer-button cancel"
                    disabled={creatingUser}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateUser}
                    className="footer-button primary"
                    disabled={creatingUser}
                  >
                    {creatingUser ? "A criar..." : "Criar"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};

export default ManagerStaffView;
