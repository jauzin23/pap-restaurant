"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  X,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Edit2,
  Award,
  AlertTriangle,
} from "lucide-react";
import "./PointsConfigManager.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const PointsConfigManager = ({ token }) => {
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch config
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/points/config`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(
            "Acesso negado. Apenas gestores podem ver esta página."
          );
        } else if (response.status === 404) {
          throw new Error(
            "Configurações não encontradas. Execute o script SQL de configuração."
          );
        } else {
          throw new Error(
            "Erro ao carregar configurações. Verifique se as tabelas foram criadas."
          );
        }
      }

      const data = await response.json();
      setConfig(data.config);
    } catch (err) {
      setError(err.message);
      console.error("Erro ao buscar configurações:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem({
      action_type: item.action_type,
      points_value: item.points_value,
      is_active: item.is_active,
      original: { ...item },
    });
  };

  const handleCancel = () => {
    setEditingItem(null);
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    if (!editingItem) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/points/config/${editingItem.action_type}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            points_value: editingItem.points_value,
            is_active: editingItem.is_active,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao atualizar configuração");
      }

      const data = await response.json();

      // Update local state
      setConfig((prev) =>
        prev.map((item) =>
          item.action_type === editingItem.action_type ? data.config : item
        )
      );

      setSuccessMessage("Configuração atualizada com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
      setEditingItem(null);
    } catch (err) {
      setError(err.message);
      console.error("Erro ao salvar:", err);
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case "basic":
        return <Award size={18} />;
      case "penalty":
        return <AlertTriangle size={18} />;
      default:
        return <Settings size={18} />;
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case "basic":
        return "Ações Básicas";
      case "penalty":
        return "Penalizações";
      default:
        return category;
    }
  };

  if (loading) {
    return (
      <div className="points-config-manager">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>A carregar configurações...</p>
        </div>
      </div>
    );
  }

  // Group config by category
  const groupedConfig = config.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="points-config-manager">
      <div className="config-header">
        <div className="header-left">
          <Settings size={24} />
          <div>
            <h2>Configuração de Pontos</h2>
            <p>Gerir valores de pontos para cada ação</p>
          </div>
        </div>
        <button
          className="refresh-btn"
          onClick={fetchConfig}
          disabled={loading}
        >
          <RotateCcw size={18} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <div style={{ flex: 1 }}>
            <div>{error}</div>
            {error.includes("tabelas") && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                Execute o script SQL:{" "}
                <code>api/database/setup_points_simple.sql</code>
                <br />
                Consulte: <code>SETUP_PONTOS.md</code> para instruções
              </div>
            )}
          </div>
          <button onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="config-content">
        {Object.entries(groupedConfig).map(([category, items]) => (
          <div key={category} className="category-section">
            <div className="category-header">
              {getCategoryIcon(category)}
              <h3>{getCategoryLabel(category)}</h3>
              <span className="item-count">{items.length} ações</span>
            </div>

            <div className="config-table">
              <div className="table-header">
                <div className="col-action">Ação</div>
                <div className="col-description">Descrição</div>
                <div className="col-points">Pontos</div>
                <div className="col-status">Estado</div>
                <div className="col-actions">Ações</div>
              </div>

              <div className="table-body">
                {items.map((item) => {
                  const isEditing =
                    editingItem?.action_type === item.action_type;

                  return (
                    <div
                      key={item.action_type}
                      className={`table-row ${isEditing ? "editing" : ""} ${
                        !item.is_active ? "inactive" : ""
                      }`}
                    >
                      <div className="col-action">
                        <span className="action-type">{item.action_type}</span>
                      </div>

                      <div className="col-description">
                        <span>{item.description}</span>
                      </div>

                      <div className="col-points">
                        {isEditing ? (
                          <input
                            type="number"
                            min="-1000"
                            max="1000"
                            value={editingItem.points_value}
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                points_value: parseInt(e.target.value) || 0,
                              })
                            }
                            className="points-input"
                          />
                        ) : (
                          <span
                            className={`points-badge ${
                              item.points_value > 0 ? "positive" : "negative"
                            }`}
                          >
                            {item.points_value > 0 ? "+" : ""}
                            {item.points_value}
                          </span>
                        )}
                      </div>

                      <div className="col-status">
                        {isEditing ? (
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={editingItem.is_active}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  is_active: e.target.checked,
                                })
                              }
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        ) : (
                          <span
                            className={`status-badge ${
                              item.is_active ? "active" : "inactive"
                            }`}
                          >
                            {item.is_active ? "Ativo" : "Inativo"}
                          </span>
                        )}
                      </div>

                      <div className="col-actions">
                        {isEditing ? (
                          <div className="action-buttons editing">
                            <button
                              className="btn-save"
                              onClick={handleSave}
                              disabled={saving}
                            >
                              <Save size={16} />
                              {saving ? "A guardar..." : "Guardar"}
                            </button>
                            <button
                              className="btn-cancel"
                              onClick={handleCancel}
                              disabled={saving}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-edit"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit2 size={16} />
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PointsConfigManager;
