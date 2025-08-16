"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import Footer from "./components/Footer";
import RestLayout from "./components/RestLayout";
import BtnsCards from "./components/btnsCards";
import TableStatusSummary from "./components/TableStatusSummary";
import ManagerStaffView from "./components/ManagerStaffView";
import { useMediaQuery } from "react-responsive";
import { useApp } from "@/contexts/AppContext";

export default function DashboardPage() {
  const isMobile = useMediaQuery({ maxWidth: 640 });
  const router = useRouter();
  const { user, loading } = useApp();

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [router, isMobile]);

  useEffect(() => {
    // If not loading and no user, redirect to login
    if (!loading && !user) {
      router.push("/login");
    }
  }, [router, loading, user]);

  // Show loading while checking user
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">A carregar dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if no user (will redirect to login)
  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header user={user} logo="/logo-icon.svg" />
      <div className="flex flex-1 overflow-hidden">
        <BtnsCards user={user} />
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          <div className="pt-3 lg:pt-6 px-2 lg:px-6 gap-4 grid md:gap-6">
            <TableStatusSummary />
            <ManagerStaffView
              user={user}
              isManager={user.labels && user.labels.includes("manager")}
            />
            <RestLayout
              user={user}
              onEditRedirect={() => router.push("/RestLayout")}
            />
          </div>

          <div className="px-2 lg:px-6 pb-3 lg:pb-6"></div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
