"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import "./Sidebar.scss";
import {
  House,
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
  CreditCard,
  Trophy,
  Calendar,
} from "lucide-react";
import { logout } from "../../lib/auth";
import { getImageUrl } from "../../lib/api";

// Custom Restaurant Layout Icon
const RestLayoutIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 44.999 44.999"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g>
      <path d="M42.558,23.378l2.406-10.92c0.18-0.816-0.336-1.624-1.152-1.803c-0.816-0.182-1.623,0.335-1.802,1.151l-2.145,9.733h-9.647c-0.835,0-1.512,0.677-1.512,1.513c0,0.836,0.677,1.513,1.512,1.513h0.573l-3.258,7.713c-0.325,0.771,0.034,1.657,0.805,1.982c0.19,0.081,0.392,0.12,0.588,0.12c0.59,0,1.15-0.348,1.394-0.925l2.974-7.038l4.717,0.001l2.971,7.037c0.327,0.77,1.215,1.127,1.982,0.805c0.77-0.325,1.13-1.212,0.805-1.982l-3.257-7.713h0.573C41.791,24.564,42.403,24.072,42.558,23.378z" />
      <path d="M14.208,24.564h0.573c0.835,0,1.512-0.677,1.512-1.513c0-0.836-0.677-1.513-1.512-1.513H5.134L2.99,11.806C2.809,10.99,2,10.472,1.188,10.655c-0.815,0.179-1.332,0.987-1.152,1.803l2.406,10.92c0.153,0.693,0.767,1.187,1.477,1.187h0.573L1.234,32.28c-0.325,0.77,0.035,1.655,0.805,1.98c0.768,0.324,1.656-0.036,1.982-0.805l2.971-7.037l4.717-0.001l2.972,7.038c0.244,0.577,0.804,0.925,1.394,0.925c0.196,0,0.396-0.039,0.588-0.12c0.77-0.325,1.13-1.212,0.805-1.98L14.208,24.564z" />
      <path d="M24.862,31.353h-0.852V18.308h8.13c0.835,0,1.513-0.677,1.513-1.512s-0.678-1.513-1.513-1.513H12.856c-0.835,0-1.513,0.678-1.513,1.513c0,0.834,0.678,1.512,1.513,1.512h8.13v13.045h-0.852c-0.835,0-1.512,0.679-1.512,1.514s0.677,1.513,1.512,1.513h4.728c0.837,0,1.514-0.678,1.514-1.513S25.699,31.353,24.862,31.353z" />
    </g>
  </svg>
);

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
    { id: "Painel", label: "Painel", icon: House },
    { id: "Mesas", label: "Mesas", icon: RestLayoutIcon },
    { id: "Ementa", label: "Ementa", icon: UtensilsCrossed },
    { id: "Stock", label: "Stock", icon: Package },
    { id: "Reservas", label: "Reservas", icon: Calendar },
    { id: "Pagamentos", label: "Pagamentos", icon: CreditCard },
    { id: "Gamificação", label: "Gamificação", icon: Trophy },
    { id: "Staff", label: "Pessoal", icon: Users },
  ];

  // Profile Image Component
  const ProfileImage = ({ src, alt, size = 32, isCircular = false }) => {
    const [hasError, setHasError] = useState(false);
    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const imageUrl = getImageUrl("imagens-perfil", src);

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
