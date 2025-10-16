"use client";

import React, { useState, useEffect } from "react";
import { BackgroundBeams } from "../components/BackgroundBeams";
import { Eye, EyeOff, Mail, Lock, LogIn } from "lucide-react";
import { login, isAuthenticated } from "../../lib/auth";

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if already authenticated and redirect
  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = "/pagina-teste-new";
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    console.log("Attempting login with:", {
      email: formData.email,
      password: formData.password ? "[HIDDEN]" : "EMPTY",
    });

    try {
      const result = await login(formData.email, formData.password);
      console.log("Login result:", result);

      if (result.success) {
        console.log("Login successful:", result.user);
        // Redirect to dashboard
        window.location.href = "/pagina-teste-new";
      } else {
        console.error("Login failed with result:", result);
        setError(result.error || "Login failed");
      }
    } catch (err) {
      console.error("Login error details:", err);
      setError(`Erro: ${err.message || "Erro de conexão"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden font-['Manrope']">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:32px_32px] opacity-60" />

      {/* Background Beams */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: -1,
        }}
      >
        <div className="relative bg-gray-900 text-white min-h-screen">
          <BackgroundBeams pathCount={15} />
        </div>
      </div>

      {/* Gradient Orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-indigo-400/20 to-cyan-400/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-white/80 backdrop-blur-sm border-r border-gray-200/80 flex-col justify-center px-16">
          <div className="max-w-md">
            {/* Hero Content */}
            <div className="space-y-6">
              <h1 className="text-4xl font-bold text-gray-900 leading-tight">
                Bem-vindo de volta ao
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {" "}
                  Mesa+
                </span>
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed">
                Gerencie o seu restaurante com facilidade
              </p>
            </div>

            {/* Features */}
            <div className="mt-6 space-y-4">
              {[
                "Monitorização em tempo real",
                "Gestão inteligente de mesas",
                "Relatórios detalhados",
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="text-gray-700 font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M+</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Mesa+</span>
            </div>

            {/* Login Card */}
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-2xl p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.05),0_12px_24px_rgba(0,0,0,0.05)]">
              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Iniciar Sessão
                </h2>
                <p className="text-gray-600">
                  Entre na sua conta para continuar
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      name="email"
                      placeholder="O seu email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                      className="w-full h-12 pl-4 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 disabled:opacity-50"
                    />
                    <Mail className="absolute right-3 top-3.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="A sua password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                      className="w-full h-12 pl-4 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors duration-200 disabled:opacity-50"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !formData.email || !formData.password}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:from-blue-700 focus:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group shadow-lg shadow-blue-500/25"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>A entrar...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                      <span>Entrar</span>
                    </>
                  )}
                </button>
              </form>

              {/* Test Credentials */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-blue-800 text-sm font-semibold mb-2">
                  Credenciais de teste:
                </p>
                <p className="text-blue-700 text-xs">
                  Email: admin@restaurant.com
                </p>
                <p className="text-blue-700 text-xs">Senha: admin123</p>
                <p className="text-blue-600 text-xs mt-2">
                  API Server: localhost:3001
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-8">
              <p className="text-xs text-gray-500">
                © 2025 Mesa+. Todos os direitos reservados.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Feito por João Monteiro
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css?family=Manrope:200,300,regular,500,600,700,800");
      `}</style>
    </div>
  );
};

export default LoginPage;
