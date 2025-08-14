"use client";

import { useState, useEffect } from "react";
import { LogOut, Star, Users, ChefHat } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const Header = ({ user, logo }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => console.log("Logging out...");

  const formatTimeParts = (date) => {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return { h, m, s };
  };

  const timeParts = formatTimeParts(time);

  const digitAnimation = {
    initial: { opacity: 0, y: -5 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 5 },
    transition: { duration: 0.2 },
  };

  // Custom role styles
  const roleStyles = {
    manager: { color: "bg-yellow-500 text-black", icon: Star },
    staff: { color: "bg-blue-600 text-white", icon: Users },
    chef: { color: "bg-red-500 text-white", icon: ChefHat },
  };

  return (
    <header className="w-full flex justify-between items-center px-6 py-4 border-b border-neutral-800 bg-gradient-to-r from-black to-neutral-950 shadow-lg">
      {/* Left: Logo + Title */}
      <div className="flex items-center space-x-3">
        <motion.img
          src={logo}
          alt="Logo"
          className="w-10 h-10 rounded-full border border-neutral-700"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
        />
        <h1 className="text-lg font-semibold text-white tracking-wide">
          Dashboard
        </h1>
      </div>

      {/* Right: Clock + User Info + Logout */}
      <div className="flex items-center space-x-6">
        {/* Clock */}
        <div
          className={clsx("font-mono text-sm text-neutral-400 hidden md:flex")}
        >
          {["h", "m", "s"].map((part, idx) => (
            <span key={idx} className="flex">
              {Object.values(timeParts)
                [idx].split("")
                .map((digit, i) => (
                  <AnimatePresence key={i} mode="wait">
                    <motion.span key={digit + i} {...digitAnimation}>
                      {digit}
                    </motion.span>
                  </AnimatePresence>
                ))}
              {idx < 2 && <span className="mx-1">:</span>}
            </span>
          ))}
        </div>

        {/* User Info + Roles */}
        <div className="flex flex-col md:flex-row md:items-center md:space-x-3">
          <span className="text-sm font-medium text-white">{user.name}</span>
          {user.labels && user.labels.length > 0 && (
            <div className="flex space-x-2 mt-1 md:mt-0">
              {user.labels.map((label) => {
                const style = roleStyles[label] || {
                  color: "bg-gray-700 text-white",
                  icon: null,
                };
                const Icon = style.icon;
                return (
                  <span
                    key={label}
                    className={clsx(
                      "flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200",
                      style.color,
                      "hover:brightness-110"
                    )}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    <span>{label}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Logout */}
        <motion.button
          onClick={handleLogout}
          className="flex items-center space-x-2 text-neutral-400 hover:text-red-500 transition-colors"
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.95 }}
        >
          <LogOut className="w-4 h-4" strokeWidth={2} />
          <span className="text-sm font-medium">Logout</span>
        </motion.button>
      </div>
    </header>
  );
};

export default Header;
