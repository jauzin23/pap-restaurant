"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "antd";
import {
  Plus,
  AlertTriangle,
  RefreshCw,
  Package,
  Minus,
  ShoppingCart,
  Search,
  X,
  Eye,
  Warehouse,
  Edit,
  Save,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Upload,
  Trash2,
  Image as ImageIcon,
  Crop,
  Wand2,
  MapPin,
  Truck,
  Check,
} from "lucide-react";
import { Cropper } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import NumberFlow from '@number-flow/react';
import "./StockComponent.scss";

// Import auth from your API module
import { getAuthToken } from "@/lib/api";

// Import WebSocket hook
import { useStockWebSocket } from "@/hooks/useStockWebSocket";

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// API call helper with authentication
const apiCall = async (endpoint, options = {}) => {
  const token = getAuthToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Network error" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export default function StockComponent() {
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [movementCart, setMovementCart] = useState({});
  const [editingRows, setEditingRows] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    description: "",
    supplier: "",
    location: "",
    cost_price: 0,
    qty: 0,
    min_qty: 0,
  });
  const [addItemLoading, setAddItemLoading] = useState(false);

  // Image states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentImageId, setCurrentImageId] = useState(null);
  const fileInputRef = useRef(null);

  // Image cropper states - simplified for react-advanced-cropper
  const [showCropper, setShowCropper] = useState(false);
  const [cropImage, setCropImage] = useState(null);
  const [croppedImageBlob, setCroppedImageBlob] = useState(null);
  const cropperRef = useRef(null);

  // Background removal states
  const [removingBackground, setRemovingBackground] = useState(false);
  const [backgroundRemovalPreview, setBackgroundRemovalPreview] = useState(null);
  const [originalImageBeforeRemoval, setOriginalImageBeforeRemoval] = useState(null);

  // Dropdown data states
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);

  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false);

  const ITEMS_PER_PAGE = 50;

  // Image handling functions
  const getImageUrl = useCallback((imageId) => {
    if (!imageId) return null;

    // Simply return the URL without state updates to avoid setState during render
    try {
      return `${API_BASE_URL}/files/imagens-stock/${imageId}`;
    } catch (error) {
      console.error("Error getting image URL:", error);
      return null;
    }
  }, []);

  const handleImageSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Por favor selecione uma imagem válida (PNG, JPG, WEBP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB
      alert("A imagem não pode exceder 5MB");
      return;
    }

    setSelectedImage(file);

    // Show cropper with the selected image
    const reader = new FileReader();
    reader.onload = (e) => {
      setCropImage(e.target.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  }, []);

  // Cropper functions using react-advanced-cropper
  const handleCropperClose = () => {
    setShowCropper(false);
    setCropImage(null);
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = () => {
    if (cropperRef.current) {
      const canvas = cropperRef.current.getCanvas();
      if (canvas) {
        canvas.toBlob((blob) => {
          if (blob) {
            setCroppedImageBlob(blob);
            const url = URL.createObjectURL(blob);
            setImagePreview(url);
            setShowCropper(false);
          }
        }, "image/png");
      }
    }
  };

  const resetImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
    setCroppedImageBlob(null);
    setCurrentImageId(null);
    setShowCropper(false);
    setCropImage(null);
    setBackgroundRemovalPreview(null);
    setOriginalImageBeforeRemoval(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Background removal function
  const removeBackground = async () => {
    if (!imagePreview) {
      alert("Por favor, selecione uma imagem primeiro");
      return;
    }

    try {
      setRemovingBackground(true);

      // Get the image data
      let imageDataToSend;

      if (croppedImageBlob) {
        // Convert blob to base64
        const reader = new FileReader();
        imageDataToSend = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(croppedImageBlob);
        });
      } else if (imagePreview) {
        // If it's a data URL or blob URL
        if (imagePreview.startsWith("data:")) {
          imageDataToSend = imagePreview;
        } else if (imagePreview.startsWith("blob:")) {
          const response = await fetch(imagePreview);
          const blob = await response.blob();
          const reader = new FileReader();
          imageDataToSend = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      }

      // Save original image before removal (for undo)
      setOriginalImageBeforeRemoval({
        preview: imagePreview,
        blob: croppedImageBlob,
      });

      // Call the background removal API
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/upload/remove-background`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          imageData: imageDataToSend,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao remover fundo");
      }

      const data = await response.json();

      // Convert the returned base64 to blob
      const base64Response = data.imageData;
      const base64Data = base64Response.replace(/^data:image\/[^;]+;base64,/, "");
      const binaryData = atob(base64Data);
      const arrayBuffer = new Uint8Array(binaryData.length);

      for (let i = 0; i < binaryData.length; i++) {
        arrayBuffer[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([arrayBuffer], { type: "image/png" });

      // Update the preview and blob
      const previewUrl = URL.createObjectURL(blob);
      setImagePreview(previewUrl);
      setCroppedImageBlob(blob);
      setBackgroundRemovalPreview(previewUrl);

      alert("Fundo removido com sucesso!");
    } catch (error) {
      console.error("Error removing background:", error);
      alert("Erro ao remover fundo da imagem");
    } finally {
      setRemovingBackground(false);
    }
  };

  const undoBackgroundRemoval = () => {
    if (originalImageBeforeRemoval) {
      setImagePreview(originalImageBeforeRemoval.preview);
      setCroppedImageBlob(originalImageBeforeRemoval.blob);
      setBackgroundRemovalPreview(null);
      setOriginalImageBeforeRemoval(null);
    }
  };

  const uploadImage = useCallback(async () => {
    if (!croppedImageBlob) return null;

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(croppedImageBlob);
      });

      const imageData = await base64Promise;
      const fileName = `stock-${Date.now()}.jpg`;

      const response = await apiCall("/stock/upload-image", {
        method: "POST",
        body: JSON.stringify({
          imageData,
          filename: fileName,
        }),
      });

      return response.$id;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error("Erro ao fazer upload da imagem");
    }
  }, [croppedImageBlob]);

  // WebSocket event handlers
  const handleItemCreated = useCallback((item) => {
    setStockItems((prev) => {
      // Check if item already exists (avoid duplicates)
      if (prev.some((i) => i.$id === item.$id)) {
        return prev;
      }
      return [...prev, item].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const handleItemUpdated = useCallback((item) => {
    setStockItems((prev) =>
      prev.map((i) => (i.$id === item.$id ? item : i))
    );
  }, []);

  const handleItemDeleted = useCallback((data) => {
    setStockItems((prev) => prev.filter((i) => i.$id !== data.id));
    // Also remove from movement cart if present
    setMovementCart((prev) => {
      const { [data.id]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleCategoryCreated = useCallback((category) => {
    setCategories((prev) => {
      if (prev.some((c) => c.$id === category.$id)) {
        return prev;
      }
      return [...prev, category].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const handleCategoryUpdated = useCallback((category) => {
    setCategories((prev) =>
      prev.map((c) => (c.$id === category.$id ? category : c))
    );
  }, []);

  const handleCategoryDeleted = useCallback((data) => {
    setCategories((prev) => prev.filter((c) => c.$id !== data.id));
  }, []);

  const handleSupplierCreated = useCallback((supplier) => {
    setSuppliers((prev) => {
      if (prev.some((s) => s.$id === supplier.$id)) {
        return prev;
      }
      return [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const handleSupplierUpdated = useCallback((supplier) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.$id === supplier.$id ? supplier : s))
    );
  }, []);

  const handleSupplierDeleted = useCallback((data) => {
    setSuppliers((prev) => prev.filter((s) => s.$id !== data.id));
  }, []);

  const handleLocationCreated = useCallback((location) => {
    setLocations((prev) => {
      if (prev.some((l) => l.$id === location.$id)) {
        return prev;
      }
      return [...prev, location].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const handleLocationUpdated = useCallback((location) => {
    setLocations((prev) =>
      prev.map((l) => (l.$id === location.$id ? location : l))
    );
  }, []);

  const handleLocationDeleted = useCallback((data) => {
    setLocations((prev) => prev.filter((l) => l.$id !== data.id));
  }, []);

  const handleAlert = useCallback((alert) => {
    // You can add toast notifications here if you have a toast library
    console.log('[Stock Alert]', alert.status, alert.message);

    // Browser notification (if permitted)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Stock Alert', {
        body: alert.message,
        icon: '/icon.png',
        tag: `stock-alert-${alert.$id}`,
      });
    }
  }, []);

  // Initialize WebSocket connection
  const { socket, isConnected } = useStockWebSocket({
    onItemCreated: handleItemCreated,
    onItemUpdated: handleItemUpdated,
    onItemDeleted: handleItemDeleted,
    onCategoryCreated: handleCategoryCreated,
    onCategoryUpdated: handleCategoryUpdated,
    onCategoryDeleted: handleCategoryDeleted,
    onSupplierCreated: handleSupplierCreated,
    onSupplierUpdated: handleSupplierUpdated,
    onSupplierDeleted: handleSupplierDeleted,
    onLocationCreated: handleLocationCreated,
    onLocationUpdated: handleLocationUpdated,
    onLocationDeleted: handleLocationDeleted,
    onAlert: handleAlert,
    onConnected: () => setWsConnected(true),
    onDisconnected: () => setWsConnected(false),
    onError: (error) => console.error('[Stock WS Error]', error),
  });

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Memoized computed values for performance
  const criticalStock = useMemo(
    () => stockItems.filter((item) => item.qty <= item.min_qty),
    [stockItems]
  );

  const warningStock = useMemo(
    () =>
      stockItems.filter(
        (item) => item.qty > item.min_qty && item.qty <= item.min_qty + 5
      ),
    [stockItems]
  );

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return stockItems;
    return stockItems.filter(
      (item) =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.category &&
          item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.supplier &&
          item.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [stockItems, searchTerm]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
  const paginatedItems = useMemo(
    () =>
      filteredItems.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      ),
    [filteredItems, currentPage]
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Initial data fetch
  useEffect(() => {
    fetchStock();
  }, []);

  // Fetch dropdown data for the add modal
  const fetchDropdownData = useCallback(async () => {
    setDropdownsLoading(true);
    try {
      const [categoriesRes, suppliersRes, locationsRes] = await Promise.all([
        apiCall("/stock/categories"),
        apiCall("/stock/suppliers"),
        apiCall("/stock/locations"),
      ]);

      setCategories(categoriesRes.documents || []);
      setSuppliers(suppliersRes.documents || []);
      setLocations(locationsRes.documents || []);
    } catch (err) {
      console.error("Error fetching dropdown data:", err);
      setCategories([]);
      setSuppliers([]);
      setLocations([]);
    } finally {
      setDropdownsLoading(false);
    }
  }, []);

  // Fetch dropdown data when add modal opens
  useEffect(() => {
    if (isAddModalOpen && categories.length === 0) {
      fetchDropdownData();
    }
  }, [isAddModalOpen, categories.length, fetchDropdownData]);

  const fetchStock = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    try {
      const response = await apiCall("/stock/items");
      setStockItems(response.documents || []);
    } catch (err) {
      console.error("Error fetching stock:", err);
      alert("Erro ao carregar stock. Verifique se está autenticado.");
      setStockItems([]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const addToMovementCart = useCallback((itemId, quantity) => {
    setMovementCart((prev) => {
      const currentQty = prev[itemId] || 0;
      const newQty = currentQty + quantity;

      // Remove item if quantity becomes 0
      if (newQty === 0) {
        const { [itemId]: removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [itemId]: newQty,
      };
    });
  }, []);

  const removeFromMovementCart = useCallback((itemId) => {
    setMovementCart((prev) => {
      const { [itemId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearMovementCart = useCallback(() => {
    setMovementCart({});
  }, []);

  const processMovements = useCallback(async () => {
    if (!Object.keys(movementCart).length || loading) return;

    setLoading(true);
    try {
      const updates = [];

      for (const [itemId, qty] of Object.entries(movementCart)) {
        const item = stockItems.find((i) => i.$id === itemId);
        if (!item) continue;

        const newQty = Math.max(0, item.qty + qty);
        updates.push(
          apiCall(`/stock/items/${itemId}`, {
            method: "PUT",
            body: JSON.stringify({ qty: newQty }),
          })
        );
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        setMovementCart({});
        await fetchStock();
      }
    } catch (err) {
      console.error("Error updating stock:", err);
      alert("Erro ao atualizar stock. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [movementCart, loading, fetchStock, stockItems]);

  const handleSaveEdit = useCallback(
    async (itemId) => {
      const edits = editingRows[itemId];
      if (!edits || loading) return;

      setLoading(true);
      try {
        await apiCall(`/stock/items/${itemId}`, {
          method: "PUT",
          body: JSON.stringify({
            qty: Math.max(0, parseInt(edits.qty) || 0),
            min_qty: Math.max(0, parseInt(edits.min_qty) || 0),
            cost_price: Math.max(0, parseFloat(edits.cost_price) || 0),
          }),
        });

        setEditingRows((prev) => {
          const { [itemId]: removed, ...rest } = prev;
          return rest;
        });

        await fetchStock();
      } catch (err) {
        console.error("Error updating item:", err);
        alert("Erro ao atualizar item. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [editingRows, loading, fetchStock]
  );

  const handleAddNewItem = useCallback(async () => {
    if (addItemLoading) return;

    const trimmedName = newItem.name?.trim();
    if (!trimmedName) {
      alert("Nome do produto é obrigatório");
      return;
    }

    setAddItemLoading(true);
    try {
      let imageId = null;

      // Upload image if one was selected and cropped
      if (croppedImageBlob) {
        imageId = await uploadImage();
      }

      await apiCall("/stock/items", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          category: newItem.category?.trim() || null,
          description: newItem.description?.trim() || null,
          supplier: newItem.supplier?.trim() || null,
          location: newItem.location?.trim() || null,
          cost_price: Math.max(0, parseFloat(newItem.cost_price) || 0),
          qty: Math.max(0, parseInt(newItem.qty) || 0),
          min_qty: Math.max(0, parseInt(newItem.min_qty) || 0),
          image_id: imageId,
        }),
      });

      setNewItem({
        name: "",
        category: "",
        description: "",
        supplier: "",
        location: "",
        cost_price: 0,
        qty: 0,
        min_qty: 0,
      });
      resetImage();
      setIsAddModalOpen(false);

      await fetchStock();
    } catch (err) {
      console.error("Error adding new item:", err);
      alert("Erro ao adicionar produto. Verifique os dados e tente novamente.");
    } finally {
      setAddItemLoading(false);
    }
  }, [
    newItem,
    addItemLoading,
    fetchStock,
    croppedImageBlob,
    uploadImage,
    resetImage,
  ]);

  const resetAddItemForm = useCallback(() => {
    setNewItem({
      name: "",
      category: "",
      description: "",
      supplier: "",
      location: "",
      cost_price: 0,
      qty: 0,
      min_qty: 0,
    });
    resetImage();
  }, [resetImage]);

  const StockTableRow = ({ item }) => {
    if (!item) return null;

    const isEditing = editingRows[item.$id];
    const getStatusInfo = (current, minimum) => {
      if (current <= minimum) return { status: "critical", label: "Crítico", icon: AlertTriangle };
      if (current <= minimum + 5) return { status: "warning", label: "Baixo", icon: TrendingDown };
      return { status: "ok", label: "OK", icon: Check };
    };

    const statusInfo = getStatusInfo(item.qty || 0, item.min_qty || 0);
    const itemImageUrl = item.image_id ? getImageUrl(item.image_id) : null;
    const StatusIcon = statusInfo.icon;

    return (
      <div className={`stock-table-row ${isEditing ? "editing" : ""}`}>
        {/* Image */}
        <div className="cell cell-image">
          {itemImageUrl ? (
            <img
              src={itemImageUrl}
              alt={item.name}
              className="item-image"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div className={`image-placeholder ${itemImageUrl ? "hidden" : ""}`}>
            <Package size={20} />
          </div>
        </div>

        {/* Item Info */}
        <div className="cell cell-info">
          <div className="item-name">{item.name || "Nome não disponível"}</div>
          {item.category && (
            <div className="item-category">{item.category}</div>
          )}
        </div>

        {/* Stock Current */}
        <div className="cell cell-qty">
          {isEditing ? (
            <input
              type="number"
              min="0"
              className="qty-input"
              value={editingRows[item.$id]?.qty ?? item.qty ?? 0}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                setEditingRows((prev) => ({
                  ...prev,
                  [item.$id]: {
                    ...prev[item.$id],
                    qty: parseInt(e.target.value) || 0,
                  },
                }));
              }}
            />
          ) : (
            <span className={`qty-value ${statusInfo.status}`}>
              <NumberFlow value={item.qty || 0} />
            </span>
          )}
        </div>

        {/* Stock Minimum */}
        <div className="cell cell-min">
          {isEditing ? (
            <input
              type="number"
              min="0"
              className="qty-input"
              value={editingRows[item.$id]?.min_qty ?? item.min_qty ?? 0}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                setEditingRows((prev) => ({
                  ...prev,
                  [item.$id]: {
                    ...prev[item.$id],
                    min_qty: parseInt(e.target.value) || 0,
                  },
                }));
              }}
            />
          ) : (
            <span className="qty-value">
              <NumberFlow value={item.min_qty || 0} />
            </span>
          )}
        </div>

        {/* Status */}
        <div className="cell cell-status">
          <span className={`status-badge ${statusInfo.status}`}>
            <StatusIcon size={14} />
            {statusInfo.label}
          </span>
        </div>

        {/* Price */}
        <div className="cell cell-price">
          {isEditing ? (
            <input
              type="number"
              step="0.01"
              min="0"
              className="price-input"
              value={editingRows[item.$id]?.cost_price ?? item.cost_price ?? 0}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                setEditingRows((prev) => ({
                  ...prev,
                  [item.$id]: {
                    ...prev[item.$id],
                    cost_price: parseFloat(e.target.value) || 0,
                  },
                }));
              }}
            />
          ) : (
            <span className="price-value">
              €<NumberFlow value={parseFloat(item.cost_price) || 0} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
            </span>
          )}
        </div>

        {/* Location & Supplier */}
        <div className="cell cell-meta">
          <div className="meta-item">
            <MapPin size={14} />
            <span>{item.location || "N/A"}</span>
          </div>
          <div className="meta-item">
            <Truck size={14} />
            <span>{item.supplier || "N/A"}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="cell cell-actions">
          {isEditing ? (
            <>
              <button
                className="action-btn save"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveEdit(item.$id);
                }}
                disabled={loading}
                title="Guardar"
              >
                <Save size={16} />
              </button>
              <button
                className="action-btn cancel"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingRows((prev) => {
                    const { [item.$id]: removed, ...rest } = prev;
                    return rest;
                  });
                }}
                title="Cancelar"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                className="action-btn edit"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingRows((prev) => ({
                    ...prev,
                    [item.$id]: {
                      qty: item.qty || 0,
                      min_qty: item.min_qty || 0,
                      cost_price: item.cost_price || 0,
                    },
                  }));
                }}
                title="Editar"
              >
                <Edit size={16} />
              </button>
              <button
                className="action-btn add"
                onClick={(e) => {
                  e.stopPropagation();
                  addToMovementCart(item.$id, 1);
                }}
                disabled={loading}
                title="Adicionar stock"
              >
                <Plus size={16} />
              </button>
              <button
                className="action-btn remove"
                onClick={(e) => {
                  e.stopPropagation();
                  addToMovementCart(item.$id, -1);
                }}
                disabled={loading}
                title="Remover stock"
              >
                <Minus size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="stock-component">
      {/* Main Container */}
      <div className="stock-container">
        {/* Header with Actions */}
        <div className="stock-page-header">
          <h1>
            <Package className="title-icon" />
            Gestão de Stock
            {wsConnected && (
              <span className="ws-indicator connected" title="WebSocket conectado - Updates em tempo real">
                ●
              </span>
            )}
          </h1>
          <div className="header-actions">
            <Button
              onClick={fetchStock}
              disabled={loading}
              className="refresh-button"
              icon={
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
              }
            >
              Atualizar
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="add-button"
              disabled={loading}
              icon={<Plus size={16} />}
            >
              Adicionar Item
            </Button>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="stock-grid">
          {/* Stats Cards */}
          <div className="stats-section">
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Total Items</span>
                <Warehouse className="stat-icon" />
              </div>
              <div className="stat-value info">
                <NumberFlow value={stockItems.length} />
              </div>
              <div className="stat-description">Items em stock</div>
            </div>

            <div className="stat-card critical-card">
              <div className="stat-header">
                <span className="stat-title">Stock Crítico</span>
                <AlertTriangle className="stat-icon" />
              </div>
              <div className="stat-value critical">
                <NumberFlow value={criticalStock.length} />
              </div>
              <div className="stat-description">Itens abaixo do mínimo</div>

              {criticalStock.length > 0 && (
                <div className="critical-items-preview">
                  {criticalStock.slice(0, 3).map((item) => (
                    <div key={item.$id} className="critical-item-mini">
                      <span className="item-name">{item.name}</span>
                      <span className="item-qty">
                        <NumberFlow value={item.qty} />/<NumberFlow value={item.min_qty} />
                      </span>
                    </div>
                  ))}
                  {criticalStock.length > 3 && (
                    <div className="more-items">
                      +<NumberFlow value={criticalStock.length - 3} /> mais
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Stock Baixo</span>
                <TrendingDown className="stat-icon" />
              </div>
              <div className="stat-value warning">
                <NumberFlow value={warningStock.length} />
              </div>
              <div className="stat-description">Itens próximos do mínimo</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Stock OK</span>
                <TrendingUp className="stat-icon" />
              </div>
              <div className="stat-value success">
                <NumberFlow value={stockItems.length - criticalStock.length - warningStock.length} />
              </div>
              <div className="stat-description">Itens com stock adequado</div>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="main-content-card">
            {/* Search Bar */}
            <div className="content-controls">
              <div className="search-wrapper">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Pesquisar items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            {/* Cart Banner - Shows when items in cart */}
            {Object.keys(movementCart).length > 0 && (
              <div className="cart-banner">
                <div className="cart-banner-info">
                  <ShoppingCart size={18} />
                  <span className="cart-banner-text">
                    <strong>{Object.values(movementCart).reduce((sum, qty) => sum + Math.abs(qty), 0)}</strong> {Object.values(movementCart).reduce((sum, qty) => sum + Math.abs(qty), 0) === 1 ? "movimento pendente" : "movimentos pendentes"}
                  </span>
                </div>
                <div className="cart-banner-actions">
                  <button onClick={() => setIsCartModalOpen(true)} className="cart-banner-btn view">
                    Ver Detalhes
                  </button>
                  <button onClick={clearMovementCart} className="cart-banner-btn clear" disabled={loading}>
                    Limpar
                  </button>
                  <button
                    onClick={() => {
                      processMovements();
                    }}
                    className="cart-banner-btn apply"
                    disabled={loading}
                  >
                    {loading ? "A processar..." : "Aplicar"}
                  </button>
                </div>
              </div>
            )}

            {/* Stock Table */}
            <div className="stock-table-container">
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">A carregar stock...</div>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Package size={32} />
                  </div>
                  <div className="empty-title">Nenhum item encontrado</div>
                  <div className="empty-description">
                    {searchTerm
                      ? "Tente ajustar os termos de pesquisa"
                      : "Adicione alguns itens para começar a gerir o seu stock"}
                  </div>
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="stock-table-header">
                    <div className="header-cell cell-image">Imagem</div>
                    <div className="header-cell cell-info">Item</div>
                    <div className="header-cell cell-qty">Stock</div>
                    <div className="header-cell cell-min">Mínimo</div>
                    <div className="header-cell cell-status">Estado</div>
                    <div className="header-cell cell-price">Preço</div>
                    <div className="header-cell cell-meta">Local & Fornecedor</div>
                    <div className="header-cell cell-actions">Ações</div>
                  </div>

                  {/* Table Rows */}
                  <div className="stock-table-body">
                    {paginatedItems.map((item) => (
                      <StockTableRow key={item.$id} item={item} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button
                        className="page-button"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1 || loading}
                      >
                        <ChevronUp size={16} />
                      </button>

                      <span className="page-info">
                        Página <NumberFlow value={currentPage} /> de <NumberFlow value={totalPages} />
                      </span>

                      <button
                        className="page-button"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1)
                          )
                        }
                        disabled={currentPage === totalPages || loading}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Simple Cart Modal */}
      {isCartModalOpen && Object.keys(movementCart).length > 0 && (
        <div className="cart-modal-overlay" onClick={() => setIsCartModalOpen(false)}>
          <div className="cart-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="cart-modal-header">
              <h3>Movimentos de Stock</h3>
              <button onClick={() => setIsCartModalOpen(false)} className="cart-close-btn">
                <X size={20} />
              </button>
            </div>

            {/* Items List */}
            <div className="cart-modal-body">
              {Object.entries(movementCart).map(([itemId, quantity]) => {
                const item = stockItems.find((i) => i.$id === itemId);
                if (!item) return null;

                return (
                  <div key={itemId} className="cart-modal-item">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{item.name}</span>
                      <span className="cart-item-category">{item.category || "Sem categoria"}</span>
                    </div>
                    <div className="cart-item-actions">
                      <span className={`cart-item-qty ${quantity > 0 ? "positive" : "negative"}`}>
                        {quantity > 0 ? "+" : ""}{quantity}
                      </span>
                      <button
                        onClick={() => removeFromMovementCart(itemId)}
                        className="cart-item-remove"
                        disabled={loading}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="cart-modal-footer">
              <button onClick={clearMovementCart} className="cart-btn cart-btn-clear" disabled={loading}>
                Limpar Tudo
              </button>
              <button
                onClick={() => {
                  processMovements();
                  setIsCartModalOpen(false);
                }}
                className="cart-btn cart-btn-apply"
                disabled={loading}
              >
                {loading ? "A processar..." : "Aplicar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Item Modal */}
      {isAddModalOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="modal-overlay">
          <div className="modal-container">
            {/* Modal Header */}
            <div className="modal-header">
              <div className="header-text">
                <h2>Adicionar Novo Item</h2>
                <p>Preencha os dados do novo produto</p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddItemForm();
                }}
                className="close-button"
                disabled={addItemLoading}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="modal-content">
              {/* Image Upload Section */}
              <div className="image-upload-section">
                <label className="image-upload-label">Imagem do Item</label>

                {/* Image Upload Area */}
                {!imagePreview && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="image-upload-area"
                  >
                    <Upload size={48} className="upload-icon" />
                    <h4 className="upload-title">Selecionar Imagem</h4>
                    <p className="upload-description">
                      PNG, JPG ou WEBP até 5MB
                    </p>
                  </div>
                )}

                {/* Image Preview */}
                {imagePreview && (
                  <div className="image-preview-container">
                    <div
                      className="image-preview-wrapper"
                      style={{ position: "relative" }}
                    >
                      <img
                        src={imagePreview}
                        alt="Preview"
                        style={{
                          maxWidth: "300px",
                          maxHeight: "300px",
                          objectFit: "contain",
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          backgroundColor: backgroundRemovalPreview
                            ? "transparent"
                            : "#ffffff",
                        }}
                      />
                      {backgroundRemovalPreview && (
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            left: "8px",
                            padding: "4px 8px",
                            backgroundColor: "#10b981",
                            color: "white",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                          }}
                        >
                          <Wand2 size={12} />
                          Fundo Removido
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={resetImage}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "32px",
                          height: "32px",
                          backgroundColor: "#dc2626",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "center",
                        flexWrap: "wrap",
                        marginTop: "16px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCropImage(imagePreview);
                          setShowCropper(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 16px",
                          backgroundColor: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "14px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Crop size={16} />
                        Cortar Imagem
                      </button>
                      {!backgroundRemovalPreview ? (
                        <button
                          type="button"
                          onClick={removeBackground}
                          disabled={removingBackground}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 16px",
                            backgroundColor: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "14px",
                            cursor: removingBackground
                              ? "not-allowed"
                              : "pointer",
                            opacity: removingBackground ? 0.7 : 1,
                            transition: "all 0.2s ease",
                          }}
                          title="Remover fundo da imagem usando IA"
                        >
                          <Wand2
                            size={16}
                            className={removingBackground ? "animate-spin" : ""}
                          />
                          {removingBackground ? "A processar..." : "Remover Fundo"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={undoBackgroundRemoval}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 16px",
                            backgroundColor: "#f59e0b",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "14px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          title="Restaurar imagem original"
                        >
                          <RefreshCw size={16} />
                          Desfazer Remoção
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={removingBackground}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 16px",
                          backgroundColor: "#f3f4f6",
                          color: "#374151",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          fontSize: "14px",
                          cursor: removingBackground ? "not-allowed" : "pointer",
                        }}
                      >
                        <Upload size={16} />
                        Trocar Imagem
                      </button>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleImageSelect}
                  style={{ display: "none" }}
                />
              </div>

              {/* Basic Information */}
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Nome do Produto *</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Ex: Arroz Agulha"
                    className="form-input"
                    disabled={addItemLoading}
                  />
                </div>

                <div className="form-group">
                  <label>Categoria</label>
                  <select
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="form-select"
                    disabled={dropdownsLoading || addItemLoading}
                  >
                    <option value="">Selecionar categoria...</option>
                    {categories.map((category) => (
                      <option
                        key={category.$id}
                        value={category.name || category.category || ""}
                      >
                        {category.name ||
                          category.category ||
                          "Categoria sem nome"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Fornecedor</label>
                  <select
                    value={newItem.supplier}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        supplier: e.target.value,
                      }))
                    }
                    className="form-select"
                    disabled={dropdownsLoading || addItemLoading}
                  >
                    <option value="">Selecionar fornecedor...</option>
                    {suppliers.map((supplier) => (
                      <option
                        key={supplier.$id}
                        value={supplier.name || supplier.supplier || ""}
                      >
                        {supplier.name ||
                          supplier.supplier ||
                          "Fornecedor sem nome"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Descrição</label>
                  <textarea
                    value={newItem.description}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Descrição adicional do produto"
                    rows={4}
                    className="form-textarea"
                    disabled={addItemLoading}
                  />
                </div>

                <div className="form-group">
                  <label>Localização</label>
                  <select
                    value={newItem.location}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    className="form-select"
                    disabled={dropdownsLoading || addItemLoading}
                  >
                    <option value="">Selecionar localização...</option>
                    {locations.map((location) => (
                      <option
                        key={location.$id}
                        value={location.name || location.location || ""}
                      >
                        {location.name ||
                          location.location ||
                          "Localização sem nome"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Preço de Custo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.cost_price || ""}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        cost_price: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="form-input"
                    disabled={addItemLoading}
                  />
                </div>

                <div className="form-group">
                  <label>Stock Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.min_qty || ""}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        min_qty: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="form-input"
                    disabled={addItemLoading}
                  />
                </div>

                <div className="form-group">
                  <label>Quantidade Inicial</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.qty || ""}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        qty: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="form-input"
                    disabled={addItemLoading}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddItemForm();
                }}
                className="footer-button cancel"
                disabled={addItemLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddNewItem}
                disabled={addItemLoading || !newItem.name?.trim()}
                className="footer-button primary"
              >
                {addItemLoading ? "A guardar..." : "Adicionar Item"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
  }

      {/* Image Cropper Modal (via Portal) */}
      {showCropper &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="image-cropper-overlay">
            <div className="image-cropper-modal">
              {/* Cropper Header */}
              <div className="cropper-header">
                <div className="header-content">
                  <h2>Recortar Imagem</h2>
                  <p>
                    Arraste para reposicionar. Use os cantos para redimensionar.
                  </p>
                </div>
                <button onClick={handleCropperClose} className="close-button">
                  <X size={20} />
                </button>
              </div>

              {/* Cropper Content */}
              <div className="cropper-content">
                <div
                  style={{
                    width: "100%",
                    maxWidth: "800px",
                    margin: "0 auto",
                    minHeight: "300px",
                  }}
                >
                  <Cropper
                    ref={cropperRef}
                    src={cropImage}
                    className="cropper"
                    stencilProps={{
                      aspectRatio: undefined,
                    }}
                    backgroundClassName="cropper-background"
                  />
                </div>
              </div>

              {/* Cropper Actions */}
              <div className="cropper-actions">
                <button
                  onClick={handleCropperClose}
                  className="action-btn cancel-btn"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCropComplete}
                  className="action-btn apply-btn"
                >
                  <Crop size={16} />
                  Aplicar Recorte
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
}
