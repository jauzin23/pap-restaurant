"use client";

import React, { useState, useEffect } from "react";
import "./Dashboard.scss";
import { account } from "../../lib/appwrite";
import RestLayout from "../components/RestLayout";
import { Menu, Bell, User, Search, Plus, ChevronLeft } from "lucide-react";

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    account
      .get()
      .then((userData) => {
        setUser(userData);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  // Helper function to get user initials
  const getInitials = (name, email) => {
    if (name) {
      return name
        .split(" ")
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const tabs = {
    dashboard: {
      name: "Restaurante",
      title: "Painel do Restaurante",
      subtitle: "Monitorize as mesas e pedidos em tempo real",
      component: RestLayout,
      icon: <Menu size={16} />,
    },
    calendar: {
      name: "Calendário",
      title: "Calendário de Entrevistas",
      subtitle: "Agende e veja entrevistas futuras",
      component: () => (
        <div className="placeholder-content">
          <h2>Calendário</h2>
          <p>Aqui será mostrado o calendário.</p>
        </div>
      ),
      icon: <Bell size={16} />,
    },
    candidates: {
      name: "Candidatos",
      title: "Gestão de Candidatos",
      subtitle: "Veja e gere perfis de candidatos",
      component: () => (
        <div className="placeholder-content">
          <h2>Candidatos</h2>
          <p>Aqui será mostrada a lista de candidatos.</p>
        </div>
      ),
      icon: <User size={16} />,
    },
    settings: {
      name: "Definições",
      title: "Definições do Sistema",
      subtitle: "Configure as preferências da aplicação",
      component: () => (
        <div className="placeholder-content">
          <h2>Definições</h2>
          <p>Aqui serão mostradas as definições.</p>
        </div>
      ),
      icon: <User size={16} />,
    },
  };

  const currentTab = tabs[activeTab];
  const CurrentComponent = currentTab.component;

  return (
    <div className="dashboard">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="sidebar">
          {/* ...existing code... */}
          <div className="logo" style={{ position: "relative" }}>
            <img src="/logo-icon.svg" alt="Mesa+" />
            <span>Mesa+</span>
            <button
              className="sidebar-close-btn"
              style={{
                position: "absolute",
                right: -18,
                top: "50%",
                transform: "translateY(-50%)",
                background: "white",
                border: "none",
                borderRadius: "50%",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 10,
              }}
              title="Fechar sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <ChevronLeft size={20} color="#374151" />
            </button>
          </div>
          {/* ...existing code... */}
          <div className="nav-section">
            <h3>Secções</h3>
            <nav>
              {Object.entries(tabs).map(([key, tab]) => (
                <div
                  key={key}
                  className={`nav-item ${activeTab === key ? "active" : ""}`}
                  onClick={() => setActiveTab(key)}
                >
                  {tab.icon}
                  {tab.name}
                </div>
              ))}
            </nav>
          </div>
          {/* ...existing code... */}
          <div
            className="user-profile"
            style={{
              justifyContent: "center",
              textAlign: "center",
              fontSize: 13,
              color: "#6b7280",
              marginTop: "auto",
              padding: "16px 24px",
            }}
          >
            <span>feito por João Monteiro 2025</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            {!sidebarOpen && (
              <button
                className="sidebar-open-btn"
                style={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                title="Abrir sidebar"
                onClick={() => setSidebarOpen(true)}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f9fafb";
                  e.target.style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "white";
                  e.target.style.borderColor = "#e5e7eb";
                }}
              >
                <Menu size={18} color="#374151" />
              </button>
            )}
            <div className="header-title-section">
              <h1 className="page-title">{currentTab.title}</h1>
              <p className="page-subtitle">{currentTab.subtitle}</p>
            </div>
          </div>

          <div className="header-right">
            <div className="header-actions">
              <button className="action-btn notification-btn">
                <Bell size={20} />
                <span className="notification-badge">3</span>
              </button>

              <div className="header-divider"></div>

              <div className="user-section">
                <div className="user-profile-header">
                  {loading ? (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "#e5e7eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 16,
                        color: "#9ca3af",
                        animation: "pulse 1.5s infinite",
                      }}
                      title="A carregar..."
                    >
                      ...
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "#F3F4F6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 16,
                        color: "#374151",
                      }}
                      title={user?.name || user?.email || "User"}
                    >
                      {getInitials(user?.name, user?.email)}
                    </div>
                  )}
                </div>
                <div className="user-info-header">
                  <span className="user-name-header">
                    {loading ? (
                      <span
                        style={{
                          background: "#e5e7eb",
                          color: "transparent",
                          borderRadius: 4,
                          padding: "0 16px",
                          display: "inline-block",
                          height: 18,
                          width: 60,
                          animation: "pulse 1.5s infinite",
                        }}
                      >
                        ...
                      </span>
                    ) : (
                      user?.name || "-"
                    )}
                  </span>
                  <div className="date">
                    {new Date().toLocaleDateString("pt-PT", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>

              <button
                className="create-btn"
                disabled={loading}
                style={loading ? { opacity: 0.5, pointerEvents: "none" } : {}}
              >
                <Plus size={16} />
                Novo Pedido
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        {loading ? (
          <div style={{ padding: 32 }}>
            <div
              style={{
                height: 32,
                width: 180,
                background: "#e5e7eb",
                borderRadius: 8,
                marginBottom: 12,
                animation: "pulse 1.5s infinite",
              }}
            ></div>
            <div
              style={{
                height: 18,
                width: 320,
                background: "#e5e7eb",
                borderRadius: 8,
                marginBottom: 24,
                animation: "pulse 1.5s infinite",
              }}
            ></div>
            <div
              style={{
                height: 120,
                width: "100%",
                background: "#e5e7eb",
                borderRadius: 12,
                animation: "pulse 1.5s infinite",
              }}
            ></div>
          </div>
        ) : (
          <CurrentComponent user={user} />
        )}
      </div>
      {/* Add pulse animation for skeleton */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
