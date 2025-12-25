"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Medal,
  Crown,
  Star,
  Settings,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Zap,
  Clock,
  Award,
  BarChart3,
} from "lucide-react";
import { usePointsData } from "@/hooks/usePointsData";
import { usePointsAnalytics } from "@/hooks/usePointsAnalytics";
import NumberFlow from "@number-flow/react";
import PointsConfigManager from "./PointsConfigManager";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./GamificationView.scss";

const GamificationView = ({ user, onLoaded }) => {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showPointsConfig, setShowPointsConfig] = useState(false);
  const [isManager] = useState(
    () => user?.labels?.includes("manager") || false
  );
  const [dataLoaded, setDataLoaded] = useState(false);
  const { leaderboard, globalStats, loading } = usePointsData(
    null,
    selectedPeriod,
    selectedMonth
  );
  const {
    timeline,
    topActions,
    activeDays,
    velocity,
    hourlyPattern,
    rankHistory,
    milestones,
    loading: analyticsLoading,
  } = usePointsAnalytics(selectedPeriod, selectedMonth);

  // Debug logging
  useEffect(() => {
    if (!analyticsLoading && !loading) {
      setDataLoaded(true);
      if (onLoaded && !dataLoaded) onLoaded();
    }
  }, [analyticsLoading, loading, onLoaded, dataLoaded]);

  const periods = [
    { value: "day", label: "Hoje" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mês" },
    { value: "all", label: "Histórico" },
  ];

  // Generate list of available months (last 12 months)
  const getAvailableMonths = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      const label = date.toLocaleDateString("pt-PT", {
        month: "long",
        year: "numeric",
      });
      months.push({ value, label });
    }
    return months;
  };

  const availableMonths = getAvailableMonths();

  // Chart colors
  const COLORS = {
    primary: "#3b82f6",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    purple: "#8b5cf6",
    pink: "#ec4899",
    teal: "#14b8a6",
    indigo: "#6366f1",
  };

  const CHART_COLORS = [
    COLORS.primary,
    COLORS.success,
    COLORS.warning,
    COLORS.purple,
    COLORS.pink,
    COLORS.teal,
    COLORS.indigo,
    COLORS.danger,
  ];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Format the label (date) properly
      let formattedLabel = label;
      try {
        let date;
        if (typeof label === "string") {
          const cleanLabel = label.replace(/TZ$/, "");
          date = new Date(cleanLabel);
        } else {
          date = new Date(label);
        }

        if (!isNaN(date.getTime())) {
          formattedLabel = date.toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        }
      } catch (error) {
        console.warn("Tooltip date parsing error:", error, label);
      }

      return (
        <div className="custom-tooltip">
          <p className="label">{formattedLabel}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="gamification-view">
      {/* Conditional Rendering: Points Config or Analytics Dashboard */}
      {showPointsConfig ? (
        <div className="points-config-container">
          <button
            onClick={() => setShowPointsConfig(false)}
            className="back-button"
          >
            <ArrowLeft size={18} />
            Voltar ao Dashboard
          </button>
          <PointsConfigManager token={localStorage.getItem("auth_token")} />
        </div>
      ) : (
        <>
          {/* Header Card */}
          <div className="stock-header-card">
            <div className="stock-header-card__content">
              <div className="stock-header-card__left">
                <h1 className="stock-header-card__title">
                  Dashboard de Performance
                </h1>
                <p className="stock-header-card__description">
                  Análise completa de pontos, rankings e desempenho da equipa
                </p>
                <div className="stock-header-card__actions">
                  {isManager && (
                    <button
                      onClick={() => setShowPointsConfig(true)}
                      className="stock-header-card__btn stock-header-card__btn--primary"
                    >
                      <Settings size={16} />
                      Configurar Pontos
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

          {/* Global Stats */}
          {globalStats && (
            <div className="global-stats-grid">
              <div className="global-stat-card">
                <div className="stat-header">
                  <span className="stat-title">Utilizadores Ativos</span>
                  <Trophy className="stat-icon" />
                </div>
                <div className="stat-value">
                  <NumberFlow value={globalStats.totals?.active_users || 0} />
                </div>
                <div className="stat-description">Membros ativos da equipa</div>
              </div>

              <div className="global-stat-card">
                <div className="stat-header">
                  <span className="stat-title">Pontos Distribuídos</span>
                  <Star className="stat-icon" />
                </div>
                <div className="stat-value">
                  <NumberFlow
                    value={globalStats.totals?.total_points_distributed || 0}
                  />
                </div>
                <div className="stat-description">
                  Total de pontos atribuídos
                </div>
              </div>

              <div className="global-stat-card">
                <div className="stat-header">
                  <span className="stat-title">Total de Ações</span>
                  <Medal className="stat-icon" />
                </div>
                <div className="stat-value">
                  <NumberFlow value={globalStats.totals?.total_actions || 0} />
                </div>
                <div className="stat-description">
                  Ações realizadas no período
                </div>
              </div>

              <div className="global-stat-card">
                <div className="stat-header">
                  <span className="stat-title">Média por Ação</span>
                  <BarChart3 className="stat-icon" />
                </div>
                <div className="stat-value">
                  <NumberFlow
                    value={parseFloat(
                      globalStats.totals?.avg_points_per_action || 0
                    )}
                    format={{ minimumFractionDigits: 1 }}
                  />
                </div>
                <div className="stat-description">Pontos médios por ação</div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="leaderboard-tabs">
            {periods.map((p) => (
              <button
                key={p.value}
                className={`leaderboard-tab ${
                  selectedPeriod === p.value ? "active" : ""
                }`}
                onClick={() => {
                  setSelectedPeriod(p.value);
                  setSelectedMonth(null);
                }}
              >
                <Trophy size={18} />
                {p.label}
              </button>
            ))}
            <div className="month-selector">
              <select
                value={selectedMonth || ""}
                onChange={(e) => setSelectedMonth(e.target.value || null)}
                className="month-dropdown"
              >
                <option value="">Por Período</option>
                {availableMonths.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Analytics Grid */}
          <div className="analytics-grid">
            {/* Graph 1: Points Distribution Over Time - FULL WIDTH */}
            <div className="chart-card full-width">
              <div className="chart-header">
                <div className="chart-title">
                  <Activity size={20} />
                  Distribuição de Pontos ao Longo do Tempo
                </div>
              </div>
              <div className="chart-content">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeline}>
                    <defs>
                      <linearGradient
                        id="colorPositive"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={COLORS.success}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={COLORS.success}
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorNegative"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={COLORS.danger}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={COLORS.danger}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        try {
                          // Handle different date formats
                          let date;
                          if (typeof value === "string") {
                            // Remove timezone suffix if present (e.g., "2025-11-17T00:00:000TZ" -> "2025-11-17T00:00:00")
                            const cleanValue = value.replace(/TZ$/, "");
                            date = new Date(cleanValue);
                          } else {
                            date = new Date(value);
                          }

                          // Check if date is valid
                          if (isNaN(date.getTime())) {
                            return value; // Return original value if parsing fails
                          }

                          return date.toLocaleDateString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                          });
                        } catch (error) {
                          console.warn("Date parsing error:", error, value);
                          return value;
                        }
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="positive_points"
                      stroke={COLORS.success}
                      fillOpacity={1}
                      fill="url(#colorPositive)"
                      name="Pontos Positivos"
                    />
                    <Area
                      type="monotone"
                      dataKey="negative_points"
                      stroke={COLORS.danger}
                      fillOpacity={1}
                      fill="url(#colorNegative)"
                      name="Penalizações"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Graph 2: Category Breakdown (Pie) */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Target size={20} />
                  Distribuição por Categoria
                </div>
              </div>
              <div className="chart-content">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={topActions.slice(0, 5)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="description"
                    >
                      {topActions.slice(0, 5).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Graph 3: Top Actions Leaderboard */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Zap size={20} />
                  Top 10 Ações
                </div>
              </div>
              <div className="chart-content">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topActions.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="description"
                      type="category"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      fill={COLORS.primary}
                      name="Contagem"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Graph 4: Velocity (Growth) - FULL WIDTH */}
            <div className="chart-card full-width">
              <div className="chart-header">
                <div className="chart-title">
                  <TrendingUp size={20} />
                  Velocidade de Crescimento (Top 15)
                </div>
              </div>
              <div className="chart-content">
                <div className="velocity-list">
                  {velocity.slice(0, 15).map((user, index) => {
                    const isPositive = user.percentage_change >= 0;
                    return (
                      <div
                        key={user.user_id}
                        className="velocity-item"
                        onClick={() => router.push(`/profile/${user.user_id}`)}
                      >
                        <div className="velocity-rank">#{index + 1}</div>
                        <div className="velocity-user">
                          {user.profile_image ? (
                            <img
                              src={user.profile_image}
                              alt={user.name}
                              className="velocity-avatar"
                            />
                          ) : (
                            <div className="velocity-avatar-placeholder">
                              {user.name.charAt(0)}
                            </div>
                          )}
                          <span className="velocity-name">{user.name}</span>
                        </div>
                        <div className="velocity-stats">
                          <span className="velocity-points">
                            <NumberFlow value={user.current_points} /> pts
                          </span>
                          <div
                            className={`velocity-change ${
                              isPositive ? "positive" : "negative"
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp size={16} />
                            ) : (
                              <TrendingDown size={16} />
                            )}
                            <NumberFlow
                              value={Math.abs(user.percentage_change)}
                              format={{ minimumFractionDigits: 1 }}
                            />
                            %
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Graph 7: Active Days Comparison */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Activity size={20} />
                  Dias Ativos (Top 10)
                </div>
              </div>
              <div className="chart-content">
                {activeDays && activeDays.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={activeDays.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="active_days"
                        fill={COLORS.teal}
                        name="Dias Ativos"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-chart-state">
                    <Activity size={48} />
                    <p>Sem dados de atividade para este período</p>
                  </div>
                )}
              </div>
            </div>

            {/* Graph 8: Hourly Pattern (Radar) */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Clock size={20} />
                  Padrão de Atividade por Hora
                </div>
              </div>
              <div className="chart-content">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={hourlyPattern}>
                    <PolarGrid />
                    <PolarAngleAxis
                      dataKey="hour"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(hour) => `${hour}h`}
                    />
                    <PolarRadiusAxis angle={90} domain={[0, "auto"]} />
                    <Radar
                      name="Ações"
                      dataKey="actions_count"
                      stroke={COLORS.purple}
                      fill={COLORS.purple}
                      fillOpacity={0.6}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Graph 9: Rank Movement Tracker - FULL WIDTH */}
            <div className="chart-card full-width">
              <div className="chart-header">
                <div className="chart-title">
                  <TrendingUp size={20} />
                  Evolução de Rankings (Top 10)
                </div>
              </div>
              <div className="chart-content">
                {rankHistory && rankHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis
                        dataKey="date"
                        type="category"
                        allowDuplicatedCategory={false}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          if (!value) return "";
                          const date = new Date(value);
                          return date.toLocaleDateString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                          });
                        }}
                      />
                      <YAxis
                        reversed
                        domain={[1, 10]}
                        tick={{ fontSize: 12 }}
                        label={{
                          value: "Ranking",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {rankHistory.slice(0, 10).map((user, index) => (
                        <Line
                          key={user.user_id}
                          data={user.history}
                          type="monotone"
                          dataKey="rank"
                          stroke={CHART_COLORS[index % CHART_COLORS.length]}
                          name={user.name}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-chart-state">
                    <TrendingUp size={48} />
                    <p>Histórico insuficiente para mostrar evolução</p>
                    <span>São necessários pelo menos 2 dias de dados</span>
                  </div>
                )}
              </div>
            </div>

            {/* Graph 10: Achievement Milestones */}
            <div className="chart-card full-width">
              <div className="chart-header">
                <div className="chart-title">
                  <Award size={20} />
                  Marcos Conquistados
                </div>
              </div>
              <div className="chart-content">
                <div className="milestones-timeline">
                  {milestones.slice(0, 10).map((user) =>
                    user.milestones.map((milestone, idx) => (
                      <div
                        key={`${user.user_id}-${milestone.points}`}
                        className="milestone-item"
                        onClick={() => router.push(`/profile/${user.user_id}`)}
                      >
                        <div className="milestone-badge">
                          <Award
                            size={24}
                            color={
                              milestone.points >= 10000
                                ? "#fbbf24"
                                : milestone.points >= 5000
                                ? "#94a3b8"
                                : "#cd7f32"
                            }
                          />
                        </div>
                        <div className="milestone-content">
                          <div className="milestone-user">
                            {user.profile_image ? (
                              <img
                                src={user.profile_image}
                                alt={user.name}
                                className="milestone-avatar"
                              />
                            ) : (
                              <div className="milestone-avatar-placeholder">
                                {user.name.charAt(0)}
                              </div>
                            )}
                            <span className="milestone-name">{user.name}</span>
                          </div>
                          <div className="milestone-info">
                            <span className="milestone-points">
                              <NumberFlow value={milestone.points} /> pontos
                            </span>
                            <span className="milestone-date">
                              {new Date(
                                milestone.achieved_at
                              ).toLocaleDateString("pt-PT")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Leaderboard - FULL WIDTH */}
            <div className="chart-card full-width leaderboard-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Trophy size={20} />
                  Classificação Geral
                </div>
              </div>
              <div className="chart-content">
                <div className="leaderboard-list">
                  {leaderboard.map((player, index) => {
                    const rankColor =
                      index === 0
                        ? "#fbbf24"
                        : index === 1
                        ? "#94a3b8"
                        : index === 2
                        ? "#cd7f32"
                        : "#64748b";

                    let rankIcon = null;
                    if (index === 0) {
                      rankIcon = <Crown size={24} color={rankColor} />;
                    } else if (index === 1) {
                      rankIcon = <Medal size={24} color={rankColor} />;
                    } else if (index === 2) {
                      rankIcon = <Trophy size={24} color={rankColor} />;
                    }

                    // Find velocity for this player
                    const playerVelocity = velocity.find(
                      (v) => v.user_id === player.user_id
                    );

                    return (
                      <div
                        key={player.user_id}
                        className="leaderboard-item"
                        onClick={() =>
                          router.push(`/profile/${player.user_id}`)
                        }
                      >
                        <div className="rank" style={{ color: rankColor }}>
                          {rankIcon || `#${index + 1}`}
                        </div>

                        <div className="player-info">
                          {player.profile_image ? (
                            <img
                              src={player.profile_image}
                              alt={player.name}
                              className="player-avatar"
                            />
                          ) : (
                            <div className="player-avatar-placeholder">
                              {player.name.charAt(0)}
                            </div>
                          )}
                          <div className="player-details">
                            <div className="player-name">{player.name}</div>
                            <div className="player-stats">
                              {player.total_actions} ações
                              {playerVelocity && (
                                <span
                                  className={`velocity-badge ${
                                    playerVelocity.percentage_change >= 0
                                      ? "positive"
                                      : "negative"
                                  }`}
                                >
                                  {playerVelocity.percentage_change >= 0 ? (
                                    <TrendingUp size={12} />
                                  ) : (
                                    <TrendingDown size={12} />
                                  )}
                                  {Math.abs(
                                    playerVelocity.percentage_change
                                  ).toFixed(0)}
                                  %
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="player-points">
                          <div className="points-value">
                            <NumberFlow value={player.total_points} />
                          </div>
                          <div className="points-label">pts</div>
                        </div>
                      </div>
                    );
                  })}
                  {leaderboard.length === 0 && (
                    <div className="empty-chart-state">
                      <Trophy size={48} />
                      <p>Nenhum utilizador com pontos neste período</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GamificationView;
