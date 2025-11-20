import { useState, useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const useUserStatsWebSocket = (userId, dateFrom, dateTo) => {
  const { socket, connected } = useWebSocketContext();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch inicial
  const fetchStats = useCallback(async () => {
    if (!userId) return;

    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);

    try {
      const response = await fetch(
        `${API_BASE_URL}/stats/user/${userId}/comprehensive?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch user stats:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, dateFrom, dateTo]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Configurar listener WebSocket para estatísticas do usuário
  useEffect(() => {
    if (!socket || !connected || !userId) return;

    // Listener para updates - quando receber, fazer refetch
    const handleUserStatsUpdate = (data) => {
      console.log("📊 User stats update notification received");
      // Se os dados vierem completos no evento, usar diretamente
      if (data && data.user_id === userId && data.orders) {
        setStats(data);
      } else {
        // Caso contrário, fazer refetch
        fetchStats();
      }
    };

    socket.on("stats:user:updated", handleUserStatsUpdate);

    return () => {
      socket.off("stats:user:updated", handleUserStatsUpdate);
    };
  }, [socket, connected, userId, fetchStats]);

  return {
    stats,
    loading,
    refetch: fetchStats,
  };
};
