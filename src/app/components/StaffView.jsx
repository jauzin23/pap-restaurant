"use client";

import React, { useState } from "react";
import { UserCircle, Plus, UtensilsCrossed, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { API_FILES_URL } from "../../lib/api";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import "./StaffView.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const StaffView = ({ username, userLabels, profileImg }) => {
  const { socket, connected } = useWebSocketContext();

  // State for real-time stats
  const [activeOrders, setActiveOrders] = React.useState(18);
  const [availableTables, setAvailableTables] = React.useState({ available: 8, total: 12 });
  const [tasksToday, setTasksToday] = React.useState(8);
  const [myOrders, setMyOrders] = React.useState(18);

  // Mock random colors
  const mockRandomColors = {
    greeting: "#ff6b35",
    dot: "#e74c3c",
  };

  // Fetch initial stats
  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/staff/stats`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setActiveOrders(data.activeOrders || 18);
          setAvailableTables(data.availableTables || { available: 8, total: 12 });
          setTasksToday(data.tasksToday || 8);
          setMyOrders(data.myOrders || 18);
        }
      } catch (error) {
        console.error('❌ Failed to fetch staff stats:', error);
      }
    };

    fetchStats();
  }, []);

  // WebSocket real-time updates
  React.useEffect(() => {
    if (!socket || !connected) return;

    console.log('🔌 StaffView: Setting up WebSocket listeners');

    const handleOrderCreated = (order) => {
      console.log('📦 StaffView: New order received', order);
      setActiveOrders((prev) => prev + 1);
      // If order is assigned to current user
      if (order.assigned_to === username) {
        setMyOrders((prev) => prev + 1);
      }
    };

    const handleOrderUpdated = (order) => {
      console.log('📝 StaffView: Order updated', order);
      // Update task counts based on order status
      if (order.status === 'completo' || order.status === 'entregue') {
        setActiveOrders((prev) => Math.max(0, prev - 1));
        if (order.assigned_to === username) {
          setMyOrders((prev) => Math.max(0, prev - 1));
        }
      }
    };

    const handleOrderDeleted = ({ id }) => {
      console.log('🗑️ StaffView: Order deleted', id);
      setActiveOrders((prev) => Math.max(0, prev - 1));
    };

    const handleTableUpdated = (table) => {
      console.log('📍 StaffView: Table updated', table);
      // Could refresh available tables count
    };

    const handleTaskAssigned = (task) => {
      console.log('✅ StaffView: Task assigned', task);
      setTasksToday((prev) => prev + 1);
    };

    // Subscribe to events
    socket.on('order:created', handleOrderCreated);
    socket.on('order:updated', handleOrderUpdated);
    socket.on('order:deleted', handleOrderDeleted);
    socket.on('table:updated', handleTableUpdated);
    socket.on('task:assigned', handleTaskAssigned);

    // Cleanup
    return () => {
      console.log('🔌 StaffView: Cleaning up WebSocket listeners');
      socket.off('order:created', handleOrderCreated);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('order:deleted', handleOrderDeleted);
      socket.off('table:updated', handleTableUpdated);
      socket.off('task:assigned', handleTaskAssigned);
    };
  }, [socket, connected, username]);

  // Profile Image Component with fallback
  const ProfileImage = ({
    src,
    alt,
    className,
    size = 24,
    isCircular = false,
  }) => {
    const [hasError, setHasError] = React.useState(false);

    if (hasError || !src) {
      return (
        <div
          className={`${className} bg-gray-100 flex items-center justify-center ${
            isCircular ? "rounded-full" : "rounded-lg"
          }`}
          style={{
            width: typeof size === "number" ? `${size}px` : size,
            height: typeof size === "number" ? `${size}px` : size,
          }}
        >
          <UserCircle
            size={typeof size === "number" ? Math.floor(size * 0.7) : 24}
            className="text-gray-400"
          />
        </div>
      );
    }

    return (
      <div
        className={`${className} ${
          isCircular ? "rounded-full" : "rounded-lg"
        } overflow-hidden`}
        style={{
          width: typeof size === "number" ? `${size}px` : size,
          height: typeof size === "number" ? `${size}px` : size,
          backgroundColor: "#f8fafc",
        }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          style={{
            backgroundColor: "transparent",
          }}
        />
      </div>
    );
  };

  return (
    <div className="staff-view">
      {/* Stats Bar */}
      <div className="stats-bar fade-in-delayed">
        {[
          { label: "Pedidos Ativos", value: String(activeOrders), type: "active" },
          { label: "Mesas Livres", value: `${availableTables.available}/${availableTables.total}`, type: "highlight" },
          { label: "Tarefas Hoje", value: String(tasksToday), type: "" },
        ].map((stat, index) => (
          <div key={index} className="stat-item scale-in hover-lift">
            <span className="stat-label">{stat.label}</span>
            <button className={`stat-btn hover-button ${stat.type}`}>
              {stat.value}
            </button>
          </div>
        ))}

        <div className="summary-stats fade-in-delayed">
          {/* No summary stats for staff view */}
        </div>
      </div>

      {/* Staff Dashboard Grid */}
      <div className="staff-dashboard-grid fade-in-delayed">
        <div className="left-section slide-in-left">
          <div className="profile-card scale-in hover-lift">
            <div className="profile-image">
              <ProfileImage
                src={profileImg}
                alt={username || "Funcionário"}
                className="w-full aspect-square object-cover rounded-lg"
                size="100%"
              />
              <div className="profile-info">
                <div className="profile-overlay"></div>
                <h3>{username ? username : "Funcionário"}</h3>
                {userLabels.length > 0 ? (
                  <p>{userLabels.join(", ")}</p>
                ) : (
                  <p>Funcionário</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="center-section">
          <div className="progress-card card">
            <div className="card-header">
              <h3>Desempenho Semanal</h3>
              <button className="expand-btn">↗</button>
            </div>
            <div className="progress-content">
              <div className="hours-display">
                <span className="hours">€2.1</span>
                <span className="hours-label">K</span>
              </div>
              <div className="work-time-label">
                <div>Vendas Totais</div>
                <div className="week-label">esta semana</div>
              </div>
              <div className="highlight-badge">+8%</div>
            </div>
            <div className="week-chart">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
                <div key={index} className="chart-bar">
                  <div
                    className={`bar ${index === 4 ? "active" : ""}`}
                    style={{
                      height: `${[40, 60, 65, 75, 90, 80, 55][index]}%`,
                    }}
                  ></div>
                  <span>{day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="calendar-section">
            <div className="calendar-header">
              <div className="month">Agosto</div>
              <div className="month current">Setembro 2024</div>
              <div className="month">Outubro</div>
            </div>
            <div className="calendar-days">
              <div className="day-column">
                <div className="day-header">Seg</div>
                <div className="day-number">22</div>
              </div>
              <div className="day-column">
                <div className="day-header">Ter</div>
                <div className="day-number">23</div>
              </div>
              <div className="day-column">
                <div className="day-header">Qua</div>
                <div className="day-number">24</div>
              </div>
              <div className="day-column">
                <div className="day-header">Qui</div>
                <div className="day-number">25</div>
              </div>
              <div className="day-column">
                <div className="day-header">Sex</div>
                <div className="day-number">26</div>
              </div>
              <div className="day-column">
                <div className="day-header">Sáb</div>
                <div className="day-number">27</div>
              </div>
            </div>

            <div className="calendar-events">
              <div className="event-time">10:00</div>
              <div className="event-card team-sync">
                <div className="event-title">Turno Manhã</div>
                <div className="event-subtitle">Atendimento sala • 4 horas</div>
                <div className="event-avatars">
                  <div className="avatar"></div>
                  <div className="avatar"></div>
                </div>
              </div>
              <div className="event-time">14:00</div>
              <div className="event-time">15:30</div>
              <div className="event-card onboarding">
                <div className="event-title">Pausa</div>
                <div className="event-subtitle">Descanso de 30 minutos</div>
                <div className="event-avatars">
                  <div className="avatar"></div>
                </div>
              </div>
              <div className="event-time">16:00</div>
              <div className="event-card dinner">
                <div className="event-title">Turno Tarde</div>
                <div className="event-subtitle">
                  Atendimento esplanada • 4 horas
                </div>
                <div className="event-avatars">
                  <div className="avatar"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="right-section">
          <div className="onboarding-card card">
            <div className="card-header">
              <h3>Meus Pedidos</h3>
              <span className="percentage">{myOrders}</span>
            </div>
            <div className="onboarding-bars">
              <div className="progress-bar">
                <div className="bar-label">45%</div>
                <div className="bar-fill task"></div>
              </div>
              <div className="progress-bar">
                <div className="bar-label">30%</div>
                <div className="bar-fill progress"></div>
              </div>
              <div className="progress-bar">
                <div className="bar-label">25%</div>
                <div className="bar-fill incomplete"></div>
              </div>
            </div>
            <div className="legend">
              <span className="legend-item">
                <span className="dot task"></span> Entregue
              </span>
              <span className="legend-item">
                <span className="dot progress"></span> A caminho
              </span>
              <span className="legend-item">
                <span className="dot incomplete"></span> Pendente
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffView;
