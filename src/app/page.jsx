"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import Mesas from "./components/Mesas";
import Footer from "./components/Footer";
import RestLayout from "./components/RestLayout";
import BtnsCards from "./components/btnsCards";
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
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-b-4 border-white mb-4"></div>
        <p className="text-white text-lg">A Carregar...</p>
      </div>
    );

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Header user={user} logo="/logo.png" />
      <div className="flex flex-1">
        <div className="w-80">
          <BtnsCards />
        </div>

        <div className="flex-1">
          <RestLayout
            user={user}
            onEditRedirect={() => router.push("/RestLayout")}
          />
        </div>
      </div>

      <Footer />
    </div>
  );
}
