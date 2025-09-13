"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import { useMediaQuery } from "react-responsive";
import Header from "../components/Header";

export default function Dashboard() {
  const isMobile = useMediaQuery({ maxWidth: 640 });
  const router = useRouter();
  const { user, loading } = useApp();

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [router, isMobile]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [router, loading, user]);

  return (
    <div className="min-h-screen bg-black font-lexend text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col py-8 px-4 min-h-screen">
        <div className="mb-12 flex items-center justify-center">
          <span className="text-2xl font-bold tracking-tight">Restaurante</span>
        </div>
        <nav className="flex flex-col gap-2">
          <a
            href="#"
            className="py-3 px-5 rounded-lg text-lg font-medium transition bg-neutral-900 hover:bg-neutral-800 focus:bg-neutral-800"
          >
            Menu
          </a>
          <a
            href="#"
            className="py-3 px-5 rounded-lg text-lg font-medium transition hover:bg-neutral-900 focus:bg-neutral-900"
          >
            Pedidos
          </a>
          <a
            href="#"
            className="py-3 px-5 rounded-lg text-lg font-medium transition hover:bg-neutral-900 focus:bg-neutral-900"
          >
            Stock
          </a>
          <a
            href="#"
            className="py-3 px-5 rounded-lg text-lg font-medium transition hover:bg-neutral-900 focus:bg-neutral-900"
          >
            Reservas
          </a>
        </nav>
        <div className="flex-1" />
        <div className="text-neutral-700 text-xs text-center mt-8">
          © 2025 Restaurante
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 px-8 py-10">
          <h1 className="text-[40px] font-semibold mb-8 tracking-tight">
            Dashboard
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Card 1: Today's Orders */}
            <div className="bg-neutral-900 rounded-2xl shadow-lg p-8 flex flex-col items-center border border-neutral-800">
              <span className="text-neutral-400 text-lg mb-2">
                Pedidos de Hoje
              </span>
              <span className="text-5xl font-semibold">128</span>
              <span className="text-green-500 mt-2 font-medium">
                +12% vs ontem
              </span>
            </div>
            {/* Card 2: Revenue */}
            <div className="bg-neutral-900 rounded-2xl shadow-lg p-8 flex flex-col items-center border border-neutral-800">
              <span className="text-neutral-400 text-lg mb-2">
                Receita de Hoje
              </span>
              <span className="text-5xl font-semibold">R$ 2.340</span>
              <span className="text-green-500 mt-2 font-medium">
                +8% vs ontem
              </span>
            </div>
            {/* Card 3: Tables Occupied */}
            <div className="bg-neutral-900 rounded-2xl shadow-lg p-8 flex flex-col items-center border border-neutral-800">
              <span className="text-neutral-400 text-lg mb-2">
                Mesas Ocupadas
              </span>
              <span className="text-5xl font-semibold">14/20</span>
              <span className="text-yellow-400 mt-2 font-medium">
                70% ocupação
              </span>
            </div>
          </div>
          {/* Row 2: More stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Card 4: Top Seller */}
            <div className="bg-neutral-900 rounded-2xl shadow-lg p-8 flex flex-col items-center border border-neutral-800">
              <span className="text-neutral-400 text-lg mb-2">
                Prato Mais Vendido
              </span>
              <span className="text-3xl font-semibold">
                Hambúrguer Clássico
              </span>
              <span className="text-neutral-500 mt-2">32 vendidos hoje</span>
            </div>
            {/* Card 5: Staff on Duty */}
            <div className="bg-neutral-900 rounded-2xl shadow-lg p-8 flex flex-col items-center border border-neutral-800">
              <span className="text-neutral-400 text-lg mb-2">
                Funcionários em Serviço
              </span>
              <span className="text-3xl font-semibold">7</span>
              <span className="text-neutral-500 mt-2">2 em pausa</span>
            </div>
          </div>
          {/* Row 3: Recent Activity */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-neutral-900 rounded-2xl shadow-lg p-8 border border-neutral-800">
              <span className="text-neutral-400 text-lg mb-4 block">
                Atividade Recente
              </span>
              <ul className="divide-y divide-neutral-800">
                <li className="py-2 flex justify-between">
                  <span>Mesa 5 pediu "Pizza Margherita"</span>
                  <span className="text-neutral-500">há 2 min</span>
                </li>
                <li className="py-2 flex justify-between">
                  <span>Mesa 2 pagou a conta</span>
                  <span className="text-neutral-500">há 5 min</span>
                </li>
                <li className="py-2 flex justify-between">
                  <span>Mesa 8 pediu "Coca-Cola"</span>
                  <span className="text-neutral-500">há 7 min</span>
                </li>
                <li className="py-2 flex justify-between">
                  <span>Mesa 1 pediu "Hambúrguer Clássico"</span>
                  <span className="text-neutral-500">há 10 min</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
