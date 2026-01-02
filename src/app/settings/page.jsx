"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Settings,
  Save,
  Loader2,
  CheckCircle,
  QrCode,
  ShoppingBag,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { BackgroundBeams } from "../components/BackgroundBeams";
import { apiRequest } from "../../lib/api";
import { getCurrentUser } from "../../lib/auth";
import "./page.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const SettingsPage = () => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState({
    qr_takeaway_enabled: true,
    qr_reservations_enabled: true,
  });
  const [originalConfigs, setOriginalConfigs] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Check user authentication and manager role
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.push("/login");
          return;
        }

        const userLabels = currentUser.labels || [];
        const userIsManager = userLabels.some(
          (label) =>
            label.toLowerCase() === "gestor" ||
            label.toLowerCase() === "manager"
        );

        if (!userIsManager) {
          router.push("/");
          return;
        }

        setUser(currentUser);
        setIsManager(userIsManager);
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Load configurations
  useEffect(() => {
    if (!isManager) return;

    const loadConfigs = async () => {
      try {
        const response = await apiRequest("/configurations");
        const loadedConfigs = {};

        Object.keys(response.configurations).forEach((key) => {
          loadedConfigs[key] = response.configurations[key].value;
        });

        setConfigs(loadedConfigs);
        setOriginalConfigs({ ...loadedConfigs });
      } catch (error) {
        console.error("Failed to load configurations:", error);
        setErrorMessage("Erro ao carregar configurações");
      }
    };

    loadConfigs();
  }, [isManager]);

  const handleConfigChange = (key, value) => {
    setConfigs((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSaveStatus(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    setErrorMessage("");

    try {
      const promises = Object.keys(configs).map(async (key) => {
        if (configs[key] !== originalConfigs[key]) {
          return apiRequest(`/configurations/${key}`, {
            method: "PUT",
            body: JSON.stringify({ value: configs[key] }),
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises.filter((p) => p));

      setOriginalConfigs({ ...configs });
      setSaveStatus("success");

      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Failed to save configurations:", error);
      setSaveStatus("error");
      setErrorMessage(error.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(configs).some(
    (key) => configs[key] !== originalConfigs[key]
  );

  if (loading) {
    return (
      <div className="settings-page">
        <div className="background-container">
          <BackgroundBeams />
        </div>
        <div className="settings-container">
          <div className="loading-container">
            <Loader2 size={48} className="animate-spin" />
            <p className="loading-text">Carregando configurações...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isManager) {
    return null;
  }

  return (
    <div className="settings-page">
      <div className="background-container">
        <BackgroundBeams />
      </div>

      <div className="settings-container">
        {/* Header */}
        <div className="settings-header">
          <button
            className="back-button"
            onClick={() => router.back()}
            title="Voltar"
          >
            <ArrowLeft size={20} />
          </button>

          <h1 className="page-title">Configurações do Sistema</h1>
        </div>

        {/* Main Content Card */}
        <div className="settings-card">
          <div className="card-header">
            <h3>
              <Settings size={20} />
              Códigos QR
            </h3>
            <p className="card-description">
              Configure quando os códigos QR devem ser gerados e utilizados no
              sistema
            </p>
          </div>

          <div className="card-content">
            {/* QR Takeaway Setting */}
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <ShoppingBag size={20} />
                </div>
                <div className="setting-details">
                  <h4>QR para Takeaway</h4>
                  <p>
                    Ativar geração de códigos QR para pedidos de takeaway.
                    Quando desativado, os códigos QR não são gerados nem
                    enviados por email.
                  </p>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={configs.qr_takeaway_enabled}
                    onChange={(e) =>
                      handleConfigChange(
                        "qr_takeaway_enabled",
                        e.target.checked
                      )
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* QR Reservations Setting */}
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">
                  <Calendar size={20} />
                </div>
                <div className="setting-details">
                  <h4>QR para Reservas</h4>
                  <p>
                    Ativar geração de códigos QR para reservas. Quando
                    desativado, os códigos QR não são gerados nem enviados por
                    email.
                  </p>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={configs.qr_reservations_enabled}
                    onChange={(e) =>
                      handleConfigChange(
                        "qr_reservations_enabled",
                        e.target.checked
                      )
                    }
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Save Actions */}
          {hasChanges && (
            <div className="card-footer">
              <div className="save-info">
                <AlertCircle size={16} />
                <span>Alterações não salvas</span>
              </div>

              <div className="save-actions">
                {saveStatus === "success" && (
                  <div className="save-status success">
                    <CheckCircle size={16} />
                    <span>Salvo com sucesso!</span>
                  </div>
                )}

                {saveStatus === "error" && (
                  <div className="save-status error">
                    <AlertCircle size={16} />
                    <span>{errorMessage || "Erro ao salvar"}</span>
                  </div>
                )}

                <button
                  className="save-button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
