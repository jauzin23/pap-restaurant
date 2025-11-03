"use client";

import React, { useState, useEffect } from "react";
import { auth } from "@/lib/api";
import "./WelcomeCard.scss";

const WelcomeCard = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    auth
      .get()
      .then((userData) => {
        setUser(userData);
      })
      .catch((err) => {
        console.error("Error fetching user:", err);
      });
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const userName =
    user?.name?.split(" ")[0] || user?.username?.split(" ")[0] || "utilizador";

  return (
    <div className="welcome-card">
      <div className="welcome-card__content">
        <div className="welcome-card__left">
          <div className="welcome-card__badge">Premium</div>
          <h2 className="welcome-card__title">
            {getGreeting()}, {userName}! Bem-vindo ao Mesa+
          </h2>
          <p className="welcome-card__description">
            Gerir o seu restaurante nunca foi tão simples. Aceda a todas as
            ferramentas para controlar mesas, pedidos, stock e equipa num só
            lugar.
          </p>
        </div>
        <div className="welcome-card__right">
          <div className="welcome-card__circles">
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>
            <div className="circle circle-4"></div>
            <div className="circle circle-5"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCard;
