import React, { useState } from "react";
import { API_BASE_URL } from "../../../lib/api";
import {
  Nfc,
  Clock,
  Users,
  FileText,
  CreditCard,
  ScrollText,
  X,
} from "lucide-react";

const DevicesPanel = ({ dispositivos, onRefresh, onOpenEnrollment }) => {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

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

  const loadDeviceLogs = async (deviceId) => {
    setLoadingLogs(true);
    setShowLogs(true);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${API_BASE_URL}/api/presencas/logs/${deviceId}?limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error("Erro ao carregar logs:", error);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
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
              <button
                onClick={() => loadDeviceLogs(device.device_id)}
                title="Ver Logs"
              >
                <ScrollText size={18} />
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

      {/* Modal de Logs */}
      {showLogs && (
        <div className="enrollment-modal" onClick={() => setShowLogs(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Logs do Dispositivo</h2>
              <button className="close-btn" onClick={() => setShowLogs(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {loadingLogs ? (
                <div className="waiting-state">
                  <div className="spinner"></div>
                  <p>A carregar logs...</p>
                </div>
              ) : (
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        background: "rgba(255, 255, 255, 0.1)",
                        padding: "1rem",
                        borderRadius: "8px",
                        marginBottom: "0.5rem",
                        borderLeft: `3px solid ${
                          log.nivel === "error"
                            ? "#f87171"
                            : log.nivel === "warning"
                            ? "#fbbf24"
                            : "#4ade80"
                        }`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "0.5rem",
                          fontSize: "0.85rem",
                          opacity: 0.8,
                        }}
                      >
                        <span>{log.tipo_log}</span>
                        <span>
                          {new Date(log.timestamp).toLocaleString("pt-PT")}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600 }}>{log.mensagem}</div>
                      {log.metadata && (
                        <pre
                          style={{
                            background: "rgba(0, 0, 0, 0.2)",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            marginTop: "0.5rem",
                            fontSize: "0.75rem",
                            overflow: "auto",
                          }}
                        >
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p style={{ textAlign: "center", opacity: 0.7 }}>
                      Nenhum log disponível
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicesPanel;
