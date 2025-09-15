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
} from "lucide-react";
import "./page.scss";
import RestLayout from "../components/RestLayout";
import { useApp } from "@/contexts/AppContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  databases,
  DBRESTAURANTE,
  COL_ORDERS,
  COL_TABLES,
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
        }
      }
    );

    return () => {
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [user, loading, client]);

  const navItems = [
    { name: "MENU", count: 12, color: "#3b82f6", icon: Menu },
    { name: "PEDIDOS", count: 5, color: "#f59e0b", icon: ShoppingCart },
    { name: "STOCK", count: 8, color: "#10b981", icon: Package },
    { name: "RESERVAS", count: 3, color: "#ef4444", icon: Calendar },
  ];

  // Function to get role styling
  const getRoleInfo = (userLabels) => {
    // Get the first label as the primary role
    const primaryRole = userLabels?.[0]?.toLowerCase();

    switch (primaryRole) {
      case "manager":
        return { icon: Crown, label: "Manager", color: "#f59e0b" };
      case "chef":
        return { icon: ChefHat, label: "Chef", color: "#10b981" };
      case "garcom":
      case "waiter":
        return { icon: User, label: "Garçom", color: "#3b82f6" };
      case "staff":
      default:
        return { icon: Shield, label: "Staff", color: "#64748b" };
    }
  };

  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
      router.push("/login");
      console.log("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

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

  // Show loading state
  if (loading) {
    return (
      <div className="dashboard">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <div>Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Fixed Header */}
      <header className="dashboard__header">
        {/* Left Section - Logo */}
        <div className="dashboard__header-left">
          {/* Mobile menu toggle */}
          <button
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={20} /> : <MenuIcon size={20} />}
          </button>

          <div className="logo">
            <img src="/logo-icon.svg" alt="Logo" />
          </div>
          <div className="logo-text">
            <div className="logo-text__title">Mesa+</div>
            <div className="logo-text__subtitle">Gestão De Restaurante</div>
          </div>
        </div>

        {/* Center Section - Search */}
        <div className="dashboard__search">
          <Search size={20} className="dashboard__search-icon" />
          <input
            type="text"
            placeholder="Pesquisar..."
            className="dashboard__search-input"
          />
        </div>

        {/* Right Section - User Actions */}
        <div className="dashboard__header-right">
          <button className="notification-btn">
            <Bell size={20} />
            <div className="notification-badge" />
          </button>

          <div className="user-section">
            <div className="user-avatar">
              <User size={18} />
            </div>

            {/* User Name */}
            <div className="user-name">{user?.name || "Utilizador"}</div>

            {/* Role Badge with tooltip - only icon */}
            {(() => {
              const roleInfo = getRoleInfo(user?.labels);
              const IconComponent = roleInfo.icon;
              return (
                <div
                  className="role-badge-icon"
                  style={{
                    backgroundColor: `${roleInfo.color}15`,
                    borderColor: `${roleInfo.color}30`,
                    color: roleInfo.color,
                  }}
                  title={roleInfo.label} // Tooltip
                >
                  <IconComponent size={14} />
                </div>
              );
            })()}

            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

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
            {/* Left side - RestLayout */}
            <div className="dashboard__layout-left">
              <RestLayout
                user={user}
                onEditRedirect={() => router.push("/RestLayout")}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
