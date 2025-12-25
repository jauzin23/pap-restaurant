"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  Calendar,
  TrendingUp,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { apiRequest } from "../../lib/api";

// Custom Select Component
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={selectRef} className={`custom-select ${className}`}>
      <div className="custom-select-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className={selectedOption ? "selected-text" : "placeholder-text"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`select-arrow ${isOpen ? "rotated" : ""}`}
        />
      </div>

      {isOpen && (
        <div className="custom-select-dropdown">
          {options.map((option) => (
            <div
              key={option.value}
              className={`custom-select-option ${
                option.value === value ? "selected" : ""
              }`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Type definitions for the history data
interface ClockEntry {
  timestamp: string;
  device_id?: string;
}

interface Duration {
  hours: number;
  minutes: number;
}

interface WorkInterval {
  id?: string;
  entrada: ClockEntry;
  saida?: ClockEntry;
  duration?: Duration;
  is_active?: boolean;
}

interface HistorySummary {
  total_hours: number;
  worked_days: number;
  total_intervals: number;
}

interface HistoryData {
  intervals: WorkInterval[];
  summary: HistorySummary;
}

interface ClockHistoryProps {
  userId: string | number;
}

const ClockHistory: React.FC<ClockHistoryProps> = ({ userId }) => {
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("30"); // days
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadHistory();
    setCurrentPage(1); // Reset to first page when period changes
  }, [userId, selectedPeriod]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - parseInt(selectedPeriod));

      const data = await apiRequest(
        `/api/presencas/intervals/${userId}?date_from=${
          dateFrom.toISOString().split("T")[0]
        }&date_to=${dateTo.toISOString().split("T")[0]}&limit=50`
      );

      setHistory(data);
    } catch (err) {
      console.error("Error loading clock history:", err);
      setError("Erro ao carregar histórico de presenças");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleDateString("pt-PT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDuration = (duration?: Duration): string => {
    if (!duration) return "Em andamento";
    return `${duration.hours}h ${duration.minutes}m`;
  };

  if (loading) {
    return (
      <div className="clock-history-loading">
        <div className="loading-spinner"></div>
        <p>Carregando histórico...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="clock-history-error">
        <p>{error}</p>
        <button onClick={loadHistory} className="retry-btn">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!history || !history.intervals || history.intervals.length === 0) {
    return (
      <div className="clock-history-empty">
        <Clock size={48} className="empty-icon" />
        <h3>Sem registos de presença</h3>
        <p>
          Não foram encontrados registos de entrada/saída para este período.
        </p>
      </div>
    );
  }

  const intervals = history.intervals.sort(
    (a, b) =>
      new Date(b.entrada.timestamp).getTime() -
      new Date(a.entrada.timestamp).getTime()
  );

  // Pagination logic
  const totalItems = intervals.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentIntervals = intervals.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="clock-history">
      <div className="clock-history-header">
        <div className="header-info">
          <h3>Histórico de Presenças</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <TrendingUp size={16} />
              <span>{history.summary.total_hours.toFixed(1)}h trabalhadas</span>
            </div>
            <div className="stat-item">
              <Calendar size={16} />
              <span>{history.summary.worked_days} dias</span>
            </div>
            <div className="stat-item">
              <Activity size={16} />
              <span>{history.summary.total_intervals} intervalos</span>
            </div>
          </div>
        </div>

        <div className="period-selector">
          <CustomSelect
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            options={[
              { value: "7", label: "Últimos 7 dias" },
              { value: "30", label: "Últimos 30 dias" },
              { value: "90", label: "Últimos 3 meses" },
              { value: "365", label: "Último ano" },
            ]}
          />
        </div>
      </div>

      <div className="clock-history-content">
        {currentIntervals.map((interval, index) => (
          <div
            key={interval.id || index}
            className={`work-interval ${interval.is_active ? "active" : ""}`}
          >
            <div className="interval-header">
              <div className="date-info">
                <Calendar size={14} />
                <span>{formatDate(interval.entrada.timestamp)}</span>
              </div>
              <div className="duration-info">
                <Clock size={14} />
                <span>{formatDuration(interval.duration)}</span>
              </div>
            </div>

            <div className="interval-times">
              <div className="time-entry">
                <div className="time-label">Entrada</div>
                <div className="time-value">
                  {formatTime(interval.entrada.timestamp)}
                </div>
                {interval.entrada.device_id && (
                  <div className="device-info">
                    Dispositivo: {interval.entrada.device_id}
                  </div>
                )}
              </div>

              {interval.saida && (
                <div className="time-exit">
                  <div className="time-label">Saída</div>
                  <div className="time-value">
                    {formatTime(interval.saida.timestamp)}
                  </div>
                  {interval.saida.device_id && (
                    <div className="device-info">
                      Dispositivo: {interval.saida.device_id}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} />
            Anterior
          </button>

          <div className="pagination-info">
            Página {currentPage} de {totalPages} ({totalItems} registos)
          </div>

          <button
            className="pagination-btn"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            Próxima
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ClockHistory;
