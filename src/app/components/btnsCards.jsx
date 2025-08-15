"use client";

import React, { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ShoppingCart,
  CalendarCheck,
  ArrowRightCircle,
} from "lucide-react";
import { motion } from "framer-motion";

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

const BtnsCards = memo(function BtnsCards() {
  const router = useRouter();

  const handleCardClick = useCallback(
    (href) => {
      router.push(href);
    },
    [router]
  );

  return (
    <section className="bg-black text-white p-8 md:p-10 w-80 h-full border-r border-neutral-800 flex flex-col flex-1">
      {/* Section header */}
      <div className="mb-8 pb-4 border-b border-neutral-800">
        <h1 className="text-2xl font-bold text-white mb-1">Acesso Rápido</h1>
        <p className="text-sm text-neutral-400">
          Navegue rapidamente pelas funcionalidades
        </p>
      </div>

      {/* Card stack */}
      <div className="flex-1 flex flex-col gap-3">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              onClick={() => handleCardClick(card.href)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
              className="cursor-pointer group rounded-xl p-5 bg-neutral-950 border border-neutral-800 flex flex-col gap-3 hover:bg-neutral-900 hover:border-neutral-700 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
            >
              {/* Top row: Icon + Title + Arrow */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 group-hover:from-neutral-700 group-hover:to-neutral-800 border border-neutral-700 flex-shrink-0 transition-all duration-200">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-white group-hover:text-neutral-100">
                    {card.title}
                  </h2>
                </div>
                <ArrowRightCircle className="w-6 h-6 text-neutral-500 group-hover:text-white group-hover:scale-110 transition-all duration-200" />
              </div>

              {/* Description */}
              <p className="text-neutral-400 text-sm pl-16 group-hover:text-neutral-300 transition-colors duration-200">
                {card.description}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Status indicator */}
      <div className="mt-8 p-5 bg-gradient-to-r from-green-950 to-green-900 rounded-xl border border-green-800 flex items-center gap-4 shadow-lg">
        <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse shadow-sm"></div>
        <div>
          <h4 className="text-base font-semibold text-green-300">
            Sistema Online
          </h4>
          <p className="text-xs text-green-400 mt-1">
            Todas as funcionalidades disponíveis
          </p>
        </div>
      </div>
    </section>
  );
});

export default BtnsCards;
