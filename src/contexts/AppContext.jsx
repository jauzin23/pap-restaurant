"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Client, Databases, Account } from "appwrite";

// Initialize Appwrite
const client = new Client()
  .setEndpoint("https://appwrite.jauzin23.com/v1")
  .setProject("689c99120038471811fa");

const databases = new Databases(client);
const account = new Account(client);

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

  // Verificar utilizador logado
  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await account.get();
        setUser(currentUser);
        console.log("Utilizador logado:", currentUser.name);
      } catch (err) {
        console.log("Nenhum utilizador logado");
        setUser(null);
      }
      setLoading(false);
    };

    checkUser();
  }, []);

  const value = {
    // Appwrite
    client,
    databases,
    account,

    // Estado
    user,
    loading,

    // Funções
    setUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
