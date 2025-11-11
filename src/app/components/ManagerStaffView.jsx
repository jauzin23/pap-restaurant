"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  UserCircle,
  Users,
  MessageCircle,
  Search,
  RefreshCw,
  Plus,
  Eye,
  Calendar,
  UserCheck,
  X,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { Table, Tag, Button, Input, Avatar, message } from "antd";
import NumberFlow from "@number-flow/react";
import { auth, users, getAuthToken, getImageUrl } from "../../lib/api";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import "./ManagerStaffView.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const ManagerStaffView = () => {
  // WebSocket context
  const { socket, connected } = useWebSocketContext();

  // State declarations
  const [searchQuery, setSearchQuery] = useState("");
  const [staffData, setStaffData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isManager, setIsManager] = useState(false);

  // Create user modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    name: "",
    telefone: "",
    nif: "",
    contrato: "",
    hrs: "",
    ferias: false,
    labels: [],
  });

  // Calculate stats
  const totalStaff = staffData.length;
  const onlineStaff = staffData.filter((s) => s.status === "online").length;
  const onVacation = staffData.filter((s) => s.ferias).length;
  const totalHours = staffData.reduce(
    (sum, s) => sum + (s.hoursWorked || 0),
    0
  );

  // Function to filter staff data
  const filteredStaffData = staffData.filter((staff) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      staff.name.toLowerCase().includes(query) ||
      staff.email.toLowerCase().includes(query) ||
      (staff.telefone && staff.telefone.toLowerCase().includes(query)) ||
      (staff.role && staff.role.toLowerCase().includes(query)) ||
      (staff.username && staff.username.toLowerCase().includes(query))
    );
  });

  // Load staff data
  const loadStaffData = async () => {
    try {
      setRefreshing(true);
      const response = await users.list();
      const allUsers = response.users || response || [];

      if (!Array.isArray(allUsers)) {
        console.error("Users data is not an array:", allUsers);
        setStaffData([]);
        return;
      }

      // Transform user data
      const transformedStaff = allUsers.map((u) => {
        const role =
          u.labels && u.labels.length > 0 ? u.labels[0] : "Funcionário";

        const joinDate = u.created_at ? new Date(u.created_at) : new Date();
        const monthsSinceJoin = Math.floor(
          (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        const experience =
          monthsSinceJoin > 12
            ? `${Math.floor(monthsSinceJoin / 12)} ${
                Math.floor(monthsSinceJoin / 12) === 1 ? "ano" : "anos"
              }`
            : `${monthsSinceJoin} ${monthsSinceJoin === 1 ? "mês" : "meses"}`;

        return {
          key: u.id || u.$id,
          id: u.id || u.$id,
          name: u.name || u.username || u.email,
          username: u.username,
          role: role,
          email: u.email,
          telefone: u.telefone || "",
          hoursWorked: u.hrs || 0,
          status: u.status || "offline",
          profileImg: u.profile_image
            ? getImageUrl("imagens-perfil", u.profile_image)
            : "",
          joinDate: u.created_at || new Date().toISOString(),
          specialties: u.labels || [],
          experience: experience,
          ferias: u.ferias || false,
          contrato: u.contrato || "N/A",
        };
      });

      setStaffData(transformedStaff);
    } catch (err) {
      console.error("Error fetching staff users:", err);
      setStaffData([]);
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await auth.get();
        setCurrentUser(user);
        const userIsManager =
          user.labels?.includes("manager") ||
          user.labels?.includes("Manager") ||
          user.labels?.includes("gerente") ||
          user.labels?.includes("Gerente");
        setIsManager(userIsManager);
      } catch (error) {
        console.error("Error loading current user:", error);
      }
    };

    loadCurrentUser();
    loadStaffData();
  }, []);

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket || !connected) return;

    const handleUserCreated = (user) => {
      console.log("🆕 New user created:", user.name);
      loadStaffData();
    };

    const handleUserUpdated = (user) => {
      console.log("📝 User updated:", user.name);
      loadStaffData();
    };

    socket.on("user:created", handleUserCreated);
    socket.on("user:updated", handleUserUpdated);

    return () => {
      socket.off("user:created", handleUserCreated);
      socket.off("user:updated", handleUserUpdated);
    };
  }, [socket, connected]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      email: "",
      username: "",
      password: "",
      name: "",
      telefone: "",
      nif: "",
      contrato: "",
      hrs: "",
      ferias: false,
      labels: [],
    });
  };

  // Open create modal
  const openCreateModal = () => {
    resetForm();
    setCreateModalOpen(true);
  };

  // Close create modal
  const closeCreateModal = () => {
    setCreateModalOpen(false);
    resetForm();
  };

  // Create new user
  const handleCreateUser = async () => {
    // Validation
    if (
      !formData.email ||
      !formData.username ||
      !formData.password ||
      !formData.name
    ) {
      message.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    if (formData.password.length < 6) {
      message.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setCreatingUser(true);

    try {
      const token = getAuthToken();

      // Prepare data
      const userData = {
        email: formData.email,
        username: formData.username,
        password: formData.password,
        name: formData.name,
      };

      // Add optional fields if they exist
      if (formData.telefone) userData.telefone = formData.telefone;
      if (formData.nif) userData.nif = formData.nif;
      if (formData.contrato) userData.contrato = formData.contrato;
      if (formData.hrs) userData.hrs = parseInt(formData.hrs);
      if (formData.labels.length > 0) userData.labels = formData.labels;
      userData.ferias = formData.ferias;

      const response = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar utilizador");
      }

      const newUser = await response.json();

      message.success(`Utilizador ${formData.name} criado com sucesso!`);
      closeCreateModal();
      loadStaffData(); // Refresh the list
    } catch (error) {
      console.error("Error creating user:", error);
      message.error(error.message || "Erro ao criar utilizador");
    } finally {
      setCreatingUser(false);
    }
  };

  // Table columns configuration
  const columns = [
    {
      title: "Funcionário",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            minWidth: "200px",
          }}
        >
          <Avatar
            size={48}
            src={record.profileImg}
            icon={<UserCircle />}
            style={{
              backgroundColor: "#f0f0f0",
              border: "2px solid #e5e7eb",
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                color: "#1a1a1a",
                fontSize: "14px",
                whiteSpace: "nowrap",
              }}
            >
              {text}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#64748b",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {record.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Função",
      dataIndex: "role",
      key: "role",
      render: (role) => (
        <Tag
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "capitalize",
            whiteSpace: "nowrap",
          }}
        >
          {role}
        </Tag>
      ),
    },
    {
      title: "Estado",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const isOnline = status === "online";
        return (
          <Tag
            color={isOnline ? "success" : "default"}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isOnline ? "#10b981" : "#6b7280",
              }}
            />
            {isOnline ? "Online" : "Offline"}
          </Tag>
        );
      },
    },
    {
      title: "Horas",
      dataIndex: "hoursWorked",
      key: "hoursWorked",
      sorter: (a, b) => a.hoursWorked - b.hoursWorked,
      render: (hours) => (
        <span
          style={{ fontWeight: 700, color: "#059669", whiteSpace: "nowrap" }}
        >
          <NumberFlow value={hours} />h
        </span>
      ),
    },
    {
      title: "Contrato",
      dataIndex: "contrato",
      key: "contrato",
      render: (text) => (
        <span
          style={{ fontSize: "13px", color: "#64748b", whiteSpace: "nowrap" }}
        >
          {text}
        </span>
      ),
    },
    {
      title: "Férias",
      dataIndex: "ferias",
      key: "ferias",
      render: (ferias) => (
        <Tag
          color={ferias ? "warning" : "success"}
          style={{
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {ferias ? "Sim" : "Não"}
        </Tag>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "6px", whiteSpace: "nowrap" }}>
          <Button
            type="primary"
            size="small"
            icon={<Eye size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `/profile/${record.id}`;
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "#0284c7",
            }}
          >
            Ver
          </Button>
          <Button
            size="small"
            icon={<MessageCircle size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              console.log(`Message to ${record.name}`);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              color: "#059669",
              borderColor: "#bbf7d0",
            }}
          />
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="manager-staff-view">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <div className="loading-text">A carregar equipa...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-staff-view">
      <div className="staff-container">
        {/* Header Card */}
        <div className="stock-header-card">
          <div className="stock-header-card__content">
            <div className="stock-header-card__left">
              <h1 className="stock-header-card__title">Gestão de Equipa</h1>
              <p className="stock-header-card__description">
                Gere a tua equipa, assiduidade e performance em tempo real.
              </p>
              <div className="stock-header-card__actions">
                <button
                  onClick={loadStaffData}
                  disabled={refreshing}
                  className="stock-header-card__btn stock-header-card__btn--secondary"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Atualizar
                </button>
                {isManager && (
                  <button
                    onClick={openCreateModal}
                    className="stock-header-card__btn stock-header-card__btn--primary"
                  >
                    <UserPlus size={16} />
                    Adicionar Funcionário
                  </button>
                )}
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

        {/* Main Grid Layout */}
        <div className="staff-grid">
          {/* Stats Cards */}
          <div className="stats-section">
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Total Funcionários</span>
                <Users className="stat-icon" />
              </div>
              <div className="stat-value info">
                <NumberFlow value={totalStaff} />
              </div>
              <div className="stat-description">Membros da equipa</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Online</span>
                <UserCheck className="stat-icon" />
              </div>
              <div className="stat-value success">
                <NumberFlow value={onlineStaff} />
              </div>
              <div className="stat-description">Funcionários ativos</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">De Férias</span>
                <Calendar className="stat-icon" />
              </div>
              <div className="stat-value warning">
                <NumberFlow value={onVacation} />
              </div>
              <div className="stat-description">Em descanso</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Horas Totais</span>
                <Clock className="stat-icon" />
              </div>
              <div className="stat-value info">
                <NumberFlow value={totalHours} />h
              </div>
              <div className="stat-description">Horas trabalhadas</div>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="main-content-card">
            {/* Search Bar */}
            <div className="content-controls">
              <Input
                placeholder="Pesquisar funcionário..."
                prefix={<Search size={18} style={{ color: "#9ca3af" }} />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  maxWidth: "500px",
                  borderRadius: "12px",
                }}
                size="large"
              />
            </div>

            {/* Staff Table */}
            <Table
              columns={columns}
              dataSource={filteredStaffData}
              loading={refreshing}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} de ${total} funcionários`,
              }}
              scroll={{ x: "max-content" }}
              tableLayout="auto"
              onRow={(record) => ({
                onClick: () => {
                  window.location.href = `/profile/${record.id}`;
                },
                style: { cursor: "pointer" },
              })}
              locale={{
                emptyText: (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <Users size={32} />
                    </div>
                    <div className="empty-title">
                      Nenhum funcionário encontrado
                    </div>
                    <div className="empty-description">
                      {searchQuery
                        ? "Tente ajustar os termos de pesquisa"
                        : "Adicione funcionários para começar"}
                    </div>
                  </div>
                ),
              }}
            />
          </div>
        </div>

        {/* Create User Modal */}
        {createModalOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div className="modal-overlay" onClick={closeCreateModal}>
              <div
                className="modal-container"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="modal-header">
                  <div className="header-text">
                    <h2>
                      <UserCircle
                        size={20}
                        style={{ display: "inline", marginRight: "8px" }}
                      />
                      Adicionar Novo Funcionário
                    </h2>
                    <p>Preencha os dados do novo funcionário</p>
                  </div>
                  <button
                    onClick={closeCreateModal}
                    className="close-button"
                    disabled={creatingUser}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="modal-content">
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Nome Completo *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Ex: João Silva"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="email@exemplo.com"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>Username *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="username"
                        value={formData.username}
                        onChange={(e) =>
                          handleInputChange("username", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Senha *</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Mínimo 6 caracteres"
                        value={formData.password}
                        onChange={(e) =>
                          handleInputChange("password", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>Telefone</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="+351 XXX XXX XXX"
                        value={formData.telefone}
                        onChange={(e) =>
                          handleInputChange("telefone", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>NIF</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="123456789"
                        value={formData.nif}
                        onChange={(e) =>
                          handleInputChange("nif", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group">
                      <label>Tipo de Contrato</label>
                      <select
                        className="form-select"
                        value={formData.contrato}
                        onChange={(e) =>
                          handleInputChange("contrato", e.target.value)
                        }
                        disabled={creatingUser}
                      >
                        <option value="">Selecione o tipo</option>
                        <option value="Efetivo">Efetivo</option>
                        <option value="Estagiário">Estagiário</option>
                        <option value="Temporário">Temporário</option>
                        <option value="Freelancer">Freelancer</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Horas Semanais</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="40"
                        value={formData.hrs}
                        onChange={(e) =>
                          handleInputChange("hrs", e.target.value)
                        }
                        disabled={creatingUser}
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Funções / Labels</label>
                      <div className="labels-checkboxes">
                        {[
                          { value: "manager", label: "Manager" },
                          {
                            value: "Empregado de Mesa",
                            label: "Empregado de Mesa",
                          },
                          { value: "chef", label: "chef" },
                          { value: "Limpeza", label: "Limpeza" },
                          { value: "Rececionista", label: "Rececionista" },
                        ].map((role) => (
                          <div key={role.value} className="label-checkbox-item">
                            <input
                              type="checkbox"
                              id={`role-${role.value}`}
                              checked={formData.labels.includes(role.value)}
                              onChange={(e) => {
                                const newLabels = e.target.checked
                                  ? [...formData.labels, role.value]
                                  : formData.labels.filter(
                                      (l) => l !== role.value
                                    );
                                handleInputChange("labels", newLabels);
                              }}
                              disabled={creatingUser}
                            />
                            <label htmlFor={`role-${role.value}`}>
                              {role.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="form-group full-width">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.ferias}
                          onChange={(e) =>
                            handleInputChange("ferias", e.target.checked)
                          }
                          disabled={creatingUser}
                        />
                        <span>De férias</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer">
                  <button
                    onClick={closeCreateModal}
                    className="footer-button cancel"
                    disabled={creatingUser}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateUser}
                    className="footer-button primary"
                    disabled={creatingUser}
                  >
                    {creatingUser ? "A criar..." : "Criar"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};

export default ManagerStaffView;
