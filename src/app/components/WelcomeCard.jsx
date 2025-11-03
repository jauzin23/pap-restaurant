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
            <div className="orbit-container">
              <div className="circle circle-1"></div>
              <div className="circle circle-2"></div>
              <div className="circle circle-3"></div>
            </div>
            <svg
              className="logo-center"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="brandGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#f472b6" />
                </linearGradient>
                <filter
                  id="simpleShadow"
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="4"
                    floodColor="#000"
                    floodOpacity="0.1"
                  />
                </filter>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="50"
                fill="#0f172a"
                filter="url(#simpleShadow)"
              />
              <circle
                cx="50"
                cy="50"
                r="47"
                fill="url(#brandGradient)"
                opacity="0.15"
              />
              <circle
                cx="50"
                cy="50"
                r="47"
                fill="none"
                stroke="url(#brandGradient)"
                strokeWidth="2"
                opacity="0.6"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.5"
                opacity="0.2"
              />
              <g transform="translate(50,50) scale(1.3) translate(-50,-50)">
                <path
                  d="M30 45 Q30 35 40 35 Q45 30 50 30 Q55 30 60 35 Q70 35 70 45 Q70 50 65 50 L65 60 Q65 65 60 65 L40 65 Q35 65 35 60 L35 50 Q30 50 30 45 Z"
                  fill="#ffffff"
                  stroke="#e2e8f0"
                  strokeWidth="2"
                />
                <ellipse
                  cx="45"
                  cy="42"
                  rx="3"
                  ry="2"
                  fill="#ffffff"
                  opacity="0.7"
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCard;
