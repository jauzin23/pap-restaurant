import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../../lib/api";
import { useWebSocketContext } from "../../../contexts/WebSocketContext";
import { X, Users } from "lucide-react";

const CardEnrollment = ({ device, onClose }) => {
  const { socket, connected } = useWebSocketContext();
  const [step, setStep] = useState(1); // 1: selecionar user, 2: aguardar cartão, 3: sucesso
  const [users, setUsers] = useState([]);
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
          console.log("Loaded users:", allUsers);

          // Separate users with and without cards
          const staffWithoutCard = allUsers.filter((u) => !u.nfc_card_uid);
          const staffWithCard = allUsers.filter((u) => u.nfc_card_uid);

          console.log("Users without NFC card:", staffWithoutCard);
          console.log("Users with NFC card:", staffWithCard);

          setUsers(staffWithoutCard);
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
          setUsers(staffWithoutCard);
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
                    {users.length > 0 ? (
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        disabled={loading}
                      >
                        <option value="">-- Selecione um funcionário --</option>
                        {users.map((user) => (
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
                        !selectedUserId || loading || users.length === 0
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

export default CardEnrollment;
