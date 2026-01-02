"use client";

import React, { useState, useEffect } from "react";
import { BackgroundBeams } from "../components/BackgroundBeams";
import { Eye, EyeOff, Mail, Lock, LogIn } from "lucide-react";
import { login, isAuthenticated } from "../../lib/auth";
import "./page.scss";

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
      window.location.href = "/";
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

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        // Redirect to dashboard
        window.location.href = "/";
      } else {
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
    <div className="login-page">
      {/* Background Beams */}
      <div className="beams-container">
        <div className="beams-wrapper">
          <BackgroundBeams pathCount={15} />
        </div>
      </div>

      {/* Gradient Orbs */}
      <div className="gradient-orb gradient-orb--top-left" />
      <div className="gradient-orb gradient-orb--bottom-right" />

      <div className="login-container">
        {/* Left Side - Branding */}
        <div className="branding-panel">
          <div className="branding-content">
            {/* Hero Content */}
            <div className="hero-section">
              <h1 className="hero-title">
                Bem-vindo de volta ao
                <span className="brand-gradient"> Mesa+</span>
              </h1>
              <p className="hero-description">
                Gerencie o seu restaurante com facilidade
              </p>
            </div>

            {/* Features */}
            <div className="features-list">
              {[
                "Monitorização em tempo real",
                "Gestão inteligente de mesas",
                "Relatórios detalhados",
              ].map((feature, index) => (
                <div key={index} className="feature-item">
                  <div className="feature-dot" />
                  <span className="feature-text">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="form-panel">
          <div className="form-wrapper">
            {/* Mobile Logo */}
            <div className="mobile-logo">
              <div className="logo-icon">
                <span>M+</span>
              </div>
              <span className="logo-text">Mesa+</span>
            </div>

            {/* Login Card */}
            <div className="login-card">
              {/* Header */}
              <div className="card-header">
                <h2 className="card-title">Iniciar Sessão</h2>
                <p className="card-subtitle">
                  Entre na sua conta para continuar
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="login-form">
                {/* Email Field */}
                <div className="form-field">
                  <label htmlFor="email">Email</label>
                  <div className="input-wrapper">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="O seu email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                    />
                    <Mail className="input-icon" size={20} />
                  </div>
                </div>

                {/* Password Field */}
                <div className="form-field">
                  <label htmlFor="password">Password</label>
                  <div className="input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      placeholder="A sua password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      className="input-icon clickable"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="error-message">
                    <p>{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !formData.email || !formData.password}
                  className="submit-button"
                >
                  {isLoading ? (
                    <>
                      <div className="spinner" />
                      <span>A entrar...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="button-icon" size={16} />
                      <span>Entrar</span>
                    </>
                  )}
                </button>
              </form>

              {/* Test Credentials */}
              <div className="test-credentials">
                <p className="credentials-title">Credenciais de teste:</p>
                <p className="credentials-text">
                  Email: jaam.joao.monteiro.2008@gmail.com
                </p>
                <p className="credentials-text">Senha: 123456789</p>
                <p className="api-server">API Server: localhost:3001</p>
              </div>
            </div>

            {/* Footer */}
            <div className="login-footer">
              <p className="copyright">
                © 2025 Mesa+. Todos os direitos reservados.
              </p>
              <p className="made-by">Feito por João Monteiro</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
