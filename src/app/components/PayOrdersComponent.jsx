"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  Search,
  CreditCard,
  CheckCircle,
  Loader2,
  Receipt,
  Users,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  Banknote,
  Smartphone,
  AlertCircle,
  Check,
  X,
  UtensilsCrossed,
  Euro,
  Coins,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import { getAuthToken } from "../../lib/api";
import NumberFlow from "@number-flow/react";
import { Select } from "antd";
import "./PayOrdersComponent.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// API helper with auth
const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();

  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.status}`);
  }

  return response.json();
};

export default function PayOrdersComponent({ onLoaded }) {
  const { socket, connected } = useWebSocketContext();

  // State
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTable, setFilterTable] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [discount, setDiscount] = useState({ type: "fixed", value: 0 });
  const [paymentNote, setPaymentNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Get image URL helper
  const getImageUrl = useCallback((imageId) => {
    if (!imageId || imageId === "undefined" || imageId === "null") return null;
    const S3_BUCKET_URL = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL;
    if (S3_BUCKET_URL) {
      return `${S3_BUCKET_URL}/imagens-menu/${imageId}`;
    }
    return `${API_BASE_URL}/upload/files/imagens-menu/${imageId}`;
  }, []);

  // Fetch data
  const fetchOrders = useCallback(async () => {
    try {
      const response = await apiRequest("/orders");
      const ordersData = response.documents || [];
      // Only show orders with "delivered" status (ready to be paid)
      const deliveredOrders = ordersData.filter(
        (order) => order.status === "delivered" || order.status === "entregue"
      );
      setOrders(deliveredOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  }, []);

  const fetchMenuItems = useCallback(async () => {
    try {
      const response = await apiRequest("/menu");
      setMenuItems(response.documents || response.menu || []);
    } catch (error) {
      console.error("Error fetching menu:", error);
    }
  }, []);

  const fetchTables = useCallback(async () => {
    try {
      const response = await apiRequest("/tables");
      setTables(response.documents || []);
    } catch (error) {
      console.error("Error fetching tables:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchOrders(), fetchMenuItems(), fetchTables()]);
    setLoading(false);
    if (onLoaded) onLoaded();
  }, [fetchOrders, fetchMenuItems, fetchTables, onLoaded]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket handlers
  useEffect(() => {
    if (!socket || !connected) return;

    const handleOrderCreated = (order) => {
      // Only add if it's delivered
      if (order.status === "delivered" || order.status === "entregue") {
        setOrders((prev) => [order, ...prev]);
      }
    };

    const handleOrderUpdated = (order) => {
      if (order.status === "pago" || order.status === "paid") {
        // Remove paid orders
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        setSelectedOrders((prev) => prev.filter((id) => id !== order.id));
      } else if (order.status === "delivered" || order.status === "entregue") {
        // Add or update delivered orders
        setOrders((prev) => {
          const exists = prev.find((o) => o.id === order.id);
          if (exists) {
            return prev.map((o) => (o.id === order.id ? order : o));
          } else {
            return [order, ...prev];
          }
        });
      } else {
        // Remove if status changed away from delivered
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        setSelectedOrders((prev) => prev.filter((id) => id !== order.id));
      }
    };

    const handleOrderDeleted = ({ orderId }) => {
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setSelectedOrders((prev) => prev.filter((id) => id !== orderId));
    };

    const handleOrdersPaid = (data) => {
      const paidOrderIds = data.order_item_ids || [];
      setOrders((prev) => prev.filter((o) => !paidOrderIds.includes(o.id)));
      setSelectedOrders((prev) =>
        prev.filter((id) => !paidOrderIds.includes(id))
      );
    };

    socket.on("order:created", handleOrderCreated);
    socket.on("order:updated", handleOrderUpdated);
    socket.on("order:deleted", handleOrderDeleted);
    socket.on("order:paid", handleOrdersPaid);

    return () => {
      socket.off("order:created", handleOrderCreated);
      socket.off("order:updated", handleOrderUpdated);
      socket.off("order:deleted", handleOrderDeleted);
      socket.off("order:paid", handleOrdersPaid);
    };
  }, [socket, connected]);

  // Calculate change breakdown with euro notes and coins
  const calculateChangeBreakdown = useCallback((changeAmount) => {
    if (changeAmount <= 0) return { notas: [], moedas: [] };

    const denominations = [
      { value: 500, type: "nota", label: "500€" },
      { value: 200, type: "nota", label: "200€" },
      { value: 100, type: "nota", label: "100€" },
      { value: 50, type: "nota", label: "50€" },
      { value: 20, type: "nota", label: "20€" },
      { value: 10, type: "nota", label: "10€" },
      { value: 5, type: "nota", label: "5€" },
      { value: 2, type: "moeda", label: "2€" },
      { value: 1, type: "moeda", label: "1€" },
      { value: 0.5, type: "moeda", label: "0.50€" },
      { value: 0.2, type: "moeda", label: "0.20€" },
      { value: 0.1, type: "moeda", label: "0.10€" },
      { value: 0.05, type: "moeda", label: "0.05€" },
      { value: 0.02, type: "moeda", label: "0.02€" },
      { value: 0.01, type: "moeda", label: "0.01€" },
    ];

    let remaining = Math.round(changeAmount * 100) / 100;
    const notas = [];
    const moedas = [];

    for (const denom of denominations) {
      const count = Math.floor(remaining / denom.value);
      if (count > 0) {
        const item = {
          ...denom,
          count,
          total: count * denom.value,
        };
        if (denom.type === "nota") {
          notas.push(item);
        } else {
          moedas.push(item);
        }
        remaining = Math.round((remaining - count * denom.value) * 100) / 100;
      }
    }

    return { notas, moedas };
  }, []);

  // Calculate selected orders total
  const selectedOrdersTotal = useMemo(() => {
    const selectedOrdersData = orders.filter((order) =>
      selectedOrders.includes(order.id)
    );

    const subtotal = selectedOrdersData.reduce((sum, order) => {
      const price = parseFloat(order.total_price || order.price || 0);
      return sum + price;
    }, 0);

    let discountAmount = 0;
    if (discount.value > 0) {
      if (discount.type === "percentage") {
        discountAmount = (subtotal * discount.value) / 100;
      } else {
        discountAmount = discount.value;
      }
    }

    const total = Math.round((subtotal - discountAmount) * 100) / 100;

    return {
      orders: selectedOrdersData,
      subtotal: isNaN(subtotal) ? 0 : subtotal,
      discountAmount: isNaN(discountAmount) ? 0 : discountAmount,
      total: isNaN(total) ? 0 : total,
    };
  }, [orders, selectedOrders, discount]);

  // Group orders by table combination
  const groupedOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      const matchesSearch =
        searchTerm === "" ||
        order.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.menu_info?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

      // Handle table_id being an array or string
      const orderTableIds = Array.isArray(order.table_id)
        ? order.table_id
        : [order.table_id];
      const matchesTable =
        filterTable === "all" || orderTableIds.includes(filterTable);

      return matchesSearch && matchesTable;
    });

    console.log("=== DEBUG GROUPING ===");
    console.log("Total orders:", orders.length);
    console.log("Filtered orders:", filtered.length);
    console.log("Total tables:", tables.length);

    if (filtered.length > 0) {
      console.log("First order sample:", filtered[0]);
      console.log("First order table_id:", filtered[0].table_id);
    }

    if (tables.length > 0) {
      console.log("First table sample:", tables[0]);
    }

    const groups = {};
    filtered.forEach((order) => {
      // Handle table_id being an array (multi-table orders) or single ID
      const tableIds = Array.isArray(order.table_id)
        ? order.table_id
        : [order.table_id];

      // Sort table IDs to create consistent group key
      const sortedTableIds = [...tableIds].sort();

      // Get table info for all tables in this order
      const tablesInfo = sortedTableIds
        .map((tableId) =>
          tables.find((t) => t.id === tableId || t.$id === tableId)
        )
        .filter(Boolean); // Remove nulls

      if (tablesInfo.length === 0) {
        // No tables found - use "Sem Mesa"
        const tableKey = "Sem Mesa";
        if (!groups[tableKey]) {
          groups[tableKey] = {
            tableKey,
            label: "Sem Mesa",
            tableIds: [],
            orders: [],
          };
        }
        groups[tableKey].orders.push(order);
      } else {
        // Create unique key from sorted table IDs
        const tableKey = sortedTableIds.join(",");

        // Create label from all tables
        const tableLabels = tablesInfo
          .map((t) => `Mesa ${t.tableNumber || t.number}`)
          .join(", ");

        // Get layout name (assume all tables in multi-table order are in same layout)
        const layoutName = tablesInfo[0]?.layout_name || "Sem Sala";

        const label = `${tableLabels} - ${layoutName}`;

        console.log(`Order ${order.id} - creating group:`, {
          tableKey,
          label,
          tableIds: sortedTableIds,
        });

        if (!groups[tableKey]) {
          groups[tableKey] = {
            tableKey,
            label,
            tableIds: sortedTableIds,
            tableNumbers: tablesInfo.map((t) => t.tableNumber || t.number),
            layoutName,
            orders: [],
          };
        }
        groups[tableKey].orders.push(order);
      }
    });

    return Object.values(groups).map((group) => ({
      ...group,
      total: group.orders.reduce((sum, o) => {
        const price = parseFloat(o.total_price || o.price || 0);
        return sum + (isNaN(price) ? 0 : price);
      }, 0),
    }));
  }, [orders, searchTerm, filterTable, tables]);

  // Toggle functions
  const toggleGroupExpanded = useCallback((tableKey) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tableKey)) {
        newSet.delete(tableKey);
      } else {
        newSet.add(tableKey);
      }
      return newSet;
    });
  }, []);

  const toggleOrderSelection = useCallback((orderId) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  }, []);

  const toggleGroupSelection = useCallback(
    (orders) => {
      const allSelected = orders.every((order) =>
        selectedOrders.includes(order.id)
      );

      if (allSelected) {
        setSelectedOrders((prev) =>
          prev.filter((id) => !orders.map((o) => o.id).includes(id))
        );
      } else {
        setSelectedOrders((prev) => [
          ...new Set([...prev, ...orders.map((o) => o.id)]),
        ]);
      }
    },
    [selectedOrders]
  );

  // Payment handlers
  const openPaymentModal = useCallback(() => {
    if (selectedOrders.length === 0) return;
    setShowPaymentModal(true);
    setCashReceived(selectedOrdersTotal.total.toFixed(2));
  }, [selectedOrders, selectedOrdersTotal.total]);

  const closePaymentModal = useCallback(() => {
    setShowPaymentModal(false);
    setPaymentMethod("cash");
    setCashReceived("");
    setDiscount({ type: "fixed", value: 0 });
    setPaymentNote("");
    setPaymentError(null);
    setPaymentSuccess(false);
  }, []);

  const handlePayment = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    setPaymentError(null);

    try {
      // Get table_ids from selected orders
      const selectedOrdersData = orders.filter((order) =>
        selectedOrders.includes(order.id)
      );

      // Collect all unique table_ids
      const tableIdsSet = new Set();
      selectedOrdersData.forEach((order) => {
        const orderTableIds = Array.isArray(order.table_id)
          ? order.table_id
          : [order.table_id];
        orderTableIds.forEach((id) => tableIdsSet.add(id));
      });

      // Format payment methods as array (backend expects this)
      const paymentMethods = [
        {
          method: paymentMethod, // "cash", "card", or "mbway"
          amount: selectedOrdersTotal.total,
        },
      ];

      // Format discount object (backend expects type/value/reason)
      const discountObj =
        discount.value > 0
          ? {
              type: discount.type, // "percentage" or "fixed"
              value: parseFloat(discount.value),
              reason: null,
            }
          : null;

      const paymentData = {
        order_item_ids: selectedOrders, // Backend expects this name
        table_ids: Array.from(tableIdsSet),
        payment_methods: paymentMethods, // Array of payment methods
        cash_received:
          paymentMethod === "cash" ? parseFloat(cashReceived) || 0 : null,
        tip_amount: 0, // No tips for now
        discount: discountObj,
        customer_name: null,
        notes: paymentNote || null,
        price_adjustments: null, // No price adjustments for now
      };

      const response = await apiRequest("/payments", {
        method: "POST",
        body: JSON.stringify(paymentData),
      });

      setPaymentSuccess(true);

      // Reset selected orders
      setSelectedOrders([]);

      setTimeout(() => {
        closePaymentModal();
      }, 2000);
    } catch (error) {
      console.error("Payment error:", error);
      setPaymentError(error.message || "Erro ao processar pagamento");
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    orders,
    selectedOrders,
    paymentMethod,
    discount,
    cashReceived,
    paymentNote,
    closePaymentModal,
  ]);

  // Format time helper
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="pay-orders-container">
      {loading && (
        <div className="loading-state">
          <Loader2 size={48} className="spinner" />
          <p>A carregar pedidos...</p>
        </div>
      )}
      {/* Header Card */}
      <div className="stock-header-card">
        <div className="stock-header-card__content">
          <div className="stock-header-card__left">
            <h1 className="stock-header-card__title">Pagamentos</h1>
            <p className="stock-header-card__description">
              Processa pagamentos de pedidos entregues e gere o sistema de
              caixa.
            </p>
            <div className="stock-header-card__actions">
              <button
                onClick={loadData}
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
                className="stock-header-card__btn stock-header-card__btn--primary"
                disabled={selectedOrders.length === 0}
                onClick={openPaymentModal}
              >
                <CreditCard size={16} />
                Processar Pagamento ({selectedOrders.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-section">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Pedidos por Pagar</span>
            <ShoppingBag className="stat-icon" />
          </div>
          <div className="stat-value info">
            <NumberFlow value={orders.length} />
          </div>
          <div className="stat-description">Pedidos entregues</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Selecionados</span>
            <CheckCircle className="stat-icon" />
          </div>
          <div className="stat-value warning">
            <NumberFlow value={selectedOrders.length} />
          </div>
          <div className="stat-description">Itens marcados</div>
        </div>

        <div className="stat-card critical-card">
          <div className="stat-header">
            <span className="stat-title">Total a Pagar</span>
            <Euro className="stat-icon" />
          </div>
          <div className="stat-value critical">
            €
            <NumberFlow
              value={selectedOrdersTotal.total}
              format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
            />
          </div>
          <div className="stat-description">Valor selecionado</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Procurar item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select
          className="filter-select custom-select"
          value={filterTable}
          onChange={(value) => setFilterTable(value)}
          style={{ width: 250 }}
          options={[
            { value: "all", label: "Todas as Mesas" },
            ...tables.map((table) => ({
              value: table.id,
              label: `Mesa ${table.tableNumber || table.number} - ${
                table.layout_name
              }`,
            })),
          ]}
        />
      </div>

      {/* Orders Content */}
      <div className="orders-content">
        {groupedOrders.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag size={64} />
            <h3>Nenhum pedido encontrado</h3>
            <p>Não há pedidos por pagar no momento.</p>
          </div>
        ) : (
          <div className="orders-groups">
            {groupedOrders.map((group) => {
              const isExpanded = expandedGroups.has(group.tableKey);
              const allSelected = group.orders.every((order) =>
                selectedOrders.includes(order.id)
              );

              return (
                <div key={group.tableKey} className="order-group">
                  <div
                    className="group-header"
                    onClick={() => toggleGroupExpanded(group.tableKey)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="group-header-left">
                      <input
                        type="checkbox"
                        className="group-checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleGroupSelection(group.orders);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="group-info">
                        <div className="group-title">
                          <UtensilsCrossed size={18} />
                          <span>{group.label}</span>
                        </div>
                        <div className="group-meta">
                          <span>{group.orders.length} itens</span>
                          <span className="group-total">
                            €{group.total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupExpanded(group.tableKey);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="group-orders">
                      {group.orders.map((order) => {
                        const menuItem = menuItems.find(
                          (item) => item.id === order.menu_item_id
                        );
                        const imageUrl = menuItem?.image_id
                          ? getImageUrl(menuItem.image_id)
                          : null;

                        return (
                          <div
                            key={order.id}
                            className={`order-item ${
                              selectedOrders.includes(order.id)
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => toggleOrderSelection(order.id)}
                          >
                            <input
                              type="checkbox"
                              className="order-checkbox"
                              checked={selectedOrders.includes(order.id)}
                              onChange={() => toggleOrderSelection(order.id)}
                              onClick={(e) => e.stopPropagation()}
                            />

                            <div className="order-image">
                              {imageUrl ? (
                                <img src={imageUrl} alt={order.item_name} />
                              ) : (
                                <div className="no-image">
                                  <UtensilsCrossed size={24} />
                                </div>
                              )}
                            </div>

                            <div className="order-details">
                              <h4>
                                {order.item_name || order.menu_info?.nome}{" "}
                                {order.quantity > 1 && `x${order.quantity}`}
                              </h4>
                              {order.notes && (
                                <p className="order-notes">{order.notes}</p>
                              )}
                              <div className="order-meta">
                                <span className="order-time">
                                  <Clock size={14} />
                                  {formatTime(order.created_at)}
                                </span>
                              </div>
                            </div>

                            <div className="order-price">
                              €
                              {parseFloat(
                                order.total_price || order.price || 0
                              ).toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal &&
        ReactDOM.createPortal(
          <div className="modal-backdrop" onClick={closePaymentModal}>
            <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
              {paymentSuccess ? (
                <div className="payment-success">
                  <CheckCircle size={64} className="success-icon" />
                  <h2>Pagamento Concluído!</h2>
                  <p>O pagamento foi processado com sucesso.</p>
                </div>
              ) : (
                <>
                  <div className="modal-header">
                    <h2>Processar Pagamento</h2>
                    <button className="close-btn" onClick={closePaymentModal}>
                      <X size={24} />
                    </button>
                  </div>

                  <div className="modal-content">
                    {/* Selected Orders */}
                    <div className="payment-section">
                      <h3>
                        <Receipt size={16} /> Itens Selecionados
                      </h3>
                      <div className="selected-orders-list">
                        {selectedOrdersTotal.orders.map((order) => {
                          const menuItem = menuItems.find(
                            (item) => item.id === order.menu_item_id
                          );
                          const imageUrl = menuItem?.image_id
                            ? getImageUrl(menuItem.image_id)
                            : null;
                          const itemName =
                            order.item_name ||
                            order.menu_info?.nome ||
                            menuItem?.nome ||
                            "Item";

                          return (
                            <div key={order.id} className="selected-order-item">
                              {imageUrl && (
                                <img
                                  src={imageUrl}
                                  alt={itemName}
                                  className="order-item-image"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              )}
                              <div className="order-item-info">
                                <span className="item-name">
                                  {itemName}{" "}
                                  {order.quantity > 1 && `x${order.quantity}`}
                                </span>
                                {order.notes && (
                                  <span className="item-notes">
                                    {order.notes}
                                  </span>
                                )}
                              </div>
                              <span className="item-price">
                                €
                                {parseFloat(
                                  order.total_price || order.price || 0
                                ).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="payment-section">
                      <h3>
                        <CreditCard size={16} /> Método de Pagamento
                      </h3>
                      <div className="payment-methods">
                        <button
                          type="button"
                          className={`payment-method-btn ${
                            paymentMethod === "cash" ? "active" : ""
                          }`}
                          onClick={() => setPaymentMethod("cash")}
                        >
                          <Banknote size={24} />
                          Numerário
                        </button>
                        <button
                          type="button"
                          className={`payment-method-btn ${
                            paymentMethod === "card" ? "active" : ""
                          }`}
                          onClick={() => setPaymentMethod("card")}
                        >
                          <CreditCard size={24} />
                          Cartão
                        </button>
                        <button
                          type="button"
                          className={`payment-method-btn ${
                            paymentMethod === "mbway" ? "active" : ""
                          }`}
                          onClick={() => setPaymentMethod("mbway")}
                        >
                          <Smartphone size={24} />
                          MB Way
                        </button>
                      </div>
                    </div>

                    {/* Discount */}
                    <div className="payment-section">
                      <h3>Desconto</h3>
                      <div className="discount-controls">
                        <Select
                          className="discount-type custom-select"
                          value={discount.type}
                          onChange={(value) =>
                            setDiscount({ ...discount, type: value })
                          }
                          style={{ width: 150 }}
                          options={[
                            { value: "percentage", label: "Percentagem" },
                            { value: "fixed", label: "Valor Fixo" },
                          ]}
                        />

                        <div className="input-group">
                          <span>
                            {discount.type === "percentage" ? "%" : "€"}
                          </span>
                          <input
                            type="number"
                            placeholder="0"
                            step={discount.type === "percentage" ? "1" : "0.01"}
                            min="0"
                            max={
                              discount.type === "percentage" ? "100" : undefined
                            }
                            value={discount.value || ""}
                            onChange={(e) =>
                              setDiscount({
                                ...discount,
                                value: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Change Calculator (Cash only) */}
                    {paymentMethod === "cash" && (
                      <div className="payment-section">
                        <h3>
                          <Euro size={16} /> Valor Recebido
                        </h3>

                        <div className="input-group">
                          <Euro size={18} />
                          <input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                          />
                        </div>

                        {parseFloat(cashReceived) >
                          selectedOrdersTotal.total && (
                          <div className="change-breakdown">
                            <div className="change-header">
                              <Coins size={20} />
                              <span>
                                Troco:{" "}
                                <strong>
                                  €
                                  {(
                                    parseFloat(cashReceived) -
                                    selectedOrdersTotal.total
                                  ).toFixed(2)}
                                </strong>
                              </span>
                            </div>

                            {(() => {
                              const changeAmount =
                                parseFloat(cashReceived) -
                                selectedOrdersTotal.total;
                              const breakdown =
                                calculateChangeBreakdown(changeAmount);

                              return (
                                (breakdown.notas.length > 0 ||
                                  breakdown.moedas.length > 0) && (
                                  <div className="change-details">
                                    {breakdown.notas.length > 0 && (
                                      <div className="change-section">
                                        <h4>
                                          <Banknote size={14} /> Notas
                                        </h4>
                                        <div className="denominations">
                                          {breakdown.notas.map((item, idx) => (
                                            <div
                                              key={idx}
                                              className="denomination-item nota"
                                            >
                                              <img
                                                src={`/euro-currency/${item.value}.png`}
                                                alt={item.label}
                                                className="currency-image"
                                              />
                                              <span className="denomination-count">
                                                ×{item.count}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {breakdown.moedas.length > 0 && (
                                      <div className="change-section">
                                        <h4>
                                          <Coins size={14} /> Moedas
                                        </h4>
                                        <div className="denominations">
                                          {breakdown.moedas.map((item, idx) => (
                                            <div
                                              key={idx}
                                              className="denomination-item moeda"
                                            >
                                              <img
                                                src={`/euro-currency/${item.value}.png`}
                                                alt={item.label}
                                                className="currency-image"
                                              />
                                              <span className="denomination-count">
                                                ×{item.count}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    <div className="payment-section">
                      <h3>Notas</h3>
                      <textarea
                        placeholder="Adicionar notas ao pagamento..."
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                      />
                    </div>

                    {/* Payment Summary */}
                    <div className="payment-summary">
                      <div className="summary-row">
                        <span>Subtotal:</span>
                        <span>€{selectedOrdersTotal.subtotal.toFixed(2)}</span>
                      </div>

                      {selectedOrdersTotal.discountAmount > 0 && (
                        <div className="summary-row discount">
                          <span>Desconto:</span>
                          <span>
                            -€{selectedOrdersTotal.discountAmount.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="summary-row total">
                        <span>Total a Pagar:</span>
                        <span>€{selectedOrdersTotal.total.toFixed(2)}</span>
                      </div>
                    </div>

                    {paymentError && (
                      <div className="payment-error">
                        <AlertCircle size={20} />
                        <span>{paymentError}</span>
                      </div>
                    )}
                  </div>

                  <div className="modal-footer">
                    <button
                      className="btn-secondary"
                      onClick={closePaymentModal}
                    >
                      Cancelar
                    </button>

                    <button
                      className="btn-primary"
                      onClick={handlePayment}
                      disabled={isProcessing || selectedOrders.length === 0}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 size={18} className="spinner" />A
                          processar...
                        </>
                      ) : (
                        <>
                          <Check size={18} />
                          Confirmar Pagamento
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
