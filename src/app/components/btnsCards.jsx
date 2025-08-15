"use client";

import React, { memo, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ShoppingCart,
  CalendarCheck,
  ArrowRightCircle,
  Clock,
  LogIn,
  LogOut,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  databases,
  client,
  DB_ATTENDANCE,
  COL_ATTENDANCE,
} from "@/lib/appwrite";
import { Query } from "appwrite";

const cards = [
  {
    title: "Menu",
    description: "Ver e editar o menu",
    href: "/menu",
    icon: BookOpen,
  },
  {
    title: "Pedidos",
    description: "Acompanhar os pedidos",
    href: "/pedidos",
    icon: ShoppingCart,
  },
  {
    title: "Reservas",
    description: "Ver reservas atuais",
    href: "/reservas",
    icon: CalendarCheck,
  },
];

const BtnsCards = memo(function BtnsCards({ user }) {
  const router = useRouter();
  const [userClockStatus, setUserClockStatus] = useState(null);
  const [clockLoading, setClockLoading] = useState(false);

  // Fetch user clock status with real-time updates
  useEffect(() => {
    if (user?.$id) {
      fetchUserClockStatus();

      // Subscribe to real-time updates for attendance changes
      const unsubscribe = client.subscribe(
        `databases.${DB_ATTENDANCE}.collections.${COL_ATTENDANCE}.documents`,
        (response) => {
          if (
            response.events.some(
              (e) =>
                e.endsWith(".create") ||
                e.endsWith(".update") ||
                e.endsWith(".delete")
            )
          ) {
            // Check if the event is related to the current user
            if (response.payload && response.payload.userId === user.$id) {
              fetchUserClockStatus();
            }
          }
        }
      );

      return () => {
        if (unsubscribe && typeof unsubscribe === "function") {
          unsubscribe();
        }
      };
    }
  }, [user]);

  async function fetchUserClockStatus() {
    try {
      const res = await databases.listDocuments(DB_ATTENDANCE, COL_ATTENDANCE, [
        Query.equal("userId", user.$id),
        Query.isNull("clockOut"),
        Query.limit(1),
      ]);
      setUserClockStatus(res.documents.length > 0 ? res.documents[0] : null);
    } catch (err) {
      console.error("Error fetching user clock status:", err);
      setUserClockStatus(null);
    }
  }

  async function handleClockIn() {
    setClockLoading(true);
    try {
      await databases.createDocument(
        DB_ATTENDANCE,
        COL_ATTENDANCE,
        "unique()",
        {
          userId: user.$id,
          name: user.name,
          clockIn: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("Error clocking in:", err);
    } finally {
      setClockLoading(false);
    }
  }

  async function handleClockOut() {
    if (!userClockStatus) return;
    setClockLoading(true);
    try {
      await databases.updateDocument(
        DB_ATTENDANCE,
        COL_ATTENDANCE,
        userClockStatus.$id,
        {
          clockOut: new Date().toISOString(),
        }
      );
    } catch (err) {
      console.error("Error clocking out:", err);
    } finally {
      setClockLoading(false);
    }
  }

  const handleCardClick = useCallback(
    (href) => {
      router.push(href);
    },
    [router]
  );

  return (
    <section className="bg-black text-white w-72 h-full flex-shrink-0 border-r border-neutral-900 flex flex-col relative overflow-hidden shadow-xl">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="white"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/40 via-transparent to-neutral-950/60 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full pt-0 pl-0">
        {/* Section header */}
        <div className="mb-8 pt-8 pl-8 pb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-xl flex items-center justify-center border border-neutral-600 shadow-lg">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          </div>
          <p className="text-sm text-neutral-400 pl-1">
            Acesso rápido às funcionalidades
          </p>
        </div>

        {/* Card stack */}
        <div className="flex-1 flex flex-col gap-4 px-6">
          {cards.map((card, i) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.title}
                onClick={() => handleCardClick(card.href)}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12, type: "spring", stiffness: 100 }}
                className="cursor-pointer group relative"
              >
                {/* Card background */}
                <div className="absolute inset-0 bg-neutral-900 rounded-2xl group-hover:bg-neutral-800 transition-all duration-300 shadow-lg" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative bg-neutral-900/95 backdrop-blur-sm rounded-2xl border border-neutral-800 group-hover:border-neutral-700 p-6 transition-all duration-300 shadow-lg group-hover:shadow-xl">
                  <div className="flex items-center gap-5">
                    {/* Icon with subtle background */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 group-hover:from-neutral-700 group-hover:to-neutral-800 flex items-center justify-center border border-neutral-700 group-hover:border-neutral-500 transition-all duration-300 group-hover:scale-110 shadow-md">
                      <Icon className="w-6 h-6 text-white group-hover:text-blue-300 transition-colors duration-300" />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-white mb-1 group-hover:text-blue-200 transition-colors duration-300">
                        {card.title}
                      </h2>
                      <p className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors duration-300">
                        {card.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="w-6 h-6 text-neutral-500 group-hover:text-blue-300 transition-all duration-300 group-hover:translate-x-1 group-hover:scale-110">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M5 12H19"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 5L19 12L12 19"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Clock In/Out Card - Minimalistic */}
        <div className="mt-8 relative px-6 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="relative bg-neutral-900/90 backdrop-blur-sm rounded-xl border border-neutral-800 p-4 shadow-md"
          >
            {/* Compact status display */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-300" />
                <span className="text-xs font-medium text-neutral-300">
                  Ponto
                </span>
              </div>
              {userClockStatus && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </div>

            {/* Minimalistic button */}
            <motion.button
              onClick={!userClockStatus ? handleClockIn : handleClockOut}
              disabled={clockLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                !userClockStatus
                  ? "bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30"
              } ${clockLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {clockLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-3 h-3 border border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  {!userClockStatus ? (
                    <>
                      <LogIn className="w-3 h-3" />
                      Entrar
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3 h-3" />
                      Sair
                    </>
                  )}
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      </div>
    </section>
  );
});

export default BtnsCards;
