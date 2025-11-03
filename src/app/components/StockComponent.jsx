"use client";

import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  Table,
  Tag,
  Image as AntImage,
  Input as AntInput,
  Select as AntSelect,
} from "antd";
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
import NumberFlow from "@number-flow/react";
import "./StockComponent.scss";

import { getAuthToken } from "@/lib/api";

import { useStockWebSocket } from "@/hooks/useStockWebSocket";

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
  // Tab state
  const [activeTab, setActiveTab] = useState("items"); // "items" | "warehouses"

  // Items tab state
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
    supplier_id: null,
    cost_price: 0,
    min_qty: 0,
    inventory: [], // Array of { warehouse_id, qty, position }
  });
  const [addItemLoading, setAddItemLoading] = useState(false);

  // Warehouses tab state
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [warehouseInventory, setWarehouseInventory] = useState([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  // Warehouse modals
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    description: "",
    address: "",
    is_active: true,
  });

  // Transfer modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    item: null,
    from_warehouse_id: null,
    to_warehouse_id: null,
    qty: 0,
  });

  // Inventory modal (add item to warehouse)
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    item: null,
    warehouse_id: null,
    qty: 0,
    position: "",
    operation: "set", // "set" or "add"
  });

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
  const [backgroundRemovalPreview, setBackgroundRemovalPreview] =
    useState(null);
  const [originalImageBeforeRemoval, setOriginalImageBeforeRemoval] =
    useState(null);

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
      const base64Data = base64Response.replace(
        /^data:image\/[^;]+;base64,/,
        ""
      );
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
    setStockItems((prev) => prev.map((i) => (i.$id === item.$id ? item : i)));
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
    console.log("[Stock Alert]", alert.status, alert.message);

    // Browser notification (if permitted)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Stock Alert", {
        body: alert.message,
        icon: "/icon.png",
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
    onError: (error) => console.error("[Stock WS Error]", error),
  });

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
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

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Initial data fetch
  useEffect(() => {
    fetchStock();
    fetchWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Fetch dropdown data when add modal opens or when first item is being edited
  useEffect(() => {
    const isEditing = Object.keys(editingRows).length > 0;
    if ((isAddModalOpen || isEditing) && categories.length === 0) {
      fetchDropdownData();
    }
  }, [isAddModalOpen, editingRows, categories.length, fetchDropdownData]);

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

  // Warehouse API functions
  const fetchWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    try {
      const response = await apiCall("/stock/warehouses");
      setWarehouses(response.documents || []);
    } catch (err) {
      console.error("Error fetching warehouses:", err);
      alert("Erro ao carregar armazéns.");
      setWarehouses([]);
    } finally {
      setWarehousesLoading(false);
    }
  }, []);

  const fetchWarehouseInventory = useCallback(async (warehouseId) => {
    setLoading(true);
    try {
      // Get all items and filter by warehouse
      const response = await apiCall("/stock/items");
      const items = response.documents || [];

      // Filter items that have inventory in this warehouse
      const inventoryItems = items
        .map(item => {
          const warehouseData = item.warehouses?.find(w => w.warehouse_id === warehouseId);
          if (!warehouseData) return null;
          return {
            ...item,
            warehouse_qty: warehouseData.qty,
            warehouse_position: warehouseData.position,
            inventory_id: warehouseData.inventory_id,
          };
        })
        .filter(Boolean);

      setWarehouseInventory(inventoryItems);
    } catch (err) {
      console.error("Error fetching warehouse inventory:", err);
      alert("Erro ao carregar inventário do armazém.");
      setWarehouseInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createWarehouse = useCallback(async (data) => {
    try {
      const response = await apiCall("/stock/warehouses", {
        method: "POST",
        body: JSON.stringify(data),
      });
      await fetchWarehouses();
      return response;
    } catch (err) {
      console.error("Error creating warehouse:", err);
      throw err;
    }
  }, [fetchWarehouses]);

  const updateWarehouse = useCallback(async (id, data) => {
    try {
      const response = await apiCall(`/stock/warehouses/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      await fetchWarehouses();
      return response;
    } catch (err) {
      console.error("Error updating warehouse:", err);
      throw err;
    }
  }, [fetchWarehouses]);

  const deleteWarehouse = useCallback(async (id) => {
    try {
      await apiCall(`/stock/warehouses/${id}`, {
        method: "DELETE",
      });
      await fetchWarehouses();
    } catch (err) {
      console.error("Error deleting warehouse:", err);
      throw err;
    }
  }, [fetchWarehouses]);

  const transferStock = useCallback(async (itemId, fromWarehouseId, toWarehouseId, qty) => {
    try {
      const response = await apiCall(`/stock/items/${itemId}/transfer`, {
        method: "POST",
        body: JSON.stringify({
          from_warehouse_id: fromWarehouseId,
          to_warehouse_id: toWarehouseId,
          qty,
        }),
      });
      await fetchStock();
      if (selectedWarehouse) {
        await fetchWarehouseInventory(selectedWarehouse.$id);
      }
      return response;
    } catch (err) {
      console.error("Error transferring stock:", err);
      throw err;
    }
  }, [fetchStock, selectedWarehouse, fetchWarehouseInventory]);

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

      // Validate name is not empty
      const trimmedName = edits.name?.trim();
      if (!trimmedName) {
        alert("Nome do produto é obrigatório");
        return;
      }

      setLoading(true);
      try {
        await apiCall(`/stock/items/${itemId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: trimmedName,
            category: edits.category?.trim() || null,
            location: edits.location?.trim() || null,
            supplier: edits.supplier?.trim() || null,
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

  // Memoized callback for updating editing state
  const updateEditingState = useCallback((itemId, newState) => {
    if (newState === undefined) {
      // Cancel editing
      setEditingRows((prev) => {
        const { [itemId]: removed, ...rest } = prev;
        return rest;
      });
    } else {
      // Update editing state
      setEditingRows((prev) => ({
        ...prev,
        [itemId]: newState,
      }));
    }
  }, []);

  const getStatusInfo = (current, minimum) => {
    if (current <= minimum)
      return { status: "critical", label: "Crítico", color: "#dc2626" };
    if (current <= minimum + 5)
      return { status: "warning", label: "Baixo", color: "#f59e0b" };
    return { status: "ok", label: "OK", color: "#10b981" };
  };

  // Ant Design Table columns configuration
  const columns = useMemo(
    () => [
      {
        title: "Imagem",
        dataIndex: "image_id",
        key: "image_id",
        render: (imageId, record) => {
          const imageUrl = imageId ? getImageUrl(imageId) : null;
          return (
            <div style={{ width: 60, height: 60 }}>
              {imageUrl ? (
                <AntImage
                  src={imageUrl}
                  alt={record.name}
                  width={60}
                  height={60}
                  style={{ objectFit: "contain", borderRadius: "4px" }}
                  preview={false}
                  fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIGZpbGw9IiNGMUY1RjkiLz48cGF0aCBkPSJNMzAgMjVMMzUgMzVIMjVMMzAgMjVaIiBmaWxsPSIjOTRBM0I4Ii8+PC9zdmc+"
                />
              ) : (
                <div
                  style={{
                    width: 60,
                    height: 60,
                    backgroundColor: "#f1f5f9",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Package size={24} color="#94a3b8" />
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Item",
        dataIndex: "name",
        key: "name",
        render: (name, record) => {
          const isEditing = editingRows[record.$id] !== undefined;
          const editState = editingRows[record.$id];

          if (isEditing) {
            return (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <AntInput
                  value={editState?.name ?? name ?? ""}
                  onChange={(e) => {
                    updateEditingState(record.$id, {
                      ...editState,
                      name: e.target.value,
                    });
                  }}
                  placeholder="Nome do item"
                  style={{ fontWeight: 600 }}
                />
                <AntSelect
                  value={editState?.category ?? record.category ?? ""}
                  onChange={(value) => {
                    updateEditingState(record.$id, {
                      ...editState,
                      category: value,
                    });
                  }}
                  style={{ width: "100%" }}
                >
                  <AntSelect.Option value="">Sem categoria</AntSelect.Option>
                  {categories.map((category) => (
                    <AntSelect.Option
                      key={category.$id}
                      value={category.name || category.category || ""}
                    >
                      {category.name || category.category || "Sem nome"}
                    </AntSelect.Option>
                  ))}
                </AntSelect>
              </div>
            );
          }

          return (
            <div>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                {name || "Nome não disponível"}
              </div>
              {record.category && (
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {record.category}
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Stock",
        dataIndex: "qty",
        key: "qty",
        sorter: (a, b) => a.qty - b.qty,
        render: (qty, record) => {
          const isEditing = editingRows[record.$id] !== undefined;
          const editState = editingRows[record.$id];
          const statusInfo = getStatusInfo(qty || 0, record.min_qty || 0);

          if (isEditing) {
            return (
              <AntInput
                type="number"
                min="0"
                value={editState?.qty ?? qty ?? 0}
                onChange={(e) => {
                  updateEditingState(record.$id, {
                    ...editState,
                    qty: parseInt(e.target.value) || 0,
                  });
                }}
                style={{ width: "80px" }}
              />
            );
          }

          return (
            <span style={{ fontWeight: 600, color: statusInfo.color }}>
              <NumberFlow value={qty || 0} />
            </span>
          );
        },
      },
      {
        title: "Mínimo",
        dataIndex: "min_qty",
        key: "min_qty",
        render: (min_qty, record) => {
          const isEditing = editingRows[record.$id] !== undefined;
          const editState = editingRows[record.$id];

          if (isEditing) {
            return (
              <AntInput
                type="number"
                min="0"
                value={editState?.min_qty ?? min_qty ?? 0}
                onChange={(e) => {
                  updateEditingState(record.$id, {
                    ...editState,
                    min_qty: parseInt(e.target.value) || 0,
                  });
                }}
                style={{ width: "80px" }}
              />
            );
          }

          return <NumberFlow value={min_qty || 0} />;
        },
      },
      {
        title: "# Armazéns",
        key: "num_warehouses",
        render: (_, record) => {
          const numWarehouses = record.num_warehouses || 0;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Warehouse size={16} color="#6b7280" />
              <span style={{ fontWeight: 500 }}>
                <NumberFlow value={numWarehouses} />
              </span>
            </div>
          );
        },
      },
      {
        title: "Estado",
        key: "status",
        render: (_, record) => {
          const statusInfo = getStatusInfo(
            record.qty || 0,
            record.min_qty || 0
          );
          const StatusIcon =
            statusInfo.status === "critical"
              ? AlertTriangle
              : statusInfo.status === "warning"
              ? TrendingDown
              : Check;

          return (
            <Tag
              color={statusInfo.color}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                width: "fit-content",
              }}
            >
              <StatusIcon size={14} />
              {statusInfo.label}
            </Tag>
          );
        },
      },
      {
        title: "Preço",
        dataIndex: "cost_price",
        key: "cost_price",
        sorter: (a, b) => (a.cost_price || 0) - (b.cost_price || 0),
        render: (cost_price, record) => {
          const isEditing = editingRows[record.$id] !== undefined;
          const editState = editingRows[record.$id];

          if (isEditing) {
            return (
              <AntInput
                type="number"
                step="0.01"
                min="0"
                value={editState?.cost_price ?? cost_price ?? 0}
                onChange={(e) => {
                  updateEditingState(record.$id, {
                    ...editState,
                    cost_price: parseFloat(e.target.value) || 0,
                  });
                }}
                style={{ width: "100px" }}
                prefix="€"
              />
            );
          }

          return (
            <span style={{ fontWeight: 500 }}>
              <NumberFlow
                value={parseFloat(cost_price) || 0}
                format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
              />
              €
            </span>
          );
        },
      },
      {
        title: "Local & Fornecedor",
        key: "meta",
        render: (_, record) => {
          const isEditing = editingRows[record.$id] !== undefined;
          const editState = editingRows[record.$id];

          if (isEditing) {
            return (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <AntSelect
                  value={editState?.location ?? record.location ?? ""}
                  onChange={(value) => {
                    updateEditingState(record.$id, {
                      ...editState,
                      location: value,
                    });
                  }}
                  style={{ width: "100%" }}
                >
                  <AntSelect.Option value="">Sem localização</AntSelect.Option>
                  {locations.map((location) => (
                    <AntSelect.Option
                      key={location.$id}
                      value={location.name || location.location || ""}
                    >
                      {location.name || location.location || "Sem nome"}
                    </AntSelect.Option>
                  ))}
                </AntSelect>
                <AntSelect
                  value={editState?.supplier ?? record.supplier ?? ""}
                  onChange={(value) => {
                    updateEditingState(record.$id, {
                      ...editState,
                      supplier: value,
                    });
                  }}
                  style={{ width: "100%" }}
                >
                  <AntSelect.Option value="">Sem fornecedor</AntSelect.Option>
                  {suppliers.map((supplier) => (
                    <AntSelect.Option
                      key={supplier.$id}
                      value={supplier.name || supplier.supplier || ""}
                    >
                      {supplier.name || supplier.supplier || "Sem nome"}
                    </AntSelect.Option>
                  ))}
                </AntSelect>
              </div>
            );
          }

          return (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                }}
              >
                <MapPin size={14} color="#64748b" />
                <span>{record.location || "N/A"}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                }}
              >
                <Truck size={14} color="#64748b" />
                <span>{record.supplier || "N/A"}</span>
              </div>
            </div>
          );
        },
      },
      {
        title: "Ações",
        key: "actions",
        render: (_, record) => {
          const isEditing = editingRows[record.$id] !== undefined;

          if (isEditing) {
            return (
              <div style={{ display: "flex", gap: "4px" }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<Save size={14} />}
                  onClick={() => handleSaveEdit(record.$id)}
                  disabled={loading}
                >
                  Guardar
                </Button>
                <Button
                  size="small"
                  icon={<X size={14} />}
                  onClick={() => updateEditingState(record.$id, undefined)}
                >
                  Cancelar
                </Button>
              </div>
            );
          }

          return (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <Button
                size="small"
                icon={<Edit size={14} />}
                onClick={() => {
                  updateEditingState(record.$id, {
                    name: record.name || "",
                    category: record.category || "",
                    location: record.location || "",
                    supplier: record.supplier || "",
                    qty: record.qty || 0,
                    min_qty: record.min_qty || 0,
                    cost_price: record.cost_price || 0,
                  });
                }}
              />
              <Button
                size="small"
                type="primary"
                icon={<Plus size={14} />}
                onClick={() => addToMovementCart(record.$id, 1)}
                disabled={loading}
              />
              <Button
                size="small"
                danger
                icon={<Minus size={14} />}
                onClick={() => addToMovementCart(record.$id, -1)}
                disabled={loading}
              />
            </div>
          );
        },
      },
    ],
    [
      editingRows,
      categories,
      locations,
      suppliers,
      loading,
      getImageUrl,
      updateEditingState,
      handleSaveEdit,
      addToMovementCart,
    ]
  );

  return (
    <div className="stock-component">
      {/* Main Container */}
      <div className="stock-container">
        {/* Header Card */}
        <div className="stock-header-card">
          <div className="stock-header-card__content">
            <div className="stock-header-card__left">
              <h1 className="stock-header-card__title">
                Gestão de Stock
                {wsConnected && (
                  <span
                    className="ws-indicator connected"
                    title="WebSocket conectado - Updates em tempo real"
                  >
                    ●
                  </span>
                )}
              </h1>
              <p className="stock-header-card__description">
                Controla o inventário em múltiplos armazéns e mantém tudo organizado.
              </p>
              <div className="stock-header-card__actions">
                <button
                  onClick={activeTab === "items" ? fetchStock : fetchWarehouses}
                  disabled={loading || warehousesLoading}
                  className="stock-header-card__btn stock-header-card__btn--secondary"
                >
                  <RefreshCw
                    size={16}
                    className={loading || warehousesLoading ? "animate-spin" : ""}
                  />
                  Atualizar
                </button>
                {activeTab === "items" ? (
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="stock-header-card__btn stock-header-card__btn--primary"
                    disabled={loading}
                  >
                    <Plus size={16} />
                    Adicionar Item
                  </button>
                ) : (
                  <button
                    onClick={() => setWarehouseModalOpen(true)}
                    className="stock-header-card__btn stock-header-card__btn--primary"
                    disabled={warehousesLoading}
                  >
                    <Plus size={16} />
                    Criar Armazém
                  </button>
                )}
              </div>
            </div>
            <div className="stock-header-card__right">
              <div className="stock-header-card__circles">
                <div className="circle circle-1"></div>
                <div className="circle circle-2"></div>
                <div className="circle circle-3"></div>
                <div className="circle circle-4"></div>
                <div className="circle circle-5"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="stock-tabs">
          <button
            className={`stock-tab ${activeTab === "items" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("items");
              setSelectedWarehouse(null);
            }}
          >
            <Package size={18} />
            Visão Geral de Items
          </button>
          <button
            className={`stock-tab ${activeTab === "warehouses" ? "active" : ""}`}
            onClick={() => setActiveTab("warehouses")}
          >
            <Warehouse size={18} />
            Armazéns
          </button>
        </div>

        {/* Items Tab Content */}
        {activeTab === "items" && (
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
                        <NumberFlow value={item.qty} />/
                        <NumberFlow value={item.min_qty} />
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
                <NumberFlow
                  value={
                    stockItems.length -
                    criticalStock.length -
                    warningStock.length
                  }
                />
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
                    <strong>
                      {Object.values(movementCart).reduce(
                        (sum, qty) => sum + Math.abs(qty),
                        0
                      )}
                    </strong>{" "}
                    {Object.values(movementCart).reduce(
                      (sum, qty) => sum + Math.abs(qty),
                      0
                    ) === 1
                      ? "movimento pendente"
                      : "movimentos pendentes"}
                  </span>
                </div>
                <div className="cart-banner-actions">
                  <button
                    onClick={() => setIsCartModalOpen(true)}
                    className="cart-banner-btn view"
                  >
                    Ver Detalhes
                  </button>
                  <button
                    onClick={clearMovementCart}
                    className="cart-banner-btn clear"
                    disabled={loading}
                  >
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
              <Table
                dataSource={filteredItems.map((item) => ({
                  ...item,
                  key: item.$id,
                }))}
                columns={columns}
                loading={loading}
                pagination={{
                  pageSize: ITEMS_PER_PAGE,
                  showSizeChanger: true,
                  showTotal: (total, range) =>
                    `${range[0]}-${range[1]} de ${total} items`,
                  pageSizeOptions: ["10", "25", "50", "100"],
                }}
                scroll={{ x: "max-content" }}
                tableLayout="auto"
                locale={{
                  emptyText: (
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
                  ),
                }}
              />
            </div>
          </div>
        </div>
        )}

      {/* Simple Cart Modal */}
      {isCartModalOpen && Object.keys(movementCart).length > 0 && (
        <div
          className="cart-modal-overlay"
          onClick={() => setIsCartModalOpen(false)}
        >
          <div className="cart-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="cart-modal-header">
              <h3>Movimentos de Stock</h3>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="cart-close-btn"
              >
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
                      <span className="cart-item-category">
                        {item.category || "Sem categoria"}
                      </span>
                    </div>
                    <div className="cart-item-actions">
                      <span
                        className={`cart-item-qty ${
                          quantity > 0 ? "positive" : "negative"
                        }`}
                      >
                        {quantity > 0 ? "+" : ""}
                        {quantity}
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
              <button
                onClick={clearMovementCart}
                className="cart-btn cart-btn-clear"
                disabled={loading}
              >
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
      {isAddModalOpen &&
        typeof document !== "undefined" &&
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
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#374151",
                      marginBottom: "12px",
                    }}
                  >
                    Imagem do Item
                  </label>

                  {/* Image Upload Area */}
                  {!imagePreview && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: "2px dashed #d1d5db",
                        borderRadius: "8px",
                        padding: "32px",
                        textAlign: "center",
                        cursor: "pointer",
                        backgroundColor: "transparent",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#ff6b35";
                        e.currentTarget.style.backgroundColor = "#fff5f2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#d1d5db";
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <Upload
                        size={48}
                        style={{
                          color: "#9ca3af",
                          margin: "0 auto 16px",
                          display: "block",
                        }}
                      />
                      <h4
                        style={{
                          fontSize: "16px",
                          fontWeight: "500",
                          color: "#374151",
                          margin: "0 0 8px 0",
                        }}
                      >
                        Selecionar Imagem
                      </h4>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#6b7280",
                          margin: 0,
                        }}
                      >
                        PNG, JPG ou WEBP até 5MB
                      </p>
                    </div>
                  )}

                  {/* Image Preview */}
                  {imagePreview && (
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "8px",
                        padding: "16px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          display: "inline-block",
                          marginBottom: "16px",
                          width: "100%",
                          textAlign: "center",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
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
                            fontWeight: "500",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#2563eb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#3b82f6";
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
                              backgroundColor: removingBackground
                                ? "#9ca3af"
                                : "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "14px",
                              fontWeight: "500",
                              cursor: removingBackground
                                ? "not-allowed"
                                : "pointer",
                              opacity: removingBackground ? 0.7 : 1,
                              transition: "all 0.2s ease",
                            }}
                            title="Remover fundo da imagem usando IA"
                            onMouseEnter={(e) => {
                              if (!removingBackground) {
                                e.currentTarget.style.backgroundColor =
                                  "#059669";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!removingBackground) {
                                e.currentTarget.style.backgroundColor =
                                  "#10b981";
                              }
                            }}
                          >
                            <Wand2
                              size={16}
                              className={
                                removingBackground ? "animate-spin" : ""
                              }
                            />
                            {removingBackground
                              ? "A processar..."
                              : "Remover Fundo"}
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
                              fontWeight: "500",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                            title="Restaurar imagem original"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#d97706";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "#f59e0b";
                            }}
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
                            fontWeight: "500",
                            cursor: removingBackground
                              ? "not-allowed"
                              : "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!removingBackground) {
                              e.currentTarget.style.backgroundColor = "#e5e7eb";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!removingBackground) {
                              e.currentTarget.style.backgroundColor = "#f3f4f6";
                            }
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
                      style={{ height: "44px" }}
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
                      style={{ height: "44px" }}
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
                      style={{ height: "44px" }}
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "12px",
                  padding: "20px 24px",
                  borderTop: "1px solid #e5e7eb",
                  flexShrink: 0,
                  backgroundColor: "#f9fafb",
                  position: "sticky",
                  bottom: 0,
                  zIndex: 1,
                }}
              >
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetAddItemForm();
                  }}
                  disabled={addItemLoading}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    backgroundColor: "white",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    cursor: addItemLoading ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                    opacity: addItemLoading ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!addItemLoading) {
                      e.currentTarget.style.backgroundColor = "#f1f5f9";
                      e.currentTarget.style.borderColor = "#94a3b8";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!addItemLoading) {
                      e.currentTarget.style.backgroundColor = "white";
                      e.currentTarget.style.borderColor = "#d1d5db";
                    }
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddNewItem}
                  disabled={addItemLoading || !newItem.name?.trim()}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "500",
                    borderRadius: "6px",
                    border: "none",
                    cursor:
                      addItemLoading || !newItem.name?.trim()
                        ? "not-allowed"
                        : "pointer",
                    backgroundColor:
                      addItemLoading || !newItem.name?.trim()
                        ? "#cbd5e1"
                        : "#ff6b35",
                    color: "white",
                    opacity:
                      addItemLoading || !newItem.name?.trim() ? 0.6 : 1,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!addItemLoading && newItem.name?.trim()) {
                      e.currentTarget.style.backgroundColor = "#e85a2a";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!addItemLoading && newItem.name?.trim()) {
                      e.currentTarget.style.backgroundColor = "#ff6b35";
                    }
                  }}
                >
                  {addItemLoading ? "A guardar..." : "Adicionar Item"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Warehouses Tab Content */}
        {activeTab === "warehouses" && (
          <div className="warehouses-view">
            {!selectedWarehouse ? (
              /* Warehouse Grid View */
              <div className="warehouse-grid-container">
                <div className="warehouse-grid">
                  {warehousesLoading ? (
                    <div className="loading-state">
                      <RefreshCw className="animate-spin" size={32} />
                      <p>A carregar armazéns...</p>
                    </div>
                  ) : warehouses.length === 0 ? (
                    <div className="empty-state">
                      <Warehouse size={64} />
                      <h3>Nenhum armazém criado</h3>
                      <p>Crie o primeiro armazém para começar a gerir inventário</p>
                      <button
                        onClick={() => setWarehouseModalOpen(true)}
                        className="stock-header-card__btn stock-header-card__btn--primary"
                      >
                        <Plus size={16} />
                        Criar Primeiro Armazém
                      </button>
                    </div>
                  ) : (
                    warehouses.map((warehouse) => (
                      <div
                        key={warehouse.$id}
                        className="warehouse-card"
                        onClick={() => {
                          setSelectedWarehouse(warehouse);
                          fetchWarehouseInventory(warehouse.$id);
                        }}
                      >
                        <div className="warehouse-card-header">
                          <Warehouse className="warehouse-icon" />
                          <div className="warehouse-status">
                            {warehouse.is_active ? (
                              <span className="status-active">●</span>
                            ) : (
                              <span className="status-inactive">●</span>
                            )}
                          </div>
                        </div>
                        <h3>{warehouse.name}</h3>
                        <p className="warehouse-description">{warehouse.description || "Sem descrição"}</p>
                        {warehouse.address && (
                          <div className="warehouse-address">
                            <MapPin size={14} />
                            {warehouse.address}
                          </div>
                        )}
                        <div className="warehouse-card-footer">
                          <button
                            className="view-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWarehouse(warehouse);
                              fetchWarehouseInventory(warehouse.$id);
                            }}
                          >
                            Ver Items
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Warehouse Inventory View */
              <div className="warehouse-inventory-view">
                <div className="warehouse-inventory-header">
                  <button
                    className="back-btn"
                    onClick={() => setSelectedWarehouse(null)}
                  >
                    <ArrowLeft size={18} />
                    Voltar aos Armazéns
                  </button>
                  <div className="warehouse-info">
                    <h2>{selectedWarehouse.name}</h2>
                    {selectedWarehouse.description && <p>{selectedWarehouse.description}</p>}
                  </div>
                </div>

                <div className="warehouse-inventory-content">
                  {loading ? (
                    <div className="loading-state">
                      <RefreshCw className="animate-spin" size={32} />
                      <p>A carregar inventário...</p>
                    </div>
                  ) : warehouseInventory.length === 0 ? (
                    <div className="empty-state">
                      <Package size={64} />
                      <h3>Sem items neste armazém</h3>
                      <p>Adicione items a este armazém ou transfira de outro armazém</p>
                    </div>
                  ) : (
                    <div className="warehouse-table-container">
                      <table className="warehouse-inventory-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Categoria</th>
                            <th>Quantidade</th>
                            <th>Posição</th>
                            <th>Min. Qty</th>
                            <th>Status</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warehouseInventory.map((item) => {
                            const status =
                              item.warehouse_qty <= item.min_qty ? "critical" :
                              item.warehouse_qty <= item.min_qty + 5 ? "warning" : "ok";

                            return (
                              <tr key={item.$id}>
                                <td>
                                  <div className="item-cell">
                                    {item.image_id && (
                                      <AntImage
                                        src={getImageUrl(item.image_id)}
                                        alt={item.name}
                                        width={40}
                                        height={40}
                                        style={{ borderRadius: "4px", objectFit: "contain" }}
                                        preview={false}
                                      />
                                    )}
                                    <span>{item.name}</span>
                                  </div>
                                </td>
                                <td>{item.category}</td>
                                <td>
                                  <NumberFlow value={item.warehouse_qty} />
                                </td>
                                <td>{item.warehouse_position || "-"}</td>
                                <td>
                                  <NumberFlow value={item.min_qty} />
                                </td>
                                <td>
                                  <Tag color={
                                    status === "critical" ? "error" :
                                    status === "warning" ? "warning" : "success"
                                  }>
                                    {status === "critical" ? "Crítico" :
                                     status === "warning" ? "Aviso" : "OK"}
                                  </Tag>
                                </td>
                                <td>
                                  <div className="action-buttons">
                                    <button
                                      className="action-btn transfer-btn"
                                      onClick={() => {
                                        setTransferForm({
                                          item,
                                          from_warehouse_id: selectedWarehouse.$id,
                                          to_warehouse_id: null,
                                          qty: 0,
                                        });
                                        setTransferModalOpen(true);
                                      }}
                                      title="Transferir"
                                    >
                                      <Truck size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      {/* Warehouse Modal (Create/Edit) */}
      {warehouseModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="modal-overlay" onClick={() => {
            setWarehouseModalOpen(false);
            setEditingWarehouse(null);
            setWarehouseForm({ name: "", description: "", address: "", is_active: true });
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingWarehouse ? "Editar Armazém" : "Criar Novo Armazém"}</h2>
                <button
                  className="close-btn"
                  onClick={() => {
                    setWarehouseModalOpen(false);
                    setEditingWarehouse(null);
                    setWarehouseForm({ name: "", description: "", address: "", is_active: true });
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                      Nome do Armazém *
                    </label>
                    <AntInput
                      placeholder="Ex: Armazém Principal"
                      value={warehouseForm.name}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                      style={{ height: "44px" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                      Descrição
                    </label>
                    <textarea
                      placeholder="Descrição do armazém..."
                      value={warehouseForm.description}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, description: e.target.value })}
                      style={{
                        width: "100%",
                        minHeight: "80px",
                        padding: "10px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                      Morada
                    </label>
                    <AntInput
                      placeholder="Ex: Rua Principal 123, Lisboa"
                      value={warehouseForm.address}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                      style={{ height: "44px" }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      id="warehouse-active"
                      checked={warehouseForm.is_active}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, is_active: e.target.checked })}
                      style={{ width: "18px", height: "18px", cursor: "pointer" }}
                    />
                    <label htmlFor="warehouse-active" style={{ fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
                      Armazém ativo
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                padding: "20px 24px",
                borderTop: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
              }}>
                <button
                  onClick={() => {
                    setWarehouseModalOpen(false);
                    setEditingWarehouse(null);
                    setWarehouseForm({ name: "", description: "", address: "", is_active: true });
                  }}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    backgroundColor: "white",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!warehouseForm.name.trim()) {
                      alert("Por favor insira um nome para o armazém");
                      return;
                    }

                    try {
                      if (editingWarehouse) {
                        await updateWarehouse(editingWarehouse.$id, warehouseForm);
                      } else {
                        await createWarehouse(warehouseForm);
                      }
                      setWarehouseModalOpen(false);
                      setEditingWarehouse(null);
                      setWarehouseForm({ name: "", description: "", address: "", is_active: true });
                    } catch (err) {
                      alert(`Erro ao ${editingWarehouse ? "atualizar" : "criar"} armazém: ${err.message}`);
                    }
                  }}
                  disabled={!warehouseForm.name.trim()}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "500",
                    borderRadius: "6px",
                    border: "none",
                    cursor: !warehouseForm.name.trim() ? "not-allowed" : "pointer",
                    backgroundColor: !warehouseForm.name.trim() ? "#cbd5e1" : "#3b82f6",
                    color: "white",
                    opacity: !warehouseForm.name.trim() ? 0.6 : 1,
                  }}
                >
                  {editingWarehouse ? "Atualizar" : "Criar Armazém"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Transfer Stock Modal */}
      {transferModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="modal-overlay" onClick={() => {
            setTransferModalOpen(false);
            setTransferForm({ item: null, from_warehouse_id: null, to_warehouse_id: null, qty: 0 });
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Transferir Stock</h2>
                <button
                  className="close-btn"
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTransferForm({ item: null, from_warehouse_id: null, to_warehouse_id: null, qty: 0 });
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ padding: "24px" }}>
                {transferForm.item && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{
                      padding: "16px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}>
                      <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "4px" }}>Item:</div>
                      <div style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937" }}>{transferForm.item.name}</div>
                      <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "8px" }}>
                        Total disponível: <span style={{ fontWeight: 600 }}>{transferForm.item.qty || 0} unidades</span>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                        De (Armazém) *
                      </label>
                      <AntSelect
                        value={transferForm.from_warehouse_id}
                        onChange={(value) => setTransferForm({ ...transferForm, from_warehouse_id: value })}
                        placeholder="Selecione o armazém de origem"
                        style={{ width: "100%", height: "44px" }}
                      >
                        {warehouses.map((warehouse) => {
                          const warehouseData = transferForm.item.warehouses?.find(w => w.warehouse_id === warehouse.$id);
                          const qty = warehouseData?.qty || 0;
                          return (
                            <AntSelect.Option key={warehouse.$id} value={warehouse.$id} disabled={qty === 0}>
                              {warehouse.name} ({qty} unidades)
                            </AntSelect.Option>
                          );
                        })}
                      </AntSelect>
                    </div>

                    <div>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                        Para (Armazém) *
                      </label>
                      <AntSelect
                        value={transferForm.to_warehouse_id}
                        onChange={(value) => setTransferForm({ ...transferForm, to_warehouse_id: value })}
                        placeholder="Selecione o armazém de destino"
                        style={{ width: "100%", height: "44px" }}
                        disabled={!transferForm.from_warehouse_id}
                      >
                        {warehouses
                          .filter(w => w.$id !== transferForm.from_warehouse_id)
                          .map((warehouse) => (
                            <AntSelect.Option key={warehouse.$id} value={warehouse.$id}>
                              {warehouse.name}
                            </AntSelect.Option>
                          ))}
                      </AntSelect>
                    </div>

                    <div>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "14px" }}>
                        Quantidade *
                      </label>
                      <AntInput
                        type="number"
                        min="1"
                        max={transferForm.from_warehouse_id ?
                          transferForm.item.warehouses?.find(w => w.warehouse_id === transferForm.from_warehouse_id)?.qty || 0
                          : 0}
                        value={transferForm.qty}
                        onChange={(e) => setTransferForm({ ...transferForm, qty: parseInt(e.target.value) || 0 })}
                        placeholder="Quantidade a transferir"
                        style={{ height: "44px" }}
                        suffix="unidades"
                      />
                      {transferForm.from_warehouse_id && (
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                          Máximo disponível: {transferForm.item.warehouses?.find(w => w.warehouse_id === transferForm.from_warehouse_id)?.qty || 0} unidades
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                padding: "20px 24px",
                borderTop: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
              }}>
                <button
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTransferForm({ item: null, from_warehouse_id: null, to_warehouse_id: null, qty: 0 });
                  }}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    backgroundColor: "white",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    const maxQty = transferForm.item.warehouses?.find(w => w.warehouse_id === transferForm.from_warehouse_id)?.qty || 0;

                    if (!transferForm.from_warehouse_id || !transferForm.to_warehouse_id) {
                      alert("Por favor selecione os armazéns de origem e destino");
                      return;
                    }
                    if (transferForm.qty <= 0) {
                      alert("Por favor insira uma quantidade válida");
                      return;
                    }
                    if (transferForm.qty > maxQty) {
                      alert(`Quantidade excede o disponível (${maxQty} unidades)`);
                      return;
                    }

                    try {
                      await transferStock(
                        transferForm.item.$id,
                        transferForm.from_warehouse_id,
                        transferForm.to_warehouse_id,
                        transferForm.qty
                      );
                      setTransferModalOpen(false);
                      setTransferForm({ item: null, from_warehouse_id: null, to_warehouse_id: null, qty: 0 });
                      alert("✅ Transferência realizada com sucesso!");
                    } catch (err) {
                      alert(`Erro ao transferir stock: ${err.message}`);
                    }
                  }}
                  disabled={
                    !transferForm.from_warehouse_id ||
                    !transferForm.to_warehouse_id ||
                    transferForm.qty <= 0 ||
                    transferForm.qty > (transferForm.item.warehouses?.find(w => w.warehouse_id === transferForm.from_warehouse_id)?.qty || 0)
                  }
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    fontWeight: "500",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: "#10b981",
                    color: "white",
                  }}
                >
                  <Truck size={16} style={{ display: "inline", marginRight: "6px" }} />
                  Transferir
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

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
    </div>
  );
}
