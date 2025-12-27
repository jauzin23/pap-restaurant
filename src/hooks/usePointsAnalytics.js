import { useState, useEffect, useCallback } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const usePointsAnalytics = (period = "week", month = null) => {
  const [timeline, setTimeline] = useState([]);
  const [topActions, setTopActions] = useState([]);
  const [activeDays, setActiveDays] = useState([]);
  const [velocity, setVelocity] = useState([]);
  const [hourlyPattern, setHourlyPattern] = useState([]);
  const [rankHistory, setRankHistory] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Clear previous data to prevent showing stale data
    setTimeline([]);
    setTopActions([]);
    setActiveDays([]);
    setVelocity([]);
    setHourlyPattern([]);
    setRankHistory([]);
    setMilestones([]);

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("Token de autenticação não encontrado");
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const monthParam = month ? `&month=${month}` : "";

      // Fetch all analytics in parallel
      const [
        timelineRes,
        actionsRes,
        activeDaysRes,
        velocityRes,
        hourlyRes,
        rankHistoryRes,
        milestonesRes,
      ] = await Promise.all([
        fetch(
          `${API_BASE_URL}/api/points/analytics/timeline?period=${period}${monthParam}`,
          { headers }
        ),
        fetch(
          `${API_BASE_URL}/api/points/analytics/actions?period=${period}${monthParam}&limit=10`,
          { headers }
        ),
        fetch(
          `${API_BASE_URL}/api/points/analytics/active-days?period=${period}${monthParam}`,
          { headers }
        ),
        fetch(
          `${API_BASE_URL}/api/points/analytics/velocity?period=${period}${monthParam}`,
          { headers }
        ),
        fetch(
          `${API_BASE_URL}/api/points/analytics/hourly?period=${period}${monthParam}`,
          { headers }
        ),
        fetch(
          `${API_BASE_URL}/api/points/analytics/rank-history?period=${period}${monthParam}&top=10`,
          { headers }
        ),
        fetch(
          `${API_BASE_URL}/api/points/analytics/milestones?period=${period}${monthParam}`,
          { headers }
        ),
      ]);

      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimeline(data.timeline || []);
      }

      if (actionsRes.ok) {
        const data = await actionsRes.json();
        setTopActions(data.actions || []);
      }

      if (activeDaysRes.ok) {
        const data = await activeDaysRes.json();
        setActiveDays(data.users || []);
      }

      if (velocityRes.ok) {
        const data = await velocityRes.json();
        setVelocity(data.velocity || []);
      }

      if (hourlyRes.ok) {
        const data = await hourlyRes.json();
        setHourlyPattern(data.hourly || []);
      }

      if (rankHistoryRes.ok) {
        const data = await rankHistoryRes.json();
        setRankHistory(data.users || []);
      }

      if (milestonesRes.ok) {
        const data = await milestonesRes.json();
        setMilestones(data.achievements || []);
      }
    } catch (err) {
      console.error("Erro ao buscar analytics:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period, month]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    timeline,
    topActions,
    activeDays,
    velocity,
    hourlyPattern,
    rankHistory,
    milestones,
    loading,
    error,
    refetch: fetchAnalytics,
  };
};
