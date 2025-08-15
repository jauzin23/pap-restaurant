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
    <section className="bg-black text-white p-6 md:p-8 w-80 h-full border-r border-neutral-800 flex flex-col flex-1">
      {/* Section header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Acesso Rápido</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Navegue rapidamente pelas funcionalidades
        </p>
      </div>

      {/* Card stack */}
      <div className="flex-1 flex flex-col gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              onClick={() => handleCardClick(card.href)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
              className="cursor-pointer group rounded-lg p-4 bg-neutral-950 border border-neutral-800 flex flex-col gap-2 hover:bg-neutral-900 hover:scale-105 transition-all duration-150"
            >
              {/* Top row: Icon + Title + Arrow */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center bg-neutral-900 group-hover:bg-neutral-800 flex-shrink-0 transition-colors duration-150">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-semibold text-white">
                    {card.title}
                  </h2>
                </div>
                <ArrowRightCircle className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors duration-150" />
              </div>

              {/* Description */}
              <p className="text-neutral-400 text-sm">{card.description}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Status indicator */}
      <div className="mt-6 p-4 bg-green-950 rounded-lg border border-green-800 flex items-center gap-3">
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
        <h4 className="text-sm font-semibold text-green-300">Sistema Online</h4>
      </div>
    </section>
  );
});

export default BtnsCards;
