import React, { useState } from "react";
import { Clock, LogIn, LogOut, Timer, Users } from "lucide-react";

const AttendanceList = ({ presencas, onRefresh }) => {
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

                        <div className="status-badge trabalhando">
                          A Trabalhar
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

                        <div className="status-badge concluido">Concluído</div>
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
