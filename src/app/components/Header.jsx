"use client";

import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import clsx from "clsx";

const Header = ({ user, logo }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    // Replace with your logout logic
    console.log("Logging out...");
  };

  const formatTime = (date) => date.toLocaleTimeString();

  return (
    <header
      className="w-full flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white mb-8
"
    >
      {/* Left: Logo */}
      <div className="flex items-center space-x-3">
        <img src={logo} alt="Logo" className="w-10 h-10 rounded-full" />
        <h1 className="text-lg font-medium text-gray-800">Dashboard</h1>
      </div>

      {/* Right: User + Labels + Time + Logout */}
      <div className="flex items-center space-x-4 text-gray-700">
        {/* Clock (hidden on mobile) */}
        <span className={clsx("font-mono text-sm", "hidden md:inline")}>
          {formatTime(time)}
        </span>

        {/* User Info */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">{user.name}</span>

          {/* Labels badge */}
          {user.labels && user.labels.length > 0 && (
            <div className="flex space-x-1">
              {user.labels.map((label) => (
                <span
                  key={label}
                  className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center space-x-1 text-red-500 hover:text-red-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
