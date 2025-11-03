// API client configuration for the custom Express API

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Get auth token from localStorage
const getAuthToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("auth_token");
  }
  return null;
};

// Set auth token in localStorage
const setAuthToken = (token) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }
};

// Remove auth token from localStorage
const removeAuthToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
  }
};

// Handle token expiration - simple logout and redirect
const handleTokenExpiration = () => {
  console.log("Token expired, logging out...");
  removeAuthToken();
  if (typeof window !== "undefined") {
    // Small delay to prevent redirect loops
    setTimeout(() => {
      window.location.href = "/login";
    }, 100);
  }
};

// Refresh access token using refresh token
const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  try {
    // Dispatch refresh start event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("token-refresh-start"));
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const data = await response.json();

    if (data.access_token) {
      setAuthToken(data.access_token);
      // Update refresh token if provided
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
      }

      // Dispatch refresh success event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("token-refresh-success"));
      }

      return data.access_token;
    }

    throw new Error("No access token in refresh response");
  } catch (error) {
    console.error("Token refresh failed:", error);

    // Dispatch refresh error event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("token-refresh-error"));
    }

    // Clear tokens and redirect to login
    removeAuthToken();
    if (typeof window !== "undefined") {
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000); // Give time for error notification to show
    }
    throw error;
  }
};

// Create API request headers
const getHeaders = (includeAuth = true) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
};

// Generic API request function with automatic token refresh
const apiRequest = async (endpoint, options = {}) => {
  const makeRequest = async (useToken = true) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...getHeaders(useToken && options.auth !== false),
        ...options.headers,
      },
    };

    console.log("API Request:", {
      url,
      method: config.method,
      hasBody: !!config.body,
      hasAuth: !!config.headers.Authorization,
    });

    const response = await fetch(url, config);
    console.log("API Response status:", response.status);

    return response;
  };

  try {
    // First attempt
    let response = await makeRequest();

    // Check if token is expired (401 or 403)
    if (
      (response.status === 401 || response.status === 403) &&
      options.auth !== false
    ) {
      console.log("Token expired or invalid");
      handleTokenExpiration();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Request failed" }));
      console.error("API Error response:", errorData);
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const responseData = await response.json();
    console.log(
      "API Success response:",
      endpoint.includes("login") ? "LOGIN_SUCCESS" : responseData
    );
    return responseData;
  } catch (error) {
    console.error("API Request failed:", error);
    throw error;
  }
};

// Authentication API
export const auth = {
  // Login user
  login: async (email, password) => {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    });

    if (response.token || response.access_token) {
      // Handle both token formats for compatibility
      const accessToken = response.token || response.access_token;
      setAuthToken(accessToken);
    }

    return response;
  },

  // Get current user
  get: async () => {
    return await apiRequest("/auth/me", { method: "GET" });
  },

  // Logout user
  logout: async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("Logout request failed:", error);
    } finally {
      removeAuthToken();
    }
  },
};

// Users API
export const users = {
  // List all users (for staff management)
  list: async () => {
    return await apiRequest("/users", { method: "GET" });
  },

  // Get specific user
  get: async (userId) => {
    return await apiRequest(`/users/${userId}`, { method: "GET" });
  },

  // Update user profile
  update: async (userId, userData) => {
    return await apiRequest(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  },
};

// Profile image API
export const profileImages = {
  // Get profile image bucket info for a user
  getBucketInfo: async (userId) => {
    return await apiRequest(`/users/${userId}/profile-bucket`, {
      method: "GET",
    });
  },

  // Upload profile image
  upload: async (imageData, userId = null) => {
    const payload = { imageData };
    if (userId) {
      payload.userId = userId;
    }
    return await apiRequest("/upload/profile-image", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Get profile image URL
  getPreviewUrl: (bucketId, options = {}) => {
    const params = new URLSearchParams();
    if (options.width) params.append("width", options.width);
    if (options.height) params.append("height", options.height);
    if (options.quality) params.append("quality", options.quality);

    const queryString = params.toString();
    return `${API_BASE_URL}/v1/storage/buckets/user-images/files/${bucketId}/preview${
      queryString ? `?${queryString}` : ""
    }`;
  },
};

// Export auth token utilities
export { getAuthToken, setAuthToken, removeAuthToken };

// Export API base URL for direct file access
export const API_FILES_URL = `${API_BASE_URL}/files`;

// Table Layouts API
export const tableLayouts = {
  // Get all table layouts
  list: async () => {
    return await apiRequest("/table-layouts", { method: "GET" });
  },

  // Get specific table layout
  get: async (layoutId) => {
    return await apiRequest(`/table-layouts/${layoutId}`, { method: "GET" });
  },

  // Create new table layout
  create: async (layoutData) => {
    return await apiRequest("/table-layouts", {
      method: "POST",
      body: JSON.stringify(layoutData),
    });
  },

  // Update table layout
  update: async (layoutId, layoutData) => {
    return await apiRequest(`/table-layouts/${layoutId}`, {
      method: "PUT",
      body: JSON.stringify(layoutData),
    });
  },

  // Delete table layout
  delete: async (layoutId) => {
    return await apiRequest(`/table-layouts/${layoutId}`, {
      method: "DELETE",
    });
  },
};

// Tables API
export const tables = {
  // Get tables for a layout
  getByLayout: async (layoutId) => {
    return await apiRequest(`/tables/layout/${layoutId}`, { method: "GET" });
  },

  // Get all tables (simplified for order system)
  list: async () => {
    return await apiRequest("/tables", { method: "GET" });
  },

  // Create new table
  create: async (tableData) => {
    return await apiRequest("/tables", {
      method: "POST",
      body: JSON.stringify(tableData),
    });
  },

  // Update table
  update: async (tableId, tableData) => {
    return await apiRequest(`/tables/${tableId}`, {
      method: "PUT",
      body: JSON.stringify(tableData),
    });
  },

  // Delete table
  delete: async (tableId) => {
    return await apiRequest(`/tables/${tableId}`, {
      method: "DELETE",
    });
  },
};

// Orders API
export const orders = {
  // Get all orders
  list: async () => {
    return await apiRequest("/orders", { method: "GET" });
  },

  // Get orders by table IDs
  getByTables: async (tableIds) => {
    const tableIdsParam = Array.isArray(tableIds)
      ? tableIds.join(",")
      : tableIds;
    return await apiRequest(`/orders/table/${tableIdsParam}`, {
      method: "GET",
    });
  },

  // Create single order
  create: async (orderData) => {
    return await apiRequest("/orders", {
      method: "POST",
      body: JSON.stringify(orderData),
    });
  },

  // Create batch orders
  createBatch: async (ordersData) => {
    return await apiRequest("/orders/batch", {
      method: "POST",
      body: JSON.stringify(ordersData),
    });
  },

  // Update order status
  update: async (orderId, orderData) => {
    return await apiRequest(`/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify(orderData),
    });
  },

  // Delete order
  delete: async (orderId) => {
    return await apiRequest(`/orders/${orderId}`, {
      method: "DELETE",
    });
  },
};

// Export a general API object for compatibility
export const api = {
  getCurrentUser: auth.get,
  login: auth.login,
  logout: auth.logout,
};
