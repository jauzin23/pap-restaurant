"use client";

import React from "react";
import {
  User,
  Crown,
  Shield,
  LogOut,
  Search,
  ChefHat,
  Bell,
  X,
  Menu as MenuIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import "./header.scss";

interface HeaderProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  showMobileToggle?: boolean;
}

export default function Header({
  sidebarOpen = false,
  setSidebarOpen,
  showMobileToggle = false,
}: HeaderProps) {
  const { user, account } = useApp();
  const router = useRouter();

  // Function to get role styling
  const getRoleInfo = (userLabels: string[] | undefined) => {
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

  return (
    <header className="dashboard__header">
      {/* Left Section - Logo */}
      <div className="dashboard__header-left">
        {/* Mobile menu toggle */}
        {showMobileToggle && setSidebarOpen && (
          <button
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={20} /> : <MenuIcon size={20} />}
          </button>
        )}

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
  );
}
