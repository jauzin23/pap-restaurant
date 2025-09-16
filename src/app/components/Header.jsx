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
import "./header.scss";

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
      return <Users size={14} />;
    }

    const primaryRole = user.labels[0].toLowerCase();

    switch (primaryRole) {
      case "manager":
        return <Star size={14} />;
      case "chef":
      case "kitchen":
        return <ChefHat size={14} />;
      case "waiter":
      case "waitress":
        return <Users size={14} />;
      default:
        return <Users size={14} />;
    }
  };

  const getRoleClass = () => {
    if (!user?.labels || user.labels.length === 0) {
      return "default";
    }

    const primaryRole = user.labels[0].toLowerCase();

    switch (primaryRole) {
      case "manager":
        return "manager";
      case "chef":
      case "kitchen":
        return "chef";
      case "waiter":
      case "waitress":
        return "waiter";
      default:
        return "default";
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
    <header className="header">
      <div className="header-content">
        {/* Left Section */}
        <div className="header-left">
          <div className="logo-section">
            {logo && (
              <div className="logo-icon">
                <Image src={logo} alt="Logo" width={24} height={24} priority />
              </div>
            )}
            <div className="brand-info">
              <h1 className="brand-title">
                <ShinyText
                  text="MESA+"
                  disabled={false}
                  speed={2}
                  className="custom-class"
                />
              </h1>
              <p className="brand-subtitle">Gestão De Restaurante</p>
            </div>
          </div>

          {/* Clock Status */}
          <div
            className={clsx(
              "clock-status",
              userClockStatus ? "active" : "inactive"
            )}
          >
            <div className="status-dot" />
            <Clock className="clock-icon" />
            <div className="clock-details">
              <div className="status-label">
                {userClockStatus ? "ATIVO" : "INATIVO"}
              </div>
              <div className="status-time">
                {userClockStatus
                  ? formatDuration(userClockStatus.clockIn)
                  : "Fora de serviço"}
              </div>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="header-right">
          {/* User Info */}
          <div className="user-info">
            <div className={clsx("role-icon", getRoleClass())}>
              {getRoleIcon()}
            </div>
            <div className="user-details">
              <div className="user-name-role">
                <span className="user-name">{user?.name || "Utilizador"}</span>
                <span className={clsx("role-badge", getRoleClass())}>
                  {user?.labels?.[0] || "staff"}
                </span>
              </div>
              <div className="current-time">
                {currentTime?.toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="logout-btn"
          >
            <LogOut className={clsx(isLoggingOut && "loading")} />
            <span className="logout-text">
              {isLoggingOut ? "Saindo..." : "Sair"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
});

export default Header;
