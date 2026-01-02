"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check logged in user via custom API
  useEffect(() => {
    const checkUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const response = await fetch(
            `${
              process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
            }/api/auth/me`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (response.ok) {
            const currentUser = await response.json();
            setUser(currentUser);
          } else {
            setUser(null);
            localStorage.removeItem("token");
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Error checking user:", err);
        setUser(null);
      }
      setLoading(false);
    };

    checkUser();
  }, []);

  const value = {
    // State
    user,
    loading,

    // Functions
    setUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
