import React from "react";
import { Users, Calendar, Clock } from "lucide-react";

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

export default AttendanceStats;
