"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Select } from "antd";
import { createPortal } from "react-dom";
import { apiRequest, getImageUrl } from "../../lib/api";
import { getCurrentUser } from "../../lib/auth";
import { useAIInsightsWebSocket } from "../../hooks/useAIInsightsWebSocket";
import {
  Calendar,
  Sparkles,
  Eye,
  Trash2,
  Clock,
  TrendingUp,
  FileText,
  Zap,
  X,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import "./AIInsightsComponent.scss";
import ComponentRenderer from "../restaurant-analysis/ComponentRenderer";
import "../restaurant-analysis/restaurant-analysis.scss";

const AIInsightsComponent = () => {
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [insights, setInsights] = useState([]);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState("insights");
  const [viewMode, setViewMode] = useState("list");
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    insight: null,
  });

  // Memoize WebSocket callbacks to prevent re-renders
  const handleInsightCreated = useCallback(
    (insight) => {
      console.log(
        "[AIInsightsComponent] WebSocket: Insight created event received:",
        insight.id,
        "at",
        new Date().toISOString()
      );
      // Refresh months and insights if we're viewing the relevant month
      if (selectedMonth && insight.data === selectedMonth) {
        fetchInsights(selectedMonth);
      }
      fetchMonths(); // Refresh available months
    },
    [selectedMonth]
  );

  const handleInsightUpdated = useCallback(
    (insight) => {
      console.log("[AIInsightsComponent] Insight updated:", insight);
      // Update the insight in the current list
      setInsights((prev) =>
        prev.map((item) =>
          item.id === insight.id ? { ...item, ...insight } : item
        )
      );
      // Update selected insight if it's the one being viewed
      if (selectedInsight && selectedInsight.id === insight.id) {
        setSelectedInsight({ ...selectedInsight, ...insight });
      }
    },
    [selectedInsight]
  );

  const handleInsightDeleted = useCallback(
    (data) => {
      console.log(
        "[AIInsightsComponent] Insight deleted:",
        data.id,
        "at",
        new Date().toISOString()
      );
      // Remove from insights list
      setInsights((prev) => prev.filter((item) => item.id !== data.id));
      // Clear selection if it was the deleted insight
      if (selectedInsight && selectedInsight.id === data.id) {
        setSelectedInsight(null);
        setViewMode("list");
      }
      fetchMonths(); // Refresh available months
    },
    [selectedInsight]
  );

  const handleConnected = useCallback(() => {
    console.log("[AIInsightsComponent] WebSocket connected successfully");
  }, []);

  const handleDisconnected = useCallback((reason) => {
    console.log("[AIInsightsComponent] WebSocket disconnected:", reason);
  }, []);

  const handleError = useCallback((error) => {
    console.error("[AIInsightsComponent] WebSocket error:", error);
  }, []);

  // WebSocket integration for real-time updates
  const { connected: wsConnected } = useAIInsightsWebSocket({
    onInsightCreated: handleInsightCreated,
    onInsightUpdated: handleInsightUpdated,
    onInsightDeleted: handleInsightDeleted,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onError: handleError,
  });

  // Fetch available months on mount
  useEffect(() => {
    fetchMonths();
  }, []);

  const fetchMonths = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("/api/ia/meses-disponiveis");
      setMonths(response);
    } catch (error) {
      console.error("Erro ao buscar meses:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsight = async (month) => {
    try {
      setGenerating(true);
      setCurrentStep(1); // Initial step

      const [year, monthNum] = month.split("-");

      // Get current user for manual generation
      const currentUser = await getCurrentUser();

      await apiRequest(`/api/ia/gerar/${year}/${monthNum}`, {
        method: "POST",
        body: JSON.stringify({ user_id: currentUser.id }),
      });

      // The websocket will handle the real-time update when insight is created
      // For now, just reset the UI state
      setGenerating(false);
      setCurrentStep(0);
    } catch (error) {
      console.error("Erro ao gerar insight:", error);
      setCurrentStep(0);
      setGenerating(false);
    }
  };

  const fetchInsights = async (month) => {
    try {
      const [year, monthNum] = month.split("-");
      const response = await apiRequest(`/api/ia/${year}/${monthNum}`);
      // Map pfp_url using getImageUrl for consistency with staff view
      const mapped = response.map((insight) => ({
        ...insight,
        pfp_url: insight.pfp_url
          ? getImageUrl("imagens-perfil", insight.pfp_url)
          : null,
      }));
      setInsights(mapped);
      setSelectedInsight(null);
    } catch (error) {
      console.error("Erro ao buscar insights:", error);
    }
  };

  const viewInsight = async (id) => {
    try {
      const response = await apiRequest(`/api/ia/insight/${id}`);
      setSelectedInsight(response);
      setViewMode("detail");
    } catch (error) {
      console.error("Erro ao buscar insight:", error);
    }
  };

  const deleteInsight = async (id) => {
    try {
      setInsights((prev) => prev.filter((item) => item.id !== id));
      await apiRequest(`/api/ia/${id}`, {
        method: "DELETE",
      });
      // Real-time updates will be handled by WebSocket events, but remove immediately for UX
      await fetchMonths();
    } catch (error) {
      console.error("Erro ao eliminar insight:", error);
    }
    setDeleteModal({ open: false, insight: null });
  };

  const handleMonthSelect = (month) => {
    setSelectedMonth(month);
    fetchInsights(month);
  };

  const formatMonthName = (monthStr) => {
    const [year, month] = monthStr.split("-");
    const monthNames = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Data desconhecida";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (viewMode === "detail" && selectedInsight) {
    return (
      <div className="restaurant-analysis-page">
        <button
          className="back-button"
          onClick={() => {
            setViewMode("list");
            setSelectedInsight(null);
          }}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="rendered-section">
          <div className="metadata-header">
            <h2>
              {selectedInsight.dados_saida?.metadata?.titulo ||
                "Análise de Insight"}
            </h2>
            {selectedInsight.dados_saida?.metadata?.subtitulo && (
              <p className="subtitle">
                {selectedInsight.dados_saida.metadata.subtitulo}
              </p>
            )}
            {selectedInsight.dados_saida?.metadata?.periodo && (
              <span className="periodo-badge">
                {selectedInsight.dados_saida.metadata.periodo}
              </span>
            )}
            {selectedInsight.dados_saida?.metadata?.resumo_executivo && (
              <p className="resumo">
                {selectedInsight.dados_saida.metadata.resumo_executivo}
              </p>
            )}
          </div>

          <div className="components-container">
            {selectedInsight.dados_saida?.components?.map(
              (component, index) => (
                <ComponentRenderer
                  key={component.id || index}
                  component={component}
                />
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-insights-container">
      {/* Section Header */}
      <div className="manager-section-header">
        <div className="header-title-group">
          <h1>Inteligência Artificial</h1>
          <p>Analise os dados do seu restaurante com insights gerados por IA</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="ai-content-grid">
        {/* Left Column - Month Selection & Generation */}
        <div className="ai-left-column">
          {/* Month Selection Card */}
          <div className="card chart-card">
            <div className="card-header-modern">
              <div className="card-icon-wrapper">
                <Calendar size={20} />
              </div>
              <div className="card-header-text">
                <h3>Selecionar Período</h3>
                <p>Escolha o mês para visualizar ou gerar insights de IA</p>
              </div>
            </div>

            <div className="month-select-container">
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>A carregar meses...</p>
                </div>
              ) : (
                <Select
                  className="month-select"
                  style={{ width: "100%" }}
                  placeholder="Selecionar mês..."
                  value={selectedMonth || undefined}
                  onChange={handleMonthSelect}
                  options={months.map((month) => ({
                    value: month.mes,
                    label: `${formatMonthName(month.mes)} (${
                      month.geracoes_ia
                    } ${month.geracoes_ia === 1 ? "análise" : "análises"})`,
                  }))}
                  showSearch
                  optionFilterProp="label"
                />
              )}
            </div>
          </div>

          {/* Generate New Insight Card */}
          {selectedMonth && (
            <div className="card chart-card">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <Zap size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Gerar Nova Análise</h3>
                  <p>Crie um novo relatório de análise com IA</p>
                </div>
              </div>

              <div className="generate-section">
                <div className="generate-info">
                  <p className="generate-description">
                    Gerar análise para{" "}
                    <strong>{formatMonthName(selectedMonth)}</strong>
                  </p>
                  <div className="generate-stats">
                    <div className="stat-item">
                      <Zap size={16} />
                      <span>Dados da API disponíveis</span>
                    </div>
                    <div className="stat-item">
                      <BarChart3 size={16} />
                      <span>Análise avançada incluída</span>
                    </div>
                  </div>
                </div>

                <button
                  className="generate-btn"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <div className="loading-spinner"></div>A gerar...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Gerar Nova Análise
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Insights List */}
        <div className="ai-right-column">
          {selectedMonth ? (
            <div className="card chart-card insights-card">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <FileText size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Análises de {formatMonthName(selectedMonth)}</h3>
                  <p>
                    {insights.length}{" "}
                    {insights.length === 1
                      ? "análise disponível"
                      : "análises disponíveis"}
                  </p>
                </div>
              </div>

              <div className="insights-list">
                {insights.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <Sparkles size={64} />
                    </div>
                    <h3>Nenhuma análise encontrada</h3>
                    <p>
                      Não existem análises geradas para este mês. Use o botão
                      "Gerar Nova Análise" para criar uma nova!
                    </p>
                  </div>
                ) : (
                  insights.map((insight) => (
                    <div key={insight.id} className="insight-item">
                      <div className="insight-header">
                        <div className="insight-info">
                          <h4>Análise #{insight.id}</h4>
                          <div className="insight-meta-row">
                            {insight.auto && (
                              <span className="insight-type auto">
                                Automático
                              </span>
                            )}
                            {!insight.auto && insight.user_id && (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#64748b",
                                    marginBottom: "0.15rem",
                                  }}
                                >
                                  Gerado por:
                                </span>
                                <div
                                  className="insight-user"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                  }}
                                >
                                  <div className="user-avatar">
                                    {insight.pfp_url ? (
                                      <img
                                        src={insight.pfp_url}
                                        alt={insight.name || "Usuário"}
                                        onError={(e) => {
                                          e.target.style.display = "none";
                                          e.target.nextSibling.style.display =
                                            "flex";
                                        }}
                                      />
                                    ) : null}
                                    <div className="user-avatar-fallback">
                                      {insight.name
                                        ? insight.name.charAt(0).toUpperCase()
                                        : "?"}
                                    </div>
                                  </div>
                                  <span className="user-name">
                                    {insight.name || "Usuário"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="insight-actions">
                          <button
                            className="action-btn view-btn"
                            onClick={() => viewInsight(insight.id)}
                            title="Ver detalhes"
                          >
                            <Eye size={14} />
                            Ver
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={() =>
                              setDeleteModal({ open: true, insight })
                            }
                            title="Eliminar insight"
                          >
                            <Trash2 size={14} />
                            Eliminar
                          </button>
                        </div>
                      </div>
                      {insight.criado_em && (
                        <div className="insight-meta">
                          <div className="meta-item">
                            <Clock size={14} />
                            <span>{formatDate(insight.criado_em)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="card chart-card placeholder-card">
              <div className="card-header-modern">
                <div className="card-icon-wrapper">
                  <FileText size={20} />
                </div>
                <div className="card-header-text">
                  <h3>Insights</h3>
                  <p>Selecione um mês para visualizar os insights</p>
                </div>
              </div>

              <div className="placeholder-content">
                <div className="placeholder-icon">
                  <BarChart3 size={48} />
                </div>
                <h4>Selecione um período</h4>
                <p>
                  Escolha um mês no painel lateral para ver os insights
                  disponíveis
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="insight-modal-overlay"
            onClick={() => setShowConfirmModal(false)}
          >
            <div
              className="insight-modal-container confirm-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="insight-modal-header">
                <h3>
                  <Zap size={20} />
                  Confirmar Geração
                </h3>
                <button
                  className="close-btn"
                  onClick={() => setShowConfirmModal(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="insight-modal-content">
                <div className="confirm-content">
                  <h4>Tem a certeza que deseja gerar uma nova análise?</h4>
                  <p>
                    Esta ação irá criar uma nova análise para{" "}
                    <strong>{formatMonthName(selectedMonth)}</strong>. O
                    processo pode levar alguns minutos.
                  </p>
                  <div className="confirm-buttons">
                    <button
                      className="cancel-btn"
                      onClick={() => setShowConfirmModal(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="confirm-btn"
                      onClick={() => {
                        setShowConfirmModal(false);
                        generateInsight(selectedMonth);
                      }}
                    >
                      <Sparkles size={16} />
                      Gerar Insight
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Insight Modal */}
      {deleteModal.open &&
        deleteModal.insight &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="insight-modal-overlay"
            onClick={() => setDeleteModal({ open: false, insight: null })}
          >
            <div
              className="insight-modal-container confirm-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="insight-modal-header">
                <h3>
                  <Trash2 size={20} />
                  Confirmar Eliminação
                </h3>
                <button
                  className="close-btn"
                  onClick={() => setDeleteModal({ open: false, insight: null })}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="insight-modal-content">
                <div className="confirm-content">
                  <h4>Tem a certeza que deseja eliminar esta análise?</h4>
                  <p>
                    Esta ação irá eliminar a análise{" "}
                    <strong>#{deleteModal.insight.id}</strong> de forma
                    permanente.
                  </p>
                  <div className="confirm-buttons">
                    <button
                      className="cancel-btn"
                      onClick={() =>
                        setDeleteModal({ open: false, insight: null })
                      }
                    >
                      Cancelar
                    </button>
                    <button
                      className="confirm-btn"
                      onClick={() => deleteInsight(deleteModal.insight.id)}
                    >
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Loading Steps Modal */}
      {generating &&
        currentStep > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="insight-modal-overlay">
            <div className="insight-modal-container loading-modal">
              <div className="insight-modal-content">
                <div className="loading-steps">
                  <div className="loading-header">
                    <h3>A gerar análise...</h3>
                  </div>

                  <div className="steps-container">
                    <div
                      className={`step ${currentStep >= 1 ? "active" : ""} ${
                        currentStep > 1 ? "completed" : ""
                      }`}
                    >
                      <div className="step-number">
                        {currentStep > 1 ? (
                          "✓"
                        ) : currentStep === 1 ? (
                          <div className="step-spinner"></div>
                        ) : (
                          "1"
                        )}
                      </div>
                      <div className="step-content">
                        <h4>Coletar dados</h4>
                        <p>Coletar as informações do mês selecionado</p>
                      </div>
                    </div>

                    <div
                      className={`step ${currentStep >= 2 ? "active" : ""} ${
                        currentStep > 2 ? "completed" : ""
                      }`}
                    >
                      <div className="step-number">
                        {currentStep > 2 ? (
                          "✓"
                        ) : currentStep === 2 ? (
                          <div className="step-spinner"></div>
                        ) : (
                          "2"
                        )}
                      </div>
                      <div className="step-content">
                        <h4>Analisar os dados</h4>
                        <p>Processar métricas e padrões</p>
                      </div>
                    </div>

                    <div
                      className={`step ${currentStep >= 3 ? "active" : ""} ${
                        currentStep > 3 ? "completed" : ""
                      }`}
                    >
                      <div className="step-number">
                        {currentStep > 3 ? (
                          "✓"
                        ) : currentStep === 3 ? (
                          <div className="step-spinner"></div>
                        ) : (
                          "3"
                        )}
                      </div>
                      <div className="step-content">
                        <h4>Gerar a análise</h4>
                        <p>Criar um relatório com Inteligência Artificial</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AIInsightsComponent;
