import { useState, useEffect, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const useStatsWebSocket = () => {
  const { socket, connected } = useWebSocketContext();
  const [liveStats, setLiveStats] = useState(null);
  const [staffStats, setStaffStats] = useState(null);
  const [topItems, setTopItems] = useState(null);
  const [kitchenStats, setKitchenStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch inicial de todas as estatísticas
  const fetchAllStats = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [live, staff, items, kitchen] = await Promise.all([
        fetch(`${API_BASE_URL}/stats/live`, { headers }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`${API_BASE_URL}/stats/staff/performance`, { headers }).then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetch(`${API_BASE_URL}/stats/items/top-selling`, { headers }).then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetch(`${API_BASE_URL}/stats/operations/tempo-medio-resposta`, {
          headers,
        }).then((r) => (r.ok ? r.json() : null)),
      ]);

      if (live) setLiveStats(live);
      if (staff) setStaffStats(staff);
      if (items) setTopItems(items);
      if (kitchen) setKitchenStats(kitchen);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllStats();
  }, [fetchAllStats]);

  // Configurar listeners WebSocket
  useEffect(() => {
    if (!socket || !connected) return;

    // Live stats updates - refetch quando receber notificação
    const handleLiveUpdate = () => {
      console.log("📊 Live stats notification - refetching...");
      fetchAllStats();
    };

    // Staff stats updates - refetch quando receber notificação
    const handleStaffUpdate = () => {
      console.log("👥 Staff stats notification - refetching...");
      fetchAllStats();
    };

    // Top items updates - refetch quando receber notificação
    const handleTopItemsUpdate = () => {
      console.log("🏆 Top items notification - refetching...");
      fetchAllStats();
    };

    // Kitchen stats updates - refetch quando receber notificação
    const handleKitchenUpdate = () => {
      console.log("⏱️ Kitchen stats notification - refetching...");
      fetchAllStats();
    };

    socket.on("stats:live:updated", handleLiveUpdate);
    socket.on("stats:staff:updated", handleStaffUpdate);
    socket.on("stats:topitems:updated", handleTopItemsUpdate);
    socket.on("stats:kitchen:updated", handleKitchenUpdate);

    return () => {
      socket.off("stats:live:updated", handleLiveUpdate);
      socket.off("stats:staff:updated", handleStaffUpdate);
      socket.off("stats:topitems:updated", handleTopItemsUpdate);
      socket.off("stats:kitchen:updated", handleKitchenUpdate);
    };
  }, [socket, connected, fetchAllStats]);

  return {
    liveStats,
    staffStats,
    topItems,
    kitchenStats,
    loading,
    refetch: fetchAllStats,
  };
};
