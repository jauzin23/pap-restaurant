"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  ArrowLeft,
  UtensilsCrossed,
  Loader2,
  CheckCircle,
  Search,
} from "lucide-react";
import { BackgroundBeams } from "../../components/BackgroundBeams";
import { auth, takeawayApi } from "../../../lib/api";
import { isAuthenticated } from "../../../lib/auth";
import {
  WebSocketProvider,
  useWebSocketContext,
} from "../../../contexts/WebSocketContext";
import NumberFlow from "@number-flow/react";
import "./page.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface MenuItem {
  $id: string;
  id: string;
  nome: string;
  preco: number;
  category: string;
  description?: string;
  image_id?: string;
}

interface Table {
  $id: string;
  id: string;
  tableNumber: number;
}

interface OrderItem extends MenuItem {
  notes?: string;
  quantity: number;
  orderItemId: string; // Unique ID for each order item instance
}

function PedidoPageContent({
  params,
}: {
  params: Promise<{ mesas?: string[] }>;
}) {
  const router = useRouter();
  const { socket, connected } = useWebSocketContext();

  const resolvedParams = React.use(params);
  const mesas = resolvedParams.mesas || [];

  // Check if this is a takeaway order
  const isTakeaway = mesas.length === 1 && mesas[0] === "takeaway";

  const [loading, setLoading] = useState(true);
  const [validTables, setValidTables] = useState<number[]>([]);
  const [validTableIds, setValidTableIds] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [displayedItemsCount, setDisplayedItemsCount] = useState(20);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [noteModalItem, setNoteModalItem] = useState<OrderItem | null>(null);
  const [tempNote, setTempNote] = useState("");
  const menuGridRef = React.useRef<HTMLDivElement>(null);
  const scrollSentinelRef = React.useRef<HTMLDivElement>(null);
  const [isOrderSectionVisible, setIsOrderSectionVisible] = useState(false);
  const [isOrderSectionExiting, setIsOrderSectionExiting] = useState(false);

  // Takeaway customer info states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const getAuthToken = () => {
    return localStorage.getItem("auth_token");
  };

  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
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
      if (response.status === 401) {
        router.push("/login");
        throw new Error("Session expired");
      }
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  };

  const getImageUrl = (imageId: string | undefined) => {
    if (!imageId || imageId === "undefined" || imageId === "null") return null;

    // Get S3 bucket URL from environment (fallback to API redirect if not set)
    const S3_BUCKET_URL = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL;

    if (S3_BUCKET_URL) {
      return `${S3_BUCKET_URL}/imagens-menu/${imageId}`;
    } else {
      return `${API_BASE_URL}/upload/files/imagens-menu/${imageId}`;
    }
  };

  const fetchMenuItems = async () => {
    try {
      setMenuLoading(true);
      const response = await apiRequest("/menu");

      const items = response.documents || response.menu || [];
      setMenuItems(items);

      const itemCategories = items.map(
        (item: MenuItem) => item.category || "outros"
      );
      const uniqueCategories = [...new Set(itemCategories)] as string[];
      setCategories(["Todos", ...uniqueCategories]);
    } catch (error) {
      console.error("Error fetching menu:", error);
    } finally {
      setMenuLoading(false);
    }
  };

  const validateTablesAndFetchMenu = async () => {
    try {
      setIsLoading(true);

      const cleanMesas = mesas.filter(
        (mesa) => mesa != null && mesa !== undefined && mesa !== ""
      );

      if (cleanMesas.length === 0) {
        router.push("/ ");
        return;
      }

      // Handle takeaway mode
      if (isTakeaway) {
        setValidTables([]);
        setValidTableIds([]);
        await fetchMenuItems();
        return;
      }

      // Decode each table ID from the URL segments
      const tableIds = cleanMesas
        .map((item) => {
          try {
            return decodeURIComponent(String(item));
          } catch (e) {
            return String(item);
          }
        })
        .filter((id) => id !== "");

      if (tableIds.length === 0) {
        router.push("/ ");
        return;
      }

      const tablesResponse = await apiRequest("/tables");
      const existingTables = tablesResponse.documents || [];

      if (!existingTables || existingTables.length === 0) {
        alert("Error: No tables found");
        router.push("/ ");
        return;
      }

      const validTableIdsArray = tableIds.filter((id) =>
        existingTables.some((table: Table) => (table.$id || table.id) === id)
      );

      if (validTableIdsArray.length === 0) {
        router.push("/ ");
        return;
      }

      const validTableNumbers = existingTables
        .filter((table: Table) =>
          validTableIdsArray.includes(table.$id || table.id)
        )
        .map((table: Table) => table.tableNumber);

      setValidTables(validTableNumbers);
      setValidTableIds(validTableIdsArray);

      await fetchMenuItems();
    } catch (error) {
      console.error("Error validating tables:", error);
      router.push("/ ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadUserAndData = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      try {
        await auth.get();
        await validateTablesAndFetchMenu();
      } catch (error) {
        console.error("Error loading:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadUserAndData();
  }, [mesas]);

  // Filter menu items by search and category
  const filteredMenuItems = useMemo(() => {
    let filtered = menuItems;

    // Filter by category
    if (selectedCategory !== "Todos") {
      filtered = filtered.filter(
        (item) => (item.category || "outros") === selectedCategory
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.nome.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [menuItems, selectedCategory, searchQuery]);

  // Reset displayed items count when filters change
  useEffect(() => {
    setDisplayedItemsCount(20);
  }, [selectedCategory, searchQuery]);

  // Infinite scroll: Load more items when scrolling to bottom
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          displayedItemsCount < filteredMenuItems.length
        ) {
          setDisplayedItemsCount((prev) =>
            Math.min(prev + 20, filteredMenuItems.length)
          );
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayedItemsCount, filteredMenuItems.length]);

  const displayedMenuItems = useMemo(() => {
    return filteredMenuItems.slice(0, displayedItemsCount);
  }, [filteredMenuItems, displayedItemsCount]);

  // Handle order section visibility with animation
  useEffect(() => {
    if (orderItems.length > 0) {
      // Show immediately when items are added
      setIsOrderSectionVisible(true);
      setIsOrderSectionExiting(false);
    } else if (isOrderSectionVisible && orderItems.length === 0) {
      // Trigger slide-out animation when items are removed
      setIsOrderSectionExiting(true);
      // Hide after animation completes (400ms as per SCSS)
      const timer = setTimeout(() => {
        setIsOrderSectionVisible(false);
        setIsOrderSectionExiting(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [orderItems.length, isOrderSectionVisible]);

  const addToOrder = useCallback((item: MenuItem) => {
    setOrderItems((prev) => {
      // Always add as a new individual item with unique orderItemId
      const newItem: OrderItem = {
        ...item,
        notes: "",
        quantity: 1,
        orderItemId: `${item.$id || item.id}-${Date.now()}-${Math.random()}`,
      };
      return [...prev, newItem];
    });
  }, []);

  const removeFromOrder = useCallback((orderItemId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.orderItemId !== orderItemId));
  }, []);

  const openNoteModal = (item: OrderItem) => {
    setNoteModalItem(item);
    setTempNote(item.notes || "");
  };

  const saveNote = () => {
    if (noteModalItem) {
      setOrderItems((prev) =>
        prev.map((item) =>
          item.orderItemId === noteModalItem.orderItemId
            ? { ...item, notes: tempNote }
            : item
        )
      );
    }
    setNoteModalItem(null);
    setTempNote("");
  };

  const total = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + (item.preco || 0), 0);
  }, [orderItems]);

  const confirmOrder = async () => {
    if (orderItems.length === 0) return;

    // Validate takeaway customer info
    if (isTakeaway) {
      if (!customerName.trim() || !customerPhone.trim()) {
        alert("Por favor, preencha o nome e telefone do cliente");
        return;
      }
    }

    try {
      setIsOrderSubmitting(true);

      if (isTakeaway) {
        // Use the new takeaway API
        const takeawayOrder = {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim() || null,
          special_requests: specialRequests.trim() || null,
          items: orderItems.map((item) => ({
            menu_item_id: item.$id || item.id,
            quantity: 1,
            price: item.preco || 0,
            notas: item.notes || null,
          })),
        };

        await takeawayApi.create(takeawayOrder);
      } else {
        // Use regular orders API for dine-in
        const orders = orderItems.map((item) => ({
          table_id: validTableIds,
          menu_item_id: item.$id || item.id,
          notas: item.notes || "",
          price: item.preco || 0,
        }));

        await apiRequest("/orders/batch", {
          method: "POST",
          body: JSON.stringify({ orders }),
        });
      }

      setOrderSuccess(true);
      setTimeout(() => {
        router.push("/pagina-teste-new");
      }, 2000);
    } catch (error) {
      console.error("Error creating order:", error);
      setIsOrderSubmitting(false);
    }
  };

  const cancelOrder = () => {
    router.push("/pagina-teste-new ");
  };

  if (loading || isLoading) {
    return (
      <div className="order-page-container">
        <BackgroundBeams />
        <div className="order-loading">
          <Loader2 size={48} className="loading-spinner" />
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="order-page-container">
      <BackgroundBeams />

      {(isOrderSubmitting || orderSuccess) && (
        <div className="order-overlay">
          <div className="order-overlay-content">
            {orderSuccess ? (
              <>
                <CheckCircle size={64} className="success-icon" />
                <h3>Pedido criado!</h3>
              </>
            ) : (
              <>
                <Loader2 size={64} className="loading-spinner" />
                <h3>A processar...</h3>
              </>
            )}
          </div>
        </div>
      )}

      <div className="order-page">
        <div className="order-header">
          <button onClick={cancelOrder} className="back-btn">
            <ArrowLeft size={20} />
          </button>
          <h1>
            {isTakeaway
              ? "Pedido para Levar"
              : `Mesa${validTables.length > 1 ? "s" : ""} ${validTables.join(
                  ", "
                )}`}
          </h1>
        </div>

        <div className="order-content">
          {/* Left: Menu */}
          <div className="menu-section">
            {/* Search and Filter Bar */}
            <div className="filter-bar">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Procurar item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="clear-search"
                    onClick={() => setSearchQuery("")}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <select
                className="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div ref={menuGridRef} className="menu-grid">
              {menuLoading ? (
                <div className="loading-state">
                  <Loader2 size={32} className="loading-spinner" />
                </div>
              ) : displayedMenuItems.length === 0 ? (
                <div className="empty-state">
                  <UtensilsCrossed size={48} />
                  <p>Nenhum item disponível</p>
                </div>
              ) : (
                <>
                  {displayedMenuItems.map((item) => {
                    const imageUrl = getImageUrl(item.image_id);
                    const itemId = item.$id || item.id;
                    const inOrderCount = orderItems.filter(
                      (i) => (i.$id || i.id) === itemId
                    ).length;

                    return (
                      <div
                        key={itemId}
                        className={`menu-card ${
                          inOrderCount > 0 ? "in-order" : ""
                        }`}
                        onClick={() => addToOrder(item)}
                      >
                        <div className="menu-card-image">
                          {imageUrl ? (
                            <img src={imageUrl} alt={item.nome} />
                          ) : (
                            <div className="no-image">
                              <UtensilsCrossed size={32} />
                            </div>
                          )}
                        </div>
                        <div className="menu-card-info">
                          <h3>{item.nome}</h3>
                          <span className="price">
                            €
                            <NumberFlow
                              value={item.preco || 0}
                              format={{
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }}
                            />
                          </span>
                        </div>
                        {inOrderCount > 0 && (
                          <div className="in-order-badge">{inOrderCount}</div>
                        )}
                      </div>
                    );
                  })}
                  {/* Scroll sentinel for infinite scroll */}
                  <div
                    ref={scrollSentinelRef}
                    style={{ height: "1px", gridColumn: "1 / -1" }}
                  />
                </>
              )}
            </div>
          </div>

          {/* Right: Order Summary */}
          {isOrderSectionVisible && (
            <div
              className={`order-section ${
                isOrderSectionExiting ? "slide-out" : ""
              }`}
            >
              <div className="order-header-bar">
                <h2>Pedido</h2>
                <span className="item-count">
                  {orderItems.length}{" "}
                  {orderItems.length === 1 ? "item" : "itens"}
                </span>
              </div>

              <div className="order-items">
                {orderItems.length === 0 ? (
                  <div className="empty-order">
                    <UtensilsCrossed size={48} />
                    <p>Selecione itens do menu</p>
                  </div>
                ) : (
                  orderItems.map((item) => {
                    const imageUrl = getImageUrl(item.image_id);

                    return (
                      <div key={item.orderItemId} className="order-item">
                        <div className="order-item-image">
                          {imageUrl ? (
                            <img src={imageUrl} alt={item.nome} />
                          ) : (
                            <div className="no-image-small">
                              <UtensilsCrossed size={20} />
                            </div>
                          )}
                        </div>

                        <div className="order-item-details">
                          <h4>{item.nome}</h4>
                          {item.notes && (
                            <div className="item-notes">
                              <MessageSquare size={12} />
                              {item.notes}
                            </div>
                          )}
                          <div className="item-actions">
                            <button
                              className="note-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openNoteModal(item);
                              }}
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button
                              className="delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromOrder(item.orderItemId);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="order-item-controls">
                          <div className="item-price">
                            €
                            <NumberFlow
                              value={item.preco || 0}
                              format={{
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="order-footer">
                <div className="order-total">
                  <span>Total</span>
                  <strong>
                    €
                    <NumberFlow
                      value={total}
                      format={{
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }}
                    />
                  </strong>
                </div>
                {isTakeaway && (
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    className="btn-customer-info"
                  >
                    <MessageSquare size={16} />
                    {customerName
                      ? `Cliente: ${customerName}`
                      : "Informação do Cliente"}
                  </button>
                )}
                <div className="order-actions">
                  <button onClick={cancelOrder} className="btn-cancel">
                    <X size={18} />
                    Cancelar
                  </button>
                  <button
                    onClick={confirmOrder}
                    className="btn-confirm"
                    disabled={orderItems.length === 0 || isOrderSubmitting}
                  >
                    <Check size={18} />
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Note Modal */}
      {noteModalItem && (
        <div className="modal-backdrop" onClick={() => setNoteModalItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <MessageSquare size={20} />
                Nota
              </h3>
            </div>
            <textarea
              value={tempNote}
              onChange={(e) => setTempNote(e.target.value)}
              placeholder="Ex: sem cebola, bem passado..."
              rows={4}
              autoFocus
            />
            <div className="modal-actions">
              <button
                onClick={() => setNoteModalItem(null)}
                className="btn-secondary"
              >
                <X size={16} />
                Cancelar
              </button>
              <button onClick={saveNote} className="btn-primary">
                <Check size={16} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Info Modal for Takeaway */}
      {showCustomerModal && isTakeaway && (
        <div
          className="modal-backdrop"
          onClick={() => setShowCustomerModal(false)}
        >
          <div
            className="modal-content customer-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Informação do Cliente</h3>
            </div>
            <div className="customer-form-modal">
              <div className="form-group">
                <label>Nome do Cliente *</label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="form-group">
                <label>Telefone *</label>
                <input
                  type="tel"
                  placeholder="+351 912 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email (opcional)</label>
                <input
                  type="email"
                  placeholder="exemplo@email.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label>Observações Especiais</label>
                <textarea
                  placeholder="Alergias, preferências, etc..."
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="btn-secondary"
              >
                <X size={16} />
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!customerName || !customerPhone) {
                    alert("Por favor preencha o nome e telefone do cliente");
                    return;
                  }
                  setShowCustomerModal(false);
                }}
                className="btn-primary"
              >
                <Check size={16} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PedidoPage({
  params,
}: {
  params: Promise<{ mesas?: string[] }>;
}) {
  return (
    <WebSocketProvider>
      <PedidoPageContent params={params} />
    </WebSocketProvider>
  );
}
