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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-neutral-950 to-slate-900 text-white flex font-lexend">
      {/* Enhanced Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-slate-950/50 to-neutral-950/80 backdrop-blur-xl border-r border-slate-800/50 flex flex-col py-8 px-6 min-h-screen shadow-2xl">
        <div className="mb-16 flex items-center justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-xl"></div>
          <span className="text-3xl font-bold tracking-tight relative bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Mesa+
          </span>
        </div>
        <nav className="flex flex-col gap-3">
          <a
            href="#"
            className="group py-4 px-6 rounded-2xl text-lg font-semibold transition-all duration-300 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-400/50 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            <span className="relative flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              Menu
            </span>
          </a>
          <a
            href="#"
            className="group py-4 px-6 rounded-2xl text-lg font-semibold transition-all duration-300 hover:bg-gradient-to-r hover:from-slate-800/50 hover:to-neutral-800/50 border border-transparent hover:border-slate-700/50 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-slate-700/10 to-neutral-700/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            <span className="relative flex items-center gap-3">
              <div className="w-2 h-2 bg-slate-400 rounded-full opacity-60 group-hover:opacity-100 group-hover:bg-blue-400 transition-all duration-300"></div>
              Pedidos
            </span>
          </a>
          <a
            href="#"
            className="group py-4 px-6 rounded-2xl text-lg font-semibold transition-all duration-300 hover:bg-gradient-to-r hover:from-slate-800/50 hover:to-neutral-800/50 border border-transparent hover:border-slate-700/50 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-slate-700/10 to-neutral-700/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            <span className="relative flex items-center gap-3">
              <div className="w-2 h-2 bg-slate-400 rounded-full opacity-60 group-hover:opacity-100 group-hover:bg-blue-400 transition-all duration-300"></div>
              Stock
            </span>
          </a>
          <a
            href="#"
            className="group py-4 px-6 rounded-2xl text-lg font-semibold transition-all duration-300 hover:bg-gradient-to-r hover:from-slate-800/50 hover:to-neutral-800/50 border border-transparent hover:border-slate-700/50 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-slate-700/10 to-neutral-700/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            <span className="relative flex items-center gap-3">
              <div className="w-2 h-2 bg-slate-400 rounded-full opacity-60 group-hover:opacity-100 group-hover:bg-blue-400 transition-all duration-300"></div>
              Reservas
            </span>
          </a>
        </nav>
        <div className="flex-1" />
        <div className="text-slate-500 text-sm text-center mt-8 font-medium">
          © 2025 Mesa+ Restaurant
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-600/10 to-pink-600/10 rounded-full blur-3xl"></div>
        
        <Header />
        <div className="flex-1 px-10 py-12 relative z-10">
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-4 tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-slate-400 text-xl font-medium">Visão geral do seu restaurante em tempo real</p>
          </div>

          {/* Enhanced Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {/* Enhanced Card 1: Today's Orders */}
            <div className="group relative bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-slate-700/50 hover:border-blue-500/30 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <div className="w-6 h-6 bg-white rounded-lg"></div>
                  </div>
                  <div className="text-blue-400 text-sm font-semibold bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                    +12%
                  </div>
                </div>
                <h3 className="text-slate-400 text-lg mb-3 font-medium">Pedidos de Hoje</h3>
                <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">128</div>
                <p className="text-slate-500 text-sm">vs ontem: +15 pedidos</p>
              </div>
            </div>

            {/* Enhanced Card 2: Revenue */}
            <div className="group relative bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-slate-700/50 hover:border-green-500/30 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25">
                    <div className="w-6 h-6 bg-white rounded-lg"></div>
                  </div>
                  <div className="text-green-400 text-sm font-semibold bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                    +8%
                  </div>
                </div>
                <h3 className="text-slate-400 text-lg mb-3 font-medium">Receita de Hoje</h3>
                <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-white to-green-200 bg-clip-text text-transparent">R$ 2.340</div>
                <p className="text-slate-500 text-sm">vs ontem: +R$ 187</p>
              </div>
            </div>

            {/* Enhanced Card 3: Tables Occupied */}
            <div className="group relative bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-slate-700/50 hover:border-amber-500/30 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <div className="w-6 h-6 bg-white rounded-lg"></div>
                  </div>
                  <div className="text-amber-400 text-sm font-semibold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                    70%
                  </div>
                </div>
                <h3 className="text-slate-400 text-lg mb-3 font-medium">Mesas Ocupadas</h3>
                <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-white to-amber-200 bg-clip-text text-transparent">14/20</div>
                <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                  <div className="bg-gradient-to-r from-amber-500 to-amber-400 h-2 rounded-full" style={{width: '70%'}}></div>
                </div>
                <p className="text-slate-500 text-sm">6 mesas disponíveis</p>
              </div>
            </div>
          </div>
          {/* Enhanced Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {/* Enhanced Card 4: Top Seller */}
            <div className="group relative bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-slate-700/50 hover:border-purple-500/30 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                    <div className="w-6 h-6 bg-white rounded-lg"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <span className="text-purple-400 text-sm font-semibold">Em destaque</span>
                  </div>
                </div>
                <h3 className="text-slate-400 text-lg mb-4 font-medium">Prato Mais Vendido</h3>
                <div className="text-3xl font-bold mb-3 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Hambúrguer Clássico
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-slate-500 text-sm">32 vendidos hoje</p>
                  <div className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm font-medium">
                    #1
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Card 5: Staff on Duty */}
            <div className="group relative bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-slate-700/50 hover:border-cyan-500/30 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                    <div className="w-6 h-6 bg-white rounded-lg"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-semibold">Ativo</span>
                  </div>
                </div>
                <h3 className="text-slate-400 text-lg mb-4 font-medium">Funcionários em Serviço</h3>
                <div className="text-3xl font-bold mb-3 bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">7</div>
                <div className="flex items-center justify-between">
                  <p className="text-slate-500 text-sm">2 em pausa</p>
                  <div className="bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-full text-sm font-medium">
                    5 ativos
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Enhanced Recent Activity */}
          <div className="max-w-6xl mx-auto">
            <div className="group relative bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 p-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                      Atividade Recente
                    </h3>
                    <p className="text-slate-400">Últimas atualizações do restaurante</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl flex items-center justify-center shadow-lg">
                    <div className="w-6 h-6 bg-white rounded-lg"></div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-slate-800/30 to-transparent rounded-2xl border border-slate-700/30 hover:border-slate-600/50 transition-all duration-300">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
                      <div className="w-6 h-6 bg-white rounded-lg"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium mb-1">Mesa 5 pediu &quot;Pizza Margherita&quot;</p>
                      <p className="text-slate-400 text-sm">Novo pedido adicionado ao sistema</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-300 text-sm font-medium">há 2 min</p>
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-1 ml-auto animate-pulse"></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-slate-800/30 to-transparent rounded-2xl border border-slate-700/30 hover:border-slate-600/50 transition-all duration-300">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25 flex-shrink-0">
                      <div className="w-6 h-6 bg-white rounded-lg"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium mb-1">Mesa 2 pagou a conta</p>
                      <p className="text-slate-400 text-sm">Pagamento processado com sucesso</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-300 text-sm font-medium">há 5 min</p>
                      <div className="w-2 h-2 bg-slate-400 rounded-full mt-1 ml-auto"></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-slate-800/30 to-transparent rounded-2xl border border-slate-700/30 hover:border-slate-600/50 transition-all duration-300">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
                      <div className="w-6 h-6 bg-white rounded-lg"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium mb-1">Mesa 8 pediu &quot;Coca-Cola&quot;</p>
                      <p className="text-slate-400 text-sm">Bebida adicionada ao pedido</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-300 text-sm font-medium">há 7 min</p>
                      <div className="w-2 h-2 bg-slate-400 rounded-full mt-1 ml-auto"></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 p-6 bg-gradient-to-r from-slate-800/30 to-transparent rounded-2xl border border-slate-700/30 hover:border-slate-600/50 transition-all duration-300">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25 flex-shrink-0">
                      <div className="w-6 h-6 bg-white rounded-lg"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium mb-1">Mesa 1 pediu &quot;Hambúrguer Clássico&quot;</p>
                      <p className="text-slate-400 text-sm">Prato principal adicionado</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-300 text-sm font-medium">há 10 min</p>
                      <div className="w-2 h-2 bg-slate-400 rounded-full mt-1 ml-auto"></div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <button className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 rounded-xl font-medium transition-all duration-300 border border-slate-600/50 hover:border-slate-500/50">
                    Ver todas as atividades
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
