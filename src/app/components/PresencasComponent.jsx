"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import { RefreshCw } from "lucide-react";
import "./PresencasComponent.scss";

// Componentes
import AttendanceList from "../presencas/components/AttendanceList";
import DevicesPanel from "../presencas/components/DevicesPanel";
import CardEnrollment from "../presencas/components/CardEnrollment";
import AttendanceStats from "../presencas/components/AttendanceStats";

export default function PresencasComponent() {
  const router = useRouter();
  const { socket, connected } = useWebSocketContext();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hoje"); // hoje, historico, dispositivos, logs

  // Dados
  const [presencasHoje, setPresencasHoje] = useState([]);
  const [dispositivos, setDispositivos] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    trabalhando: 0,
    totalHoje: 0,
    mediaHoras: 0,
  });

  // UI States
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Carregar presenças de hoje
  const loadPresencasHoje = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/api/presencas/hoje`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Combine both lists for display - working first, then completed
        const allPresencas = [
          ...(data.aTrabalhaar || []).map((p) => ({
            ...p,
            status: "trabalhando",
          })),
          ...(data.jaTrabalharam || []).map((p) => ({
            ...p,
            status: "concluido",
          })),
        ];

        setPresencasHoje(allPresencas);

        // Calculate statistics
        const trabalhando = data.aTrabalhaar?.length || 0;
        const totalHoje = data.presencas?.length || 0;
        const mediaHoras =
          totalHoje > 0
            ? (data.presencas || []).reduce(
                (acc, p) => acc + (p.horas_trabalhadas || 0),
                0
              ) / totalHoje
            : 0;

        setStats({
          trabalhando,
          totalHoje,
          mediaHoras: mediaHoras.toFixed(1),
        });
      }
    } catch (error) {
      console.error("Erro ao carregar presenças:", error);
    }
  };

  // Helper function to check if device is actually online
  // Devices send heartbeat every 30 seconds. If 2 heartbeats are missed (60 seconds), consider offline
  const isDeviceOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffSeconds = (now - lastSeenDate) / 1000;
    const HEARTBEAT_INTERVAL = 30; // seconds
    const MISSED_HEARTBEATS_THRESHOLD = 2;
    const offlineThreshold = HEARTBEAT_INTERVAL * MISSED_HEARTBEATS_THRESHOLD; // 60 seconds
    return diffSeconds < offlineThreshold;
  };

  // Carregar dispositivos
  const loadDispositivos = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${API_BASE_URL}/api/presencas/dispositivos`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Update is_online based on last_seen timestamp
        const updatedDevices = (data.dispositivos || []).map((device) => ({
          ...device,
          is_online: isDeviceOnline(device.last_seen),
        }));
        setDispositivos(updatedDevices);
      }
    } catch (error) {
      console.error("Erro ao carregar dispositivos:", error);
    }
  };

  // Verificar autenticação e role de gestor
  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push("/login");
          return;
        }

        // Apenas gestores podem aceder
        const isManager =
          currentUser.labels?.includes("gestor") ||
          currentUser.labels?.includes("manager");

        if (!isManager) {
          router.push("/");
          return;
        }

        setUser(currentUser);
        setLoading(false);
      } catch (error) {
        console.error("Auth error:", error);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // Carregar dados iniciais
  useEffect(() => {
    if (!user) return;

    loadPresencasHoje();
    loadDispositivos();

    // Refresh a cada 30 segundos
    const interval = setInterval(() => {
      loadPresencasHoje();
      loadDispositivos();
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // WebSocket: Escutar atualizações de presenças
  useEffect(() => {
    if (!socket || !connected) return;

    console.log("[PRESENCAS] WebSocket conectado, configurando listeners...");

    // Nova presença registada
    socket.on("presenca:registada", (data) => {
      console.log("[PRESENCAS] Presença registada:", data);
      loadPresencasHoje();
    });

    // Dispositivo conectado
    socket.on("dispositivo:conectado", (data) => {
      console.log("[PRESENCAS] Dispositivo conectado:", data);
      loadDispositivos();
    });

    // Dispositivo desconectado
    socket.on("dispositivo:desconectado", (data) => {
      console.log("[PRESENCAS] Dispositivo desconectado:", data);
      loadDispositivos();
    });

    // Status do dispositivo atualizado
    socket.on("dispositivo:status", (data) => {
      console.log("[PRESENCAS] Status do dispositivo atualizado:", data);
      loadDispositivos();
    });

    // Log do dispositivo
    socket.on("dispositivo:log", (data) => {
      console.log("[PRESENCAS] Log do dispositivo:", data);
      setLogs((prevLogs) => [data, ...prevLogs].slice(0, 100)); // Keep last 100 logs
    });

    // Vinculação bem-sucedida
    socket.on("vinculacao:sucesso", (data) => {
      console.log("[PRESENCAS] Vinculação bem-sucedida:", data);
      setShowEnrollmentModal(false);
      loadPresencasHoje();
      loadDispositivos();
    });

    // Vinculação falhou
    socket.on("vinculacao:erro", (data) => {
      console.error("[PRESENCAS] Erro na vinculação:", data);
    });

    return () => {
      console.log("[PRESENCAS] Removendo listeners WebSocket...");
      socket.off("presenca:registada");
      socket.off("dispositivo:conectado");
      socket.off("dispositivo:desconectado");
      socket.off("dispositivo:status");
      socket.off("dispositivo:log");
      socket.off("vinculacao:sucesso");
      socket.off("vinculacao:erro");
    };
  }, [socket, connected]);

  // Refresh manual
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPresencasHoje(), loadDispositivos()]);
    setRefreshing(false);
  };

  // Abrir modal de vinculação
  const handleOpenEnrollment = (device) => {
    setSelectedDevice(device);
    setShowEnrollmentModal(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="presencas-component">
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

  // Unauthorized - should not happen due to redirect, but just in case
  if (!user) {
    return null;
  }

  return (
    <div className="presencas-component">
      {/* Header */}
      <div className="presencas-header">
        <div className="presencas-header__content">
          <div className="presencas-header__left">
            <h1 className="presencas-header__title">Sistema de Presenças</h1>
            <p className="presencas-header__description">
              Gestão de presenças e dispositivos de controlo de acesso.
            </p>
          </div>
          <div className="presencas-header__actions">
            <button
              className={`presencas-header__btn presencas-header__btn--secondary ${
                refreshing ? "refreshing" : ""
              }`}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <AttendanceStats stats={stats} />

      {/* Tabs */}
      <div className="presencas-tabs">
        <button
          className={`tab ${activeTab === "hoje" ? "active" : ""}`}
          onClick={() => setActiveTab("hoje")}
        >
          Hoje
        </button>
        <button
          className={`tab ${activeTab === "dispositivos" ? "active" : ""}`}
          onClick={() => setActiveTab("dispositivos")}
        >
          Dispositivos ({dispositivos.filter((d) => d.is_online).length}/
          {dispositivos.length})
        </button>
        <button
          className={`tab ${activeTab === "logs" ? "active" : ""}`}
          onClick={() => setActiveTab("logs")}
        >
          Logs ({logs.length})
        </button>
      </div>

      {/* Content */}
      <div className="presencas-content">
        {activeTab === "hoje" && (
          <AttendanceList
            presencas={presencasHoje}
            onRefresh={loadPresencasHoje}
          />
        )}

        {activeTab === "dispositivos" && (
          <DevicesPanel
            dispositivos={dispositivos}
            onRefresh={loadDispositivos}
            onOpenEnrollment={handleOpenEnrollment}
          />
        )}

        {activeTab === "logs" && (
          <div className="logs-panel">
            <div className="logs-header">
              <h3>Logs de Dispositivos (Tempo Real)</h3>
              <button className="btn-clear" onClick={() => setLogs([])}>
                Limpar
              </button>
            </div>
            <div className="logs-list">
              {logs.length === 0 ? (
                <div className="logs-empty">
                  <p>
                    Nenhum log recebido ainda. Os logs aparecem em tempo real.
                  </p>
                </div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`log-item log-item--${log.nivel || "info"}`}
                  >
                    <div className="log-item__header">
                      <span className="log-item__device">{log.device_id}</span>
                      <span className="log-item__type">{log.tipo_log}</span>
                      <span className="log-item__time">
                        {new Date(log.timestamp).toLocaleTimeString("pt-PT")}
                      </span>
                    </div>
                    <div className="log-item__message">{log.mensagem}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Vinculação */}
      {showEnrollmentModal && (
        <CardEnrollment
          device={selectedDevice}
          onClose={() => {
            setShowEnrollmentModal(false);
            setSelectedDevice(null);
          }}
        />
      )}
    </div>
  );
}
