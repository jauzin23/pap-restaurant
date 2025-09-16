"use client";

import React, { useState } from "react";
import {
  User,
  Crown,
  Shield,
  Award,
  Star,
  LogOut,
  Settings,
  Menu,
  ShoppingCart,
  Package,
  Calendar,
  Bell,
  Search,
  ChefHat,
  X,
  MenuIcon,
  Loader2,
  Edit,
  Trash2,
  MessageSquare,
  UtensilsCrossed,
  Clock,
  CheckCircle,
  CreditCard,
  ArrowLeft,
  Plus,
} from "lucide-react";
import "./page.scss";
import RestLayout from "../components/RestLayout";
import Header from "../components/Header";
import { useApp } from "@/contexts/AppContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  databases,
  DBRESTAURANTE,
  COL_ORDERS,
  COL_TABLES,
  COL_MENU,
} from "@/lib/appwrite";
import { Query } from "appwrite";

export default function RestaurantDashboard() {
  const [activeNav, setActiveNav] = useState("MENU");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, account, client } = useApp();
  const router = useRouter();

  // Daily statistics state
  const [dailyStats, setDailyStats] = useState({
    profit: 0,
    orders: 0,
    reservations: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Order management state
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [tempNote, setTempNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(null);

  // Timer state to update elapsed times every minute
  const [timeUpdateTrigger, setTimeUpdateTrigger] = useState(0);

  // Simple height matching effect
  useEffect(() => {
    const matchHeight = () => {
      const leftElement = document.querySelector(".dashboard__layout-left");
      const rightElement = document.querySelector(".stats-cards");

      if (leftElement && rightElement) {
        // Only apply height matching on larger screens (desktop layout)
        if (window.innerWidth > 1200) {
          const leftHeight = leftElement.offsetHeight;
          rightElement.style.height = leftHeight + "px";
        } else {
          // Remove height constraint on smaller screens
          rightElement.style.height = "auto";
        }
      }
    };

    // Match height after component mounts and updates
    const timer = setTimeout(matchHeight, 100);
    window.addEventListener("resize", matchHeight);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", matchHeight);
    };
  }, [user, loading]); // Re-run when user/loading changes

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [router, loading, user]);

  // Fetch daily stats when component loads
  useEffect(() => {
    if (user && !loading) {
      fetchDailyStats();
      fetchMenuItems(); // Also fetch menu items
    }
  }, [user, loading]);

  // Set up real-time subscription for orders to update stats
  useEffect(() => {
    if (!user || loading || !client) return;

    const unsubscribe = client.subscribe(
      `databases.${DBRESTAURANTE}.collections.${COL_ORDERS}.documents`,
      (response) => {
        // Refetch stats when orders change
        if (
          response.events.some(
            (event) =>
              event.includes("create") ||
              event.includes("update") ||
              event.includes("delete")
          )
        ) {
          fetchDailyStats();

          // If we have a selected table, also refresh its orders
          if (selectedTable) {
            fetchTableOrders(selectedTable);
          }
        }
      }
    );

    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [user, loading, client, selectedTable]);

  // Set up timer to update elapsed times every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUpdateTrigger((prev) => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { name: "MENU", count: 12, color: "#3b82f6", icon: Menu },
    { name: "PEDIDOS", count: 5, color: "#f59e0b", icon: ShoppingCart },
    { name: "STOCK", count: 8, color: "#10b981", icon: Package },
    { name: "RESERVAS", count: 3, color: "#ef4444", icon: Calendar },
  ];

  // Function to get today's date in ISO format for Appwrite query
  const getTodayDateRange = () => {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    return {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString(),
    };
  };

  // Function to fetch daily statistics
  const fetchDailyStats = async () => {
    try {
      setStatsLoading(true);
      const { start, end } = getTodayDateRange();

      // Fetch today's orders
      const ordersResponse = await databases.listDocuments(
        DBRESTAURANTE,
        COL_ORDERS,
        [
          Query.greaterThanEqual("$createdAt", start),
          Query.lessThan("$createdAt", end),
          Query.limit(1000), // High limit to get all today's orders
        ]
      );

      const todayOrders = ordersResponse.documents;

      // Calculate profit (sum of all paid orders)
      const paidOrders = todayOrders.filter((order) => order.paid === true);
      const profit = paidOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0
      );

      // Count total orders
      const ordersCount = todayOrders.length;

      // For reservations, we'll count orders with "reserved" status or specific condition
      // Since we don't have a separate reservations table, we'll count future orders or specific status
      const reservations = todayOrders.filter(
        (order) => order.status === "reserved" || order.status === "reservado"
      ).length;

      setDailyStats({
        profit: profit,
        orders: ordersCount,
        reservations: reservations,
      });
    } catch (error) {
      console.error("Error fetching daily stats:", error);
      setDailyStats({ profit: 0, orders: 0, reservations: 0 });
    } finally {
      setStatsLoading(false);
    }
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Fetch all menu items for order display
  const fetchMenuItems = async () => {
    try {
      const menuResponse = await databases.listDocuments(
        DBRESTAURANTE,
        COL_MENU,
        [Query.limit(1000), Query.orderAsc("category"), Query.orderAsc("nome")]
      );
      setMenuItems(menuResponse.documents);
    } catch (error) {
      console.error("Error fetching menu items:", error);
    }
  };

  // Fetch orders for specific table
  const fetchTableOrders = async (tableNumber) => {
    try {
      setOrdersLoading(true);

      const ordersResponse = await databases.listDocuments(
        DBRESTAURANTE,
        COL_ORDERS,
        [
          Query.contains("numeroMesa", [tableNumber]),
          Query.orderDesc("$createdAt"),
          Query.limit(100),
        ]
      );

      setTableOrders(ordersResponse.documents);
    } catch (error) {
      console.error("Error fetching table orders:", error);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Get menu item details for an order
  const getMenuItemForOrder = (menuId) => {
    return menuItems.find((item) => item.$id === menuId);
  };

  // Toggle order status: pendente -> preparando -> concluido (final)
  const toggleOrderStatus = async (orderId, currentStatus) => {
    try {
      setUpdatingStatus(orderId);

      // If already completed, don't allow changes
      if (currentStatus === "concluido") {
        setUpdatingStatus(null);
        return;
      }

      let newStatus;
      let updateData = {};

      switch (currentStatus) {
        case "pendente":
          newStatus = "preparando";
          updateData = {
            status: newStatus,
            chef_id: user?.$id,
          };
          break;
        case "preparando":
          newStatus = "concluido";
          updateData = {
            status: newStatus,
            concluidoEm: new Date().toLocaleString("pt-PT", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }),
          };
          break;
        default:
          newStatus = "pendente";
          updateData = { status: newStatus };
      }

      await databases.updateDocument(
        DBRESTAURANTE,
        COL_ORDERS,
        orderId,
        updateData
      );

      // Refresh orders for the selected table
      if (selectedTable) {
        fetchTableOrders(selectedTable);
      }
    } catch (error) {
      console.error("Error updating order status:", error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Update order notes
  const updateOrderNotes = async (orderId, notes) => {
    try {
      await databases.updateDocument(DBRESTAURANTE, COL_ORDERS, orderId, {
        notes,
      });

      // Refresh orders for the selected table
      if (selectedTable) {
        fetchTableOrders(selectedTable);
      }
    } catch (error) {
      console.error("Error updating order notes:", error);
    }
  };

  // Delete order item
  const deleteOrderItem = async (orderId) => {
    try {
      await databases.deleteDocument(DBRESTAURANTE, COL_ORDERS, orderId);

      // Refresh orders for the selected table
      if (selectedTable) {
        fetchTableOrders(selectedTable);
      }
    } catch (error) {
      console.error("Error deleting order:", error);
    }
  };

  // Handle table selection for order management
  const selectTableForOrders = (tableNumber) => {
    setSelectedTable(tableNumber);
    fetchTableOrders(tableNumber);
  };

  // Handle checkout redirect
  const handleCheckout = () => {
    // TODO: Redirect to checkout page with selected table
    router.push(`/checkout/${selectedTable}`);
  };

  // Handle add new order redirect
  const handleAddOrder = () => {
    router.push(`/order/${selectedTable}`);
  };

  // Calculate time elapsed since order creation
  const getTimeElapsed = (createdAt) => {
    if (!createdAt) return "Sem data";

    const now = new Date();
    const orderTime = new Date(createdAt);
    const diffMs = now - orderTime;

    // Convert to minutes
    const minutes = Math.floor(diffMs / (1000 * 60));

    if (minutes < 1) {
      return "Agora mesmo";
    } else if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h ${remainingMinutes}min`;
      }
    }
  };

  // Get display time based on order status
  const getOrderTime = (order) => {
    if (order.status === "concluido" && order.concluidoEm) {
      return `Concluído: ${order.concluidoEm}`;
    } else {
      return getTimeElapsed(order.$createdAt);
    }
  };

  // Get time class for styling based on elapsed time and status
  const getTimeClass = (order) => {
    if (order.status === "concluido") {
      return "time-completed";
    }

    if (!order.$createdAt) return "";

    const now = new Date();
    const orderTime = new Date(order.$createdAt);
    const diffMs = now - orderTime;
    const minutes = Math.floor(diffMs / (1000 * 60));

    if (minutes < 15) {
      return "time-recent"; // Green - less than 15 minutes
    } else if (minutes < 30) {
      return "time-medium"; // Amber - 15-30 minutes
    } else {
      return "time-urgent"; // Red - more than 30 minutes
    }
  };

  // Loading spinner component
  const LoadingSpinner = ({ size = 24 }) => (
    <Loader2 size={size} className="loading-spinner" />
  );

  // Skeleton component for navigation items
  const NavItemSkeleton = () => (
    <div className="nav-item-skeleton">
      <div className="skeleton-icon"></div>
      <div className="skeleton-text"></div>
      <div className="skeleton-count"></div>
    </div>
  );

  // Show enhanced loading state
  if (loading) {
    return (
      <div className="dashboard">
        <Header />

        <div className="dashboard__main">
          <aside className="dashboard__sidebar dashboard__sidebar--open">
            <nav className="dashboard__nav">
              <h3 className="dashboard__nav-title">Menu Principal</h3>

              {Array.from({ length: 4 }).map((_, index) => (
                <NavItemSkeleton key={index} />
              ))}
            </nav>

            <div className="dashboard__sidebar-footer">
              <div className="version-text">Desenvolvido por João Monteiro</div>
            </div>
          </aside>

          <main className="dashboard__content">
            <div className="dashboard__layout">
              <div className="dashboard__layout-left">
                <div className="loading-content">
                  <LoadingSpinner size={48} />
                  <h3>A carregar painel...</h3>
                  <p>Por favor aguarde</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Fixed Header */}
      <Header
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        showMobileToggle={true}
      />

      {/* Main Container */}
      <div className="dashboard__main">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="mobile-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Fixed Sidebar */}
        <aside
          className={`dashboard__sidebar ${
            sidebarOpen ? "dashboard__sidebar--open" : ""
          }`}
        >
          {/* Mobile close button */}
          <button
            className="mobile-sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>

          {/* Navigation Section */}
          <nav className="dashboard__nav">
            <h3 className="dashboard__nav-title">Menu Principal</h3>

            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeNav === item.name;
              return (
                <div
                  key={item.name}
                  onClick={() => setActiveNav(item.name)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setActiveNav(item.name);
                    }
                  }}
                  className={`nav-item ${isActive ? "nav-item--active" : ""}`}
                  style={{
                    "--item-color": item.color,
                    color: isActive ? item.color : "#64748b",
                    background: isActive ? `${item.color}08` : "#ffffff",
                    borderColor: isActive ? `${item.color}20` : "#e2e8f0",
                    borderWidth: isActive ? "2px" : "1px",
                    boxShadow: isActive
                      ? `0 2px 8px 0 ${item.color}15`
                      : "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div className="nav-item__content">
                    <IconComponent size={20} />
                    <span>{item.name}</span>
                  </div>
                  <span
                    className="nav-item__count"
                    style={{
                      background: isActive ? item.color : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#64748b",
                    }}
                  >
                    {item.count}
                  </span>
                </div>
              );
            })}
          </nav>

          {/* Bottom Section */}
          <div className="dashboard__sidebar-footer">
            <div className="version-text">Desenvolvido por João Monteiro</div>
          </div>
        </aside>

        {/* Main Content Area - Scrollable */}
        <main className="dashboard__content">
          <div className="dashboard__layout">
            {/* Left side - RestLayout or Order Management */}
            <div className="dashboard__layout-left">
              {selectedTable ? (
                // Order Management Interface
                <div className="order-management">
                  <div className="order-header">
                    <button
                      onClick={() => setSelectedTable(null)}
                      className="back-button"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <h2>Pedidos - Mesa {selectedTable}</h2>
                    <div className="order-header-actions">
                      <button
                        onClick={handleAddOrder}
                        className="add-order-button"
                        title="Adicionar novo pedido"
                      >
                        <Plus size={20} />
                        Novo Pedido
                      </button>
                      <button
                        onClick={handleCheckout}
                        className="checkout-button"
                        disabled={tableOrders.length === 0}
                      >
                        <CreditCard size={20} />
                        Checkout
                      </button>
                    </div>
                  </div>

                  {ordersLoading ? (
                    <div className="orders-loading">
                      <LoadingSpinner size={48} />
                      <p>A carregar pedidos...</p>
                    </div>
                  ) : tableOrders.length === 0 ? (
                    <div className="no-orders">
                      <UtensilsCrossed size={48} />
                      <h3>Nenhum pedido encontrado</h3>
                      <p>Esta mesa não tem pedidos ativos</p>
                    </div>
                  ) : (
                    <div className="orders-list">
                      {tableOrders.map((order) => {
                        const menuItem = getMenuItemForOrder(order.menu_id);
                        const isEditing = editingNote === order.$id;

                        return (
                          <div key={order.$id} className="order-item">
                            <div className="order-item-image">
                              <UtensilsCrossed size={40} />
                            </div>

                            <div className="order-item-info">
                              <h4>{menuItem?.nome || "Item não encontrado"}</h4>
                              <div className="order-item-price">
                                €{(order.total || 0).toFixed(2)}
                              </div>
                              <div
                                className={`order-item-time ${getTimeClass(
                                  order
                                )}`}
                              >
                                <Clock size={12} />
                                {getOrderTime(order)}
                              </div>

                              {/* Notes section */}
                              {isEditing ? (
                                <div className="note-editor">
                                  <textarea
                                    value={tempNote}
                                    onChange={(e) =>
                                      setTempNote(e.target.value)
                                    }
                                    placeholder="Adicionar nota..."
                                    rows={2}
                                  />
                                  <div className="note-actions">
                                    <button
                                      onClick={() => {
                                        updateOrderNotes(order.$id, tempNote);
                                        setEditingNote(null);
                                        setTempNote("");
                                      }}
                                      className="save-note"
                                    >
                                      <CheckCircle size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingNote(null);
                                        setTempNote("");
                                      }}
                                      className="cancel-note"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                order.notes && (
                                  <div className="order-notes">
                                    <MessageSquare size={12} />
                                    {order.notes}
                                  </div>
                                )
                              )}
                            </div>

                            <div className="order-item-actions">
                              {/* Status toggle button */}
                              <button
                                onClick={() =>
                                  toggleOrderStatus(order.$id, order.status)
                                }
                                disabled={
                                  updatingStatus === order.$id ||
                                  order.status === "concluido"
                                }
                                className={`status-toggle status-${order.status}`}
                                title={
                                  order.status === "concluido"
                                    ? "Pedido concluído"
                                    : `Status: ${order.status}`
                                }
                              >
                                {updatingStatus === order.$id ? (
                                  <LoadingSpinner size={16} />
                                ) : (
                                  <>
                                    {order.status === "pendente" && (
                                      <Clock size={16} />
                                    )}
                                    {order.status === "preparando" && (
                                      <ChefHat size={16} />
                                    )}
                                    {order.status === "concluido" && (
                                      <CheckCircle size={16} />
                                    )}
                                    <span>{order.status}</span>
                                  </>
                                )}
                              </button>

                              {/* Edit note button */}
                              <button
                                onClick={() => {
                                  setEditingNote(order.$id);
                                  setTempNote(order.notes || "");
                                }}
                                className="edit-note"
                                title="Editar nota"
                              >
                                <MessageSquare size={16} />
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => deleteOrderItem(order.$id)}
                                className="delete-order"
                                title="Eliminar item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                // Default RestLayout
                <RestLayout
                  user={user}
                  onEditRedirect={() => router.push("/RestLayout")}
                  onTableSelect={selectTableForOrders}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
