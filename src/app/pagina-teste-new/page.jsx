"use client";

import React, { useState, useEffect } from "react";
import { BackgroundBeams } from "../components/BackgroundBeams";
import BlurText from "../components/BlurText";
import Header from "../components/Header";
import "./page.scss";
import { auth, users, profileImages, API_FILES_URL } from "../../lib/api";
import { isAuthenticated } from "../../lib/auth";
import ManagerView from "../components/ManagerView";
import StaffView from "../components/StaffView";
import MenuComponent from "../components/MenuComponent";
import TableLayoutManager from "../components/TableLayout";
import { WebSocketProvider, useWebSocketContext } from "../../contexts/WebSocketContext";

const RestaurantDashboardContent = () => {
  const { socket, connected, reconnecting } = useWebSocketContext();
  // State declarations MUST come before any useEffect that uses them
  const [expandedSections, setExpandedSections] = useState({
    kitchen: false,
    inventory: false,
    staff: false,
    finances: false,
    tables: false,
  });
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffFetched, setStaffFetched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [profileImg, setProfileImg] = useState("");
  const [user, setUser] = useState(null);
  const [userLabels, setUserLabels] = useState([]);
  const [currentView, setCurrentView] = useState(null); // null initially, set after user loads
  const [activeNavItem, setActiveNavItem] = useState("Painel"); // Track active navigation item

  // Mock chart data for manager view - Daily revenue for the week
  const chartData = [
    { month: "Segunda", revenue: 2800 },
    { month: "Terça", revenue: 3200 },
    { month: "Quarta", revenue: 2950 },
    { month: "Quinta", revenue: 3600 },
    { month: "Sexta", revenue: 4200 },
    { month: "Sábado", revenue: 4800 },
    { month: "Domingo", revenue: 3400 },
  ];

  const chartConfig = {
    dataKey: "revenue",
    color: "#ff6b35",
    label: "Receita Diária (€)",
  };

  // Check if user is a manager (you can modify this logic based on your role system)
  const isManager =
    userLabels.includes("manager") ||
    userLabels.includes("Manager") ||
    userLabels.includes("gerente") ||
    userLabels.includes("Gerente");

  // Function to handle navigation clicks
  const handleNavClick = (navItem) => {
    setActiveNavItem(navItem);
    // Reset scroll to top when changing tabs
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Reset to dashboard view when clicking on navigation items (except Ementa)
    if (navItem !== "Ementa" && currentView) {
      // Keep the current view type but show dashboard
      // currentView will be used to determine which dashboard to show
    }
  };

  // Function to toggle between views (only for managers)
  const toggleView = () => {
    if (isManager && currentView) {
      setCurrentView((prev) => (prev === "manager" ? "staff" : "manager"));
    }
  };

  // Handle blur text animation completion
  const handleAnimationComplete = () => {
    console.log("BlurText animation completed!");
  };

  // Authentication guard - redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = "/login";
      return;
    }
  }, []);

  // Only fetch users when staff accordion is opened for the first time
  useEffect(() => {
    if (expandedSections.staff && !staffFetched) {
      async function fetchUsers() {
        try {
          const result = await users.list();
          setStaffUsers(result.users || []);
        } catch (err) {
          console.error("Error fetching staff users:", err);
          setStaffUsers([]);
        }
      }
      fetchUsers();
      setStaffFetched(true);
    }
  }, [expandedSections.staff, staffFetched]);

  useEffect(() => {
    auth
      .get()
      .then(async (user) => {
        setUsername(user.name || user.username || user.email);
        setUser(user);
        const labels = user.labels || [];
        setUserLabels(labels);

        // Set initial view based on user role
        const isUserManager =
          labels.includes("manager") ||
          labels.includes("Manager") ||
          labels.includes("gerente") ||
          labels.includes("Gerente");

        if (isUserManager) {
          setCurrentView("manager");
        } else {
          setCurrentView("staff");
        }

        const userId = user.$id || user.id;

        try {
          // Try to get profile image bucket info
          const bucketResult = await profileImages.getBucketInfo(userId);
          let profileImageFile = "";

          if (bucketResult.documents && bucketResult.documents.length > 0) {
            profileImageFile = bucketResult.documents[0].bucket_id;
          }

          if (profileImageFile) {
            // Use the new API preview URL
            const fileUrl = profileImages.getPreviewUrl(profileImageFile, {
              width: 400,
              height: 400,
              quality: 80,
            });
            setProfileImg(fileUrl);
          } else if (user.profile_image) {
            // If user has profile_image field directly, use it
            const fileUrl = `${API_FILES_URL}/${user.profile_image}`;
            setProfileImg(fileUrl);
          } else {
            // Try fallback with user ID
            const fallbackUrl = profileImages.getPreviewUrl(userId, {
              width: 400,
              height: 400,
              quality: 80,
            });
            setProfileImg(fallbackUrl);
          }
        } catch (err) {
          setProfileImg("");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setUsername("");
        setProfileImg("");
        setIsLoading(false);
      });
  }, []);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

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

            {/* Only show spinner after loading starts */}
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
      <Header
        activeNavItem={activeNavItem}
        onNavClick={handleNavClick}
        user={user}
        username={username}
        userLabels={userLabels}
        profileImg={profileImg}
        isManager={isManager}
        currentView={currentView}
        onViewToggle={toggleView}
        showViewToggle={true}
        wsConnected={connected}
        wsReconnecting={reconnecting}
      />

      <main className="main-content fade-in-delayed">
        {/* Only render views when user data is loaded */}
        {user && currentView && (
          <>
            {activeNavItem === "Ementa" ? (
              <MenuComponent />
            ) : activeNavItem === "Mesas" ? (
              <TableLayoutManager user={user} />
            ) : (
              <>
                {isManager && currentView === "manager" ? (
                  <>
                    <h1 className="welcome-title slide-in-up">
                      <BlurText
                        text={`Bem-vindo, ${username}.`}
                        delay={150}
                        animateBy="words"
                        direction="top"
                        onAnimationComplete={handleAnimationComplete}
                        className="welcome-greeting"
                        style={{ color: "#ff6b35" }}
                      />
                    </h1>
                    <ManagerView
                      expandedSections={expandedSections}
                      toggleSection={toggleSection}
                      staffUsers={staffUsers}
                      username={username}
                      userLabels={userLabels}
                      profileImg={profileImg}
                      chartData={chartData}
                      chartConfig={chartConfig}
                      user={user}
                    />
                  </>
                ) : (
                  <StaffView
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                    staffUsers={staffUsers}
                    username={username}
                    userLabels={userLabels}
                    profileImg={profileImg}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const RestaurantDashboard = () => {
  return (
    <WebSocketProvider>
      <RestaurantDashboardContent />
    </WebSocketProvider>
  );
};

export default RestaurantDashboard;
