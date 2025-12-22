// Authentication utilities for the restaurant app

import React from "react";
import { auth, getAuthToken, removeAuthToken, handleTokenExpiration } from "./api";

// Check if an error is a token/auth error
export const isTokenError = (error) => {
  if (!error) return false;

  const errorStr = typeof error === 'string' ? error : error.message || '';

  return (
    errorStr.includes("Token inválido") ||
    errorStr.includes("expirado") ||
    errorStr.includes("invalid token") ||
    errorStr.includes("expired") ||
    errorStr.includes("Session expired") ||
    errorStr.includes("Authentication failed") ||
    errorStr.includes("401") ||
    errorStr.includes("403") ||
    errorStr.includes("Unauthorized")
  );
};

// Handle any API error - automatically logs out if token error
export const handleApiError = (error, response = null) => {
  console.error("API Error:", error);

  // Check response status
  if (response && (response.status === 401 || response.status === 403)) {
    console.log("Auth error detected in response status - logging out");
    handleTokenExpiration();
    return;
  }

  // Check error message
  if (isTokenError(error)) {
    console.log("Token error detected - logging out");
    handleTokenExpiration();
  }
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getAuthToken();
};

// Login function with automatic token handling
export const login = async (email, password) => {
  try {
    const response = await auth.login(email, password);
    return {
      success: true,
      user: response.user,
      token: response.token || response.access_token,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Logout function with proper cleanup
export const logout = async () => {
  try {
    await auth.logout();
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    // Always remove tokens and redirect
    removeAuthToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }
};

// Get current user with automatic token handling
export const getCurrentUser = async () => {
  try {
    return await auth.get();
  } catch (error) {
    console.error("Get current user error:", error);

    // If getting user fails and it's an auth error, logout
    if (
      error.message.includes("Session expired") ||
      error.message.includes("Authentication failed")
    ) {
      await logout();
    }

    throw error;
  }
};

// Auth guard hook for protected routes with token validation
export const useAuthGuard = () => {
  const [isValidating, setIsValidating] = React.useState(true);
  const [isAuthValid, setIsAuthValid] = React.useState(false);

  React.useEffect(() => {
    const validateToken = async () => {
      if (!isAuthenticated()) {
        setIsValidating(false);
        setIsAuthValid(false);
        return;
      }

      try {
        // Try to get current user to validate token
        await getCurrentUser();
        setIsAuthValid(true);
      } catch (error) {
        // Token is invalid, getCurrentUser handles logout
        setIsAuthValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, []);

  React.useEffect(() => {
    if (!isValidating && !isAuthValid && typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, [isValidating, isAuthValid]);

  return { isValidating, isAuthenticated: isAuthValid };
};

// AuthGuard component for protecting routes
export const AuthGuard = ({ children }) => {
  const { isValidating, isAuthenticated } = useAuthGuard();

  if (isValidating) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'white'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #f0f0f0',
          borderTop: '3px solid #ff6b35',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return children;
};
