"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import Footer from "./components/Footer";
import RestLayout from "./components/RestLayout";
import BtnsCards from "./components/btnsCards";
import ManagerStaffView from "./components/ManagerStaffView";
import { useMediaQuery } from "react-responsive";
import { useApp } from "@/contexts/AppContext";
import "./main-page.scss";

export default function DashboardPage() {
  const isMobile = useMediaQuery({ maxWidth: 640 });
  const router = useRouter();
  const { user, loading } = useApp();

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [router, isMobile]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [router, loading, user]);

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
    <div className="main-page-container">
      <div className="main-page-layout">
        <Header user={user} logo="/logo-icon.svg" />
        <div className="main-page-content">
          <BtnsCards user={user} />
          <div className="main-content-area">
            <div className="content-grid">
              <RestLayout
                user={user}
                onEditRedirect={() => router.push("/RestLayout")}
              />
              <ManagerStaffView
                user={user}
                isManager={user.labels && user.labels.includes("manager")}
              />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
