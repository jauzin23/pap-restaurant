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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BackgroundBeams } from "../../components/BackgroundBeams";
import { auth } from "../../../lib/api";
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

  const [loading, setLoading] = useState(true);
  const [validTables, setValidTables] = useState<number[]>([]);
  const [validTableIds, setValidTableIds] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [noteModalItem, setNoteModalItem] = useState<OrderItem | null>(null);
  const [tempNote, setTempNote] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12); // Default, will be calculated
  const menuGridRef = React.useRef<HTMLDivElement>(null);
  const [isOrderSectionVisible, setIsOrderSectionVisible] = useState(false);
  const [isOrderSectionExiting, setIsOrderSectionExiting] = useState(false);

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
    return `${API_BASE_URL}/files/imagens-menu/${imageId}`;
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

  // Calculate items per page based on grid size
  useEffect(() => {
    const calculateItemsPerPage = () => {
      if (!menuGridRef.current) return;

      const gridWidth = menuGridRef.current.offsetWidth;
      const gridHeight = menuGridRef.current.offsetHeight;

      // Menu card dimensions: 180px min width + 16px gap
      const cardWidth = 196; // 180 + 16 gap
      const cardHeight = 218; // ~140px image + ~78px info + gap

      const itemsPerRow = Math.floor(gridWidth / cardWidth) || 1;
      const rows = Math.floor(gridHeight / cardHeight) || 2;

      const calculatedItems = itemsPerRow * rows;
      setItemsPerPage(Math.max(calculatedItems, 6)); // Minimum 6 items
    };

    calculateItemsPerPage();
    window.addEventListener("resize", calculateItemsPerPage);
    return () => window.removeEventListener("resize", calculateItemsPerPage);
  }, []);

  const filteredMenuItems = useMemo(() => {
    const filtered =
      activeCategory === "Todos"
        ? menuItems
        : menuItems.filter(
            (item) => (item.category || "outros") === activeCategory
          );

    // Reset to page 1 if current page is beyond total pages
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }

    return filtered;
  }, [menuItems, activeCategory, itemsPerPage, currentPage]);

  // Paginated items
  const paginatedMenuItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredMenuItems.slice(startIndex, endIndex);
  }, [filteredMenuItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredMenuItems.length / itemsPerPage);

  // Reset to page 1 when category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory]);

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

    try {
      setIsOrderSubmitting(true);

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

      setOrderSuccess(true);
      setTimeout(() => {
        router.push("/ ");
      }, 2000);
    } catch (error) {
      console.error("Error creating order:", error);
      setIsOrderSubmitting(false);
    }
  };

  const cancelOrder = () => {
    router.push("/ ");
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
            Mesa{validTables.length > 1 ? "s" : ""} {validTables.join(", ")}
          </h1>
        </div>

        <div className="order-content">
          {/* Left: Menu */}
          <div className="menu-section">
            <div className="category-bar">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`category-btn ${
                    activeCategory === category ? "active" : ""
                  }`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={20} />
                  Anterior
                </button>
                <div className="pagination-info">
                  Página {currentPage} de {totalPages}
                </div>
                <button
                  className="pagination-btn"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Próxima
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            <div ref={menuGridRef} className="menu-grid">
              {menuLoading ? (
                <div className="loading-state">
                  <Loader2 size={32} className="loading-spinner" />
                </div>
              ) : paginatedMenuItems.length === 0 ? (
                <div className="empty-state">
                  <UtensilsCrossed size={48} />
                  <p>Nenhum item disponível</p>
                </div>
              ) : (
                paginatedMenuItems.map((item) => {
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
                })
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
