"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Clock, Play, StopCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Query, ID } from "appwrite";
import { DB_ATTENDANCE, COL_ATTENDANCE } from "@/lib/appwrite";
import "./btns-cards.scss";

export default function BtnsCards({ user }) {
  const router = useRouter();
  const { databases } = useApp();

  const [userClockStatus, setUserClockStatus] = useState(null);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);

  const getUserPermissions = () => {
    return ["dashboard", "menu", "orders", "inventory"];
  };

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
      console.error("❌ BtnsCards - Error fetching clock status:", err);
      setUserClockStatus(null);
    }
  }, [user?.$id, databases]);

  useEffect(() => {
    if (user?.$id) {
      fetchUserClockStatus();
    }
  }, [fetchUserClockStatus, user?.$id]);

  const handleClockIn = async () => {
    if (!user?.$id || isClockingIn) return;

    try {
      setIsClockingIn(true);

      const attendanceDoc = {
        userId: user.$id,
        name: user.name || "Unknown User",
        label: user.labels || [],
        clockIn: new Date().toISOString(),
        clockOut: null,
      };

      const res = await databases.createDocument(
        DB_ATTENDANCE,
        COL_ATTENDANCE,
        ID.unique(),
        attendanceDoc
      );

      setUserClockStatus(res);
    } catch (err) {
      console.error("❌ Error clocking in:", err);
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!userClockStatus?.$id || isClockingOut) return;

    try {
      setIsClockingOut(true);

      await databases.updateDocument(
        DB_ATTENDANCE,
        COL_ATTENDANCE,
        userClockStatus.$id,
        {
          clockOut: new Date().toISOString(),
        }
      );

      setUserClockStatus(null);
    } catch (err) {
      console.error("❌ Error clocking out:", err);
    } finally {
      setIsClockingOut(false);
    }
  };

  const allButtons = [
    {
      id: "dashboard",
      label: "Dashboard",
      route: "/dashboard",
      active: true,
    },
    {
      id: "menu",
      label: "Menu",
      route: "/menu",
      active: false,
    },
    {
      id: "orders",
      label: "Pedidos",
      route: "/pedidos",
      badge: 12,
      active: false,
    },
    {
      id: "inventory",
      label: "Stock",
      route: "/stock",
      active: false,
    },
    {
      id: "reservations",
      label: "Reservas",
      route: "/reservations",
      badge: 4,
      active: false,
    },
  ];

  return (
    <aside className="sidebar">
      <nav className="nav-section">
        <div className="nav-label">Operações</div>

        {allButtons.map((button) => (
          <a
            key={button.id}
            href={button.route}
            className={`nav-item ${button.active ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              router.push(button.route);
            }}
          >
            <div className="nav-icon"></div>
            <span>{button.label}</span>
            {button.badge && <div className="nav-badge">{button.badge}</div>}
          </a>
        ))}
      </nav>

      {/* Clock Section */}
      <div className="clock-section">
        <div className="clock-header">
          <Clock size={16} />
          <span>Ponto Eletrónico</span>
          {userClockStatus && <div className="status-dot active"></div>}
        </div>

        {userClockStatus ? (
          <button
            onClick={handleClockOut}
            disabled={isClockingOut}
            className="clock-btn clock-out"
          >
            <StopCircle size={18} />
            <div className="clock-content">
              <span className="clock-label">
                {isClockingOut ? "A sair..." : "Bater Saída"}
              </span>
              <span className="clock-status">Terminar turno</span>
            </div>
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={isClockingIn}
            className="clock-btn clock-in"
          >
            <Play size={18} />
            <div className="clock-content">
              <span className="clock-label">
                {isClockingIn ? "A bater entrada..." : "Bater Entrada"}
              </span>
              <span className="clock-status">Iniciar turno</span>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
}
