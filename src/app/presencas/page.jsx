"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import { ArrowLeft, RefreshCw } from "lucide-react";
import "./presencas.scss";

// Componentes
import AttendanceList from "./components/AttendanceList";
import DevicesPanel from "./components/DevicesPanel";
import CardEnrollment from "./components/CardEnrollment";
import AttendanceStats from "./components/AttendanceStats";

const PresencasPage = () => {
  const router = useRouter();
  const { socket, connected } = useWebSocketContext();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hoje"); // hoje, historico, dispositivos

  // Dados
  const [presencasHoje, setPresencasHoje] = useState([]);
  const [dispositivos, setDispositivos] = useState([]);
  const [stats, setStats] = useState({
    trabalhando: 0,
    totalHoje: 0,
    mediaHoras: 0,
  });

  // UI States
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Verificar autenticação
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
        return;
      }
    };

    checkAuth();
  }, [router]);

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
        setPresencasHoje(data.presencas || []);

        // Calcular estatísticas
        const trabalhando = data.presencas.filter(
          (p) => p.status === "trabalhando"
        ).length;
        const totalHoje = data.presencas.length;
        const mediaHoras =
          data.presencas.reduce(
            (acc, p) => acc + (p.horas_trabalhadas || 0),
            0
          ) / (totalHoje || 1);

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
        setDispositivos(data.dispositivos || []);
      }
    } catch (error) {
      console.error("Erro ao carregar dispositivos:", error);
    }
  };

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

    // Nova presença registada
    socket.on("presenca:registada", (data) => {
      console.log("Presença registada:", data);
      loadPresencasHoje(); // Recarregar lista
    });

    // Dispositivo conectado
    socket.on("dispositivo:conectado", (data) => {
      console.log("Dispositivo conectado:", data);
      loadDispositivos();
    });

    // Dispositivo desconectado
    socket.on("dispositivo:desconectado", (data) => {
      console.log("Dispositivo desconectado:", data);
      loadDispositivos();
    });

    // Vinculação bem-sucedida
    socket.on("vinculacao:sucesso", (data) => {
      console.log("Vinculação bem-sucedida:", data);
      setShowEnrollmentModal(false);
      loadPresencasHoje();
    });

    return () => {
      socket.off("presenca:registada");
      socket.off("dispositivo:conectado");
      socket.off("dispositivo:desconectado");
      socket.off("vinculacao:sucesso");
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

  if (loading) {
    return (
      <div className="presencas-loading">
        <div className="spinner"></div>
        <p>A carregar...</p>
      </div>
    );
  }

  return (
    <div className="presencas-page">
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
};

export default PresencasPage;
