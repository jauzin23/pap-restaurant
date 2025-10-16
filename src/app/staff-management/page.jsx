"use client";

import React, { useState, useEffect } from "react";
import { BackgroundBeams } from "../components/BackgroundBeams";
import Header from "../components/Header";
import {
  Clock,
  MapPin,
  Phone,
  Mail,
  Calendar,
  MoreVertical,
  UserCircle,
  Briefcase,
  Settings,
  Trophy,
  TrendingUp,
  Coffee,
  Users,
  User,
  MessageCircle,
  Search,
} from "lucide-react";
import "./page.scss";
import { auth, users, profileImages, API_FILES_URL } from "../../lib/api";
import { isAuthenticated } from "../../lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const StaffManagement = () => {
  // State declarations
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [profileImg, setProfileImg] = useState("");
  const [user, setUser] = useState(null);
  const [userLabels, setUserLabels] = useState([]);
  const [activeNavItem, setActiveNavItem] = useState("Equipe");
  const [expandedCards, setExpandedCards] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [staffData, setStaffData] = useState([]);

  // Function to toggle card details
  const toggleCardDetails = (staffId) => {
    setExpandedCards((prev) => ({
      ...prev,
      [staffId]: !prev[staffId],
    }));
  };

  // Function to filter staff data
  const filteredStaffData = staffData.filter((staff) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      staff.name.toLowerCase().includes(query) ||
      staff.email.toLowerCase().includes(query) ||
      (staff.telefone && staff.telefone.toLowerCase().includes(query)) ||
      (staff.role && staff.role.toLowerCase().includes(query)) ||
      (staff.username && staff.username.toLowerCase().includes(query))
    );
  });

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
  };

  // Check if user is a manager
  const isManager =
    userLabels.includes("manager") ||
    userLabels.includes("Manager") ||
    userLabels.includes("gerente") ||
    userLabels.includes("Gerente");

  // Function to handle navigation clicks
  const handleNavClick = (navItem) => {
    setActiveNavItem(navItem);
    if (navItem === "Painel") {
      window.location.href = "/pagina-teste-new";
    }
  };

  // Function to get status color and text
  const getStatusInfo = (status) => {
    switch (status) {
      case "online":
        return { color: "#10b981", text: "Online", dotClass: "online" };
      case "offline":
        return { color: "#6b7280", text: "Offline", dotClass: "offline" };
      default:
        return { color: "#6b7280", text: "Offline", dotClass: "offline" };
    }
  };

  // Function to get performance color
  const getPerformanceColor = (performance) => {
    if (performance >= 90) return "#10b981";
    if (performance >= 80) return "#f59e0b";
    if (performance >= 70) return "#ef4444";
    return "#6b7280";
  };

  // Authentication guard - redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = "/login";
      return;
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const currentUser = await auth.get();
        setUsername(
          currentUser.name || currentUser.username || currentUser.email
        );
        setUser(currentUser);
        const labels = currentUser.labels || [];
        setUserLabels(labels);

        const userId = currentUser.$id || currentUser.id;

        // Load profile image
        try {
          const bucketResult = await profileImages.getBucketInfo(userId);
          let profileImageFile = "";

          if (bucketResult.documents && bucketResult.documents.length > 0) {
            profileImageFile = bucketResult.documents[0].bucket_id;
          }

          if (profileImageFile) {
            const fileUrl = profileImages.getPreviewUrl(profileImageFile, {
              width: 400,
              height: 400,
              quality: 80,
            });
            setProfileImg(fileUrl);
          } else if (currentUser.profile_image) {
            const fileUrl = `${API_BASE_URL}/files/imagens-perfil/${currentUser.profile_image}`;
            setProfileImg(fileUrl);
          } else {
            const fallbackUrl = profileImages.getPreviewUrl(userId, {
              width: 400,
              height: 400,
              quality: 80,
            });
            setProfileImg(fallbackUrl);
          }
        } catch (err) {
          console.error("Error loading profile image:", err);
          setProfileImg("");
        }

        // Fetch all staff users
        try {
          const response = await users.list();
          console.log("Fetched users:", response);

          // Extract users array from response
          const allUsers = response.users || response || [];

          if (!Array.isArray(allUsers)) {
            console.error("Users data is not an array:", allUsers);
            setStaffData([]);
            setIsLoading(false);
            return;
          }

          // Transform user data to match staff card format
          const transformedStaff = allUsers.map((u) => {
            // Get primary role from labels
            const role =
              u.labels && u.labels.length > 0 ? u.labels[0] : "Funcionário";

            // Calculate time since account creation
            const joinDate = u.created_at ? new Date(u.created_at) : new Date();
            const monthsSinceJoin = Math.floor(
              (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            );
            const experience =
              monthsSinceJoin > 12
                ? `${Math.floor(monthsSinceJoin / 12)} ${
                    Math.floor(monthsSinceJoin / 12) === 1 ? "ano" : "anos"
                  }`
                : `${monthsSinceJoin} ${
                    monthsSinceJoin === 1 ? "mês" : "meses"
                  }`;

            return {
              id: u.id || u.$id,
              name: u.name || u.username || u.email,
              username: u.username,
              role: role,
              email: u.email,
              telefone: u.telefone || "",
              hoursWorked: u.hrs || 0,
              status: u.status || "offline",
              profileImg: u.profile_image
                ? `${API_BASE_URL}/files/imagens-perfil/${u.profile_image}`
                : "",
              joinDate: u.created_at || new Date().toISOString(),
              performance: 85, // Default performance - could be calculated from actual data
              specialties: u.labels || [],
              availability: u.contrato || "N/A",
              lastActive: u.status === "online" ? "Online agora" : "Offline",
              totalOrders: 0, // Could be fetched from orders if needed
              experience: experience,
              ferias: u.ferias || false,
              contrato: u.contrato || "",
            };
          });

          setStaffData(transformedStaff);
        } catch (err) {
          console.error("Error fetching staff users:", err);
          setStaffData([]);
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error loading data:", err);
        setUsername("");
        setProfileImg("");
        setStaffData([]);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
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

        <div className="loading-screen loading-scale-in">
          <div className="loading-content loading-slide-up">
            <div className="logo-loading loading-logo">Mesa+</div>
            <div
              className="spinner loading-spinner"
              style={{
                borderTopColor: "#ff6b35",
                borderRightColor: "#ff6b35",
                borderBottomColor: "#ff6b35",
              }}
            />
            <div className="loading-text loading-text">A carregar...</div>
          </div>
        </div>

        <style>{`
          .loading-screen {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
          }
          
          .loading-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2rem;
          }
          
          .logo-loading {
            font-size: 2.5rem;
            font-weight: 700;
            color: #1a1a1a;
            letter-spacing: -0.02em;
          }
          
          .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid #f0f0f0;
            border-radius: 50%;
          }
          
          .loading-text {
            font-size: 1.1rem;
            font-weight: 500;
            color: #666;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="staff-management-dashboard fade-in">
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

      <Header
        activeNavItem={activeNavItem}
        onNavClick={handleNavClick}
        user={user}
        username={username}
        userLabels={userLabels}
        profileImg={profileImg}
        isManager={isManager}
        currentView="staff"
        showViewToggle={false}
      />

      <main className="main-content fade-in-delayed">
        <div className="staff-management-container">
          <h1 className="page-title slide-in-up">Equipa</h1>

          {/* Search Bar */}
          <div className="search-container fade-in-delayed">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Pesquisar por nome, email, telefone ou cargo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {/* Staff Stats */}
          <div className="staff-stats-bar fade-in-delayed">
            <div className="stat-card scale-in">
              <div className="stat-icon">
                <Users size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{filteredStaffData.length}</div>
                <div className="stat-label">Funcionários Ativos</div>
              </div>
            </div>
            <div className="stat-card scale-in">
              <div className="stat-icon online">
                <Users size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">
                  {
                    filteredStaffData.filter((s) => s.status === "online")
                      .length
                  }
                </div>
                <div className="stat-label">Online</div>
              </div>
            </div>
            <div className="stat-card scale-in">
              <div className="stat-icon">
                <Clock size={20} />
              </div>
              <div className="stat-info">
                <div className="stat-value">
                  {Math.round(
                    filteredStaffData.reduce(
                      (sum, s) => sum + s.hoursWorked,
                      0
                    ) / filteredStaffData.length
                  )}
                  h
                </div>
                <div className="stat-label">Horas Médias/Semana</div>
              </div>
            </div>
          </div>

          {/* Staff Grid */}
          <div className="staff-grid slide-in-up">
            {filteredStaffData.map((staff, index) => {
              const statusInfo = getStatusInfo(staff.status);
              const performanceColor = getPerformanceColor(staff.performance);
              const isExpanded = expandedCards[staff.id];

              return (
                <div
                  key={staff.id}
                  className="staff-card hover-lift"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="staff-card-header">
                    <div className="staff-avatar-container">
                      <ProfileImage
                        src={staff.profileImg}
                        alt={staff.name}
                        size={60}
                        isCircular={true}
                        className="staff-avatar"
                      />
                      <div
                        className={`status-indicator ${statusInfo.dotClass}`}
                      ></div>
                    </div>
                    <div className="staff-actions">
                      <button
                        className="message-btn-header"
                        onClick={() => {
                          console.log(`Sending message to ${staff.name}`);
                        }}
                        title="Enviar mensagem"
                      >
                        <MessageCircle size={16} />
                      </button>
                      <button className="staff-menu-btn">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="staff-info">
                    <h3 className="staff-name">{staff.name}</h3>
                    <div className="staff-role-experience">
                      <p className="staff-role">{staff.role}</p>
                      <div className="experience-badge">
                        <Briefcase size={12} />
                        <span>{staff.experience}</span>
                      </div>
                    </div>
                    <div className="staff-status">
                      <span
                        className="status-text"
                        style={{ color: statusInfo.color }}
                      >
                        {statusInfo.text}
                      </span>
                      <span className="last-active">• {staff.lastActive}</span>
                    </div>
                  </div>

                  <div className="staff-metrics">
                    <div className="metric">
                      <div className="metric-icon">
                        <Clock size={14} />
                      </div>
                      <div className="metric-info">
                        <span className="metric-value">
                          {staff.hoursWorked}h
                        </span>
                        <span className="metric-label">Horas</span>
                      </div>
                    </div>
                    <div className="metric">
                      <div className="metric-icon">
                        <Briefcase size={14} />
                      </div>
                      <div className="metric-info">
                        <span className="metric-value">
                          {staff.contrato || "N/A"}
                        </span>
                        <span className="metric-label">Contrato</span>
                      </div>
                    </div>
                    <div className="metric">
                      <div className="metric-icon">
                        <Calendar size={14} />
                      </div>
                      <div className="metric-info">
                        <span
                          className="metric-value"
                          style={{
                            color: staff.ferias ? "#f59e0b" : "#10b981",
                          }}
                        >
                          {staff.ferias ? "Férias" : "Ativo"}
                        </span>
                        <span className="metric-label">Estado</span>
                      </div>
                    </div>
                  </div>

                  <div className="staff-specialties">
                    {staff.specialties.slice(0, 3).map((specialty, idx) => (
                      <span key={idx} className="specialty-tag">
                        {specialty}
                      </span>
                    ))}
                    {staff.specialties.length === 0 && (
                      <span className="specialty-tag" style={{ opacity: 0.5 }}>
                        Sem labels
                      </span>
                    )}
                  </div>

                  <div className="staff-contact-section">
                    <button
                      className={`contact-trigger ${
                        isExpanded ? "expanded" : ""
                      }`}
                      onClick={() => toggleCardDetails(staff.id)}
                    >
                      <div className="contact-trigger-content">
                        <span className="contact-label">
                          Informações de Contacto
                        </span>
                      </div>
                    </button>

                    <div
                      className={`staff-contact-details ${
                        isExpanded ? "expanded" : ""
                      }`}
                    >
                      <div className="contact-item">
                        <User size={12} />
                        <span>@{staff.username || "N/A"}</span>
                      </div>
                      <div className="contact-item">
                        <Mail size={12} />
                        <span>{staff.email}</span>
                      </div>
                      {staff.telefone && (
                        <div className="contact-item">
                          <Phone size={12} />
                          <span>{staff.telefone}</span>
                        </div>
                      )}
                      <div className="contact-item">
                        <Calendar size={12} />
                        <span>
                          Desde{" "}
                          {new Date(staff.joinDate).toLocaleDateString("pt-PT")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StaffManagement;
