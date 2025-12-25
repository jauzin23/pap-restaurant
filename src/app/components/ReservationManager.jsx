"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { notification } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/pt";
import {
  Calendar,
  Clock,
  Users,
  Phone,
  Mail,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  Filter,
  UserCheck,
  UserX,
  RefreshCw,
} from "lucide-react";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import NumberFlow from "@number-flow/react";
import { tableLayouts, tables as tablesApi } from "@/lib/api";
import "./ReservationManager.scss";

dayjs.locale("pt");

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente", color: "#f59e0b" },
  { value: "completed", label: "Concluída", color: "#10b981" },
];

const getStatusColor = (status) => {
  switch (status) {
    case "pending":
      return "#f59e0b";
    case "completed":
      return "#10b981";
    default:
      return "#6b7280";
  }
};

const getNextStatus = (currentStatus) => {
  const workflow = ["pending", "completed"];
  const idx = workflow.indexOf(currentStatus);
  if (idx === -1 || idx === workflow.length - 1) return null;
  return workflow[idx + 1];
};

// QR Reader Component using react-qr-reader

// (removed duplicate import)
import { BrowserQRCodeReader } from "@zxing/browser";

function QRScanZXingComponent({ onScan }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  useEffect(() => {
    let codeReader;
    let active = true;
    if (videoRef.current && !freeze) {
      codeReader = new BrowserQRCodeReader();
      codeReader
        .decodeFromVideoDevice(
          null,
          videoRef.current,
          (result, err, controls) => {
            if (!controlsRef.current) controlsRef.current = controls;
            if (result && active) {
              onScan(result.getText());
              active = false;
              if (controlsRef.current) controlsRef.current.stop();
            }
          }
        )
        .then((ctrl) => {
          controlsRef.current = ctrl;
        });
      {freeze && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "1.5rem",
            zIndex: 2,
          }}
        >
          Verificando QR...
                        <div
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#22c55e",
                          }}
                        />

  // State
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [tables, setTables] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState(0);
  const [selectedTableIds, setSelectedTableIds] = useState([]);
  const [qrModal, setQrModal] = useState({ open: false, reservationId: null });
  const [qrError, setQrError] = useState("");

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

  const showToast = (message, type = "success") => {
    notification[type]({
      message:
        type === "success"
          ? "Sucesso"
          : type === "error"
          ? "Erro"
          : "Informação",
      description: message,
      placement: "topRight",
      duration: 3,
    });
  };

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
      let errorMessage = `Erro: ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch (e) {
        // Response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  };

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/reservations");
      setReservations(data.reservations || []);
    } catch (error) {
      showToast("Erro ao carregar reservas", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const allTablesResponse = await tablesApi.list();
      const tablesList = allTablesResponse.documents || [];
      console.log(
        "📋 Tables loaded:",
        tablesList.length,
        tablesList.slice(0, 2)
      );
      setTables(tablesList);
    } catch (error) {
      console.error("Erro ao carregar mesas:", error);
    }
  };

  const fetchLayouts = async () => {
    try {
      const dbLayouts = await tableLayouts.list();
      console.log("🏢 Layouts loaded:", dbLayouts.length, dbLayouts);
      setLayouts(dbLayouts || []);
    } catch (error) {
      console.error("Erro ao carregar layouts:", error);
    }
  };

  useEffect(() => {
    fetchReservations();
    fetchTables();
    fetchLayouts();
  }, []);

  // Memoize current layout tables to prevent re-computation on every render
  const currentLayoutTables = useMemo(() => {
    if (layouts.length > 0 && layouts[selectedLayoutIndex]) {
      return layouts[selectedLayoutIndex].tables || [];
    }
    return [];
  }, [layouts, selectedLayoutIndex]);

  // WebSocket listeners
  useEffect(() => {
    if (!socket || !connected) return;

    // Reservation events
    const handleReservationCreated = () => fetchReservations();
    const handleReservationUpdated = () => fetchReservations();
    const handleReservationDeleted = () => fetchReservations();

    // Table events - update state directly without re-fetching
    const handleTableCreated = (table) => {
      console.log("🆕 Table created via WebSocket:", table);
      setTables((prev) => [...prev, table]);
    };

    const handleTableUpdated = (table) => {
      console.log("✏️ Table updated via WebSocket:", table);
      setTables((prev) =>
        prev.map((t) => (t.id === table.id ? { ...t, ...table } : t))
      );
    };

    const handleTableDeleted = ({ id }) => {
      console.log("🗑️ Table deleted via WebSocket:", id);
      setTables((prev) => prev.filter((t) => t.id !== id));
      setSelectedTableIds((prev) => prev.filter((tableId) => tableId !== id));
    };

    // Layout events - update state directly without re-fetching
    const handleLayoutCreated = (layout) => {
      console.log("🆕 Layout created via WebSocket:", layout);
      setLayouts((prev) => [...prev, layout]);
    };

    const handleLayoutUpdated = (layout) => {
      console.log("✏️ Layout updated via WebSocket:", layout);
      setLayouts((prev) =>
        prev.map((l) => (l.id === layout.id ? { ...l, ...layout } : l))
      );
      // Re-fetch tables to get updated layout associations
      fetchTables();
    };

    const handleLayoutDeleted = ({ id }) => {
      console.log("🗑️ Layout deleted via WebSocket:", id);
      setLayouts((prev) => prev.filter((l) => l.id !== id));
      if (
        layouts[selectedLayoutIndex] &&
        layouts[selectedLayoutIndex].id === id
      ) {
        setSelectedLayoutIndex(0);
      }
    };

    // Register reservation listeners
    socket.on("reservation:created", handleReservationCreated);
    socket.on("reservation:updated", handleReservationUpdated);
    socket.on("reservation:deleted", handleReservationDeleted);

    // Register table listeners
    socket.on("table:created", handleTableCreated);
    socket.on("table:updated", handleTableUpdated);
    socket.on("table:deleted", handleTableDeleted);

    // Register layout listeners
    socket.on("layout:created", handleLayoutCreated);
    socket.on("layout:updated", handleLayoutUpdated);
    socket.on("layout:deleted", handleLayoutDeleted);

    return () => {
      // Cleanup reservation listeners
      socket.off("reservation:created", handleReservationCreated);
      socket.off("reservation:updated", handleReservationUpdated);
      socket.off("reservation:deleted", handleReservationDeleted);

      // Cleanup table listeners
      socket.off("table:created", handleTableCreated);
      socket.off("table:updated", handleTableUpdated);
      socket.off("table:deleted", handleTableDeleted);

      // Cleanup layout listeners
      socket.off("layout:created", handleLayoutCreated);
      socket.off("layout:updated", handleLayoutUpdated);
      socket.off("layout:deleted", handleLayoutDeleted);
    };
  }, [socket, connected, layouts, selectedLayoutIndex]);

  const handleSubmit = async () => {
    try {
      if (!formData.customer_name || !formData.customer_phone) {
        showToast("Nome e telefone são obrigatórios", "error");
        return;
      }

      const payload = {
        ...formData,
        table_ids: selectedTableIds.length > 0 ? selectedTableIds : undefined,
      };

      const response = await apiRequest("/reservations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast("Reserva criada com sucesso!", "success");

      resetForm();
      fetchReservations();
    } catch (error) {
      console.error("Erro ao criar reserva:", error);
      showToast(error.message || "Erro ao criar reserva", "error");
      // Still refresh to check if it was created despite error
      fetchReservations();
    }
  };

  const handleDelete = async (id) => {
    const reservation = reservations.find((r) => r.id === id);
    if (!reservation) return;

    setConfirmModal({
      title: "Eliminar Reserva",
      message: `Tem certeza que deseja eliminar a reserva de "${reservation.customer_name}"?`,
      onConfirm: async () => {
        try {
          await apiRequest(`/reservations/${id}`, { method: "DELETE" });
          showToast("Reserva eliminada");
          fetchReservations();
          setConfirmModal(null);
        } catch (error) {
          showToast(error.message, "error");
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const handleStatusChange = async (id, status) => {
    if (status === "completed") {
      // Require QR code scan before completing
      setQrModal({ open: true, reservationId: id });
      return;
    }
    try {
      await apiRequest(`/reservations/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      showToast("Estado atualizado");
      fetchReservations();
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // QR code scan handler
  const handleQrScan = async (scanned) => {
    setQrError("");
    if (!qrModal.reservationId) return;
    setQrLoading(true);
    try {
      // Send scanned QR token to backend for verification
      const verifyRes = await apiRequest(
        `/reservations/${qrModal.reservationId}/verify-qr`,
        {
          method: "POST",
          body: JSON.stringify({ qrToken: scanned }),
        }
      );
      showToast(
        verifyRes.message || "Reserva concluída com sucesso!",
        "success"
      );
      setQrModal({ open: false, reservationId: null });
      fetchReservations();
    } catch (err) {
      setQrError(err.message || "QR code inválido ou erro de verificação.");
    } finally {
      setQrLoading(false);
    }
  };

  const fetchCalendarDays = (value) => {
    // Placeholder function for calendar panel change
    setSelectedDate(value);
  };

  const onPanelChange = (value) => {
    fetchCalendarDays(value);
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
    setSelectedTableIds([]);
    setEditingReservation(null);
    setShowModal(false);
  };

  // Filter reservations
  const filteredReservations = reservations.filter((r) => {
    const matchesSearch =
      r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_phone?.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;

    // Filter by tab
    const isCompleted =
      r.status === "completed" ||
      r.status === "cancelled" ||
      r.status === "no-show";
    const matchesTab = activeTab === "active" ? !isCompleted : isCompleted;

    return matchesSearch && matchesStatus && matchesTab;
  });

  // Table columns
  const columns = [
    {
      title: "#",
      dataIndex: "reservation_number",
      key: "reservation_number",
      align: "center",
      render: (number) => (
        <div
          style={{
            fontWeight: 700,
            fontSize: "14px",
            color: "#1f2937",
            fontFamily: "monospace",
          }}
        >
          #{number}
        </div>
      ),
    },
    {
      title: "Cliente",
      dataIndex: "customer_name",
      key: "customer_name",
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{text}</div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            <Phone size={12} style={{ marginRight: 4, display: "inline" }} />
            {record.customer_phone}
          </div>
        </div>
      ),
    },
    {
      title: "Data & Hora",
      key: "datetime",
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {dayjs(record.reservation_date).format("DD/MM/YYYY")}
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            <Clock size={12} style={{ marginRight: 4, display: "inline" }} />
            {record.time_only || "19:00"}
          </div>
        </div>
      ),
    },
    {
      title: "Pessoas",
      dataIndex: "party_size",
      key: "party_size",
      align: "center",
      render: (size) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            justifyContent: "center",
          }}
        >
          <Users size={14} />
          <NumberFlow value={size} />
        </div>
      ),
    },
    {
      title: "Mesas",
      key: "tables",
      render: (_, record) => {
        if (!record.table_names || record.table_names.length === 0) {
          return <span style={{ color: "#9ca3af", fontSize: "12px" }}>—</span>;
        }
        return (
          <div style={{ fontSize: "13px", color: "#374151" }}>
            {record.table_names.join(", ")}
          </div>
        );
      },
    },
    {
      title: "Estado",
      dataIndex: "status",
      key: "status",
      render: (status, record) => {
        const statusConfig = STATUS_OPTIONS.find((s) => s.value === status);
        const nextStatus = getNextStatus(status);
        return (
          <button
            type="button"
            className="reservation-status-badge"
            style={{
              background: "#fff",
              color: "#1e293b",
              border: "1.5px solid #d1d5db",
              borderRadius: "1rem",
              padding: "0.5rem 1.25rem",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: nextStatus ? "pointer" : "default",
              outline: "none",
              transition: "background 0.2s, border 0.2s, color 0.2s",
              boxShadow: nextStatus
                ? "0 2px 8px rgba(16,185,129,0.04)"
                : undefined,
              opacity: nextStatus ? 1 : 0.7,
            }}
            .then((ctrl) => {
              controlsRef.current = ctrl;
            });
        }
        return () => {
          active = false;
          if (controlsRef.current) controlsRef.current.stop();
        };
      }, [onScan, freeze]);
      return (
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <video
            ref={videoRef}
            style={{ width: "100%", borderRadius: "1.5rem", background: "#000" }}
          />
          {freeze && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "1.5rem",
                zIndex: 2,
              }}
            >
              Verificando QR...
            </div>
          )}
        </div>
      );
    <>
      <div className="reservation-manager">
        {/* Header */}
        <div className="stock-header-card">
          <div className="stock-header-card__content">
            <div className="stock-header-card__left">
              <h1 className="stock-header-card__title">Gestão de Reservas</h1>
              <p className="stock-header-card__description">
                Gerencie as reservas de mesas do restaurante
              </p>
              <div className="stock-header-card__actions">
                <button
                  onClick={fetchReservations}
                  disabled={loading}
                  className="stock-header-card__btn stock-header-card__btn--secondary"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin" : ""}
                  />
                  Atualizar
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowModal(true);
                  }}
                  className="stock-header-card__btn stock-header-card__btn--primary"
                >
                  <Plus size={16} />
                  Nova Reserva
                </button>
              </div>
            </div>
            <div className="stock-header-card__right">
              <div className="stock-header-card__circles">
                <div className="circle circle-1"></div>
                <div className="circle circle-2"></div>
                <div className="circle circle-3"></div>
                <div className="circle circle-4"></div>
                <div className="circle circle-5"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="stock-tabs">
          <button
            onClick={() => setActiveTab("active")}
            className={`stock-tab ${activeTab === "active" ? "active" : ""}`}
          >
            <Calendar size={18} />
            Ativas
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`stock-tab ${activeTab === "history" ? "active" : ""}`}
          >
            <Clock size={18} />
            Histórico
          </button>
        </div>

        {/* Controls */}
        <div className="stock-controls">
          <div className="stock-controls__left">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Pesquisar por nome ou telefone..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="search-clear"
                  onClick={() => setSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          <div className="stock-controls__right">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="custom-select"
            >
              <option value="all">Todos os Estados</option>
              {STATUS_OPTIONS.filter((s) => {
                const isCompletedStatus =
                  s.value === "completed" ||
                  s.value === "cancelled" ||
                  s.value === "no-show";
                return activeTab === "active"
                  ? !isCompletedStatus
                  : isCompletedStatus;
              }).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="custom-table-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>A carregar reservas...</p>
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma reserva encontrada</p>
            </div>
          ) : (
            <>
              <table className="custom-table">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        style={{ textAlign: col.align || "left" }}
                      >
                        {col.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          style={{ textAlign: col.align || "left" }}
                        >
                          {col.render
                            ? col.render(
                                reservation[col.dataIndex],
                                reservation
                              )
                            : reservation[col.dataIndex]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="table-footer">
                <span>
                  {filteredReservations.length} reserva
                  {filteredReservations.length !== 1 ? "s" : ""}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Custom Modal */}
        {showModal &&
          createPortal(
            <div className="modal-overlay">
              <div className="modal-container">
                {/* Modal Header */}
                <div className="modal-header">
                  <div className="header-text">
                    <h2>Nova Reserva</h2>
                    <p>Preencha os dados da nova reserva</p>
                  </div>
                  <button onClick={resetForm} className="close-button">
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="modal-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Nome *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.customer_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_name: e.target.value,
                          })
                        }
                        placeholder="Nome do cliente"
                      />
                    </div>

                    <div className="form-group">
                      <label>Telefone *</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={formData.customer_phone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_phone: e.target.value,
                          })
                        }
                        placeholder="Número de telefone"
                      />
                    </div>

                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={formData.customer_email}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customer_email: e.target.value,
                          })
                        }
                        placeholder="Email (opcional)"
                      />
                    </div>

                    <div className="form-group">
                      <label>Data *</label>
                      <input
                        type="date"
                        className="form-input"
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
                      <input
                        type="time"
                        className="form-input"
                        value={formData.reservation_time}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reservation_time: e.target.value,
                          })
                        }
                      />
                    </div>

                    createPortal(
                      <div className="modal-overlay">
                        <div className="modal-container">
                          {/* Modal Header */}
                          <div className="modal-header">
                            <div className="header-text">
                              <h2>Nova Reserva</h2>
                              <p>Preencha os dados da nova reserva</p>
                            </div>
                            <button onClick={resetForm} className="close-button">
                              <X size={20} />
                            </button>
                          </div>

                          {/* Modal Content */}
                          <div className="modal-content">
                            <div className="form-grid">
                              <div className="form-group">
                                <label>Nome *</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={formData.customer_name}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      customer_name: e.target.value,
                                    })
                                  }
                                  placeholder="Nome do cliente"
                                  required
                                />
                              </div>

                              <div className="form-group">
                                <label>Telefone *</label>
                                <input
                                  type="tel"
                                  className="form-control"
                                  value={formData.customer_phone}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      customer_phone: e.target.value,
                                    })
                                  }
                                  placeholder="Número de telefone"
                                  required
                                />
                              </div>

                              <div className="form-group">
                                <label>Email</label>
                                <input
                                  type="email"
                                  className="form-control"
                                  value={formData.customer_email}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      customer_email: e.target.value,
                                    })
                                  }
                                  placeholder="Email (opcional)"
                                />
                              </div>

                              <div className="form-group">
                                <label>Data *</label>
                                <input
                                  type="date"
                                  className="form-control"
                                  value={formData.reservation_date}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      reservation_date: e.target.value,
                                    })
                                  }
                                  required
                                />
                              </div>

                              <div className="form-group">
                                <label>Hora *</label>
                                <input
                                  type="time"
                                  className="form-control"
                                  value={formData.reservation_time}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      reservation_time: e.target.value,
                                    })
                                  }
                                  required
                                />
                              </div>

                              <div className="form-group">
                                <label>Número de Pessoas *</label>
                                <input
                                  type="number"
                                  className="form-control"
                                  min={1}
                                  value={formData.party_size}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      party_size: parseInt(e.target.value),
                                    })
                                  }
                                  required
                                />
                              </div>

                              <div className="form-group full-width">
                                <label>Mesas (Opcional)</label>
                                {/* ...existing code for table selection... */}
                              </div>

                              <div className="form-group full-width">
                                <label>Pedidos Especiais</label>
                                <textarea
                                  className="form-control"
                                  rows={3}
                                  value={formData.special_requests}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      special_requests: e.target.value,
                                    })
                                  }
                                  placeholder="Alergias, preferências de mesa, etc."
                                />
                              </div>
                            </div>
                          </div>

                          {/* Modal Footer */}
                          <div className="modal-footer">
                            <button className="btn btn--secondary" onClick={resetForm}>
                              Cancelar
                            </button>
                            <button
                              className="btn btn--primary"
                              onClick={handleSubmit}
                            >
                              Criar
                            </button>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}
                            }}
                          ></div>
                          <span
                            style={{
                              fontSize: "13px",
                              color: "#166534",
                              fontWeight: "600",
                            }}
                          >
                            {selectedTableIds.length} mesa
                            {selectedTableIds.length > 1 ? "s" : ""} selecionada
                            {selectedTableIds.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="form-group full-width">
                      <label>Pedidos Especiais</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={formData.special_requests}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            special_requests: e.target.value,
                          })
                        }
                        placeholder="Alergias, preferências de mesa, etc."
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer">
                  <button className="footer-button cancel" onClick={resetForm}>
                    Cancelar
                  </button>
                  <button
                    className="footer-button primary"
                    onClick={handleSubmit}
                  >
                    Criar
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* Confirm Modal */}
      {confirmModal &&
        createPortal(
          <div className="confirm-modal-overlay">
            <div className="confirm-modal">
              <h3>{confirmModal.title}</h3>
              <p>{confirmModal.message}</p>
              <div className="confirm-modal-actions">
                <button
                  className="confirm-modal-btn cancel"
                  onClick={confirmModal.onCancel}
                >
                  Cancelar
                </button>
                <button
                  className="confirm-modal-btn confirm"
                  onClick={confirmModal.onConfirm}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* QR Code Scan Modal */}
      {qrModal.open && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            margin: 0,
            overflowY: "auto",
            fontFamily:
              'Nunito, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            className="modal-container"
            style={{
              maxWidth: 400,
              minHeight: 320,
              background: "#fff",
              borderRadius: "1.5rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              padding: 32,
              position: "relative",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              border: "1px solid #d1d5db",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              className="modal-header"
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontWeight: 700,
                  fontSize: 22,
                  color: "#1e293b",
                  margin: 0,
                }}
              >
                Scan QR Code
              </h2>
              <button
                onClick={() => setQrModal({ open: false, reservationId: null })}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 28,
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                &times;
              </button>
            </div>
            <div
              className="modal-content"
              style={{ textAlign: "center", width: "100%" }}
            >
              {/* QR Scan logic using ZXing */}
              <QRScanZXingComponent onScan={handleQrScan} freeze={qrLoading} />
              {qrError && (
                <div style={{ color: "#ef4444", marginTop: 8 }}>{qrError}</div>
              )}
              <div style={{ marginTop: 12, color: "#64748b" }}>
                Aponte a câmara para o QR code enviado por email.
              </div>
            </div>
            <div
              className="modal-footer"
              style={{
                width: "100%",
                marginTop: 24,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="footer-button cancel"
                style={{
                  background: "#f3f4f6",
                  color: "#1e293b",
                  borderRadius: "1.5rem",
                  padding: "10px 24px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => setQrModal({ open: false, reservationId: null })}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReservationManager;
