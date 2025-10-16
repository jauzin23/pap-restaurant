"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Settings,
  Bell,
  User,
  UserCircle,
  Menu,
  X,
  Eye,
  Users,
  LogOut,
} from "lucide-react";
import "./Header.scss";
import { logout } from "../../lib/auth";

const Header = ({
  activeNavItem = "Painel",
  onNavClick,
  user,
  username = "",
  userLabels = [],
  profileImg = "",
  isManager = false,
  currentView = null,
  onViewToggle,
  showViewToggle = false,
  wsConnected = false,
  wsReconnecting = false,
}) => {
  // Profile Image Component with fallback
  const ProfileImage = ({
    src,
    alt,
    className,
    size = 24,
    isCircular = false,
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
          backgroundColor: "#f8fafc", // Light grayish-white background for transparent images
        }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          style={{
            backgroundColor: "transparent", // Ensure the img itself doesn't add background
          }}
        />
      </div>
    );
  };

  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const userButtonRef = useRef(null);

  // Navigation items
  const navItems = [
    "Painel",
    "Ementa",
    "Reservas",
    "Mesas",
    "Financeiro",
    "Relatórios",
  ];

  // Handle navigation clicks
  const handleNavClick = (navItem) => {
    if (onNavClick) {
      onNavClick(navItem);
    }
    // Close mobile menu when nav item is clicked
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
      document.body.style.overflow = "unset";
    }
  };

  // Toggle view between manager and staff
  const handleViewToggle = () => {
    if (onViewToggle) {
      onViewToggle();
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

  // Toggle user menu
  const toggleUserMenu = () => {
    if (!isUserMenuOpen && userButtonRef.current) {
      const rect = userButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  // Navigate to profile
  const handleProfileClick = () => {
    setIsUserMenuOpen(false);
    if (user?.id) {
      router.push(`/profile/${user.id}`);
    } else {
      router.push("/profile");
    }
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    const newMenuState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newMenuState);

    // Prevent body scrolling when menu is open
    if (newMenuState) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isUserMenuOpen &&
        !event.target.closest(".user-menu-container") &&
        !event.target.closest(".user-dropdown")
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMobileMenuOpen &&
        !event.target.closest(".nav") &&
        !event.target.closest(".mobile-menu-toggle")
      ) {
        setIsMobileMenuOpen(false);
        document.body.style.overflow = "unset";
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  return (
    <header className="header nav-fade-in">
      <div className="logo hover-scale">Mesa+</div>
      <nav
        className={`nav ${isMobileMenuOpen ? "nav-mobile-open" : ""}`}
        onClick={(e) => {
          // Close menu if clicking on the nav background (not on buttons)
          if (e.target === e.currentTarget) {
            toggleMobileMenu();
          }
        }}
      >
        {navItems.map((item, index) => (
          <button
            key={item}
            className={`nav-btn hover-button stagger-item ${
              activeNavItem === item ? "active" : ""
            }`}
            onClick={() => handleNavClick(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="header-actions nav-fade-in">
        {/* WebSocket Connection Indicator - Only show when reconnecting */}
        {wsReconnecting && (
          <div className="ws-status reconnecting" title="A reconectar...">
            <div className="ws-indicator pulsing" />
          </div>
        )}
        {/* View Switcher for Managers */}
        {showViewToggle && isManager && currentView && (
          <button
            className="icon-btn view-toggle"
            onClick={handleViewToggle}
            title={`Mudar para Vista ${
              currentView === "manager" ? "Funcionário" : "Gestor"
            }`}
          >
            {currentView === "manager" ? (
              <Eye size={18} />
            ) : (
              <Users size={18} />
            )}
          </button>
        )}
        <button className="icon-btn">
          <Settings size={18} />
        </button>
        <button className="icon-btn">
          <Bell size={18} />
        </button>
        <div className="user-menu-container">
          <button
            ref={userButtonRef}
            className="icon-btn user-menu-trigger"
            onClick={toggleUserMenu}
            title="Menu do Usuário"
          >
            <User size={18} />
          </button>
        </div>
        {isUserMenuOpen && typeof document !== 'undefined' && createPortal(
          <div
            className="user-dropdown"
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
            }}
          >
            <div className="user-dropdown-header">
              <div className="user-avatar">
                <ProfileImage
                  src={profileImg}
                  alt={username || "Usuário"}
                  size={40}
                  isCircular={true}
                />
              </div>
              <div className="user-info">
                <div className="user-name">{username || "Usuário"}</div>
                <div className="user-role">
                  {userLabels.length > 0
                    ? userLabels.join(", ")
                    : "Sem Cargo"}
                </div>
              </div>
            </div>
            <div className="user-dropdown-divider"></div>
            <div className="user-dropdown-menu">
              <button className="dropdown-item" onClick={handleProfileClick}>
                <User size={16} />
                <span>Perfil</span>
              </button>
              <button
                className="dropdown-item logout-item"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span>Sair</span>
              </button>
            </div>
          </div>,
          document.body
        )}
        <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
          {isMobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
