"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  UserCircle,
} from "lucide-react";
import { BackgroundBeams } from "../../components/BackgroundBeams";
import { auth } from "../../../lib/api";
import { isAuthenticated } from "../../../lib/auth";
import {
  WebSocketProvider,
  useWebSocketContext,
} from "../../../contexts/WebSocketContext";
import NumberFlow from '@number-flow/react';
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

interface CartItem extends MenuItem {
  notes?: string;
}

interface User {
  $id: string;
  id: string;
  name: string;
  username: string;
  email: string;
  labels: string[];
  profile_image?: string;
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

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [validTables, setValidTables] = useState<number[]>([]);
  const [validTableIds, setValidTableIds] = useState<string[]>([]); // Store table IDs for API calls
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
  const [username, setUsername] = useState("");
  const [userLabels, setUserLabels] = useState<string[]>([]);
  const [profileImg, setProfileImg] = useState("");
  const [activeNavItem, setActiveNavItem] = useState("Pedidos");

  // Memoized Profile Image Component with fallback
  const ProfileImage = React.memo(
    ({
      src,
      alt,
      className,
      size = 24,
      isCircular = false,
    }: {
      src?: string;
      alt: string;
      className?: string;
      size?: number;
      isCircular?: boolean;
    }) => {
      const [hasError, setHasError] = useState(false);

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
    }
  );

  // Function to get auth token
  const getAuthToken = () => {
    return localStorage.getItem("auth_token"); // Fixed: use same key as api.js
  };

  // Function to make API requests with auth
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
      // Handle authentication errors specifically
      if (response.status === 401) {
        console.error("Authentication failed - redirecting to login");
        router.push("/login");
        throw new Error("Session expired. Please login again.");
      }
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  };

  // Function to get image URL for menu item
  const getImageUrl = (imageId: string | undefined) => {
    if (!imageId || imageId === "undefined" || imageId === "null") return null;
    return `${API_BASE_URL}/files/imagens-menu/${imageId}`;
  };

  // Authentication check and user data loading
  useEffect(() => {
    const loadUserAndData = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      try {
        const userData = await auth.get();
        setUser(userData);
        setUsername(userData.name || userData.username || userData.email);
        setUserLabels(userData.labels || []);

        if (userData.profile_image) {
          setProfileImg(
            `${API_BASE_URL}/files/imagens-perfil/${userData.profile_image}`
          );
        }

        await validateTablesAndFetchMenu();
      } catch (error) {
        console.error("Error loading user data:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadUserAndData();
  }, [mesas]);

  // Function to fetch menu items
  const fetchMenuItems = async () => {
    try {
      setMenuLoading(true);
      const response = await apiRequest("/menu");

      const items = response.documents || response.menu || [];
      setMenuItems(items);

      // Extract and update categories
      const itemCategories = items.map(
        (item: MenuItem) => item.category || "outros"
      );
      const uniqueCategories = [...new Set(itemCategories)] as string[];
      setCategories(["Todos", ...uniqueCategories]);

      console.log("Menu items updated:", items.length, "items");
    } catch (error) {
      console.error("Error fetching menu items:", error);
    } finally {
      setMenuLoading(false);
    }
  };

  // Validate table IDs exist and fetch menu items
  const validateTablesAndFetchMenu = async () => {
    try {
      setIsLoading(true);

      console.log("Debug - mesas array:", mesas);

      // Validate tables - now expecting table IDs (UUIDs) instead of table numbers
      let tableIds: string[] = [];

      if (mesas.length === 0) {
        console.error("mesas array is empty - redirecting to pagina-teste-new");
        router.push("/pagina-teste-new");
        return;
      }

      // Check if mesas contains undefined or null values
      const cleanMesas = mesas.filter(
        (mesa) => mesa != null && mesa !== undefined && mesa !== ""
      );
      if (cleanMesas.length === 0) {
        console.error("mesas array contains only null/undefined/empty values");
        router.push("/pagina-teste-new");
        return;
      }

      if (
        cleanMesas.length === 1 &&
        typeof cleanMesas[0] === "string" &&
        (cleanMesas[0].includes(",") || cleanMesas[0].includes("%2C"))
      ) {
        // Handle comma-separated format like "uuid1,uuid2,uuid3" or URL-encoded
        console.log("Parsing comma-separated format:", cleanMesas[0]);

        // Decode URL-encoded string first
        const decodedString = decodeURIComponent(cleanMesas[0]);
        console.log("Decoded string:", decodedString);

        tableIds = decodedString
          .split(",")
          .map((str) => str.trim())
          .filter((str) => str !== "");
      } else {
        // Handle regular array format like ["uuid1", "uuid2", "uuid3"]
        console.log("Parsing array format:", cleanMesas);
        tableIds = cleanMesas
          .map((item) => {
            // Try to decode each item in case it's URL-encoded
            try {
              return decodeURIComponent(String(item));
            } catch (e) {
              return String(item);
            }
          })
          .filter((id) => id !== "");
      }

      console.log("Parsed table IDs:", tableIds);

      if (tableIds.length === 0) {
        console.error("No table IDs provided after parsing");
        router.push("/pagina-teste-new");
        return;
      }

      // Check if tables exist
      const tablesResponse = await apiRequest("/tables");
      const existingTables = tablesResponse.documents || [];

      console.log("Tables API response:", tablesResponse);
      console.log("Existing tables:", existingTables);

      if (!existingTables || existingTables.length === 0) {
        console.error("No tables found in the database");
        alert(
          "Error: No tables found in the system. Please contact an administrator."
        );
        router.push("/pagina-teste-new");
        return;
      }

      // Validate that the provided table IDs exist in the database
      const validTableIdsArray = tableIds.filter((id) =>
        existingTables.some((table: Table) => (table.$id || table.id) === id)
      );

      if (validTableIdsArray.length === 0) {
        console.error("No valid table IDs found");
        router.push("/pagina-teste-new");
        return;
      }

      // Get the table numbers for display purposes
      const validTableNumbers = existingTables
        .filter((table: Table) =>
          validTableIdsArray.includes(table.$id || table.id)
        )
        .map((table: Table) => table.tableNumber);

      console.log("Existing tables from API:", existingTables);
      console.log("Valid table IDs:", validTableIdsArray);
      console.log("Valid table numbers (for display):", validTableNumbers);

      setValidTables(validTableNumbers);
      setValidTableIds(validTableIdsArray);

      // Fetch menu items
      await fetchMenuItems();

      console.log("Tables and menu loaded successfully");
    } catch (error) {
      console.error("Error validating tables or fetching menu:", error);
      router.push("/pagina-teste-new");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle navigation clicks
  const handleNavClick = (navItem: string) => {
    if (navItem === "Painel") {
      router.push("/pagina-teste-new");
    }
  };

  // Check if user is a manager
  const isManager =
    userLabels.includes("manager") ||
    userLabels.includes("Manager") ||
    userLabels.includes("gerente") ||
    userLabels.includes("Gerente");

  // Memoize WebSocket event handlers to prevent recreation on every render
  const handleOrderCreated = useCallback(
    (order: any) => {
      console.log("📦 Order created via WebSocket:", order);

      // Check if order belongs to our tables
      if (order.table_id && Array.isArray(order.table_id)) {
        const belongsToOurTables = order.table_id.some((id: string) =>
          validTableIds.includes(id)
        );

        if (belongsToOurTables) {
          console.log("✅ Order belongs to current tables, refreshing menu");
          // Note: We don't auto-add to cart, just refresh menu availability
          fetchMenuItems();
        }
      }
    },
    [validTableIds]
  );

  const handleOrderUpdated = useCallback(
    (order: any) => {
      console.log("📝 Order updated via WebSocket:", order);

      // Check if order belongs to our tables
      if (order.table_id && Array.isArray(order.table_id)) {
        const belongsToOurTables = order.table_id.some((id: string) =>
          validTableIds.includes(id)
        );

        if (belongsToOurTables) {
          console.log("✅ Order belongs to current tables");
          fetchMenuItems();
        }
      }
    },
    [validTableIds]
  );

  const handleOrderDeleted = useCallback((data: any) => {
    console.log("🗑️ Order deleted via WebSocket:", data);
    fetchMenuItems();
  }, []);

  // Menu events - update menu items in real-time
  const handleMenuCreated = useCallback((item: any) => {
    console.log("🍕 Menu item created via WebSocket:", item);
    setMenuItems((prev) => [...prev, item]);

    // Update categories
    const newCategory = item.category || "outros";
    setCategories((prev) => {
      if (!prev.includes(newCategory)) {
        return [...prev, newCategory];
      }
      return prev;
    });
  }, []);

  const handleMenuUpdated = useCallback((item: any) => {
    console.log("✏️ Menu item updated via WebSocket:", item);
    setMenuItems((prev) =>
      prev.map((m) => (m.$id === item.$id || m.id === item.id ? item : m))
    );
  }, []);

  const handleMenuDeleted = useCallback((data: any) => {
    console.log("🗑️ Menu item deleted via WebSocket:", data);
    const itemId = data.id || data.$id;
    setMenuItems((prev) =>
      prev.filter((m) => m.$id !== itemId && m.id !== itemId)
    );

    // Remove from cart if it was there
    setCartItems((prev) =>
      prev.filter((item) => item.$id !== itemId && item.id !== itemId)
    );
  }, []);

  // WebSocket Real-Time Updates
  useEffect(() => {
    if (!socket || !connected) return;

    console.log("🔌 OrderPage: Setting up WebSocket listeners");

    // Subscribe to specific tables
    if (validTableIds.length > 0) {
      validTableIds.forEach((tableId) => {
        console.log(`📡 Subscribing to table: ${tableId}`);
        socket.emit("subscribe:table", tableId);
      });
    }

    // Register all event listeners
    socket.on("order:created", handleOrderCreated);
    socket.on("order:updated", handleOrderUpdated);
    socket.on("order:deleted", handleOrderDeleted);
    socket.on("menu:created", handleMenuCreated);
    socket.on("menu:updated", handleMenuUpdated);
    socket.on("menu:deleted", handleMenuDeleted);

    // Cleanup function
    return () => {
      console.log("🔌 OrderPage: Cleaning up WebSocket listeners");

      // Unsubscribe from tables
      if (validTableIds.length > 0) {
        validTableIds.forEach((tableId) => {
          console.log(`📡 Unsubscribing from table: ${tableId}`);
          socket.emit("unsubscribe:table", tableId);
        });
      }

      // Remove all event listeners
      socket.off("order:created", handleOrderCreated);
      socket.off("order:updated", handleOrderUpdated);
      socket.off("order:deleted", handleOrderDeleted);
      socket.off("menu:created", handleMenuCreated);
      socket.off("menu:updated", handleMenuUpdated);
      socket.off("menu:deleted", handleMenuDeleted);
    };
  }, [
    socket,
    connected,
    validTableIds,
    handleOrderCreated,
    handleOrderUpdated,
    handleOrderDeleted,
    handleMenuCreated,
    handleMenuUpdated,
    handleMenuDeleted,
  ]);

  // Memoize filtered menu items to avoid recalculation on every render
  const filteredMenuItems = useMemo(() => {
    return activeCategory === "Todos"
      ? menuItems
      : menuItems.filter(
          (item) => (item.category || "outros") === activeCategory
        );
  }, [menuItems, activeCategory]);

  // Memoize add to cart function
  const addToCart = useCallback(async (item: MenuItem) => {
    setAddingToCart(item.$id || item.id);

    // Small delay for visual feedback
    await new Promise((resolve) => setTimeout(resolve, 300));

    setCartItems((prev) => [...prev, { ...item, notes: "" }]);
    setAddingToCart(null);

    // Auto-open cart on mobile when item is added
    if (window.innerWidth <= 768) {
      setCartSidebarOpen(true);
    }
  }, []);

  // Memoize remove from cart function
  const removeFromCart = useCallback((index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

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

  // Memoize total calculation
  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.preco || 0), 0);
  }, [cartItems]);

  // Confirm order
  const confirmOrder = async () => {
    if (cartItems.length === 0) {
      console.error("No items in cart");
      return;
    }

    if (validTableIds.length === 0) {
      console.error("No valid table IDs available");
      alert("Error: No valid tables selected");
      return;
    }

    try {
      setIsOrderSubmitting(true);

      // Create batch order request with proper table IDs and prices
      const orderData = {
        orders: cartItems.map((item) => ({
          table_id: validTableIds, // Use table IDs instead of table numbers
          menu_item_id: item.$id || item.id,
          notas: item.notes || "",
          price: item.preco || 0, // Include price as required by API
        })),
      };

      console.log("Valid table IDs:", validTableIds);
      console.log(
        "Cart items:",
        cartItems.map((item) => ({
          name: item.nome,
          id: item.$id || item.id,
        }))
      );
      console.log("Sending order data:", JSON.stringify(orderData, null, 2)); // Debug log

      await apiRequest("/orders/batch", {
        method: "POST",
        body: JSON.stringify(orderData),
      });

      console.log(
        `Successfully created ${
          cartItems.length
        } orders for tables ${validTables.join(", ")}`
      );

      // Show success for 2 seconds then redirect
      setOrderSuccess(true);
      setTimeout(() => {
        router.push("/pagina-teste-new");
      }, 2000);
    } catch (error) {
      console.error("Error creating order:", error);
      setIsOrderSubmitting(false);
      // You could add a toast notification here instead of alert
    }
  };

  // Cancel and go back
  const cancelOrder = () => {
    router.push("/pagina-teste-new");
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
      <div className="dashboard fade-in">
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: -1,
          }}
        >
          <div className="relative bg-white text-black min-h-screen">
            <BackgroundBeams pathCount={20} />
          </div>
        </div>

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

  return (
    <div className="dashboard fade-in">
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: -1,
        }}
      >
        <div className="relative bg-white text-black min-h-screen">
          <BackgroundBeams pathCount={20} />
        </div>
      </div>

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

      <main className="main-content fade-in-delayed">
        <div
          className="order-page"
          style={{
            pointerEvents: isOrderSubmitting || orderSuccess ? "none" : "auto",
          }}
        >
          {/* Main Content */}
          <div className="order-main">
            {/* Header with selected tables */}
            <div className="order-header">
              <button onClick={cancelOrder} className="back-button">
                <ArrowLeft size={20} />
              </button>
              <h1 className="page-title slide-in-up">
                Novo Pedido - Mesa{validTables.length > 1 ? "s" : ""}{" "}
                {validTables.join(", ")}
              </h1>
            </div>

            {/* Category Tabs */}
            <div className="category-tabs fade-in-delayed">
              {menuLoading ? (
                <div className="category-loading">
                  <LoadingSpinner size={16} />
                  <span>A atualizar menu...</span>
                </div>
              ) : (
                categories.map((category) => (
                  <button
                    key={category}
                    className={`category-tab scale-in ${
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
            <div className="menu-grid slide-in-up">
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
                filteredMenuItems.map((item) => {
                  const imageUrl = item.image_id
                    ? getImageUrl(item.image_id)
                    : null;
                  const itemId = item.$id || item.id;
                  return (
                    <div
                      key={itemId}
                      className={`menu-item-card scale-in ${
                        addingToCart === itemId ? "loading" : ""
                      }`}
                      onClick={() => addToCart(item)}
                    >
                      {/* Image - inset style thumbnail */}
                      <div className="menu-item-image">
                        {addingToCart === itemId ? (
                          <LoadingSpinner size={24} />
                        ) : imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.nome}
                            className="menu-image"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                              const parent = (e.target as HTMLElement)
                                .parentElement;
                              if (parent) {
                                const fallback = parent.querySelector(
                                  ".no-image-placeholder"
                                );
                                if (fallback)
                                  (fallback as HTMLElement).style.display =
                                    "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="no-image-placeholder"
                          style={{ display: imageUrl ? "none" : "flex" }}
                        >
                          <UtensilsCrossed size={32} />
                        </div>
                      </div>

                      {/* Info - vertical card layout */}
                      <div className="menu-item-info">
                        <div className="menu-item-details">
                          <h3>{item.nome}</h3>
                          {item.category && (
                            <span className="menu-item-category">
                              {item.category}
                            </span>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="menu-item-tags">
                              {item.tags.map((tag, idx) => (
                                <span key={idx} className="tag">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="menu-item-price">
                          €<NumberFlow value={item.preco || 0} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

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

          {/* Cart Overlay */}
          <div
            className={`mobile-cart-overlay ${
              cartSidebarOpen ? "active" : ""
            }`}
            onClick={() => setCartSidebarOpen(false)}
          />

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
              {cartItems.map((item, index) => {
                const itemId = item.$id || item.id;
                const imageUrl = getImageUrl(item.image_id);
                return (
                  <div key={`${itemId}-${index}`} className="cart-item">
                    {/* Image Container */}
                    <div className="cart-item-image-container">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.nome}
                          className="cart-item-image"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                            const nextSibling = (e.target as HTMLElement)
                              .nextSibling as HTMLElement;
                            if (nextSibling) {
                              nextSibling.style.display = "flex";
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="no-image-placeholder"
                        style={{
                          display: imageUrl ? "none" : "flex",
                        }}
                      >
                        <UtensilsCrossed size={24} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="cart-item-content">
                      <div className="cart-item-info">
                        {/* Title and Price */}
                        <div className="title-price-row">
                          <h4>{item.nome}</h4>
                          <span className="price">
                            €<NumberFlow value={item.preco || 0} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
                          </span>
                        </div>

                        {/* Description */}
                        {item.description && (
                          <p className="description">{item.description}</p>
                        )}

                        {/* Category */}
                        {item.category && (
                          <div style={{ marginBottom: "8px" }}>
                            <span className="category-tag">
                              {item.category}
                            </span>
                          </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <div className="cart-item-notes">
                            <MessageSquare size={12} />
                            {item.notes}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="action-buttons">
                        <button
                          onClick={() => openNoteModal(index)}
                          className="edit-btn"
                          title="Adicionar nota"
                        >
                          <MessageSquare size={14} />
                          Nota
                        </button>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="delete-btn"
                          title="Remover item"
                        >
                          <Trash2 size={14} />
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                <strong>Total: €<NumberFlow value={total} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /></strong>
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
        </div>
      </main>

      {/* Note Modal */}
      {noteModalOpen !== null && (
        <div
          className="modal-overlay"
          onClick={() => setNoteModalOpen(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999999,
            pointerEvents: "auto",
          }}
        >
          <div
            className="note-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "24px",
              width: "90%",
              maxWidth: "500px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
              pointerEvents: "auto",
              position: "relative",
              zIndex: 1000000,
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <MessageSquare size={20} />
              Adicionar Nota
            </h3>
            <textarea
              value={tempNote}
              onChange={(e) => setTempNote(e.target.value)}
              placeholder="Nota para o chef (ex: sem cebola, bem passado, etc.)..."
              rows={4}
              autoFocus
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e9ecef",
                borderRadius: "6px",
                fontSize: "14px",
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: "100px",
                marginBottom: "16px",
                pointerEvents: "auto",
                userSelect: "text",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setNoteModalOpen(null)}
                style={{
                  padding: "12px 16px",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  pointerEvents: "auto",
                }}
              >
                <X size={16} />
                Cancelar
              </button>
              <button
                onClick={saveNote}
                style={{
                  padding: "12px 16px",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: "#ff6b35",
                  color: "white",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  pointerEvents: "auto",
                }}
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

// Wrap the component with WebSocketProvider
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
