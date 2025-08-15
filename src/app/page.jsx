"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import Mesas from "./components/Mesas";
import Footer from "./components/Footer";
import RestLayout from "./components/RestLayout";
import BtnsCards from "./components/btnsCards";
import TableStatusSummary from "./components/TableStatusSummary";
import { account } from "@/lib/appwrite";
import { useMediaQuery } from "react-responsive";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const router = useRouter();

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [router]);

  useEffect(() => {
    account
      .get()
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router]);

  if (!user)
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mb-4"></div>
        <p className="text-white text-lg">A Carregar...</p>
      </div>
    );

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Header user={user} logo="/logo.png" />

      <div className="flex flex-1">
        {/* Left Sidebar - Quick Actions */}
        <div className="w-80 flex flex-col gap-6 p-6">
          <BtnsCards />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Table Status Row - Spans the main content area only */}
          <div className="pt-6 px-6">
            <TableStatusSummary />
          </div>

          {/* Restaurant Layout */}
          <div className="flex-1 px-6 pb-6">
            <RestLayout
              user={user}
              onEditRedirect={() => router.push("/RestLayout")}
            />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
