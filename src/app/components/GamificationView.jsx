"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Medal, Crown, Star } from "lucide-react";
import { usePointsData } from "@/hooks/usePointsData";
import NumberFlow from "@number-flow/react";
import "./GamificationView.scss";

const GamificationView = () => {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const { leaderboard, globalStats, loading } = usePointsData(
    null,
    selectedPeriod,
    selectedMonth
  );

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

  if (loading) {
    return (
      <div className="gamification-view">
        <div className="loading-container">
          <div className="spinner" />
          <p>A carregar leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gamification-view">
      {/* Global Stats */}
      {globalStats && (
        <div className="global-stats-grid">
          <div className="global-stat-card">
            <div className="global-stat-icon">
              <Trophy size={24} />
            </div>
            <div className="global-stat-content">
              <div className="global-stat-value">
                <NumberFlow value={globalStats.totals?.active_users || 0} />
              </div>
              <div className="global-stat-label">Utilizadores Ativos</div>
            </div>
          </div>

          <div className="global-stat-card">
            <div className="global-stat-icon">
              <Star size={24} />
            </div>
            <div className="global-stat-content">
              <div className="global-stat-value">
                <NumberFlow
                  value={globalStats.totals?.total_points_distributed || 0}
                />
              </div>
              <div className="global-stat-label">Pontos Distribuídos</div>
            </div>
          </div>

          <div className="global-stat-card">
            <div className="global-stat-icon">
              <Medal size={24} />
            </div>
            <div className="global-stat-content">
              <div className="global-stat-value">
                <NumberFlow value={globalStats.totals?.total_actions || 0} />
              </div>
              <div className="global-stat-label">Total de Ações</div>
            </div>
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
      </div>

      {/* Leaderboard */}
      <div className="leaderboard-section">
        <div className="section-header">
          <h3>Classificação</h3>
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

            return (
              <div
                key={player.user_id}
                className="leaderboard-item"
                onClick={() => router.push(`/profile/${player.user_id}`)}
                style={{ cursor: "pointer" }}
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
        </div>
      </div>
    </div>
  );
};

export default GamificationView;
