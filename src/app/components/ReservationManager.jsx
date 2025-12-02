"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar as AntCalendar,
  Modal,
  Select,
  Input,
  Badge,
  message,
} from "antd";
import {
  Calendar,
  Clock,
  Users,
  Phone,
  Mail,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  AlertCircle,
  UserCheck,
  UserX,
} from "lucide-react";
import dayjs from "dayjs";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import "./ReservationManager.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const STATUS_MAP = {
  pending: { label: "Pendente", color: "#f59e0b", icon: Clock },
  confirmed: { label: "Confirmada", color: "#3b82f6", icon: Check },
  seated: { label: "Sentada", color: "#10b981", icon: UserCheck },
  completed: { label: "Concluída", color: "#6b7280", icon: Check },
  cancelled: { label: "Cancelada", color: "#ef4444", icon: X },
  "no-show": { label: "Não Compareceu", color: "#dc2626", icon: UserX },
};

const ReservationManager = () => {
  const { socket, connected } = useWebSocketContext();
  const [reservations, setReservations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    party_size: 2,
    reservation_date: dayjs().format("YYYY-MM-DD"),
    reservation_time: "19:00",
    special_requests: "",
  });

  const getAuthToken = () => localStorage.getItem("auth_token");

  const apiRequest = async (endpoint, options = {}) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Erro: ${response.status}`);
    }

    return response.json();
  };

  const fetchReservations = async (date = null) => {
    try {
      setLoading(true);
      const dateStr = date || selectedDate.format("YYYY-MM-DD");
      const data = await apiRequest(`/reservations?date=${dateStr}`);
      setReservations(data.reservations || []);
    } catch (error) {
      message.error("Erro ao carregar reservas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [selectedDate]);

  // WebSocket listeners
  useEffect(() => {
    if (!socket || !connected) return;

    const handleReservationCreated = (data) => {
      if (data.reservation) {
        fetchReservations();
        message.success("Nova reserva criada");
      }
    };

    const handleReservationUpdated = (data) => {
      if (data.reservation) {
        fetchReservations();
      }
    };

    const handleReservationDeleted = () => {
      fetchReservations();
      message.info("Reserva eliminada");
    };

    socket.on("reservation:created", handleReservationCreated);
    socket.on("reservation:updated", handleReservationUpdated);
    socket.on("reservation:deleted", handleReservationDeleted);

    return () => {
      socket.off("reservation:created", handleReservationCreated);
      socket.off("reservation:updated", handleReservationUpdated);
      socket.off("reservation:deleted", handleReservationDeleted);
    };
  }, [socket, connected, selectedDate]);

  const handleSubmit = async () => {
    try {
      if (!formData.customer_name || !formData.customer_phone) {
        message.error("Nome e telefone são obrigatórios");
        return;
      }

      if (editingReservation) {
        await apiRequest(`/reservations/${editingReservation.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        message.success("Reserva atualizada");
      } else {
        await apiRequest("/reservations", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        message.success("Reserva criada");
      }

      resetForm();
      fetchReservations();
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: "Eliminar Reserva",
      content: "Tem certeza que deseja eliminar esta reserva?",
      okText: "Eliminar",
      cancelText: "Cancelar",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiRequest(`/reservations/${id}`, { method: "DELETE" });
          message.success("Reserva eliminada");
          fetchReservations();
        } catch (error) {
          message.error(error.message);
        }
      },
    });
  };

  const handleStatusChange = async (id, status) => {
    try {
      await apiRequest(`/reservations/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      message.success("Estado atualizado");
      fetchReservations();
    } catch (error) {
      message.error(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      party_size: 2,
      reservation_date: selectedDate.format("YYYY-MM-DD"),
      reservation_time: "19:00",
      special_requests: "",
    });
    setEditingReservation(null);
    setShowModal(false);
  };

  const startEdit = (reservation) => {
    setEditingReservation(reservation);
    setFormData({
      customer_name: reservation.customer_name,
      customer_phone: reservation.customer_phone,
      customer_email: reservation.customer_email || "",
      party_size: reservation.party_size,
      reservation_date: reservation.reservation_date,
      reservation_time:
        reservation.time_only ||
        reservation.reservation_time?.slice(0, 5) ||
        "19:00",
      special_requests: reservation.special_requests || "",
    });
    setShowModal(true);
  };

  const getDateReservations = (date) => {
    const dateStr = date.format("YYYY-MM-DD");
    return reservations.filter((r) => r.reservation_date === dateStr);
  };

  const cellRender = (current, info) => {
    if (info.type !== "date") return info.originNode;

    const dateReservations = getDateReservations(current);
    if (dateReservations.length === 0) return null;

    return (
      <div className="calendar-badges">
        {dateReservations.slice(0, 3).map((r) => (
          <Badge
            key={r.id}
            color={STATUS_MAP[r.status]?.color}
            text={`${r.customer_name.split(" ")[0]} (${r.party_size})`}
          />
        ))}
        {dateReservations.length > 3 && (
          <div className="more-badge">+{dateReservations.length - 3} mais</div>
        )}
      </div>
    );
  };

  const todayReservations = getDateReservations(selectedDate);

  return (
    <div className="reservation-manager">
      <div className="reservation-container">
        {/* Header Card */}
        <div className="reservation-header-card">
          <div className="reservation-header-card__content">
            <div className="reservation-header-card__left">
              <h1 className="reservation-header-card__title">
                <Calendar size={32} />
                Gestão de Reservas
              </h1>
              <p className="reservation-header-card__description">
                Gerencie as reservas de mesas do restaurante
              </p>
              <div className="reservation-header-card__actions">
                <button
                  className="reservation-header-card__btn reservation-header-card__btn--primary"
                  onClick={() => {
                    resetForm();
                    setShowModal(true);
                  }}
                >
                  <Plus size={18} />
                  Nova Reserva
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="reservation-content">
          {/* Calendar */}
          <div className="calendar-card">
            <AntCalendar
              fullscreen={false}
              onSelect={(date) => setSelectedDate(date)}
              cellRender={cellRender}
            />
          </div>

          {/* Reservations List */}
          <div className="reservations-card">
            <div className="reservations-card__header">
              <h2>Reservas para {selectedDate.format("DD/MM/YYYY")}</h2>
              <span className="reservations-count">
                {todayReservations.length}{" "}
                {todayReservations.length === 1 ? "reserva" : "reservas"}
              </span>
            </div>

            <div className="reservations-list">
              {loading ? (
                <div className="loading-state">A carregar...</div>
              ) : todayReservations.length === 0 ? (
                <div className="empty-state">
                  <Calendar size={48} />
                  <p>Nenhuma reserva para este dia</p>
                </div>
              ) : (
                todayReservations
                  .sort((a, b) => {
                    const timeA = a.time_only || a.reservation_time;
                    const timeB = b.time_only || b.reservation_time;
                    return timeA.localeCompare(timeB);
                  })
                  .map((reservation) => {
                    const StatusIcon =
                      STATUS_MAP[reservation.status]?.icon || AlertCircle;
                    return (
                      <div key={reservation.id} className="reservation-item">
                        <div className="reservation-item__time">
                          <Clock size={16} />
                          {reservation.time_only ||
                            reservation.reservation_time?.slice(11, 16) ||
                            "N/A"}
                        </div>
                        <div className="reservation-item__info">
                          <div className="reservation-item__name">
                            {reservation.customer_name}
                          </div>
                          <div className="reservation-item__details">
                            <span>
                              <Phone size={12} />
                              {reservation.customer_phone}
                            </span>
                            <span>
                              <Users size={12} />
                              {reservation.party_size}{" "}
                              {reservation.party_size === 1
                                ? "pessoa"
                                : "pessoas"}
                            </span>
                          </div>
                          {reservation.special_requests && (
                            <div className="reservation-item__notes">
                              {reservation.special_requests}
                            </div>
                          )}
                        </div>
                        <div className="reservation-item__status">
                          <Select
                            value={reservation.status}
                            onChange={(value) =>
                              handleStatusChange(reservation.id, value)
                            }
                            style={{ width: 140 }}
                          >
                            {Object.entries(STATUS_MAP).map(([key, val]) => (
                              <Select.Option key={key} value={key}>
                                <span style={{ color: val.color }}>
                                  {val.label}
                                </span>
                              </Select.Option>
                            ))}
                          </Select>
                        </div>
                        <div className="reservation-item__actions">
                          <button
                            className="action-btn action-btn--edit"
                            onClick={() => startEdit(reservation)}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="action-btn action-btn--delete"
                            onClick={() => handleDelete(reservation.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        {/* Modal */}
        <Modal
          title={editingReservation ? "Editar Reserva" : "Nova Reserva"}
          open={showModal}
          onOk={handleSubmit}
          onCancel={resetForm}
          okText={editingReservation ? "Atualizar" : "Criar"}
          cancelText="Cancelar"
          width={600}
          centered
          className="reservation-modal"
          classNames={{
            header: "reservation-modal-header",
            body: "reservation-modal-body",
            footer: "reservation-modal-footer",
          }}
        >
          <div className="reservation-form">
            <div className="form-group">
              <label>Nome *</label>
              <Input
                size="large"
                value={formData.customer_name}
                onChange={(e) =>
                  setFormData({ ...formData, customer_name: e.target.value })
                }
                placeholder="Nome do cliente"
              />
            </div>

            <div className="form-group">
              <label>Telefone *</label>
              <Input
                size="large"
                value={formData.customer_phone}
                onChange={(e) =>
                  setFormData({ ...formData, customer_phone: e.target.value })
                }
                placeholder="Número de telefone"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <Input
                size="large"
                value={formData.customer_email}
                onChange={(e) =>
                  setFormData({ ...formData, customer_email: e.target.value })
                }
                placeholder="Email (opcional)"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Data *</label>
                <Input
                  size="large"
                  type="date"
                  value={formData.reservation_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reservation_date: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Hora *</label>
                <Input
                  size="large"
                  type="time"
                  value={formData.reservation_time}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reservation_time: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label>Número de Pessoas *</label>
              <Input
                size="large"
                type="number"
                min={1}
                value={formData.party_size}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    party_size: parseInt(e.target.value),
                  })
                }
              />
            </div>

            <div className="form-group">
              <label>Pedidos Especiais</label>
              <Input.TextArea
                rows={3}
                value={formData.special_requests}
                onChange={(e) =>
                  setFormData({ ...formData, special_requests: e.target.value })
                }
                placeholder="Alergias, preferências de mesa, etc."
              />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default ReservationManager;
