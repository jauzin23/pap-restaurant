"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Package,
  Clock,
  CheckCircle,
  DollarSign,
  Trophy,
  TrendingUp,
  Target,
  Zap,
  Crown,
  Medal,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import NumberFlow from "@number-flow/react";
import { useUserStatsWebSocket } from "@/hooks/useUserStatsWebSocket";
import { usePointsData } from "@/hooks/usePointsData";
import "./UserPersonalStats.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const S3_BUCKET_URL = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL;

interface UserStatsProps {
  userId: string;
  dateFrom?: string;
  dateTo?: string;
}

const COLORS = ["#667eea", "#764ba2", "#f093fb", "#f5576c", "#4facfe"];

// Custom Select Component
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={selectRef} className={`custom-select ${className}`}>
      <div className="custom-select-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className={selectedOption ? "selected-text" : "placeholder-text"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`select-arrow ${isOpen ? "rotated" : ""}`}
        />
      </div>

      {isOpen && (
        <div className="custom-select-dropdown">
          {options.map((option) => (
            <div
              key={option.value}
              className={`custom-select-option ${
                option.value === value ? "selected" : ""
              }`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const UserPersonalStats: React.FC<UserStatsProps> = ({
  userId,
  dateFrom,
  dateTo,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { stats, loading } = useUserStatsWebSocket(userId, dateFrom, dateTo);
  const statsTyped = stats as any;
  const {
    userStats: pointsStats,
    loading: pointsLoading,
    refetch,
  } = usePointsData(userId, "all", selectedMonth);

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

  // Reset to page 1 when month filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth]);

  if (loading || !statsTyped) {
    return <div className="loading-container">A carregar estatísticas...</div>;
  }

  const hourlyData = statsTyped.hourly_pattern.map((h: any) => ({
    hour: `${h.hour}:00`,
    pedidos: h.orders_count,
  }));

  const dailyData = statsTyped.daily_breakdown.slice(0, 14).reverse();
  const scoreClass =
    statsTyped.performance_score >= 80
      ? "high-score"
      : statsTyped.performance_score >= 60
      ? "medium-score"
      : "low-score";

  return (
    <div className="user-stats-container">
      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon purple">
              <Package size={20} color="#667eea" />
            </div>
            <div className="stat-content">
              <div className="stat-label">Pedidos</div>
              <div className="stat-value">
                <NumberFlow value={statsTyped.orders.total_handled} />
              </div>
            </div>
          </div>
          <div className="stat-footer">{statsTyped.orders.active} ativos</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon green">
              <CheckCircle size={20} color="#10b981" />
            </div>
            <div className="stat-content">
              <div className="stat-label">Aceites</div>
              <div className="stat-value">
                <NumberFlow value={statsTyped.orders.accepted} />
              </div>
            </div>
          </div>
          <div className="stat-footer">
            {statsTyped.orders.prepared} preparados
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon orange">
              <Clock size={20} color="#f59e0b" />
            </div>
            <div className="stat-content">
              <div className="stat-label">Pedidos Entregues</div>
              <div className="stat-value">
                <NumberFlow value={statsTyped.orders.delivered} />
              </div>
            </div>
          </div>
          <div className="stat-footer">
            {statsTyped.time_performance.fast_percentage}% rápidos
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon blue">
              <CheckCircle size={20} color="#4facfe" />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Processados</div>
              <div className="stat-value">
                <NumberFlow value={statsTyped.orders.total_handled} />
              </div>
            </div>
          </div>
          <div className="stat-footer">Todos os pedidos em que participou</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {dailyData.length > 0 && (
          <div className="chart-card">
            <div className="chart-header">
              <h3>Atividade Diária</h3>
              <p>Últimas 2 semanas</p>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    new Date(value).getDate().toString()
                  }
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("pt-PT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  }
                  formatter={(value: any) => [value]}
                  separator=""
                />
                <Area
                  type="monotone"
                  dataKey="total_orders"
                  stroke="#667eea"
                  fillOpacity={1}
                  fill="url(#colorOrders)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {hourlyData.length > 0 && (
          <div className="chart-card">
            <div className="chart-header">
              <h3>Padrão de Trabalho</h3>
              <p>Pedidos por hora</p>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="hour"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="pedidos" radius={[8, 8, 0, 0]}>
                  {hourlyData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Items */}
      {statsTyped.top_items_handled.length > 0 && (
        <div className="top-items-section">
          <div className="section-header">
            <h3>Itens Mais Trabalhados</h3>
            <p>Top 5 produtos</p>
          </div>
          <div className="items-list">
            {statsTyped.top_items_handled
              .slice(0, 5)
              .map((item: any, index: number) => (
                <div key={index} className="item-card">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.item_name}
                      className="item-image"
                    />
                  ) : (
                    <div className="item-image" />
                  )}
                  <div className={`item-rank rank-${index + 1}`}>
                    {index + 1}
                  </div>
                  <div className="item-info">
                    <div className="item-name">{item.item_name}</div>
                    <div className="item-category">{item.category}</div>
                  </div>
                  <div className="item-stats">
                    <div className="item-count">{item.times_handled}x</div>
                    <div className="item-revenue">
                      {item.total_revenue.toFixed(2)}€
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Gamification Section */}
      {pointsStats && !pointsLoading && (
        <div className="gamification-section">
          <div className="section-header">
            <h3>
              <Trophy size={20} />
              Sistema de Pontos
            </h3>
          </div>

          {/* Highlight Cards */}
          <div className="points-highlight-grid">
            <div className="highlight-card total-points">
              <div className="highlight-icon">
                <Trophy size={32} />
              </div>
              <div className="highlight-content">
                <div className="highlight-label">Pontos Totais</div>
                <div className="highlight-value">
                  <NumberFlow value={pointsStats.summary.total_points} />
                </div>
              </div>
              <div className="highlight-decoration">
                <div className="shine" />
              </div>
            </div>

            <div className="highlight-card ranking">
              <div className="highlight-icon">
                {pointsStats.ranking.rank === 1 ? (
                  <Crown size={32} />
                ) : pointsStats.ranking.rank === 2 ? (
                  <Medal size={32} />
                ) : pointsStats.ranking.rank === 3 ? (
                  <Medal size={32} />
                ) : (
                  <Target size={32} />
                )}
              </div>
              <div className="highlight-content">
                <div className="highlight-label">Ranking</div>
                <div className="highlight-value">
                  #{pointsStats.ranking.rank}
                  <span className="highlight-total">
                    de {pointsStats.ranking.total_users}
                  </span>
                </div>
              </div>
              <div className="highlight-decoration">
                <div className="shine" />
              </div>
            </div>
          </div>

          {/* Points Stats Grid */}
          <div className="points-stats-grid">
            <div className="points-stat-card green">
              <div className="points-stat-icon">
                <TrendingUp size={20} />
              </div>
              <div className="points-stat-content">
                <div className="points-stat-value">
                  <NumberFlow value={pointsStats.summary.positive_points} />
                </div>
                <div className="points-stat-label">Pontos Ganhos</div>
              </div>
            </div>

            <div className="points-stat-card red">
              <div className="points-stat-icon">
                <Target size={20} />
              </div>
              <div className="points-stat-content">
                <div className="points-stat-value">
                  <NumberFlow value={pointsStats.summary.negative_points} />
                </div>
                <div className="points-stat-label">Penalizações</div>
              </div>
            </div>

            <div className="points-stat-card blue">
              <div className="points-stat-icon">
                <Zap size={20} />
              </div>
              <div className="points-stat-content">
                <div className="points-stat-value">
                  <NumberFlow value={pointsStats.summary.total_actions} />
                </div>
                <div className="points-stat-label">Ações Totais</div>
              </div>
            </div>
          </div>

          {/* Points Breakdown by Category */}
          {pointsStats.breakdown &&
            pointsStats.breakdown.filter((cat: any) => cat.category !== "bonus")
              .length > 0 && (
              <div className="breakdown-container">
                <h4>Distribuição de Pontos</h4>
                <div className="breakdown-list">
                  {pointsStats.breakdown
                    .filter((cat: any) => cat.category !== "bonus")
                    .map((cat: any, index: number) => (
                      <div key={index} className="breakdown-item">
                        <div className="breakdown-category">
                          <span className={`category-badge ${cat.category}`}>
                            {cat.category === "basic" ? (
                              <Package size={20} color="#10b981" />
                            ) : (
                              <AlertTriangle size={20} color="#ef4444" />
                            )}
                          </span>
                          <span className="category-name">
                            {cat.category === "basic"
                              ? "Básico"
                              : "Penalização"}
                          </span>
                        </div>
                        <div className="breakdown-stats">
                          <span className="breakdown-count">
                            {cat.total_actions} ações
                          </span>
                          <span
                            className={`breakdown-points ${
                              cat.total_points > 0 ? "positive" : "negative"
                            }`}
                          >
                            {cat.total_points > 0 ? "+" : ""}
                            {cat.total_points} pts
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

          {/* Recent Activity */}
          {pointsStats.history && pointsStats.history.length > 0 && (
            <div className="history-container">
              <div className="history-header">
                <h4>Histórico de Atividades</h4>
                <div className="month-selector">
                  <CustomSelect
                    value={selectedMonth || ""}
                    onChange={(value) => setSelectedMonth(value || null)}
                    options={[
                      { value: "", label: "Todos os Meses" },
                      ...availableMonths,
                    ]}
                    className="month-dropdown"
                  />
                </div>
              </div>
              <div className="history-list-profile">
                {(() => {
                  const totalItems = pointsStats.history.length;
                  const totalPages = Math.ceil(totalItems / itemsPerPage);
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const currentItems = pointsStats.history.slice(
                    startIndex,
                    endIndex
                  );

                  return (
                    <>
                      {currentItems.map((item: any) => (
                        <div key={item.id} className="history-item-profile">
                          <div
                            className={`points-badge-profile ${
                              item.points_earned > 0 ? "positive" : "negative"
                            }`}
                          >
                            {item.points_earned > 0 ? "+" : ""}
                            {item.points_earned}
                          </div>
                          <div className="history-details-profile">
                            <div className="history-description-profile">
                              {item.description}
                            </div>
                            <div className="history-time-profile">
                              {new Date(item.created_at).toLocaleString(
                                "pt-PT",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="pagination-controls">
                          <button
                            onClick={() =>
                              setCurrentPage(Math.max(1, currentPage - 1))
                            }
                            disabled={currentPage === 1}
                            className="pagination-btn"
                          >
                            <ChevronLeft size={16} />
                            Anterior
                          </button>

                          <div className="pagination-info">
                            Página {currentPage} de {totalPages}
                          </div>

                          <button
                            onClick={() =>
                              setCurrentPage(
                                Math.min(totalPages, currentPage + 1)
                              )
                            }
                            disabled={currentPage === totalPages}
                            className="pagination-btn"
                          >
                            Próxima
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
