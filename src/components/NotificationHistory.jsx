"use client";

import React, { useState, useEffect, useContext } from "react";
import { createPortal } from "react-dom";
import { NotificationContext } from "../contexts/NotificationContext";
import { X, Trash2, Bell, BellOff } from "lucide-react";
import "./NotificationHistory.scss";

/**
 * Notification History Panel
 * Shows recent notifications with ability to review and clear
 */
const NotificationHistory = ({ isOpen, onClose }) => {
  const context = useContext(NotificationContext);
  const [filter, setFilter] = useState("all");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
    } else {
      setIsMounted(false);
    }
  }, [isOpen]);

  // Safety check - if context not available, don't render
  if (!context || !isOpen || !isMounted) return null;

  const { notifications, clearAll } = context;

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "all") return true;
    return notif.type === filter;
  });

  const notificationTypes = [
    { value: "all", label: "Todas" },
    { value: "order", label: "Pedidos" },
    { value: "takeaway", label: "Takeaway" },
    { value: "reservation", label: "Reservas" },
    { value: "payment", label: "Pagamentos" },
    { value: "attendance", label: "Presenças" },
    { value: "menu", label: "Menu" },
    { value: "stock", label: "Stock" },
  ];

  if (!isOpen || !isMounted) return null;

  return createPortal(
    <>
      <div className="notification-history-backdrop" onClick={onClose} />
      <div className="notification-history-panel">
        <div className="notification-history-header">
          <h2>
            <Bell size={20} />
            Histórico de Notificações
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="notification-history-filters">
          {notificationTypes.map((type) => (
            <button
              key={type.value}
              className={`filter-btn ${filter === type.value ? "active" : ""}`}
              onClick={() => setFilter(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="notification-history-actions">
          <span className="count">
            {filteredNotifications.length}{" "}
            {filteredNotifications.length === 1
              ? "notificação"
              : "notificações"}
          </span>
          {notifications.length > 0 && (
            <button className="clear-all-btn" onClick={clearAll}>
              <Trash2 size={16} />
              Limpar Todas
            </button>
          )}
        </div>

        <div className="notification-history-list">
          {filteredNotifications.length === 0 ? (
            <div className="empty-state">
              <BellOff size={48} />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            filteredNotifications
              .slice()
              .reverse()
              .map((notif) => (
                <div key={notif.id} className={`history-item ${notif.type}`}>
                  <div className="history-item-content">
                    <div className="history-item-title">{notif.title}</div>
                    <div className="history-item-message">{notif.message}</div>
                    <div className="history-item-time">
                      {new Date(notif.timestamp).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default NotificationHistory;
