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
  Plus,
  Minus,
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
        router.push("/pagina-teste-new");
        return;
      }

      let tableIds: string[] = [];

      if (cleanMesas.length === 1 && cleanMesas[0].includes(",")) {
        const decodedString = decodeURIComponent(cleanMesas[0]);
        tableIds = decodedString
          .split(",")
          .map((str) => str.trim())
          .filter((str) => str !== "");
      } else {
        tableIds = cleanMesas
          .map((item) => {
            try {
              return decodeURIComponent(String(item));
            } catch (e) {
              return String(item);
            }
          })
          .filter((id) => id !== "");
      }

      if (tableIds.length === 0) {
        router.push("/pagina-teste-new");
        return;
      }

      const tablesResponse = await apiRequest("/tables");
      const existingTables = tablesResponse.documents || [];

      if (!existingTables || existingTables.length === 0) {
        alert("Error: No tables found");
        router.push("/pagina-teste-new");
        return;
      }

      const validTableIdsArray = tableIds.filter((id) =>
        existingTables.some((table: Table) => (table.$id || table.id) === id)
      );

      if (validTableIdsArray.length === 0) {
        router.push("/pagina-teste-new");
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
      router.push("/pagina-teste-new");
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

  const filteredMenuItems = useMemo(() => {
    return activeCategory === "Todos"
      ? menuItems
      : menuItems.filter(
          (item) => (item.category || "outros") === activeCategory
        );
  }, [menuItems, activeCategory]);

  const addToOrder = useCallback((item: MenuItem) => {
    setOrderItems((prev) => {
      const existing = prev.find(
        (i) => (i.$id || i.id) === (item.$id || item.id)
      );
      if (existing) {
        return prev.map((i) =>
          (i.$id || i.id) === (item.$id || item.id)
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, notes: "", quantity: 1 }];
    });
  }, []);

  const removeFromOrder = useCallback((itemId: string) => {
    setOrderItems((prev) => prev.filter((i) => (i.$id || i.id) !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if ((item.$id || item.id) === itemId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  }, []);

  const openNoteModal = (item: OrderItem) => {
    setNoteModalItem(item);
    setTempNote(item.notes || "");
  };

  const saveNote = () => {
    if (noteModalItem) {
      const itemId = noteModalItem.$id || noteModalItem.id;
      setOrderItems((prev) =>
        prev.map((item) =>
          (item.$id || item.id) === itemId ? { ...item, notes: tempNote } : item
        )
      );
    }
    setNoteModalItem(null);
    setTempNote("");
  };

  const total = useMemo(() => {
    return orderItems.reduce(
      (sum, item) => sum + (item.preco || 0) * item.quantity,
      0
    );
  }, [orderItems]);

  const confirmOrder = async () => {
    if (orderItems.length === 0) return;

    try {
      setIsOrderSubmitting(true);

      const orders = orderItems.flatMap((item) =>
        Array.from({ length: item.quantity }).map(() => ({
          table_id: validTableIds,
          menu_item_id: item.$id || item.id,
          notas: item.notes || "",
          price: item.preco || 0,
        }))
      );

      await apiRequest("/orders/batch", {
        method: "POST",
        body: JSON.stringify({ orders }),
      });

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
    router.push("/pagina-teste-new");
  };

  if (loading || isLoading) {
    return (
      <div className="order-page-container">
        <BackgroundBeams pathCount={20} />
        <div className="order-loading">
          <Loader2 size={48} className="loading-spinner" />
          <p>A carregar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="order-page-container">
      <BackgroundBeams pathCount={20} />

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

            <div className="menu-grid">
              {menuLoading ? (
                <div className="loading-state">
                  <Loader2 size={32} className="loading-spinner" />
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="empty-state">
                  <UtensilsCrossed size={48} />
                  <p>Nenhum item disponível</p>
                </div>
              ) : (
                filteredMenuItems.map((item) => {
                  const imageUrl = getImageUrl(item.image_id);
                  const itemId = item.$id || item.id;
                  const inOrder = orderItems.find(
                    (i) => (i.$id || i.id) === itemId
                  );

                  return (
                    <div
                      key={itemId}
                      className={`menu-card ${inOrder ? "in-order" : ""}`}
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
                      {inOrder && (
                        <div className="in-order-badge">{inOrder.quantity}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="order-section">
            <div className="order-header-bar">
              <h2>Pedido</h2>
              <span className="item-count">
                {orderItems.reduce((sum, item) => sum + item.quantity, 0)} itens
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
                  const itemId = item.$id || item.id;
                  const imageUrl = getImageUrl(item.image_id);

                  return (
                    <div key={itemId} className="order-item">
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
                              removeFromOrder(itemId);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="order-item-controls">
                        <div className="quantity-controls">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(itemId, -1);
                            }}
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(itemId, 1);
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="item-price">
                          €
                          <NumberFlow
                            value={(item.preco || 0) * item.quantity}
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
