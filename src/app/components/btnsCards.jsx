"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  ShoppingCart,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";

const DashboardCards = () => {
  const router = useRouter();

  const cards = [
    {
      title: "Menu",
      description: "Ver e editar o menu",
      href: "/menu",
      icon: BookOpen,
      color: "text-orange-500",
    },
    {
      title: "Pedidos",
      description: "Acompanhar os pedidos",
      href: "/pedidos",
      icon: ShoppingCart,
      color: "text-blue-500",
    },
    {
      title: "Reservas",
      description: "Ver reservas atuais",
      href: "/reservas",
      icon: CalendarCheck,
      color: "text-green-500",
    },
  ];

  return (
    <div className="flex flex-wrap gap-6 justify-center mt-8 mb-8">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            onClick={() => router.push(card.href)}
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
            className="w-72 p-6 rounded-xl cursor-pointer shadow-lg relative overflow-hidden group bg-white"
          >
            {/* Gradient background circle */}
            <div
              className={`absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 bg-gradient-to-br ${card.color.replace(
                "text-",
                "from-"
              )} to-rose-500`}
            />

            {/* Icon */}
            <div className="mb-4 w-12 h-12 rounded-full flex items-center justify-center shadow-md bg-white">
              <Icon className={`w-8 h-8 ${card.color}`} />
            </div>

            {/* Card text */}
            <h2 className="text-xl font-semibold text-gray-800">
              {card.title}
            </h2>
            <p className="text-gray-500 mt-2 text-sm">{card.description}</p>

            {/* Bottom hover arrow */}
            <motion.div
              className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
              animate={{ x: 0 }}
              whileHover={{ x: 2 }}
            >
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default DashboardCards;
