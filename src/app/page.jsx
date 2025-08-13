"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import Mesas from "./components/Mesas";
import { account } from "@/lib/appwrite";

export default function DashboardPage() {
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
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-b-4 border-gray-300 mb-4"></div>
        <p className="text-gray-700 text-lg">A Carregar...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} logo="/logo.png" />
      <Mesas />
    </div>
  );
}
