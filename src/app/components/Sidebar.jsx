"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import "./Sidebar.scss";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Package,
  LayoutGrid,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  User,
  LogOut,
} from "lucide-react";
import { logout } from "../../lib/auth";

const Sidebar = ({
  activeNavItem,
  onNavClick,
  isCollapsed: externalCollapsed,
  onToggle,
  user,
  username: propUsername,
  userLabels: propUserLabels,
  profileImg: propProfileImg,
}) => {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(externalCollapsed || false);

  const menuItems = [
    { id: "Painel", label: "Painel", icon: LayoutDashboard },
    { id: "Ementa", label: "Ementa", icon: UtensilsCrossed },
    { id: "Stock", label: "Stock", icon: Package },
    { id: "Mesas", label: "Mesas", icon: LayoutGrid },
    { id: "Staff", label: "Pessoal", icon: Users },
  ];

  // Profile Image Component
  const ProfileImage = ({ src, alt, size = 32, isCircular = false }) => {
    const [hasError, setHasError] = useState(false);
    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const getImageUrl = (imageSrc) => {
      if (!imageSrc) return null;
      if (imageSrc.startsWith("http")) return imageSrc;
      return `${API_BASE_URL}/files/imagens-perfil/${imageSrc}`;
    };

    const imageUrl = getImageUrl(src);

    if (hasError || !imageUrl) {
      return (
        <div
          className={`profile-placeholder ${isCircular ? "circular" : ""}`}
          style={{
            width: typeof size === "number" ? `${size}px` : size,
            height: typeof size === "number" ? `${size}px` : size,
          }}
        >
          <UserCircle
            size={typeof size === "number" ? Math.floor(size * 0.65) : 24}
          />
        </div>
      );
    }

    return (
      <div
        className={`profile-image ${isCircular ? "circular" : ""}`}
        style={{
          width: typeof size === "number" ? `${size}px` : size,
          height: typeof size === "number" ? `${size}px` : size,
        }}
      >
        <img src={imageUrl} alt={alt} onError={() => setHasError(true)} />
      </div>
    );
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    if (onToggle) {
      onToggle();
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Navigate to profile
  const handleProfileClick = () => {
    const userId = user?.$id || user?.id;
    if (userId) {
      router.push(`/profile/${userId}`);
    } else {
      router.push("/profile");
    }
  };

  // Use props if provided, otherwise fallback to user object
  const username = propUsername || user?.name || user?.username || "Utilizador";
  const userLabels = propUserLabels || user?.labels || [];
  const profileImg =
    propProfileImg || user?.profileImage || user?.profile_image || "";

  return (
    <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      {/* Sidebar Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <span>M+</span>
        </div>
        {!isCollapsed && <div className="brand-text">Mesa Plus</div>}
      </div>

      <hr className="sidebar-divider" />

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-heading">{!isCollapsed && "NAVEGAÇÃO"}</div>
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeNavItem === item.id;

          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => onNavClick(item.id)}
              title={isCollapsed ? item.label : ""}
              style={{ animationDelay: `${0.1 + index * 0.05}s` }}
            >
              <Icon size={18} />
              {!isCollapsed && <span className="nav-text">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <hr className="sidebar-divider" />

      {/* User Profile Section with Radix Dropdown */}
      <div className="sidebar-topbar">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="user-profile-btn" title={username}>
              <ProfileImage
                src={profileImg}
                alt={username}
                size={40}
                isCircular={true}
              />
              {!isCollapsed && (
                <div className="user-info">
                  <span className="user-name">{username}</span>
                  {userLabels && userLabels.length > 0 && (
                    <span className="user-role">{userLabels[0]}</span>
                  )}
                </div>
              )}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="user-dropdown"
              sideOffset={5}
              align="start"
              side="right"
            >
              <DropdownMenu.Item
                className="user-dropdown-item"
                onSelect={handleProfileClick}
              >
                <User size={16} />
                <span>Perfil</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className="user-dropdown-item"
                onSelect={() => router.push("/settings")}
              >
                <Settings size={16} />
                <span>Definições</span>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="user-dropdown-divider" />

              <DropdownMenu.Item
                className="user-dropdown-item danger"
                onSelect={handleLogout}
              >
                <LogOut size={16} />
                <span>Sair</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Sidebar Toggle */}
      <button className="sidebar-toggle" onClick={toggleSidebar}>
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
};

export default Sidebar;
