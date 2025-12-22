"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Settings,
  User,
  UserCircle,
  Menu,
  X,
  Users,
  LogOut,
} from "lucide-react";
import "./header.scss";
import { logout } from "../../lib/auth";
import { getImageUrl } from "../../lib/api";

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
    const API_BASE_URL =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Handle custom API URLs for profile images
    const imageUrl = getImageUrl("imagens-perfil", src);

    if (hasError || !imageUrl) {
      return (
        <div
          className={`${className} flex items-center justify-center ${
            isCircular ? "rounded-full" : "rounded-lg"
          }`}
          style={{
            width: typeof size === "number" ? `${size}px` : size,
            height: typeof size === "number" ? `${size}px` : size,
            background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
          }}
        >
          <UserCircle
            size={typeof size === "number" ? Math.floor(size * 0.65) : 24}
            style={{ color: "#94a3b8" }}
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
          background: "#ffffff",
        }}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  };

  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });
  const userButtonRef = useRef(null);

  // Navigation items
  const navItems = [
    "Painel",
    "Ementa",
    "Stock",
    "Reservas",
    "Mesas",
    "Presenças",
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

        {/* Profile Dropdown */}
        <div className="user-menu-container" ref={userButtonRef}>
          <button
            className="header-profile-button"
            onClick={toggleUserMenu}
            title={username || "Menu de utilizador"}
          >
            <div className="header-profile-avatar">
              <ProfileImage
                src={profileImg}
                alt={username || "Utilizador"}
                size={32}
                isCircular={true}
              />
            </div>
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen &&
            createPortal(
              <div
                className="user-dropdown"
                style={{
                  position: "fixed",
                  top: `${dropdownPosition.top}px`,
                  right: `${dropdownPosition.right}px`,
                }}
              >
                <div className="user-dropdown-header">
                  <div className="user-dropdown-avatar">
                    <ProfileImage
                      src={profileImg}
                      alt={username || "Utilizador"}
                      size={32}
                      isCircular={true}
                    />
                  </div>
                  <div className="user-dropdown-info">
                    <div className="user-dropdown-name">
                      {username || "Utilizador"}
                    </div>
                    {userLabels && userLabels.length > 0 && (
                      <div className="user-dropdown-role">
                        {userLabels.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="user-dropdown-divider" />
                {showViewToggle && isManager && currentView && (
                  <>
                    <button
                      className="user-dropdown-item"
                      onClick={() => {
                        handleViewToggle();
                        setIsUserMenuOpen(false);
                      }}
                    >
                      <Users size={16} />
                      <span>
                        {currentView === "manager"
                          ? "Mudar para Vista Funcionário"
                          : "Mudar para Vista Gestor"}
                      </span>
                    </button>
                    <div className="user-dropdown-divider" />
                  </>
                )}
                <button
                  className="user-dropdown-item"
                  onClick={handleProfileClick}
                >
                  <User size={16} />
                  <span>O Seu Perfil</span>
                </button>
                <button
                  className="user-dropdown-item"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    router.push("/settings");
                  }}
                >
                  <Settings size={16} />
                  <span>Definições</span>
                </button>
                <div className="user-dropdown-divider" />
                <button
                  className="user-dropdown-item danger"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Terminar Sessão</span>
                </button>
              </div>,
              document.body
            )}
        </div>

        <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
          {isMobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
