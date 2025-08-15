"use client";

import Mesas from "../components/Mesas";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { account } from "@/lib/appwrite";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { ArrowLeft } from "lucide-react";

export default function RestLayout() {
  const [user, setUser] = useState(null);
  const router = useRouter();
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
