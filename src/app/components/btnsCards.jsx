"use client";

import React, { memo, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ShoppingCart,
  CalendarCheck,
  Clock,
  LogIn,
  LogOut,
} from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePerformance } from "@/components/PerformanceContext";
import {
  SUBSCRIPTION_CHANNELS,
  eventMatches,
  EVENT_PATTERNS,
} from "@/lib/subscriptionChannels";
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
  const { subscribe } = useSubscription();
  const {
    getBackdropClass,
    getAnimationClass,
    getTransitionClass,
    getShadowClass,
  } = usePerformance();
  const [userClockStatus, setUserClockStatus] = useState(null);
  const [clockLoading, setClockLoading] = useState(false);

  // Fetch user clock status with optimized real-time updates
  useEffect(() => {
    if (user?.$id) {
      fetchUserClockStatus();

      // Subscribe to optimized real-time updates for attendance changes
      const unsubscribe = subscribe(
        SUBSCRIPTION_CHANNELS.ATTENDANCE(DB_ATTENDANCE, COL_ATTENDANCE),
        (response) => {
          if (eventMatches(response.events, EVENT_PATTERNS.ALL_CRUD)) {
            // Check if the event is related to the current user
            if (response.payload && response.payload.userId === user.$id) {
              fetchUserClockStatus();
            }
          }
        },
        { debounce: true, debounceDelay: 300 }
      );

      return unsubscribe;
    }
  }, [user, subscribe]);

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
    <section
      className={`border-b border-white/10 ${getBackdropClass(
        "bg-neutral-900/95"
      )} ${getShadowClass()} text-white w-full md:w-20 xl:w-72 h-full flex-shrink-0 border-r flex flex-col relative overflow-hidden`}
    >
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
      <div className="relative z-10 flex flex-col h-full">
        {/* Header - Mobile: horizontal, Tablet: vertical center, Desktop: horizontal */}
        <div className="flex md:hidden xl:flex items-center gap-4 p-4 xl:p-8 border-b border-neutral-800 xl:border-none">
          <div className="w-10 h-10 xl:w-12 xl:h-12 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-xl flex items-center justify-center border border-neutral-600 shadow-lg">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="xl:w-[20px] xl:h-[20px]"
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
          <div className="hidden xl:block">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-neutral-400">
              Acesso rápido às funcionalidades
            </p>
          </div>
        </div>

        {/* Tablet icon header - only visible on tablets */}
        <div className="hidden md:flex xl:hidden justify-center pt-6 pb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-xl flex items-center justify-center border border-neutral-600 shadow-lg">
            <svg
              width="20"
              height="20"
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
        </div>

        {/* Navigation Cards */}
        <div className="flex-1 flex flex-col md:flex-col xl:flex-col gap-2 md:gap-3 xl:gap-4 p-3 md:p-2 xl:p-6">
          {cards.map((card, i) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                onClick={() => handleCardClick(card.href)}
                className={`cursor-pointer group relative ${getAnimationClass(
                  "animate-fade-in-left"
                )}`}
                style={{ animationDelay: `${i * 120}ms` }}
                title={card.title} // Tooltip for tablet icon-only view
              >
                {/* Mobile & Desktop: Full card */}
                <div className="md:hidden xl:block">
                  <div
                    className={`relative bg-neutral-900/95 ${getBackdropClass(
                      "bg-neutral-900/95"
                    )} rounded-2xl border border-neutral-800 group-hover:border-neutral-700 p-4 xl:p-6 ${getTransitionClass()} ${getShadowClass()} group-hover:shadow-xl`}
                  >
                    <div className="flex items-center gap-4 xl:gap-5">
                      <div
                        className={`w-10 h-10 xl:w-12 xl:h-12 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 group-hover:from-neutral-700 group-hover:to-neutral-800 flex items-center justify-center border border-neutral-700 group-hover:border-neutral-500 ${getTransitionClass()} group-hover:scale-110 shadow-md`}
                      >
                        <Icon
                          className={`w-5 h-5 xl:w-6 xl:h-6 text-white group-hover:text-blue-300 ${getTransitionClass(
                            "transition-colors duration-300"
                          )}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2
                          className={`text-base xl:text-lg font-bold text-white mb-1 group-hover:text-blue-200 ${getTransitionClass(
                            "transition-colors duration-300"
                          )} truncate`}
                        >
                          {card.title}
                        </h2>
                        <p
                          className={`text-sm xl:text-sm text-neutral-400 group-hover:text-neutral-300 ${getTransitionClass(
                            "transition-colors duration-300"
                          )} leading-tight`}
                        >
                          {card.description}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 xl:w-6 xl:h-6 text-neutral-500 group-hover:text-blue-300 ${getTransitionClass()} group-hover:translate-x-1 group-hover:scale-110 flex-shrink-0`}
                      >
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
                </div>

                {/* Tablet: Icon only */}
                <div className="hidden md:block xl:hidden">
                  <div
                    className={`relative bg-neutral-900/95 ${getBackdropClass(
                      "bg-neutral-900/95"
                    )} rounded-xl border border-neutral-800 group-hover:border-neutral-700 p-3 ${getTransitionClass()} ${getShadowClass()} group-hover:shadow-xl`}
                  >
                    <div className="flex justify-center">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 group-hover:from-neutral-700 group-hover:to-neutral-800 flex items-center justify-center border border-neutral-700 group-hover:border-neutral-500 ${getTransitionClass()} group-hover:scale-110 shadow-md`}
                      >
                        <Icon
                          className={`w-5 h-5 text-white group-hover:text-blue-300 ${getTransitionClass(
                            "transition-colors duration-300"
                          )}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Clock In/Out Section */}
        <div className="mt-auto p-3 md:p-2 xl:p-6 border-t border-neutral-800">
          <div
            className={`relative bg-neutral-900/90 ${getBackdropClass(
              "bg-neutral-900/95"
            )} rounded-xl border border-neutral-800 p-3 xl:p-4 shadow-md ${getAnimationClass(
              "animate-fade-in-up animate-stagger-6"
            )}`}
          >
            {/* Mobile & Desktop: Full content */}
            <div className="md:hidden xl:block">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-neutral-300" />
                  <span className="text-xs font-medium text-neutral-300">
                    Ponto
                  </span>
                </div>
                {userClockStatus && (
                  <div
                    className={`w-2 h-2 bg-green-400 rounded-full ${getAnimationClass(
                      "animate-pulse"
                    )}`}
                  />
                )}
              </div>
              <button
                onClick={!userClockStatus ? handleClockIn : handleClockOut}
                disabled={clockLoading}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${getTransitionClass(
                  "transition-all duration-200"
                )} hover-scale ${
                  !userClockStatus
                    ? "bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30"
                    : "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30"
                } ${clockLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {clockLoading ? (
                  <div
                    className={`w-3 h-3 border border-white border-t-transparent rounded-full ${getAnimationClass(
                      "animate-spin"
                    )}`}
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
              </button>
            </div>

            {/* Tablet: Icon only */}
            <div className="hidden md:block xl:hidden">
              <div className="flex justify-center">
                <button
                  onClick={!userClockStatus ? handleClockIn : handleClockOut}
                  disabled={clockLoading}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTransitionClass(
                    "transition-all duration-200"
                  )} hover-scale ${
                    !userClockStatus
                      ? "bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30"
                      : "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30"
                  } ${clockLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  title={!userClockStatus ? "Marcar Entrada" : "Marcar Saída"}
                >
                  {clockLoading ? (
                    <div
                      className={`w-3 h-3 border border-white border-t-transparent rounded-full ${getAnimationClass(
                        "animate-spin"
                      )}`}
                    />
                  ) : (
                    <>
                      {!userClockStatus ? (
                        <LogIn className="w-4 h-4" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

export default BtnsCards;
