"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";
import DashboardCards from "./components/DashboardCards";
import { useMediaQuery } from "react-responsive";
import { useApp } from "@/contexts/AppContext";
import "./main-page.scss";

export default function DashboardPage() {
  const isMobile = useMediaQuery({ maxWidth: 640 });
  const router = useRouter();
  const { user, loading } = useApp();
  const [activeNavItem, setActiveNavItem] = useState("Painel");

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [router, isMobile]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [router, loading, user]);

  const handleNavClick = (navItem) => {
    setActiveNavItem(navItem);

    // Route to appropriate pages based on nav item
    const routes = {
      Painel: "/",
      Ementa: "/menu",
      Stock: "/stock",
      Mesas: "/order",
      Staff: "/staff-management",
      Settings: "/settings",
    };

    if (routes[navItem] && routes[navItem] !== "/") {
      router.push(routes[navItem]);
    }
  };

  if (loading) {
    return (
      <div className="main-page-container">
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner-base"></div>
            <div className="spinner-active"></div>
          </div>
          <div className="loading-content">
            <h2 className="loading-title">Mesa+</h2>
            <p className="loading-text">A carregar o dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar */}
      <Sidebar
        activeNavItem={activeNavItem}
        onNavClick={handleNavClick}
        user={user}
      />

      {/* Main Content Wrapper */}
      <div className="content-wrapper">
        {/* Page Content */}
        <div className="page-content">
          <div className="container-fluid">
            {/* Page Heading */}
            <div className="page-heading">
              <h1 className="page-title">Dashboard</h1>
            </div>

            {/* Dashboard Cards */}
            <DashboardCards />

            {/* Content Row */}
            <div className="content-row">
              {/* Restaurant Layout */}
              <div className="content-section"></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
