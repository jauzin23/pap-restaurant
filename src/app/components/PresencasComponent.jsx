"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Select } from "antd";
import { useRouter } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "../../lib/auth";
import { API_BASE_URL, users } from "../../lib/api";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import {
  RefreshCw,
  X,
  AlertTriangle,
  User,
  LogIn,
  LogOut,
  Clock,
  Timer,
  Users,
  UserCog,
  Calendar,
  Nfc,
  FileText,
  CreditCard,
} from "lucide-react";
import "./PresencasComponent.scss";

// ========== INTEGRATED COMPONENTS ==========

// AttendanceStats Component
const AttendanceStats = ({ stats }) => {
  return (
    <div className="attendance-stats">
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-title">A Trabalhar</span>
          <Users className="stat-icon" size={24} />
        </div>
        <div className="stat-value">{stats.trabalhando}</div>
        <p className="stat-description">Funcionários atualmente no trabalho</p>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-title">Presenças Hoje</span>
          <Calendar className="stat-icon" size={24} />
        </div>
        <div className="stat-value">{stats.totalHoje}</div>
        <p className="stat-description">Total de registos de entrada</p>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-title">Média de Horas</span>
          <Clock className="stat-icon" size={24} />
        </div>
        <div className="stat-value">{stats.mediaHoras}h</div>
        <p className="stat-description">Horas médias trabalhadas hoje</p>
      </div>
    </div>
  );
};

// AttendanceList Component
const AttendanceList = ({ presencas, onRefresh, onForceAction }) => {
  const [filter, setFilter] = useState("todos"); // todos, trabalhando, concluido

  const filteredPresencas = presencas.filter((p) => {
    if (filter === "todos") return true;
    return p.status === filter;
  });

  const formatTime = (timestamp) => {
    if (!timestamp) return "--:--";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handleForceAction = (presenca, action) => {
    if (onForceAction) {
      onForceAction({
        user: {
          user_id: presenca.user_id,
          name: presenca.name,
          status: presenca.status,
          profile_image: presenca.profile_image,
        },
        action,
      });
    }
  };

  return (
    <div className="attendance-list">
      <div className="list-header">
        <h2>Presenças de Hoje</h2>
        <div className="filter-buttons">
          <button
            className={filter === "todos" ? "active" : ""}
            onClick={() => setFilter("todos")}
          >
            Todos ({presencas.length})
          </button>
          <button
            className={filter === "trabalhando" ? "active" : ""}
            onClick={() => setFilter("trabalhando")}
          >
            A Trabalhar (
            {presencas.filter((p) => p.status === "trabalhando").length})
          </button>
          <button
            className={filter === "concluido" ? "active" : ""}
            onClick={() => setFilter("concluido")}
          >
            Concluído (
            {presencas.filter((p) => p.status === "concluido").length})
          </button>
        </div>
      </div>

      {filteredPresencas.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>Nenhum Registo</h3>
          <p>Nenhuma presença registada hoje.</p>
        </div>
      ) : (
        <>
          {/* A Trabalhar Section */}
          {(filter === "todos" || filter === "trabalhando") &&
            filteredPresencas.filter((p) => p.status === "trabalhando").length >
              0 && (
              <>
                <h3 className="section-title working">
                  <Users size={16} />A Trabalhar Agora (
                  {
                    filteredPresencas.filter((p) => p.status === "trabalhando")
                      .length
                  }
                  )
                </h3>
                <div className="attendance-grid">
                  {filteredPresencas
                    .filter((p) => p.status === "trabalhando")
                    .map((presenca) => (
                      <div
                        key={presenca.user_id}
                        className="attendance-card working"
                      >
                        <div className="avatar">
                          {presenca.profile_image ? (
                            <img
                              src={presenca.profile_image}
                              alt={presenca.name}
                            />
                          ) : (
                            getInitials(presenca.name)
                          )}
                        </div>

                        <div className="info">
                          <div className="name">{presenca.name}</div>
                          <div className="details">
                            <span>
                              <LogIn size={14} />
                              {formatTime(presenca.primeira_entrada)}
                            </span>
                            <span>
                              <Timer size={14} />
                              {presenca.horas_trabalhadas?.toFixed(1) || 0}h
                            </span>
                          </div>
                        </div>

                        <div className="card-actions">
                          <div className="status-badge trabalhando">
                            A Trabalhar
                          </div>
                          <button
                            className="btn-force btn-force-saida"
                            onClick={() => handleForceAction(presenca, "saida")}
                            title="Forçar Saída"
                          >
                            <UserCog size={16} />
                            Forçar Saída
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}

          {/* Já Trabalharam Section */}
          {(filter === "todos" || filter === "concluido") &&
            filteredPresencas.filter((p) => p.status === "concluido").length >
              0 && (
              <>
                <h3 className="section-title completed">
                  <Clock size={16} />
                  Já Trabalharam Hoje (
                  {
                    filteredPresencas.filter((p) => p.status === "concluido")
                      .length
                  }
                  )
                </h3>
                <div className="attendance-grid">
                  {filteredPresencas
                    .filter((p) => p.status === "concluido")
                    .map((presenca) => (
                      <div
                        key={presenca.user_id}
                        className="attendance-card completed"
                      >
                        <div className="avatar">
                          {presenca.profile_image ? (
                            <img
                              src={presenca.profile_image}
                              alt={presenca.name}
                            />
                          ) : (
                            getInitials(presenca.name)
                          )}
                        </div>

                        <div className="info">
                          <div className="name">{presenca.name}</div>
                          <div className="details">
                            <span>
                              <LogIn size={14} />
                              {formatTime(presenca.primeira_entrada)}
                            </span>
                            {presenca.ultima_saida && (
                              <span>
                                <LogOut size={14} />
                                {formatTime(presenca.ultima_saida)}
                              </span>
                            )}
                            <span>
                              <Timer size={14} />
                              {presenca.horas_trabalhadas?.toFixed(1) || 0}h
                            </span>
                          </div>
                        </div>

                        <div className="card-actions">
                          <div className="status-badge concluido">
                            Concluído
                          </div>
                          <button
                            className="btn-force btn-force-entrada"
                            onClick={() =>
                              handleForceAction(presenca, "entrada")
                            }
                            title="Forçar Entrada"
                          >
                            <UserCog size={16} />
                            Forçar Entrada
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
        </>
      )}
    </div>
  );
};

// DevicesPanel Component
const DevicesPanel = ({ dispositivos, onRefresh, onOpenEnrollment }) => {
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Nunca";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  return (
    <div className="devices-panel">
      <div className="devices-grid">
        {dispositivos.map((device) => (
          <div
            key={device.device_id}
            className={`device-card ${device.is_online ? "online" : "offline"}`}
          >
            {/* Hologram GIF Container */}
            <div className="hologram-container">
              <img src="/3d.gif" alt="Hologram" className="hologram-gif" />
            </div>

            {/* Device Info */}
            <div className="device-content">
              <div className="device-title">
                <h3>{device.nome}</h3>
                <div
                  className={`status-indicator ${
                    device.is_online ? "online" : "offline"
                  }`}
                ></div>
              </div>
              <p className="device-location">
                {device.localizacao || "Sem localização"}
              </p>
              <div className="device-stats">
                <div className="stat">
                  <Clock size={14} />
                  <span>{formatLastSeen(device.last_seen)}</span>
                </div>
                <div className="stat">
                  <Users size={14} />
                  <span>{device.total_utilizadores_hoje || 0}</span>
                </div>
                <div className="stat">
                  <FileText size={14} />
                  <span>{device.total_registos_hoje || 0}</span>
                </div>
                <div className="stat">
                  <Nfc size={14} />
                  <span>{device.device_id?.slice(-3) || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="device-actions">
              <button
                onClick={() => onOpenEnrollment(device)}
                disabled={!device.is_online}
                title="Vincular Cartão"
              >
                <CreditCard size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {dispositivos.length === 0 && (
        <div className="empty-state">
          <Nfc size={48} />
          <p>Nenhum dispositivo conectado</p>
        </div>
      )}
    </div>
  );
};

// CardEnrollment Component
const CardEnrollment = ({ device, onClose }) => {
  const { socket, connected } = useWebSocketContext();
  const [step, setStep] = useState(1); // 1: selecionar user, 2: aguardar cartão, 3: sucesso
  const [enrollmentUsers, setEnrollmentUsers] = useState([]);
  const [usersWithCards, setUsersWithCards] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [showCardManagement, setShowCardManagement] = useState(false);

  // Carregar utilizadores
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const response = await fetch(`${API_BASE_URL}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Handle different response formats (array directly or wrapped in users property)
          const allUsers = Array.isArray(data) ? data : data.users || [];

          // Separate users with and without cards
          const staffWithoutCard = allUsers.filter((u) => !u.nfc_card_uid);
          const staffWithCard = allUsers.filter((u) => u.nfc_card_uid);

          setEnrollmentUsers(staffWithoutCard);
          setUsersWithCards(staffWithCard);
        }
      } catch (error) {
        console.error("Erro ao carregar utilizadores:", error);
      }
    };

    loadUsers();
  }, []);

  const handleResetCard = async (userId, userName) => {
    if (
      !confirm(`Tem a certeza que deseja remover o cartão NFC de ${userName}?`)
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/users/${userId}/nfc-card`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Reload users
        const usersResponse = await fetch(`${API_BASE_URL}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (usersResponse.ok) {
          const data = await usersResponse.json();
          const allUsers = Array.isArray(data) ? data : data.users || [];
          const staffWithoutCard = allUsers.filter((u) => !u.nfc_card_uid);
          const staffWithCard = allUsers.filter((u) => u.nfc_card_uid);
          setEnrollmentUsers(staffWithoutCard);
          setUsersWithCards(staffWithCard);
        }

        alert("Cartão removido com sucesso!");
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Erro ao remover cartão");
      }
    } catch (error) {
      console.error("Erro ao remover cartão:", error);
      alert("Erro ao remover cartão");
    }
  };

  // Escutar eventos de vinculação
  useEffect(() => {
    if (!socket || !connected) return;

    const handleEnrollmentStarted = (data) => {
      if (data.device_id === device.device_id) {
        setEnrollmentCode(data.codigo);
        setStep(2);
        setLoading(false);
      }
    };

    const handleEnrollmentSuccess = (data) => {
      setSuccessData(data);
      setStep(3);
      setLoading(false);

      // Fechar após 3 segundos
      setTimeout(() => {
        onClose();
      }, 3000);
    };

    const handleEnrollmentError = (data) => {
      setError(data.error || "Erro ao vincular cartão");
      setLoading(false);
      setStep(1);
    };

    socket.on("vinculacao:iniciada", handleEnrollmentStarted);
    socket.on("vinculacao:sucesso", handleEnrollmentSuccess);
    socket.on("vinculacao:erro", handleEnrollmentError);

    return () => {
      socket.off("vinculacao:iniciada", handleEnrollmentStarted);
      socket.off("vinculacao:sucesso", handleEnrollmentSuccess);
      socket.off("vinculacao:erro", handleEnrollmentError);
    };
  }, [socket, connected, device, onClose]);

  const handleStartEnrollment = async () => {
    if (!selectedUserId) {
      setError("Por favor, selecione um utilizador");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${API_BASE_URL}/api/presencas/dispositivos/${device.device_id}/iniciar-vinculacao`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: selectedUserId,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEnrollmentCode(data.codigo);
        setStep(2);
        setLoading(false);

        // Start polling for completion
        pollForEnrollmentCompletion(data.codigo);
      } else {
        const data = await response.json();
        setError(data.error || "Erro ao iniciar vinculação");
        setLoading(false);
      }
    } catch (error) {
      console.error("Erro ao iniciar vinculação:", error);
      setError("Erro ao comunicar com o servidor");
      setLoading(false);
    }
  };

  const pollForEnrollmentCompletion = (codigo) => {
    const checkInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const response = await fetch(
          `${API_BASE_URL}/api/presencas/dispositivos/${device.device_id}/enrollment-status`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();

          // If enrollment no longer active, it was completed or cancelled
          if (!data.enrollmentActive) {
            clearInterval(checkInterval);

            // Check if card was successfully linked
            checkEnrollmentResult(codigo);
          }
        }
      } catch (error) {
        console.error("Erro ao verificar status:", error);
      }
    }, 2000);

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      setError("Tempo esgotado");
      setStep(1);
    }, 300000);
  };

  const checkEnrollmentResult = async (codigo) => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${API_BASE_URL}/api/presencas/codigos-vinculacao/${codigo}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.usado) {
          // Success!
          setSuccessData({
            userName: data.userName,
            userId: data.user_id,
          });
          setStep(3);

          setTimeout(() => {
            onClose();
          }, 3000);
        } else {
          // Cancelled or expired
          setError("Vinculação cancelada ou expirada");
          setStep(1);
        }
      }
    } catch (error) {
      console.error("Erro ao verificar resultado:", error);
      setError("Erro ao verificar resultado");
      setStep(1);
    }
  };

  const handleCancelEnrollment = async () => {
    if (!enrollmentCode) {
      onClose();
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      await fetch(
        `${API_BASE_URL}/api/presencas/codigos-vinculacao/${enrollmentCode}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error) {
      console.error("Erro ao cancelar vinculação:", error);
    }

    onClose();
  };

  return (
    <div className="enrollment-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Gestão de Cartões NFC</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={!showCardManagement ? "active" : ""}
            onClick={() => setShowCardManagement(false)}
          >
            Vincular Novo Cartão
          </button>
          <button
            className={showCardManagement ? "active" : ""}
            onClick={() => setShowCardManagement(true)}
          >
            Gerir Cartões ({usersWithCards.length})
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #f87171",
                padding: "1rem",
                borderRadius: "8px",
                marginBottom: "1rem",
                color: "#fff",
              }}
            >
              {error}
            </div>
          )}

          {/* Card Management View */}
          {showCardManagement ? (
            <div className="card-management">
              <h3>Utilizadores com Cartões NFC</h3>
              {usersWithCards.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#6b7280",
                    padding: "2rem",
                  }}
                >
                  Nenhum utilizador com cartão associado.
                </p>
              ) : (
                <div className="users-with-cards-list">
                  {usersWithCards.map((user) => (
                    <div key={user.id} className="user-card-item">
                      <div className="user-info">
                        <strong>{user.name}</strong>
                        <span className="username">@{user.username}</span>
                        <span className="card-uid" title={user.nfc_card_uid}>
                          Cartão: {user.nfc_card_uid?.substring(0, 8)}...
                        </span>
                      </div>
                      <button
                        className="reset-card-btn"
                        onClick={() => handleResetCard(user.id, user.name)}
                      >
                        Remover Cartão
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Step 1: Selecionar Utilizador */}
              {step === 1 && (
                <>
                  <div className="step">
                    <div className="step-number">1</div>
                    <h3>Selecionar Funcionário</h3>
                    {enrollmentUsers.length > 0 ? (
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        disabled={loading}
                      >
                        <option value="">-- Selecione um funcionário --</option>
                        {enrollmentUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} (@{user.username})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="no-users-message">
                        <Users size={48} color="#6b7280" />
                        <p>Nenhum funcionário disponível</p>
                        <span>
                          Não há funcionários sem cartão NFC para vincular
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="step">
                    <div className="step-number">2</div>
                    <h3>Dispositivo</h3>
                    <p>
                      <strong>{device.nome}</strong> - {device.localizacao}
                    </p>
                  </div>

                  <div className="action-buttons">
                    <button className="secondary" onClick={onClose}>
                      Cancelar
                    </button>
                    <button
                      className="primary"
                      onClick={handleStartEnrollment}
                      disabled={
                        !selectedUserId ||
                        loading ||
                        enrollmentUsers.length === 0
                      }
                    >
                      {loading ? "A processar..." : "Iniciar Vinculação"}
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Aguardar Cartão */}
              {step === 2 && (
                <div className="waiting-state">
                  <p>
                    <strong>Aguardando cartão...</strong>
                  </p>
                  <p>Por favor, aproxime o cartão NFC no dispositivo:</p>
                  <p style={{ fontSize: "1.3rem", fontWeight: 600 }}>
                    {device.nome}
                  </p>

                  {enrollmentCode && (
                    <div className="code-display">
                      Código: {enrollmentCode.substring(0, 8)}...
                    </div>
                  )}

                  <p
                    style={{
                      fontSize: "0.9rem",
                      opacity: 0.8,
                      marginTop: "1rem",
                    }}
                  >
                    O código expira em 5 minutos
                  </p>

                  <div className="action-buttons">
                    <button
                      className="secondary"
                      onClick={handleCancelEnrollment}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Sucesso */}
              {step === 3 && successData && (
                <div className="success-state">
                  <div className="success-icon">
                    <svg
                      width="64"
                      height="64"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                  <p>
                    <strong>Cartão vinculado com sucesso!</strong>
                  </p>
                  <p style={{ fontSize: "1.2rem", marginTop: "1rem" }}>
                    {successData.name}
                  </p>
                  <p style={{ fontSize: "0.9rem", opacity: 0.8 }}>
                    @{successData.username}
                  </p>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      opacity: 0.7,
                      marginTop: "1rem",
                    }}
                  >
                    A fechar automaticamente...
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ========== MAIN COMPONENT ==========

export default function PresencasComponent({ onLoaded }) {
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

  // Force action modal state
  const [forceActionModal, setForceActionModal] = useState(null);
  const [forceActionMotivo, setForceActionMotivo] = useState("");
  const [forceActionLoading, setForceActionLoading] = useState(false);

  // Manual force action modal state (from header button)
  const [showManualForceModal, setShowManualForceModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Track if onLoaded has been called to prevent multiple calls
  const onLoadedCalled = React.useRef(false);

  // Carregar todos os utilizadores
  const loadAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await users.list();
      const allUsers = response.users || response || [];

      if (!Array.isArray(allUsers)) {
        console.error("Users data is not an array:", allUsers);
        setAllUsers([]);
        return;
      }

      setAllUsers(allUsers);
    } catch (error) {
      console.error("Erro ao carregar utilizadores:", error);
      setAllUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

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
        // Set devices directly from API - WebSocket will handle real-time updates
        setDispositivos(data.dispositivos || []);
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

    const loadData = async () => {
      await Promise.all([loadPresencasHoje(), loadDispositivos()]);
      // Only call onLoaded once during initial load
      if (onLoaded && !onLoadedCalled.current) {
        onLoadedCalled.current = true;
        onLoaded();
      }
    };

    loadData();

    // No longer need periodic refresh - WebSocket handles real-time updates
  }, [user, onLoaded]);

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
      setDispositivos((prev) =>
        prev.map((device) =>
          device.device_id === data.device_id
            ? {
                ...device,
                is_online: true,
                last_seen: data.timestamp,
                nome: data.nome,
                localizacao: data.localizacao,
              }
            : device
        )
      );
    });

    // Dispositivo desconectado
    socket.on("dispositivo:desconectado", (data) => {
      console.log("[PRESENCAS] Dispositivo desconectado:", data);
      setDispositivos((prev) =>
        prev.map((device) =>
          device.device_id === data.device_id
            ? { ...device, is_online: false, last_seen: data.timestamp }
            : device
        )
      );
    });

    // Status do dispositivo atualizado
    socket.on("dispositivo:status", (data) => {
      console.log("[PRESENCAS] Status do dispositivo atualizado:", data);
      setDispositivos((prev) =>
        prev.map((device) =>
          device.device_id === data.device_id
            ? {
                ...device,
                is_online: data.is_online,
                last_seen: data.last_seen,
                nome: data.nome || device.nome,
                localizacao: data.localizacao || device.localizacao,
                firmware_version:
                  data.firmware_version || device.firmware_version,
                ip_address: data.ip_address || device.ip_address,
              }
            : device
        )
      );
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

  // Handle force action
  const handleForceAction = (data) => {
    setForceActionModal(data);
    setForceActionMotivo("");
  };

  // Confirm force action
  const confirmForceAction = async () => {
    if (!forceActionModal) return;

    setForceActionLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${API_BASE_URL}/api/presencas/forcar-acao`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: forceActionModal.user.user_id,
            acao: forceActionModal.action,
            motivo: forceActionMotivo || null,
          }),
        }
      );

      if (response.ok) {
        setForceActionModal(null);
        setForceActionMotivo("");
        // Refresh attendance list
        loadPresencasHoje();
      } else {
        const errorData = await response.json();
        alert(`Erro: ${errorData.error || "Erro ao forçar ação"}`);
      }
    } catch (error) {
      console.error("Erro ao forçar ação:", error);
      alert("Erro ao comunicar com o servidor");
    } finally {
      setForceActionLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

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
            <button
              className="presencas-header__btn presencas-header__btn--primary"
              onClick={() => {
                setShowManualForceModal(true);
                loadAllUsers();
              }}
            >
              <User size={16} />
              Forçar Ação Manual
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
            onForceAction={handleForceAction}
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

      {/* Manual Force Action Modal */}
      {showManualForceModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowManualForceModal(false)}
          >
            <div
              className="modal-container manual-force-action-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "600px" }}
            >
              <div className="modal-header">
                <h3>Forçar Ação Manual</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowManualForceModal(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="userSelect">Selecionar Utilizador</label>
                  {loadingUsers ? (
                    <div className="loading-state">
                      <RefreshCw size={24} className="animate-spin" />
                      <p>A carregar utilizadores...</p>
                    </div>
                  ) : (
                    <Select
                      value={selectedUserId}
                      onChange={(value) => setSelectedUserId(value)}
                      placeholder="Selecione um utilizador..."
                      showSearch
                      style={{ width: "100%" }}
                      className="custom-select"
                      size="large"
                      filterOption={(input, option) =>
                        (option?.searchtext ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      optionRender={(option) => {
                        const user = allUsers.find(
                          (u) => u.id === option.value
                        );
                        if (!user) return option.label;
                        const isWorking = user.is_working;
                        return (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <svg
                              width="10"
                              height="10"
                              style={{ flexShrink: 0 }}
                            >
                              <circle
                                cx="5"
                                cy="5"
                                r="5"
                                fill={isWorking ? "#10b981" : "#ef4444"}
                              />
                            </svg>
                            <span
                              style={{
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {user.name || user.username}
                            </span>
                          </div>
                        );
                      }}
                      options={allUsers.map((user) => ({
                        value: user.id,
                        label: user.name || user.username,
                        searchtext: `${user.name || ""} ${user.username || ""}`,
                      }))}
                    />
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setShowManualForceModal(false)}
                >
                  Cancelar
                </button>
                {selectedUserId &&
                  (() => {
                    const selectedUser = allUsers.find(
                      (u) => u.id === selectedUserId
                    );
                    const isWorking = selectedUser?.is_working;
                    return (
                      <button
                        className={`btn-action-single ${
                          isWorking ? "clock-out" : "clock-in"
                        }`}
                        onClick={() => {
                          if (!selectedUser) {
                            alert("Por favor, selecione um utilizador");
                            return;
                          }
                          setForceActionModal({
                            user: {
                              user_id: selectedUser.id,
                              name: selectedUser.name,
                            },
                            action: isWorking ? "saida" : "entrada",
                          });
                          setShowManualForceModal(false);
                          setSelectedUserId(null);
                          setUserSearchTerm("");
                        }}
                      >
                        {isWorking ? (
                          <>
                            <LogOut size={16} />
                            Forçar Saída
                          </>
                        ) : (
                          <>
                            <LogIn size={16} />
                            Forçar Entrada
                          </>
                        )}
                      </button>
                    );
                  })()}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal de Força de Ação */}
      {forceActionModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setForceActionModal(null)}
          >
            <div
              className="modal-container force-action-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>
                  Forçar{" "}
                  {forceActionModal.action === "entrada" ? "Entrada" : "Saída"}
                </h3>
                <button
                  className="modal-close"
                  onClick={() => setForceActionModal(null)}
                  disabled={forceActionLoading}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                <div className="warning-section">
                  <AlertTriangle size={24} />
                  <p>
                    Está prestes a forçar uma{" "}
                    {forceActionModal.action === "entrada"
                      ? "entrada"
                      : "saída"}{" "}
                    de um funcionário.
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="forceActionMotivo">Motivo (opcional)</label>
                  <textarea
                    id="forceActionMotivo"
                    value={forceActionMotivo}
                    onChange={(e) => setForceActionMotivo(e.target.value)}
                    placeholder="Descreva o motivo desta ação forçada..."
                    rows={3}
                    disabled={forceActionLoading}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setForceActionModal(null)}
                  disabled={forceActionLoading}
                >
                  Cancelar
                </button>
                <button
                  className={`btn-primary ${
                    forceActionModal.action === "entrada" ? "entrada" : "saida"
                  }`}
                  onClick={confirmForceAction}
                  disabled={forceActionLoading}
                >
                  {forceActionLoading
                    ? "A processar..."
                    : `Confirmar ${
                        forceActionModal.action === "entrada"
                          ? "Entrada"
                          : "Saída"
                      }`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
