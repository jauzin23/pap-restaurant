"use client";

import Mesas from "../components/Mesas";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { ArrowLeft } from "lucide-react";

export default function RestLayout() {
  const [user, setUser] = useState(null);
  const router = useRouter();
  const { account } = useApp();
  useEffect(() => {
    account
      .get()
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router]);

  if (!user)
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
  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Header */}
      <Header user={user} logo="/logo-icon.svg" />

      {/* Content area that fills remaining height */}
      <div className="flex-1 flex flex-col">
        {/* Voltar Button */}
        <div className="px-6 py-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-neutral-800 bg-neutral-950 text-neutral-300 
                   hover:bg-neutral-900 hover:text-white hover:border-neutral-700 
                   transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Voltar</span>
          </button>
        </div>

        {/* Mesas fills all remaining height */}
        <div className="flex-1 px-6 pb-6">
          <Mesas user={user} className="h-full" />
        </div>
      </div>

      <Footer />
    </div>
  );
}
