"use client";

import React from "react";
import Link from "next/link";
import "./not-found.scss";
import { BackgroundBeams } from "./components/BackgroundBeams";
import { Ghost, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="notfound-root">
      <BackgroundBeams />
      <div className="notfound-content card">
        <div className="icon-wrapper">
          <Ghost size={64} />
        </div>
        <h1 className="notfound-title">404</h1>
        <h2 className="notfound-subtitle">Página não encontrada</h2>
        <p className="notfound-desc">
          A página que procura não existe ou foi movida.
          <br />
          Volte para a página inicial ou explore outras secções.
        </p>
        <Link href="/" className="notfound-btn">
          <ArrowLeft size={18} style={{ marginRight: 8 }} /> Voltar ao início
        </Link>
      </div>
    </div>
  );
}
