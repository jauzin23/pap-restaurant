"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  ArrowLeft,
  ShoppingCart,
  UtensilsCrossed,
  Loader2,
  CheckCircle,
} from "lucide-react";
import Header from "../../components/Header";
import { useApp } from "@/contexts/AppContext";
import {
  databases,
  client,
  DBRESTAURANTE,
  COL_ORDERS,
  COL_TABLES,
  COL_MENU,
} from "@/lib/appwrite";
import { Query } from "appwrite";
import "./page.scss";

interface MenuItem {
  $id: string;
  nome: string;
  preco: number;
  category: string;
  description?: string;
}

interface Table {
  $id: string;
  tableNumber: number;
}

interface CartItem extends MenuItem {
  notes?: string;
}

export default function PedidoPage({
  params,
}: {
  params: Promise<{ mesas?: string[] }>;
}) {
  const router = useRouter();
  const { user, loading } = useApp();

  const resolvedParams = React.use(params);
  console.log("Raw params:", params);
  console.log("Resolved params:", resolvedParams);
  const mesas = resolvedParams.mesas || [];
  console.log("Received mesas parameter:", mesas);
  console.log("mesas type:", typeof mesas);
  console.log("mesas is array:", Array.isArray(mesas));

  // Debug useEffect to monitor mesas changes
  useEffect(() => {
    console.log("useEffect - mesas changed:", mesas);
  }, [mesas]);

  const [validTables, setValidTables] = useState<number[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);
  const [cartSidebarOpen, setCartSidebarOpen] = useState(false);

  // Validate tables and fetch menu on load
  useEffect(() => {
    console.log("useEffect triggered - loading:", loading, "user:", !!user);

    if (!loading && !user) {
      console.log("No user, redirecting to login");
      router.push("/login");
      return;
    }

    if (user) {
      console.log("User found, validating tables and fetching menu");
      validateTablesAndFetchMenu();
    }
  }, [user, loading, mesas]);

  // Set up real-time subscription for menu updates
  useEffect(() => {
    if (!user || loading || !client) return;

    const unsubscribeMenu = client.subscribe(
      `databases.${DBRESTAURANTE}.collections.${COL_MENU}.documents`,
      (response) => {
        console.log("Menu update received:", response);

        // Refetch menu when items change
        if (
          response.events.some(
            (event) =>
              event.includes("create") ||
              event.includes("update") ||
              event.includes("delete")
          )
        ) {
          fetchMenuItems();
        }
      }
    );

    const unsubscribeTables = client.subscribe(
      `databases.${DBRESTAURANTE}.collections.${COL_TABLES}.documents`,
      (response) => {
        console.log("Tables update received:", response);

        // Refetch tables when they change
        if (
          response.events.some(
            (event) =>
              event.includes("create") ||
              event.includes("update") ||
              event.includes("delete")
          )
        ) {
          validateTablesAndFetchMenu();
        }
      }
    );

    return () => {
      if (unsubscribeMenu && typeof unsubscribeMenu === "function") {
        unsubscribeMenu();
      }
      if (unsubscribeTables && typeof unsubscribeTables === "function") {
        unsubscribeTables();
      }
    };
  }, [user, loading, client]);

  // Separate function to fetch only menu items
  const fetchMenuItems = async () => {
    try {
      setMenuLoading(true);

      const menuResponse = await databases.listDocuments(
        DBRESTAURANTE,
        COL_MENU,
        [Query.limit(1000), Query.orderAsc("category"), Query.orderAsc("nome")]
      );

      const items = menuResponse.documents as unknown as MenuItem[];
      setMenuItems(items);

      // Extract and update categories
      const uniqueCategories = [
        ...new Set(
          items.map((item) => item.category || "outros").filter(Boolean)
        ),
      ];
      setCategories(["Todos", ...uniqueCategories]);

      console.log("Menu items updated:", items.length, "items");
    } catch (error) {
      console.error("Error fetching menu items:", error);
    } finally {
      setMenuLoading(false);
    }
  };

  // Validate table numbers exist and fetch menu items
  const validateTablesAndFetchMenu = async () => {
    try {
      setIsLoading(true);

      // Log current URL for debugging
      console.log("Current URL:", window.location.href);
      console.log("Current pathname:", window.location.pathname);

      console.log("Debug - mesas array:", mesas);
      console.log("Debug - mesas length:", mesas.length);
      console.log("Debug - mesas[0]:", mesas[0]);
      console.log("Debug - typeof mesas[0]:", typeof mesas[0]);

      // Validate tables - handle both array format and comma-separated format
      let tableNumbers: number[] = [];

      if (mesas.length === 0) {
        console.error("mesas array is empty - redirecting to testedash");
        console.error(
          "This might happen if URL is /order/ without table numbers"
        );
        router.push("/testedash");
        return;
      }

      // Check if mesas contains undefined or null values
      const cleanMesas = mesas.filter(
        (mesa) => mesa != null && mesa !== undefined && mesa !== ""
      );
      if (cleanMesas.length === 0) {
        console.error("mesas array contains only null/undefined/empty values");
        router.push("/testedash");
        return;
      }

      if (
        cleanMesas.length === 1 &&
        typeof cleanMesas[0] === "string" &&
        (cleanMesas[0].includes(",") || cleanMesas[0].includes("%2C"))
      ) {
        // Handle comma-separated format like "3,5,7" or URL-encoded "9%2C10%2C11%2C12"
        console.log("Parsing comma-separated format:", cleanMesas[0]);

        // Decode URL-encoded string first
        const decodedString = decodeURIComponent(cleanMesas[0]);
        console.log("Decoded string:", decodedString);

        tableNumbers = decodedString
          .split(",")
          .map((str) => str.trim())
          .filter((str) => str !== "")
          .map(Number)
          .filter((num) => !isNaN(num));
      } else {
        // Handle regular array format like ["3", "5", "7"]
        console.log("Parsing array format:", cleanMesas);
        tableNumbers = cleanMesas
          .map((item) => {
            // Try to decode each item in case it's URL-encoded
            try {
              return decodeURIComponent(String(item));
            } catch (e) {
              return String(item);
            }
          })
          .map(Number)
          .filter((num) => !isNaN(num));
      }

      console.log("Parsed table numbers:", tableNumbers);

      if (tableNumbers.length === 0) {
        console.error("No table numbers provided after parsing");
        console.error("Original mesas:", mesas);
        router.push("/testedash");
        return;
      }

      // Check if tables exist with better error handling
      const tablesResponse = await databases.listDocuments(
        DBRESTAURANTE,
        COL_TABLES,
        [Query.limit(1000), Query.orderAsc("tableNumber")]
      );

      const existingTableNumbers = (
        tablesResponse.documents as unknown as Table[]
      ).map((table) => table.tableNumber);

      const validTableNumbers = tableNumbers.filter((num) =>
        existingTableNumbers.includes(num)
      );

      if (validTableNumbers.length === 0) {
        console.error("No valid tables found");
        router.push("/testedash");
        return;
      }

      setValidTables(validTableNumbers);

      // Fetch menu items with improved sorting
      await fetchMenuItems();

      console.log("Tables and menu loaded successfully");
    } catch (error) {
      console.error("Error validating tables or fetching menu:", error);
      router.push("/testedash");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter menu items by category
  const filteredMenuItems =
    activeCategory === "Todos"
      ? menuItems
      : menuItems.filter(
          (item) => (item.category || "outros") === activeCategory
        );

  // Add item to cart
  const addToCart = async (item: MenuItem) => {
    setAddingToCart(item.$id);

    // Small delay for visual feedback
    await new Promise((resolve) => setTimeout(resolve, 300));

    setCartItems((prev) => [...prev, { ...item, notes: "" }]);
    setAddingToCart(null);

    // Auto-open cart on mobile when item is added
    if (window.innerWidth <= 768) {
      setCartSidebarOpen(true);
    }
  };

  // Remove item from cart
  const removeFromCart = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Open note modal
  const openNoteModal = (index: number) => {
    const item = cartItems[index];
    setTempNote(item.notes || "");
    setNoteModalOpen(index.toString());
  };

  // Save note
  const saveNote = () => {
    if (noteModalOpen !== null) {
      const index = parseInt(noteModalOpen);
      setCartItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, notes: tempNote } : item
        )
      );
    }
    setNoteModalOpen(null);
    setTempNote("");
  };

  // Calculate total
  const total = cartItems.reduce((sum, item) => sum + (item.preco || 0), 0);

  // Confirm order
  const confirmOrder = async () => {
    if (cartItems.length === 0) {
      return;
    }

    try {
      setIsOrderSubmitting(true);

      // Create individual order documents for each item
      const orderPromises = cartItems.map((item) =>
        databases.createDocument(DBRESTAURANTE, COL_ORDERS, "unique()", {
          status: "pendente",
          criadoEm: new Date().toLocaleString("pt-PT", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          staffID: user?.$id,
          paid: false,
          total: item.preco || 0,
          numeroMesa: validTables,
          menu_id: item.$id,
          notes: item.notes || "",
        })
      );

      // Execute all order creations in parallel for better performance
      await Promise.all(orderPromises);

      console.log(
        `Successfully created ${
          cartItems.length
        } orders for tables ${validTables.join(", ")}`
      );

      // Show success for 2 seconds then redirect
      setOrderSuccess(true);
      setTimeout(() => {
        router.push("/testedash");
      }, 2000);
    } catch (error) {
      console.error("Error creating order:", error);
      setIsOrderSubmitting(false);
      // You could add a toast notification here instead of alert
    }
  };

  // Cancel and go back
  const cancelOrder = () => {
    router.push("/testedash");
  };

  // Loading spinner component
  const LoadingSpinner = ({ size = 24 }: { size?: number }) => (
    <Loader2 size={size} className="loading-spinner" />
  );

  // Skeleton loader for menu items
  const MenuItemSkeleton = () => (
    <div className="menu-item-skeleton">
      <div className="skeleton-image"></div>
      <div className="skeleton-title"></div>
      <div className="skeleton-description"></div>
      <div className="skeleton-price"></div>
    </div>
  );

  // Main loading state
  if (loading || isLoading) {
    return (
      <div className="dashboard">
        <Header />
        <div className="order-page">
          <div className="order-main">
            <div className="order-header">
              <div className="back-button">
                <ArrowLeft size={20} />
              </div>
              <h1>Carregar Pedido...</h1>
            </div>

            <div className="category-tabs">
              <div className="category-skeleton"></div>
              <div className="category-skeleton"></div>
              <div className="category-skeleton"></div>
              <div className="category-skeleton"></div>
            </div>

            <div className="menu-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <MenuItemSkeleton key={index} />
              ))}
            </div>
          </div>

          <aside className="cart-sidebar">
            <div className="cart-header">
              <ShoppingCart size={20} />
              <h2>Carrinho</h2>
              <span className="cart-count">0</span>
            </div>
            <div className="cart-items">
              <div className="cart-loading">
                <LoadingSpinner size={32} />
                <p>A carregar...</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (loading || isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        Carregando...
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Header />

      {/* Loading overlay for order submission */}
      {(isOrderSubmitting || orderSuccess) && (
        <div className="order-loading-overlay">
          <div className="order-loading-content">
            {orderSuccess ? (
              <>
                <CheckCircle size={48} className="success-icon" />
                <h3>Pedido criado com sucesso!</h3>
                <p>A redirecionar...</p>
              </>
            ) : (
              <>
                <LoadingSpinner size={48} />
                <h3>A processar pedido...</h3>
                <p>Por favor aguarde</p>
              </>
            )}
          </div>
        </div>
      )}

      <div
        className="order-page"
        style={{
          pointerEvents: isOrderSubmitting || orderSuccess ? "none" : "auto",
        }}
      >
        {/* Main Content */}
        <main className="order-main">
          {/* Header with selected tables */}
          <div className="order-header">
            <button onClick={cancelOrder} className="back-button">
              <ArrowLeft size={20} />
            </button>
            <h1>
              Novo Pedido - Mesa{validTables.length > 1 ? "s" : ""}{" "}
              {validTables.join(", ")}
            </h1>
          </div>

          {/* Category Tabs */}
          <div className="category-tabs">
            {menuLoading ? (
              <div className="category-loading">
                <LoadingSpinner size={16} />
                <span>A atualizar menu...</span>
              </div>
            ) : (
              categories.map((category) => (
                <button
                  key={category}
                  className={`category-tab ${
                    activeCategory === category ? "active" : ""
                  }`}
                  onClick={() => setActiveCategory(category)}
                  disabled={menuLoading}
                >
                  {category}
                </button>
              ))
            )}
          </div>

          {/* Menu Items Grid */}
          <div className="menu-grid">
            {menuLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <MenuItemSkeleton key={`skeleton-${index}`} />
              ))
            ) : filteredMenuItems.length === 0 ? (
              <div className="menu-empty">
                <UtensilsCrossed size={48} />
                <h3>Nenhum item encontrado</h3>
                <p>Não há itens disponíveis nesta categoria</p>
              </div>
            ) : (
              filteredMenuItems.map((item) => (
                <div
                  key={item.$id}
                  className={`menu-item-card ${
                    addingToCart === item.$id ? "loading" : ""
                  }`}
                  onClick={() => addToCart(item)}
                >
                  <div className="menu-item-image">
                    {addingToCart === item.$id ? (
                      <LoadingSpinner size={24} />
                    ) : (
                      <UtensilsCrossed size={40} />
                    )}
                  </div>
                  <div className="menu-item-info">
                    <h3>{item.nome}</h3>
                    <p className="menu-item-description">
                      {item.description || "Deliciosa opção do nosso menu"}
                    </p>
                    <div className="menu-item-price">
                      €{(item.preco || 0).toFixed(2)}
                    </div>
                    {item.category && (
                      <div className="menu-item-category">{item.category}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* Mobile Cart Toggle Button */}
        <button
          className="mobile-cart-toggle"
          onClick={() => setCartSidebarOpen(!cartSidebarOpen)}
        >
          <ShoppingCart size={24} />
          {cartItems.length > 0 && (
            <span className="mobile-cart-badge">{cartItems.length}</span>
          )}
        </button>

        {/* Mobile Cart Overlay */}
        {cartSidebarOpen && (
          <div
            className="mobile-cart-overlay"
            onClick={() => setCartSidebarOpen(false)}
          />
        )}

        {/* Shopping Cart Sidebar */}
        <aside
          className={`cart-sidebar ${
            cartSidebarOpen ? "cart-sidebar--open" : ""
          }`}
        >
          <div className="cart-header">
            <ShoppingCart size={20} />
            <h2>Carrinho</h2>
            <span className="cart-count">{cartItems.length}</span>

            {/* Mobile close button */}
            <button
              className="mobile-cart-close"
              onClick={() => setCartSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          <div className="cart-items">
            {cartItems.map((item, index) => (
              <div key={`${item.$id}-${index}`} className="cart-item">
                <div className="cart-item-info">
                  <h4>{item.nome}</h4>
                  <div className="cart-item-price">
                    €{(item.preco || 0).toFixed(2)}
                  </div>
                  {item.notes && (
                    <div className="cart-item-notes">
                      <MessageSquare size={12} />
                      {item.notes}
                    </div>
                  )}
                </div>
                <div className="cart-item-actions">
                  <button
                    onClick={() => openNoteModal(index)}
                    className="note-button"
                    title="Adicionar nota"
                  >
                    <MessageSquare size={16} />
                  </button>
                  <button
                    onClick={() => removeFromCart(index)}
                    className="remove-button"
                    title="Remover item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {cartItems.length === 0 && (
            <div className="cart-empty">
              <p>Carrinho vazio</p>
              <p>Selecione itens do menu</p>
            </div>
          )}

          {/* Cart Footer */}
          <div className="cart-footer">
            <div className="cart-total">
              <strong>Total: €{total.toFixed(2)}</strong>
            </div>
            <div className="cart-actions">
              <button
                onClick={cancelOrder}
                className="cancel-button"
                title="Cancelar"
              >
                <X size={20} />
              </button>
              <button
                onClick={confirmOrder}
                className="confirm-button"
                disabled={cartItems.length === 0 || isOrderSubmitting}
                title="Confirmar Pedido"
              >
                {isOrderSubmitting ? (
                  <>
                    <LoadingSpinner size={20} />A processar...
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* Note Modal */}
        {noteModalOpen !== null && (
          <div className="modal-overlay">
            <div className="note-modal">
              <h3>
                <MessageSquare size={20} style={{ marginRight: "8px" }} />
                Adicionar Nota
              </h3>
              <textarea
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="Nota para o chef (ex: sem cebola, bem passado, etc.)..."
                rows={4}
              />
              <div className="note-modal-actions">
                <button onClick={() => setNoteModalOpen(null)}>
                  <X size={16} />
                  Cancelar
                </button>
                <button onClick={saveNote}>
                  <Check size={16} />
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
