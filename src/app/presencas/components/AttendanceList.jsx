import React, { useState } from "react";
import {
  Clock,
  LogIn,
  LogOut,
  Timer,
  Users,
  UserCog,
  Shield,
} from "lucide-react";
import { API_BASE_URL } from "../../../lib/api";

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

export default AttendanceList;
