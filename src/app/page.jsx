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
    if (!loading && !user) {
      router.push("/login");
    }
  }, [router, loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f0f_1px,transparent_1px),linear-gradient(to_bottom,#0f0f0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Loading spinner */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/10 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-t-purple-500 border-r-pink-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>

          {/* Logo and text */}
          <div className="mt-8 text-center">
            <div className="mb-4 flex justify-center"></div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
              Mesa+
            </h2>
            <p className="text-white/50 text-sm">A carregar o dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

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
