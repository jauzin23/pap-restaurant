import { useState, useEffect, useCallback } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const usePointsData = (userId = null, period = "week", month = null) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [globalStats, setGlobalStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("Token de autenticação não encontrado");
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Build query params for month filtering
      const monthParam = month ? `&month=${month}` : "";

      // Fetch leaderboard
      const leaderboardRes = await fetch(
        `${API_BASE_URL}/api/points/leaderboard?period=${period}&limit=50${monthParam}`,
        { headers }
      );

      if (!leaderboardRes.ok) {
        throw new Error("Erro ao buscar leaderboard");
      }

      const leaderboardData = await leaderboardRes.json();
      setLeaderboard(leaderboardData.leaderboard || []);

      // Fetch user stats if userId provided
      if (userId) {
        const userStatsRes = await fetch(
          `${API_BASE_URL}/api/points/user/${userId}?limit=1000${monthParam}`,
          { headers }
        );

        if (userStatsRes.ok) {
          const userData = await userStatsRes.json();
          setUserStats(userData);
        }
      }

      // Fetch global stats
      const globalStatsRes = await fetch(`${API_BASE_URL}/api/points/stats`, {
        headers,
      });

      if (globalStatsRes.ok) {
        const globalData = await globalStatsRes.json();
        setGlobalStats(globalData);
      }
    } catch (err) {
      console.error("Erro ao buscar dados de pontos:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, period, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    leaderboard,
    userStats,
    globalStats,
    loading,
    error,
    refetch: fetchData,
  };
};
