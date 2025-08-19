"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { LogOut, Star, Users, ChefHat, Clock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Query } from "appwrite";
import { DB_ATTENDANCE, COL_ATTENDANCE } from "@/lib/appwrite";
import ShinyText from "./ShinyText";

const Header = memo(function Header({ user, logo }) {
  const router = useRouter();
  const { databases, account, client } = useApp();

  const [userClockStatus, setUserClockStatus] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchUserClockStatus = useCallback(async () => {
    if (!user?.$id) return;

    try {
      const res = await databases.listDocuments(DB_ATTENDANCE, COL_ATTENDANCE, [
        Query.equal("userId", user.$id),
        Query.isNull("clockOut"),
        Query.limit(1),
      ]);

      const clockStatus = res.documents.length > 0 ? res.documents[0] : null;
      setUserClockStatus(clockStatus);
    } catch (err) {
      console.error("❌ Header - Error fetching clock status:", err);
      setUserClockStatus(null);
    }
  }, [user?.$id, databases]);

  useEffect(() => {
    if (user?.$id) {
      fetchUserClockStatus();
    }
  }, [fetchUserClockStatus, user?.$id]);

  useEffect(() => {
    if (!user?.$id) return;

    const unsubscribe = client.subscribe(
      [`databases.${DB_ATTENDANCE}.collections.${COL_ATTENDANCE}.documents`],
      (response) => {
        const eventType = response.events[0];
        const payload = response.payload;

        if (payload?.userId === user.$id) {
          if (eventType.includes(".create") && !payload.clockOut) {
            setUserClockStatus(payload);
          } else if (eventType.includes(".update") && payload.clockOut) {
            setUserClockStatus(null);
          }

          setTimeout(fetchUserClockStatus, 300);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.$id, fetchUserClockStatus, client]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await account.deleteSession("current");
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  const getRoleIcon = () => {
    if (!user?.labels || user.labels.length === 0) {
      return <Users size={14} className="text-white/70" />;
    }

    const primaryRole = user.labels[0].toLowerCase();

    switch (primaryRole) {
      case "manager":
        return <Star size={14} className="text-purple-400" />;
      case "chef":
      case "kitchen":
        return <ChefHat size={14} className="text-orange-400" />;
      case "waiter":
      case "waitress":
        return <Users size={14} className="text-blue-400" />;
      default:
        return <Users size={14} className="text-green-400" />;
    }
  };

  const getRoleBadgeColor = () => {
    if (!user?.labels || user.labels.length === 0) {
      return "bg-gray-500/20 text-gray-300";
    }

    const primaryRole = user.labels[0].toLowerCase();

    switch (primaryRole) {
      case "manager":
        return "bg-purple-500/20 text-purple-300";
      case "chef":
      case "kitchen":
        return "bg-orange-500/20 text-orange-300";
      case "waiter":
      case "waitress":
        return "bg-blue-500/20 text-blue-300";
      default:
        return "bg-green-500/20 text-green-300";
    }
  };

  const formatDuration = (clockInTime) => {
    if (!clockInTime || !currentTime) return "0h 0m";

    const clockIn = new Date(clockInTime);
    const current = new Date(currentTime);
    const diffMs = current - clockIn;

    if (diffMs < 0) return "0h 0m";

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <header className="sticky top-0 z-50 border-white/10 bg-neutral-900/95 shadow-lg border-b border-neutral-800 ">
      <div className="w-full px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Left Section - Logo, Brand, and Clock Status */}
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            {logo && (
              <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-lg  p-1.5 flex-shrink-0">
                <Image
                  src={logo}
                  alt="Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            )}
            <div className="hidden sm:block min-w-0">
              <h1 className="text-lg lg:text-xl font-bold text-white truncate">
                <ShinyText
                  text="MESA+"
                  disabled={false}
                  speed={2}
                  className="custom-class"
                />
              </h1>
              <p className="text-xs text-white/60 truncate">
                Gestão De Restaurante
              </p>
            </div>

            {/* Clock Status - Same height as other buttons */}
            {userClockStatus ? (
              <div className="flex items-center gap-2 px-3 py-2 md:py-3 rounded-xl bg-green-500/20 border border-green-500/30 h-10 md:h-12">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <Clock size={16} className="text-green-400" />
                <div className="hidden md:block">
                  <div className="text-xs font-bold text-green-400">ATIVO</div>
                  <div className="text-xs text-green-300">
                    {formatDuration(userClockStatus.clockIn)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 md:py-3 rounded-xl bg-gray-500/20 border border-gray-500/30 h-10 md:h-12">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <Clock size={16} className="text-gray-400" />
                <div className="hidden md:block">
                  <div className="text-xs font-bold text-gray-400">INATIVO</div>
                  <div className="text-xs text-gray-300">Fora de serviço</div>
                </div>
              </div>
            )}
          </div>

          {/* Right Section - User Info and Controls */}
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            {/* User Info Card */}
            <div className="flex items-center gap-1 md:gap-2 bg-neutral-900/60 rounded-xl border border-neutral-700 px-2 py-2 md:py-3 h-10 md:h-12 max-w-[200px] lg:max-w-none">
              {/* Role Icon */}
              <div
                className={clsx(
                  "w-6 md:w-8 h-6 md:h-8 rounded-lg flex items-center justify-center border flex-shrink-0",
                  getRoleBadgeColor(),
                  "border-current border-opacity-30"
                )}
              >
                {getRoleIcon()}
              </div>

              {/* User Details */}
              <div className="hidden lg:block min-w-0 flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <h3 className="text-xs font-bold text-white truncate">
                    {user?.name || "Utilizador"}
                  </h3>
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 rounded text-xs font-medium uppercase tracking-wide flex-shrink-0",
                      getRoleBadgeColor()
                    )}
                  >
                    {user?.labels?.[0] || "staff"}
                  </span>
                </div>
                <p className="text-xs text-white/60 font-mono">
                  {currentTime?.toLocaleTimeString("pt-PT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center px-3 md:px-4 py-2 md:py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 disabled:opacity-50 h-10 md:h-12 justify-center"
            >
              <LogOut
                size={14}
                className={clsx(isLoggingOut && "animate-spin")}
              />
              <span className="hidden xl:inline text-sm font-medium">
                {isLoggingOut ? "Saindo..." : ""}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});

export default Header;
