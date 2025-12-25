"use client";

import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  Table,
  Tag,
  Image as AntImage,
  Input as AntInput,
  message,
  Modal,
  Select,
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
  BarChart3,
  PackageCheck,
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

export default function StockComponent({ onLoaded }) {
  // Tab state
  const [activeTab, setActiveTab] = useState("items"); // "items" | "warehouses" | "suppliers"
  const [isTabTransitioning, setIsTabTransitioning] = useState(false);

  // Items tab state
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRows, setEditingRows] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    supplier_id: null,
    cost_price: 0,
    inventory: [], // Array of { warehouse_id, qty, min_qty, position }
  });
  const [addItemLoading, setAddItemLoading] = useState(false);

  // Warehouses tab state
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [warehouseInventory, setWarehouseInventory] = useState([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  // Alerts state (warehouse-level)
  const [stockAlerts, setStockAlerts] = useState([]);

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

  // Warehouse inventory editing
  const [editingWarehouseItem, setEditingWarehouseItem] = useState(null);
  const [warehouseItemEditState, setWarehouseItemEditState] = useState({});
  const [warehouseItemEditModalOpen, setWarehouseItemEditModalOpen] =
    useState(false);

  // Warehouse edit modal
  const [editWarehouseModalOpen, setEditWarehouseModalOpen] = useState(false);

  // Warehouse dropdown for items table
  const [openWarehouseDropdown, setOpenWarehouseDropdown] = useState(null);
  const [itemWarehouseDetails, setItemWarehouseDetails] = useState({});
  const [warehouseDropdownLoading, setWarehouseDropdownLoading] =
    useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const warehouseDropdownRef = useRef(null);

  // Warehouse inventory search/filter
  const [warehouseSearchTerm, setWarehouseSearchTerm] = useState("");

  // Add item to warehouse modal
  const [addToWarehouseModalOpen, setAddToWarehouseModalOpen] = useState(false);
  const [addToWarehouseForm, setAddToWarehouseForm] = useState({
    item_id: null,
    qty: 0,
    min_qty: 0,
    position: "",
  });

  // Bulk quantity change modal
  const [bulkQtyModalOpen, setBulkQtyModalOpen] = useState(false);
  const [bulkQtyForm, setBulkQtyForm] = useState({
    item: null,
    action: "add", // 'add' or 'remove' or 'set'
    qty: 0,
  });

  // Image states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentImageId, setCurrentImageId] = useState(null);
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null); // Separate ref for edit modal

  // Image cropper states - simplified for react-advanced-cropper
  const [showCropper, setShowCropper] = useState(false);
  const [cropImage, setCropImage] = useState(null);
  const [croppedImageBlob, setCroppedImageBlob] = useState(null);
  const cropperRef = useRef(null);
  const [editingItemImageId, setEditingItemImageId] = useState(null); // Track which item we're editing image for

  // Track if onLoaded has been called to prevent multiple calls
  const onLoadedCalled = useRef(false);

  // Background removal states
  const [removingBackground, setRemovingBackground] = useState(false);
  const [backgroundRemovalPreview, setBackgroundRemovalPreview] =
    useState(null);
  const [originalImageBeforeRemoval, setOriginalImageBeforeRemoval] =
    useState(null);

  // Dropdown data states
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);
  const [expandedSupplierItems, setExpandedSupplierItems] = useState(new Set());

  // Supplier management states
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false);
  const [pageSize, setPageSize] = useState(50);

  // Image handling functions
  const getImageUrl = useCallback((imageId) => {
    if (!imageId) return null;

    // Simply return the URL without state updates to avoid setState during render
    try {
      // Get S3 bucket URL from environment (fallback to API redirect if not set)
      const S3_BUCKET_URL = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL;

      if (S3_BUCKET_URL) {
        // Direct S3 URL
        return `${S3_BUCKET_URL}/imagens-stock/${imageId}`;
      } else {
        // Fallback to API redirect
        return `${API_BASE_URL}/upload/files/imagens-stock/${imageId}`;
      }
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
      message.warning("Por favor selecione uma imagem válida (PNG, JPG, WEBP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB
      message.warning("A imagem não pode exceder 5MB");
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
    setEditingItemImageId(null); // Reset editing state
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = async () => {
    if (cropperRef.current) {
      const canvas = cropperRef.current.getCanvas();
      if (canvas) {
        canvas.toBlob(async (blob) => {
          if (blob) {
            setCroppedImageBlob(blob);
            const url = URL.createObjectURL(blob);
            setImagePreview(url);
            setShowCropper(false);
            // Note: In edit mode, we just set the preview - upload happens on Save
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
      message.warning("Por favor, selecione uma imagem primeiro");
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

      message.success("Fundo removido com sucesso!");
    } catch (error) {
      console.error("Error removing background:", error);
      message.error("Erro ao remover fundo da imagem");
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

      const response = await apiCall("/upload/stock-image", {
        method: "POST",
        body: JSON.stringify({
          imageData,
          filename: fileName,
        }),
      });

      // Return the filename (not full URL) - database stores just filename
      return response.filename || response.$id;
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

  const handleItemUpdated = useCallback(
    (item) => {
      // Update main stock items list
      setStockItems((prev) =>
        prev.map((i) =>
          i.$id === item.$id
            ? {
                ...i,
                ...item,
                num_warehouses: item.num_warehouses ?? i.num_warehouses,
              }
            : i
        )
      );

      // Update warehouse inventory if we're viewing a specific warehouse
      setWarehouseInventory((prev) => {
        // Check if this item exists in the current warehouse view
        const itemIndex = prev.findIndex((i) => i.$id === item.$id);
        if (itemIndex === -1) return prev;

        // Get the current warehouse ID (if viewing a warehouse)
        if (!selectedWarehouse) return prev;

        // Find warehouse data for the selected warehouse
        const warehouseData = item.warehouses?.find(
          (w) => String(w.warehouse_id) === String(selectedWarehouse.$id)
        );

        // If item no longer exists in this warehouse, remove it
        if (!warehouseData) {
          return prev.filter((i) => i.$id !== item.$id);
        }

        // Update the item with new warehouse data
        return prev.map((i) =>
          i.$id === item.$id
            ? {
                ...i,
                ...item,
                warehouse_qty: warehouseData.qty || 0,
                warehouse_position: warehouseData.position || null,
                min_qty: warehouseData.min_qty || 0,
                inventory_id: warehouseData.inventory_id || null,
              }
            : i
        );
      });
    },
    [selectedWarehouse]
  );

  const handleItemDeleted = useCallback((data) => {
    // Remove from main stock items list
    setStockItems((prev) => prev.filter((i) => i.$id !== data.id));

    // Remove from warehouse inventory if viewing a warehouse
    setWarehouseInventory((prev) => prev.filter((i) => i.$id !== data.id));
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

  const handleAlert = useCallback((alert) => {
    console.log("[Stock Alert]", alert.status, alert.message);
  }, []);

  // Handle real-time inventory updates from WebSocket
  const handleInventoryUpdated = useCallback(
    (inventory) => {
      console.log("[Stock] Inventory updated via WebSocket:", inventory);

      // Update warehouse inventory if viewing the affected warehouse
      setWarehouseInventory((prev) => {
        if (!selectedWarehouse) return prev;

        // Check if this inventory update is for the currently selected warehouse
        if (String(inventory.warehouse_id) !== String(selectedWarehouse.$id)) {
          return prev;
        }

        // Update the item in the warehouse inventory list
        return prev.map((item) => {
          if (String(item.$id) === String(inventory.stock_item_id)) {
            return {
              ...item,
              warehouse_qty: inventory.qty,
              warehouse_position: inventory.position,
              min_qty: inventory.min_qty ?? item.min_qty,
            };
          }
          return item;
        });
      });
    },
    [selectedWarehouse]
  );

  const handleInventoryDeleted = useCallback(
    (data) => {
      console.log("[Stock] Inventory deleted via WebSocket:", data);

      // Remove from warehouse inventory if viewing the affected warehouse
      setWarehouseInventory((prev) => {
        if (!selectedWarehouse) return prev;

        // Check if this deletion is for the currently selected warehouse
        if (String(data.warehouse_id) !== String(selectedWarehouse.$id)) {
          return prev;
        }

        // Remove the item from the warehouse inventory list
        return prev.filter(
          (item) => String(item.$id) !== String(data.stock_item_id)
        );
      });
    },
    [selectedWarehouse]
  );

  const handleStockTransferred = useCallback(
    (transfer) => {
      console.log("[Stock] Stock transferred via WebSocket:", transfer);

      // Update warehouse inventory for transfers affecting the current warehouse
      if (selectedWarehouse) {
        const warehouseId = String(selectedWarehouse.$id);
        const isSourceWarehouse =
          String(transfer.from_warehouse_id) === warehouseId;
        const isDestinationWarehouse =
          String(transfer.to_warehouse_id) === warehouseId;

        if (isSourceWarehouse || isDestinationWarehouse) {
          // Update the item in the warehouse inventory
          setWarehouseInventory((prev) => {
            return prev.map((item) => {
              if (String(item.$id) === String(transfer.stock_item_id)) {
                // Calculate new quantity based on transfer
                let newQty = item.warehouse_qty;
                if (isSourceWarehouse) {
                  newQty -= transfer.qty;
                }
                if (isDestinationWarehouse) {
                  newQty += transfer.qty;
                }

                return {
                  ...item,
                  warehouse_qty: Math.max(0, newQty),
                };
              }
              return item;
            });
          });
        }
      }
    },
    [selectedWarehouse]
  );

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
    onInventoryUpdated: handleInventoryUpdated,
    onInventoryDeleted: handleInventoryDeleted,
    onStockTransferred: handleStockTransferred,
    onAlert: handleAlert,
    onConnected: () => setWsConnected(true),
    onDisconnected: () => setWsConnected(false),
    onError: (error) => console.error("[Stock WS Error]", error),
  });

  // Memoized computed values for performance (now warehouse-based)
  const criticalStock = useMemo(
    () => stockAlerts.filter((alert) => alert.status === "critical"),
    [stockAlerts]
  );

  const warningStock = useMemo(
    () => stockAlerts.filter((alert) => alert.status === "warning"),
    [stockAlerts]
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

  // Filtered suppliers based on search
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchTerm.trim()) return suppliers;
    return suppliers.filter(
      (supplier) =>
        supplier.name
          ?.toLowerCase()
          .includes(supplierSearchTerm.toLowerCase()) ||
        supplier.contact_name
          ?.toLowerCase()
          .includes(supplierSearchTerm.toLowerCase()) ||
        supplier.email
          ?.toLowerCase()
          .includes(supplierSearchTerm.toLowerCase()) ||
        supplier.phone
          ?.toLowerCase()
          .includes(supplierSearchTerm.toLowerCase()) ||
        supplier.address
          ?.toLowerCase()
          .includes(supplierSearchTerm.toLowerCase())
    );
  }, [suppliers, supplierSearchTerm]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Fetch dropdown data for the add modal
  const fetchDropdownData = useCallback(async () => {
    setDropdownsLoading(true);
    try {
      const [categoriesRes, suppliersRes] = await Promise.all([
        apiCall("/stock/categories"),
        apiCall("/stock/suppliers"),
      ]);

      setCategories(categoriesRes.documents || []);
      setSuppliers(suppliersRes.documents || []);
    } catch (err) {
      console.error("Error fetching dropdown data:", err);
      setCategories([]);
      setSuppliers([]);
    } finally {
      setDropdownsLoading(false);
    }
  }, []);

  const fetchStock = useCallback(async () => {
    // Don't set loading=true during initial load - global loading handles this
    // Only set loading=true for refresh cycles
    if (onLoadedCalled.current) {
      setLoading(true);
    }
    try {
      const response = await apiCall("/stock/items");
      setStockItems(response.documents || []);
    } catch (err) {
      console.error("Error fetching stock:", err);
      message.error("Erro ao carregar stock. Verifique se está autenticado.");
      setStockItems([]);
    } finally {
      setLoading(false);
      // Only call onLoaded once during initial load
      if (onLoaded && !onLoadedCalled.current) {
        onLoadedCalled.current = true;
        onLoaded();
      }
    }
  }, [onLoaded]);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await apiCall("/stock/alerts");
      setStockAlerts(response.documents || []);
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setStockAlerts([]);
    }
  }, []);

  // Image management functions for items
  const updateItemImage = useCallback(
    async (itemId, imageId) => {
      try {
        await apiCall(`/stock/items/${itemId}`, {
          method: "PUT",
          body: JSON.stringify({ image_id: imageId }),
        });
        await fetchStock();
      } catch (error) {
        console.error("Error updating item image:", error);
        throw error;
      }
    },
    [fetchStock]
  );

  const deleteItemImage = useCallback(
    async (itemId, imageId) => {
      try {
        // Delete the image file
        if (imageId) {
          await apiCall(`/stock/image/${imageId}`, {
            method: "DELETE",
          });
        }
        // Update item to remove image_id
        await apiCall(`/stock/items/${itemId}`, {
          method: "PUT",
          body: JSON.stringify({ image_id: null }),
        });
        await fetchStock();

        // If we're in the edit modal, update the editingItem state
        if (editingItem && editingItem.$id === itemId) {
          setEditingItem({ ...editingItem, image_id: null });
        }
      } catch (error) {
        console.error("Error deleting item image:", error);
        throw error;
      }
    },
    [fetchStock, editingItem]
  );

  // Warehouse API functions
  const fetchWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    try {
      const response = await apiCall("/stock/warehouses");
      setWarehouses(response.documents || []);
    } catch (err) {
      console.error("Error fetching warehouses:", err);
      message.error("Erro ao carregar armazéns.");
      setWarehouses([]);
    } finally {
      setWarehousesLoading(false);
    }
  }, []);

  const fetchWarehouseInventory = useCallback(async (warehouseId) => {
    setLoading(true);
    try {
      // Get all items
      const itemsResponse = await apiCall("/stock/items");
      const allItems = itemsResponse.documents || [];

      // Filter items that might have inventory in this warehouse
      const itemsWithWarehouses = allItems.filter(
        (item) => item.num_warehouses > 0
      );

      // Fetch detailed info for each item to get warehouse breakdown
      const detailedItemsPromises = itemsWithWarehouses.map((item) =>
        apiCall(`/stock/items/${item.$id}`).catch((err) => {
          console.error(`Error fetching details for item ${item.$id}:`, err);
          return null;
        })
      );

      const detailedItems = await Promise.all(detailedItemsPromises);

      // Filter to get only items in the selected warehouse
      const inventoryItems = detailedItems
        .filter(Boolean) // Remove failed requests
        .map((item) => {
          // Find warehouse data for this specific warehouse
          const warehouseData = item.warehouses?.find(
            (w) => String(w.warehouse_id) === String(warehouseId)
          );
          if (!warehouseData) return null;

          return {
            ...item,
            warehouse_qty: warehouseData.qty || 0,
            warehouse_position: warehouseData.position || null,
            min_qty: warehouseData.min_qty || 0,
            inventory_id: warehouseData.inventory_id || null,
          };
        })
        .filter(Boolean); // Remove items not in this warehouse

      console.log("Warehouse inventory loaded:", inventoryItems);
      setWarehouseInventory(inventoryItems);
    } catch (err) {
      console.error("Error fetching warehouse inventory:", err);
      message.error("Erro ao carregar inventário do armazém.");
      setWarehouseInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchItemWarehouseDetails = useCallback(
    async (itemId, triggerElement) => {
      // Calculate position from trigger element
      if (triggerElement) {
        const rect = triggerElement.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }

      // Toggle if already open
      if (openWarehouseDropdown === itemId) {
        setOpenWarehouseDropdown(null);
        return;
      }

      // Open dropdown
      setOpenWarehouseDropdown(itemId);

      // If already cached, don't fetch again
      if (itemWarehouseDetails[itemId]) {
        return;
      }

      // Fetch detailed item info with warehouse breakdown
      setWarehouseDropdownLoading(true);
      try {
        const itemDetails = await apiCall(`/stock/items/${itemId}`);

        // Map warehouse data with warehouse names
        const warehousesWithNames = await Promise.all(
          (itemDetails.warehouses || []).map(async (wh) => {
            try {
              const warehouseInfo = await apiCall(
                `/stock/warehouses/${wh.warehouse_id}`
              );
              return {
                ...wh,
                warehouse_name: warehouseInfo.name,
                warehouse_address: warehouseInfo.address,
              };
            } catch (err) {
              console.error(
                `Error fetching warehouse ${wh.warehouse_id}:`,
                err
              );
              return {
                ...wh,
                warehouse_name: "Unknown",
                warehouse_address: "-",
              };
            }
          })
        );

        setItemWarehouseDetails((prev) => ({
          ...prev,
          [itemId]: warehousesWithNames,
        }));
      } catch (err) {
        console.error("Error fetching item warehouse details:", err);
        message.error("Erro ao carregar detalhes dos armazéns.");
      } finally {
        setWarehouseDropdownLoading(false);
      }
    },
    [itemWarehouseDetails, openWarehouseDropdown]
  );

  // Click outside and scroll to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Check if click is on a warehouse trigger button or its children
      const triggerButton = e.target.closest(".warehouse-trigger");

      if (
        openWarehouseDropdown &&
        warehouseDropdownRef.current &&
        !warehouseDropdownRef.current.contains(e.target) &&
        !triggerButton
      ) {
        setOpenWarehouseDropdown(null);
      }
    };

    const handleScroll = () => {
      if (openWarehouseDropdown) {
        setOpenWarehouseDropdown(null);
      }
    };

    if (openWarehouseDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true); // true for capture phase to catch all scrolls
      document.addEventListener("scroll", handleScroll, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [openWarehouseDropdown]);

  const createWarehouse = useCallback(
    async (data) => {
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
    },
    [fetchWarehouses]
  );

  const updateWarehouse = useCallback(
    async (id, data) => {
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
    },
    [fetchWarehouses]
  );

  const deleteWarehouse = useCallback(
    async (id) => {
      try {
        await apiCall(`/stock/warehouses/${id}`, {
          method: "DELETE",
        });
        await fetchWarehouses();
      } catch (err) {
        console.error("Error deleting warehouse:", err);
        throw err;
      }
    },
    [fetchWarehouses]
  );

  const updateWarehouseInventory = useCallback(
    async (itemId, warehouseId, data) => {
      // Optimistic update - update local state immediately
      setWarehouseInventory((prevInventory) =>
        prevInventory.map((item) => {
          if (item.$id === itemId) {
            return {
              ...item,
              warehouse_qty:
                data.qty !== undefined ? data.qty : item.warehouse_qty,
              warehouse_position:
                data.position !== undefined
                  ? data.position
                  : item.warehouse_position,
              min_qty: data.min_qty !== undefined ? data.min_qty : item.min_qty,
            };
          }
          return item;
        })
      );

      try {
        const response = await apiCall(
          `/stock/items/${itemId}/inventory/${warehouseId}`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        );
        // Refresh alerts after updating warehouse inventory
        await fetchAlerts();
        return response;
      } catch (err) {
        console.error("Error updating warehouse inventory:", err);
        // If API call fails, revert by refetching
        if (selectedWarehouse) {
          await fetchWarehouseInventory(selectedWarehouse.$id);
        }
        throw err;
      }
    },
    [selectedWarehouse, fetchWarehouseInventory, fetchAlerts]
  );

  const addItemToWarehouse = useCallback(
    async (itemId, warehouseId, qty, min_qty, position) => {
      try {
        const response = await apiCall(`/stock/items/${itemId}/inventory`, {
          method: "POST",
          body: JSON.stringify({
            warehouse_id: warehouseId,
            qty,
            min_qty: min_qty || 0,
            position: position || null,
            operation: "set",
          }),
        });
        if (selectedWarehouse) {
          await fetchWarehouseInventory(selectedWarehouse.$id);
        }
        await fetchStock(); // Refresh main list too
        await fetchAlerts(); // Refresh alerts too
        return response;
      } catch (err) {
        console.error("Error adding item to warehouse:", err);
        throw err;
      }
    },
    [selectedWarehouse, fetchWarehouseInventory, fetchStock, fetchAlerts]
  );

  const transferStock = useCallback(
    async (itemId, fromWarehouseId, toWarehouseId, qty) => {
      // Optimistic update - update local state immediately
      setWarehouseInventory((prevInventory) =>
        prevInventory.map((item) => {
          if (item.$id === itemId) {
            // Only update if this is the "from" warehouse we're viewing
            if (String(selectedWarehouse?.$id) === String(fromWarehouseId)) {
              return {
                ...item,
                warehouse_qty: Math.max(0, (item.warehouse_qty || 0) - qty),
              };
            }
          }
          return item;
        })
      );

      try {
        const response = await apiCall(`/stock/items/${itemId}/transfer`, {
          method: "POST",
          body: JSON.stringify({
            from_warehouse_id: fromWarehouseId,
            to_warehouse_id: toWarehouseId,
            qty,
          }),
        });

        // Silently refresh data in background without showing loading
        await fetchStock();
        await fetchAlerts();

        // Fetch full item details to update warehouse inventory accurately
        const itemDetails = await apiCall(`/stock/items/${itemId}`);
        setWarehouseInventory((prevInventory) =>
          prevInventory.map((item) => {
            if (item.$id === itemId) {
              const warehouseData = itemDetails.warehouses?.find(
                (w) => String(w.warehouse_id) === String(selectedWarehouse?.$id)
              );
              if (warehouseData) {
                return {
                  ...item,
                  warehouse_qty: warehouseData.qty || 0,
                  warehouse_position: warehouseData.position || null,
                  min_qty: warehouseData.min_qty || 0,
                };
              }
            }
            return item;
          })
        );

        return response;
      } catch (err) {
        console.error("Error transferring stock:", err);
        // Revert optimistic update on error
        if (selectedWarehouse) {
          await fetchWarehouseInventory(selectedWarehouse.$id);
        }
        throw err;
      }
    },
    [fetchStock, fetchAlerts, selectedWarehouse, fetchWarehouseInventory]
  );

  // Supplier CRUD operations
  const createSupplier = useCallback(
    async (supplierData) => {
      try {
        const response = await apiCall("/stock/suppliers", {
          method: "POST",
          body: JSON.stringify(supplierData),
        });
        await fetchDropdownData(); // Refresh suppliers list
        return response;
      } catch (err) {
        console.error("Error creating supplier:", err);
        throw err;
      }
    },
    [fetchDropdownData]
  );

  const updateSupplier = useCallback(
    async (supplierId, supplierData) => {
      try {
        const response = await apiCall(`/stock/suppliers/${supplierId}`, {
          method: "PUT",
          body: JSON.stringify(supplierData),
        });
        await fetchDropdownData(); // Refresh suppliers list
        return response;
      } catch (err) {
        console.error("Error updating supplier:", err);
        throw err;
      }
    },
    [fetchDropdownData]
  );

  const deleteSupplier = useCallback(
    async (supplierId) => {
      try {
        const response = await apiCall(`/stock/suppliers/${supplierId}`, {
          method: "DELETE",
        });
        await fetchDropdownData(); // Refresh suppliers list
        return response;
      } catch (err) {
        console.error("Error deleting supplier:", err);
        throw err;
      }
    },
    [fetchDropdownData]
  );

  // Initial data fetch
  useEffect(() => {
    fetchStock();
    fetchWarehouses();
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch dropdown data when add modal opens or when first item is being edited
  useEffect(() => {
    const isEditing = Object.keys(editingRows).length > 0;
    if (
      (isAddModalOpen || isEditModalOpen || isEditing) &&
      categories.length === 0
    ) {
      fetchDropdownData();
    }
    // Also fetch warehouses when modal opens
    if ((isAddModalOpen || isEditModalOpen) && warehouses.length === 0) {
      fetchWarehouses();
    }
  }, [
    isAddModalOpen,
    isEditModalOpen,
    editingRows,
    categories.length,
    warehouses.length,
    fetchDropdownData,
    fetchWarehouses,
  ]);

  // Fetch warehouses when transfer modal opens
  useEffect(() => {
    if (transferModalOpen && warehouses.length === 0) {
      fetchWarehouses();
    }
  }, [transferModalOpen, warehouses.length, fetchWarehouses]);

  // Debug transfer modal data
  useEffect(() => {
    if (transferModalOpen) {
      console.log("Transfer Modal Open - Debug Info:");
      console.log("- Warehouses:", warehouses.length, warehouses);
      console.log("- Transfer Form:", transferForm);
      console.log("- Item warehouses:", transferForm.item?.warehouses);
    }
  }, [transferModalOpen, warehouses, transferForm]);

  // Fetch stock items when add to warehouse modal opens
  useEffect(() => {
    if (addToWarehouseModalOpen && stockItems.length === 0) {
      fetchStock();
    }
  }, [addToWarehouseModalOpen, stockItems.length, fetchStock]);

  // Fetch suppliers when suppliers tab is opened
  useEffect(() => {
    if (activeTab === "suppliers" && suppliers.length === 0) {
      fetchDropdownData();
    }
  }, [activeTab, suppliers.length, fetchDropdownData]);

  const handleSaveEdit = useCallback(
    async (itemId) => {
      const edits = editingRows[itemId];
      if (!edits || loading) return;

      // Validate name is not empty
      const trimmedName = edits.name?.trim();
      if (!trimmedName) {
        message.warning("Nome do produto é obrigatório");
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
        message.success("Item atualizado com sucesso!");
      } catch (err) {
        console.error("Error updating item:", err);
        message.error("Erro ao atualizar item. Tente novamente.");
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
          description: newItem.description?.trim() || null,
          supplier_id: newItem.supplier_id || null,
          cost_price: Math.max(0, parseFloat(newItem.cost_price) || 0),
          image_id: imageId,
          inventory: newItem.inventory || [], // Send inventory array
        }),
      });

      setNewItem({
        name: "",
        description: "",
        supplier_id: null,
        cost_price: 0,
        inventory: [],
      });
      resetImage();
      setIsAddModalOpen(false);

      await fetchStock();
      console.log("Item adicionado com sucesso!");
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
      description: "",
      supplier_id: null,
      cost_price: 0,
      inventory: [],
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
        title: "Item",
        dataIndex: "name",
        key: "name",
        render: (name, record) => {
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {record.image_id ? (
                <AntImage
                  src={getImageUrl(record.image_id)}
                  alt={record.name}
                  width={60}
                  height={60}
                  style={{
                    borderRadius: "8px",
                    objectFit: "contain",
                  }}
                  preview={false}
                />
              ) : (
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "8px",
                    background: "#f8f9fa",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <Package size={24} color="#9ca3af" />
                </div>
              )}
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "#1a1a1a",
                    marginBottom: "4px",
                  }}
                >
                  {name || "Nome não disponível"}
                </div>
                {record.category && (
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {record.category}
                  </div>
                )}
              </div>
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
          return (
            <span
              style={{
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              <NumberFlow value={qty || 0} />
            </span>
          );
        },
      },
      {
        title: "# Armazéns",
        key: "num_warehouses",
        render: (_, record) => {
          const numWarehouses = record.num_warehouses || 0;
          const isOpen = openWarehouseDropdown === record.$id;

          return (
            <button
              className="warehouse-trigger"
              onClick={(e) => {
                if (numWarehouses > 0) {
                  e.stopPropagation();
                  e.preventDefault();
                  fetchItemWarehouseDetails(record.$id, e.currentTarget);
                }
              }}
              disabled={numWarehouses === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: numWarehouses > 0 ? "pointer" : "default",
                padding: "6px 10px",
                borderRadius: "6px",
                transition: "all 0.2s",
                backgroundColor: isOpen ? "#e0f2fe" : "transparent",
                border: "none",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                if (numWarehouses > 0 && !isOpen) {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                }
              }}
              onMouseLeave={(e) => {
                if (!isOpen) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <Warehouse
                size={16}
                color={numWarehouses > 0 ? "#0ea5e9" : "#6b7280"}
              />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: "14px",
                  color: numWarehouses > 0 ? "#0ea5e9" : "#6b7280",
                }}
              >
                <NumberFlow value={numWarehouses} />
              </span>
              {numWarehouses > 0 && (
                <ChevronDown
                  size={14}
                  color="#0ea5e9"
                  style={{
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                />
              )}
            </button>
          );
        },
      },
      {
        title: "Preço",
        dataIndex: "cost_price",
        key: "cost_price",
        sorter: (a, b) => (a.cost_price || 0) - (b.cost_price || 0),
        render: (cost_price) => {
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
        title: "Fornecedor",
        dataIndex: "supplier_name",
        key: "supplier_name",
        render: (supplier_name) => {
          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
              }}
            >
              <Truck size={14} color="#64748b" />
              <span>{supplier_name || "N/A"}</span>
            </div>
          );
        },
      },
      {
        title: "Ações",
        key: "actions",
        width: 80,
        render: (_, record) => {
          return (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <Button
                size="small"
                icon={<Edit size={14} />}
                onClick={() => {
                  setEditingItem(record);
                  setIsEditModalOpen(true);
                }}
                title="Editar item"
              />
            </div>
          );
        },
      },
    ],
    [getImageUrl, loading]
  );

  return (
    <div className="stock-component">
      {loading && (
        <div className="loading-state">
          <RefreshCw className="animate-spin" size={32} />
          <p>A carregar...</p>
        </div>
      )}
      {/* Main Container */}
      <div className="stock-container">
        {/* Header Card */}
        <div className="stock-header-card">
          <div className="stock-header-card__content">
            <div className="stock-header-card__left">
              <h1 className="stock-header-card__title">Gestão de Stock</h1>
              <p className="stock-header-card__description">
                Controla o inventário em múltiplos armazéns e mantém tudo
                organizado.
              </p>
              {/* Only show buttons on items tab, warehouses views, and suppliers tab */}
              {(activeTab === "items" ||
                activeTab === "warehouses" ||
                activeTab === "suppliers") && (
                <div className="stock-header-card__actions">
                  <button
                    onClick={
                      activeTab === "items"
                        ? fetchStock
                        : activeTab === "warehouses"
                        ? selectedWarehouse
                          ? () => fetchWarehouseInventory(selectedWarehouse.$id)
                          : fetchWarehouses
                        : fetchDropdownData
                    }
                    disabled={loading || warehousesLoading}
                    className="stock-header-card__btn stock-header-card__btn--secondary"
                  >
                    <RefreshCw
                      size={16}
                      className={
                        loading || warehousesLoading ? "animate-spin" : ""
                      }
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
                  ) : activeTab === "warehouses" ? (
                    selectedWarehouse ? (
                      <button
                        onClick={() => setAddToWarehouseModalOpen(true)}
                        className="stock-header-card__btn stock-header-card__btn--primary"
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
                    )
                  ) : (
                    <button
                      onClick={() => setIsAddSupplierModalOpen(true)}
                      className="stock-header-card__btn stock-header-card__btn--primary"
                    >
                      <Plus size={16} />
                      Adicionar Fornecedor
                    </button>
                  )}
                </div>
              )}
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
              if (activeTab !== "items") {
                setIsTabTransitioning(true);
                setTimeout(() => {
                  setActiveTab("items");
                  setSelectedWarehouse(null);
                  setTimeout(() => setIsTabTransitioning(false), 50);
                }, 150);
              }
            }}
          >
            <Package size={18} />
            Visão Geral de Items
          </button>
          <button
            className={`stock-tab ${
              activeTab === "warehouses" ? "active" : ""
            }`}
            onClick={() => {
              if (activeTab !== "warehouses") {
                setIsTabTransitioning(true);
                setTimeout(() => {
                  setActiveTab("warehouses");
                  setTimeout(() => setIsTabTransitioning(false), 50);
                }, 150);
              }
            }}
          >
            <Warehouse size={18} />
            Armazéns
          </button>
          <button
            className={`stock-tab ${activeTab === "suppliers" ? "active" : ""}`}
            onClick={() => {
              if (activeTab !== "suppliers") {
                setIsTabTransitioning(true);
                setTimeout(() => {
                  setActiveTab("suppliers");
                  setTimeout(() => setIsTabTransitioning(false), 50);
                }, 150);
              }
            }}
          >
            <ShoppingCart size={18} />
            Fornecedores
          </button>
        </div>

        {/* Items Tab Content */}
        {activeTab === "items" && (
          <div
            className={`stock-grid tab-content-wrapper ${
              isTabTransitioning ? "transitioning" : "active"
            }`}
          >
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
                <div className="stat-description">
                  Localizações abaixo do mínimo
                </div>

                {criticalStock.length > 0 && (
                  <div className="critical-items-preview">
                    {criticalStock.slice(0, 3).map((alert) => (
                      <div key={alert.$id} className="critical-item-mini">
                        <span className="item-name">{alert.name}</span>
                        <span className="item-qty" style={{ fontSize: "11px" }}>
                          {alert.warehouse_name}:{" "}
                          <NumberFlow value={alert.qty} />/
                          <NumberFlow value={alert.min_qty} />
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
                <div className="stat-description">
                  Localizações próximas do mínimo
                </div>
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

              {/* Stock Table */}
              <div className="stock-table-container">
                <Table
                  dataSource={filteredItems
                    .filter((item) => item && item.$id && item.name)
                    .map((item) => ({
                      ...item,
                      key: item.$id,
                    }))}
                  columns={columns}
                  loading={loading}
                  pagination={{
                    pageSize: pageSize,
                    showSizeChanger: true,
                    showTotal: (total, range) =>
                      `${range[0]}-${range[1]} p/página`,
                    pageSizeOptions: ["10", "25", "50", "100"],
                    onShowSizeChange: (current, size) => setPageSize(size),
                    locale: { items_per_page: "p/página" },
                  }}
                  scroll={{ x: "max-content" }}
                  tableLayout="auto"
                  locale={{
                    emptyText: (
                      <div className="empty-state">
                        <div className="empty-icon">
                          <Package size={32} />
                        </div>
                        <div className="empty-title">
                          Nenhum item encontrado
                        </div>
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
                          borderRadius: "1.5rem",
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
                                borderRadius: "1.5rem",
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
                              borderRadius: "1.5rem",
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
                                borderRadius: "1.5rem",
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
                                borderRadius: "1.5rem",
                                fontSize: "14px",
                                fontWeight: "500",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                              }}
                              title="Restaurar imagem original"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#d97706";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#f59e0b";
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
                              borderRadius: "1.5rem",
                              fontSize: "14px",
                              fontWeight: "500",
                              cursor: removingBackground
                                ? "not-allowed"
                                : "pointer",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!removingBackground) {
                                e.currentTarget.style.backgroundColor =
                                  "#e5e7eb";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!removingBackground) {
                                e.currentTarget.style.backgroundColor =
                                  "#f3f4f6";
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
                        rows={3}
                        className="form-textarea"
                        disabled={addItemLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label>Fornecedor</label>
                      <Select
                        value={newItem.supplier_id || undefined}
                        onChange={(value) =>
                          setNewItem((prev) => ({
                            ...prev,
                            supplier_id: value || null,
                          }))
                        }
                        placeholder="Sem fornecedor"
                        disabled={dropdownsLoading || addItemLoading}
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                          (option?.label ?? "")
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        style={{ width: "100%", height: "44px" }}
                        className="custom-select"
                        options={suppliers.map((supplier) => ({
                          value: supplier.$id,
                          label:
                            supplier.name ||
                            supplier.supplier ||
                            "Fornecedor sem nome",
                        }))}
                      />
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

                    {/* Warehouse Inventory Section */}
                    <div className="form-group full-width">
                      <label
                        style={{
                          marginBottom: "12px",
                          display: "block",
                          fontWeight: "600",
                        }}
                      >
                        Inventário Inicial (Opcional)
                      </label>
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "1.5rem",
                          padding: "16px",
                          backgroundColor: "#f9fafb",
                        }}
                      >
                        {warehousesLoading ? (
                          <p style={{ textAlign: "center", color: "#6b7280" }}>
                            A carregar armazéns...
                          </p>
                        ) : warehouses.length === 0 ? (
                          <p style={{ textAlign: "center", color: "#6b7280" }}>
                            Nenhum armazém disponível. Crie armazéns primeiro.
                          </p>
                        ) : (
                          <>
                            {warehouses.map((warehouse) => {
                              const inventoryEntry = newItem.inventory.find(
                                (inv) =>
                                  String(inv.warehouse_id) ===
                                  String(warehouse.$id)
                              );

                              return (
                                <div
                                  key={warehouse.$id}
                                  style={{
                                    marginBottom: "12px",
                                    padding: "12px",
                                    backgroundColor: "white",
                                    borderRadius: "1.5rem",
                                    border: "1px solid #e5e7eb",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <div
                                      style={{ flex: "1", minWidth: "150px" }}
                                    >
                                      <strong style={{ fontSize: "14px" }}>
                                        {warehouse.name}
                                      </strong>
                                      {warehouse.address && (
                                        <div
                                          style={{
                                            fontSize: "12px",
                                            color: "#6b7280",
                                            marginTop: "2px",
                                          }}
                                        >
                                          {warehouse.address}
                                        </div>
                                      )}
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="Qtd."
                                        value={inventoryEntry?.qty || ""}
                                        onChange={(e) => {
                                          const qty =
                                            parseInt(e.target.value) || 0;
                                          setNewItem((prev) => {
                                            const existingIndex =
                                              prev.inventory.findIndex(
                                                (inv) =>
                                                  String(inv.warehouse_id) ===
                                                  String(warehouse.$id)
                                              );

                                            const newInventory = [
                                              ...prev.inventory,
                                            ];

                                            if (qty > 0) {
                                              if (existingIndex >= 0) {
                                                newInventory[existingIndex] = {
                                                  ...newInventory[
                                                    existingIndex
                                                  ],
                                                  qty,
                                                };
                                              } else {
                                                newInventory.push({
                                                  warehouse_id: warehouse.$id,
                                                  qty,
                                                  min_qty: 0,
                                                  position: "",
                                                });
                                              }
                                            } else if (existingIndex >= 0) {
                                              newInventory.splice(
                                                existingIndex,
                                                1
                                              );
                                            }

                                            return {
                                              ...prev,
                                              inventory: newInventory,
                                            };
                                          });
                                        }}
                                        style={{
                                          width: "80px",
                                          padding: "6px 10px",
                                          border: "1px solid #d1d5db",
                                          borderRadius: "1.5rem",
                                          fontSize: "14px",
                                        }}
                                        disabled={addItemLoading}
                                      />
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="Mín."
                                        value={inventoryEntry?.min_qty || ""}
                                        onChange={(e) => {
                                          const min_qty =
                                            parseInt(e.target.value) || 0;
                                          setNewItem((prev) => {
                                            const existingIndex =
                                              prev.inventory.findIndex(
                                                (inv) =>
                                                  String(inv.warehouse_id) ===
                                                  String(warehouse.$id)
                                              );

                                            const newInventory = [
                                              ...prev.inventory,
                                            ];

                                            if (existingIndex >= 0) {
                                              newInventory[existingIndex] = {
                                                ...newInventory[existingIndex],
                                                min_qty,
                                              };
                                            } else if (min_qty > 0) {
                                              newInventory.push({
                                                warehouse_id: warehouse.$id,
                                                qty: 0,
                                                min_qty,
                                                position: "",
                                              });
                                            }

                                            return {
                                              ...prev,
                                              inventory: newInventory,
                                            };
                                          });
                                        }}
                                        style={{
                                          width: "70px",
                                          padding: "6px 10px",
                                          border: "1px solid #d1d5db",
                                          borderRadius: "1.5rem",
                                          fontSize: "14px",
                                        }}
                                        disabled={addItemLoading}
                                      />
                                      <input
                                        type="text"
                                        placeholder="Posição (ex: A1-B5)"
                                        value={inventoryEntry?.position || ""}
                                        onChange={(e) => {
                                          const position = e.target.value;
                                          setNewItem((prev) => {
                                            const existingIndex =
                                              prev.inventory.findIndex(
                                                (inv) =>
                                                  String(inv.warehouse_id) ===
                                                  String(warehouse.$id)
                                              );

                                            const newInventory = [
                                              ...prev.inventory,
                                            ];

                                            if (existingIndex >= 0) {
                                              newInventory[existingIndex] = {
                                                ...newInventory[existingIndex],
                                                position,
                                              };
                                            } else if (position) {
                                              newInventory.push({
                                                warehouse_id: warehouse.$id,
                                                qty: 0,
                                                min_qty: 0,
                                                position,
                                              });
                                            }

                                            return {
                                              ...prev,
                                              inventory: newInventory,
                                            };
                                          });
                                        }}
                                        style={{
                                          width: "140px",
                                          padding: "6px 10px",
                                          border: "1px solid #d1d5db",
                                          borderRadius: "1.5rem",
                                          fontSize: "14px",
                                        }}
                                        disabled={addItemLoading}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                marginTop: "12px",
                                marginBottom: "0",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <PackageCheck size={14} />
                              <span>
                                Pode adicionar stock aos armazéns agora ou
                                depois
                              </span>
                            </p>
                          </>
                        )}
                      </div>
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
                    disabled={addItemLoading}
                    className="footer-button cancel"
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
          )}

        {/* Warehouses Tab Content */}
        {activeTab === "warehouses" && (
          <div
            className={`warehouses-view tab-content-wrapper ${
              isTabTransitioning ? "transitioning" : "active"
            }`}
          >
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
                      <p>
                        Crie o primeiro armazém para começar a gerir inventário
                      </p>
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
                        <div className="warehouse-card-content">
                          <p className="warehouse-description">
                            {warehouse.description || "Sem descrição"}
                          </p>
                          {warehouse.address && (
                            <div className="warehouse-address">
                              <MapPin size={14} />
                              {warehouse.address}
                            </div>
                          )}
                        </div>
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
                          <button
                            className="edit-warehouse-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingWarehouse(warehouse);
                              setEditWarehouseModalOpen(true);
                            }}
                          >
                            <Edit size={16} />
                            Editar
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
                    {selectedWarehouse.description && (
                      <p>{selectedWarehouse.description}</p>
                    )}
                  </div>
                </div>

                <div className="warehouse-inventory-content">
                  {warehouseInventory.length === 0 ? (
                    <div className="empty-state">
                      <Package size={64} />
                      <h3>Sem items neste armazém</h3>
                      <p>
                        Adicione items a este armazém ou transfira de outro
                        armazém
                      </p>
                    </div>
                  ) : (
                    <div className="warehouse-table-container">
                      <div
                        className="warehouse-search-bar"
                        style={{ marginBottom: "16px" }}
                      >
                        <div
                          className="search-input-wrapper"
                          style={{
                            position: "relative",
                            maxWidth: "400px",
                          }}
                        >
                          <Search
                            size={18}
                            style={{
                              position: "absolute",
                              left: "12px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: "#64748b",
                              borderRadius: "1.5rem",
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Procurar por nome, categoria ou posição..."
                            value={warehouseSearchTerm}
                            onChange={(e) =>
                              setWarehouseSearchTerm(e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "10px 12px 10px 40px",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              fontSize: "14px",
                              outline: "none",
                              transition: "border-color 0.2s",
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = "#0ea5e9";
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = "#e2e8f0";
                            }}
                          />
                          {warehouseSearchTerm && (
                            <button
                              onClick={() => setWarehouseSearchTerm("")}
                              style={{
                                position: "absolute",
                                right: "8px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#64748b",
                                transition: "color 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#0ea5e9";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "#64748b";
                              }}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      <table className="warehouse-inventory-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Categoria</th>
                            <th>Quantidade</th>
                            <th>Posição</th>
                            <th>Qtd. Mín.</th>
                            <th>Status</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warehouseInventory
                            .filter((item) => {
                              if (!warehouseSearchTerm) return true;
                              const searchLower =
                                warehouseSearchTerm.toLowerCase();
                              return (
                                item.name
                                  ?.toLowerCase()
                                  .includes(searchLower) ||
                                item.category
                                  ?.toLowerCase()
                                  .includes(searchLower) ||
                                item.warehouse_position
                                  ?.toLowerCase()
                                  .includes(searchLower)
                              );
                            })
                            .map((item) => {
                              const status =
                                item.warehouse_qty <= item.min_qty
                                  ? "critical"
                                  : item.warehouse_qty <= item.min_qty + 5
                                  ? "warning"
                                  : "ok";

                              return (
                                <tr key={item.$id}>
                                  <td>
                                    <div className="item-cell">
                                      {item.image_id ? (
                                        <AntImage
                                          src={getImageUrl(item.image_id)}
                                          alt={item.name}
                                          width={60}
                                          height={60}
                                          style={{
                                            borderRadius: "8px",
                                            objectFit: "contain",
                                          }}
                                          preview={false}
                                        />
                                      ) : (
                                        <div
                                          style={{
                                            width: 60,
                                            height: 60,
                                            borderRadius: "8px",
                                            background: "#f8f9fa",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            border: "1px solid #e5e7eb",
                                          }}
                                        >
                                          <Package size={24} color="#9ca3af" />
                                        </div>
                                      )}
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          fontSize: "14px",
                                          color: "#1a1a1a",
                                        }}
                                      >
                                        {item.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td>{item.category || "-"}</td>
                                  <td>
                                    <NumberFlow
                                      value={item.warehouse_qty || 0}
                                    />
                                  </td>
                                  <td>{item.warehouse_position || "-"}</td>
                                  <td>
                                    <NumberFlow value={item.min_qty || 0} />
                                  </td>
                                  <td>
                                    <Tag
                                      color={
                                        status === "critical"
                                          ? "error"
                                          : status === "warning"
                                          ? "warning"
                                          : "success"
                                      }
                                    >
                                      {status === "critical"
                                        ? "Crítico"
                                        : status === "warning"
                                        ? "Aviso"
                                        : "OK"}
                                    </Tag>
                                  </td>
                                  <td>
                                    <div className="action-buttons">
                                      <button
                                        className="action-btn"
                                        onClick={async () => {
                                          try {
                                            const newQty =
                                              item.warehouse_qty + 1;
                                            await updateWarehouseInventory(
                                              item.$id,
                                              selectedWarehouse.$id,
                                              {
                                                qty: newQty,
                                                position:
                                                  item.warehouse_position,
                                                min_qty: item.min_qty,
                                              }
                                            );
                                          } catch (err) {
                                            message.error(
                                              `Erro: ${err.message}`
                                            );
                                          }
                                        }}
                                        title="Adicionar +1"
                                        style={{ color: "#10b981" }}
                                      >
                                        <Plus size={16} />
                                      </button>
                                      <button
                                        className="action-btn"
                                        onClick={async () => {
                                          if (item.warehouse_qty <= 0) {
                                            message.warning(
                                              "Quantidade já está em 0"
                                            );
                                            return;
                                          }
                                          try {
                                            const newQty = Math.max(
                                              0,
                                              item.warehouse_qty - 1
                                            );
                                            await updateWarehouseInventory(
                                              item.$id,
                                              selectedWarehouse.$id,
                                              {
                                                qty: newQty,
                                                position:
                                                  item.warehouse_position,
                                                min_qty: item.min_qty,
                                              }
                                            );
                                          } catch (err) {
                                            message.error(
                                              `Erro: ${err.message}`
                                            );
                                          }
                                        }}
                                        title="Remover -1"
                                        style={{ color: "#ef4444" }}
                                        disabled={item.warehouse_qty <= 0}
                                      >
                                        <Minus size={16} />
                                      </button>
                                      <button
                                        className="action-btn bulk-qty-btn"
                                        onClick={() => {
                                          setBulkQtyForm({
                                            item: item,
                                            action: "add",
                                            qty: 0,
                                          });
                                          setBulkQtyModalOpen(true);
                                        }}
                                        title="Ajuste Rápido"
                                      >
                                        <PackageCheck size={16} />
                                      </button>
                                      <button
                                        className="action-btn transfer-btn"
                                        onClick={async () => {
                                          // Fetch full item details with warehouse breakdown
                                          try {
                                            const itemDetails = await apiCall(
                                              `/stock/items/${item.$id}`
                                            );
                                            setTransferForm({
                                              item: itemDetails,
                                              from_warehouse_id:
                                                selectedWarehouse.$id,
                                              to_warehouse_id: null,
                                              qty: 0,
                                            });
                                            setTransferModalOpen(true);
                                          } catch (err) {
                                            message.error(
                                              `Erro ao carregar detalhes: ${err.message}`
                                            );
                                          }
                                        }}
                                        title="Transferir"
                                      >
                                        <Truck size={16} />
                                      </button>
                                      <button
                                        className="action-btn"
                                        onClick={() => {
                                          setEditingWarehouseItem(item);
                                          setWarehouseItemEditState({
                                            qty: item.warehouse_qty,
                                            position:
                                              item.warehouse_position || "",
                                            min_qty: item.min_qty || 0,
                                          });
                                          setWarehouseItemEditModalOpen(true);
                                        }}
                                        title="Editar"
                                        style={{ color: "#3b82f6" }}
                                      >
                                        <Edit size={16} />
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

        {/* Suppliers Tab Content */}
        {activeTab === "suppliers" && (
          <div
            className={`suppliers-view tab-content-wrapper ${
              isTabTransitioning ? "transitioning" : "active"
            }`}
          >
            {/* Main Content Card */}
            <div className="main-content-card">
              {/* Search Bar */}
              <div className="content-controls">
                <div className="search-wrapper">
                  <Search className="search-icon" />
                  <input
                    type="text"
                    placeholder="Pesquisar fornecedores..."
                    value={supplierSearchTerm}
                    onChange={(e) => setSupplierSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>

              {/* Suppliers Grid */}
              <div className="suppliers-grid">
                {dropdownsLoading ? (
                  <div className="loading-state">
                    <RefreshCw className="animate-spin" size={32} />
                    <p>A carregar fornecedores...</p>
                  </div>
                ) : filteredSuppliers.length === 0 ? (
                  <div className="empty-state">
                    <ShoppingCart size={64} />
                    <h3>
                      {suppliers.length === 0
                        ? "Nenhum fornecedor registado"
                        : "Nenhum fornecedor encontrado"}
                    </h3>
                    <p>
                      {suppliers.length === 0
                        ? "Adicione fornecedores para associar aos items de stock"
                        : "Tente ajustar os termos de pesquisa"}
                    </p>
                    {suppliers.length === 0 && (
                      <button
                        onClick={() => setIsAddSupplierModalOpen(true)}
                        className="stock-header-card__btn stock-header-card__btn--primary"
                      >
                        <Plus size={16} />
                        Adicionar Primeiro Fornecedor
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="suppliers-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Contacto</th>
                        <th>Email</th>
                        <th>Telefone</th>
                        <th>Morada</th>
                        <th>Items Fornecidos</th>
                        <th>Notas</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSuppliers.map((supplier) => {
                        // Get items for this supplier (ensure both are strings for comparison)
                        const supplierItems = stockItems.filter((item) => {
                          const itemSupplierId = item.supplier_id?.toString();
                          const supplierId = supplier.$id?.toString();
                          return itemSupplierId === supplierId;
                        });
                        const itemCount = supplierItems.length;

                        return (
                          <tr key={supplier.$id}>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <ShoppingCart size={16} color="#0ea5e9" />
                                <span style={{ fontWeight: 600 }}>
                                  {supplier.name}
                                </span>
                              </div>
                            </td>
                            <td>{supplier.contact_name || "-"}</td>
                            <td>
                              {supplier.email ? (
                                <a
                                  href={`mailto:${supplier.email}`}
                                  style={{
                                    color: "#0ea5e9",
                                    textDecoration: "none",
                                  }}
                                >
                                  {supplier.email}
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td>
                              {supplier.phone ? (
                                <a
                                  href={`tel:${supplier.phone}`}
                                  style={{
                                    color: "#0ea5e9",
                                    textDecoration: "none",
                                  }}
                                >
                                  {supplier.phone}
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td>{supplier.address || "-"}</td>
                            <td>
                              {itemCount > 0 ? (
                                <div className="supplier-items-cell">
                                  <div
                                    className="items-count-badge clickable"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedSupplierItems((prev) => {
                                        const newSet = new Set(prev);
                                        if (newSet.has(supplier.$id)) {
                                          newSet.delete(supplier.$id);
                                        } else {
                                          newSet.add(supplier.$id);
                                        }
                                        return newSet;
                                      });
                                    }}
                                  >
                                    <Package size={14} />
                                    <span>
                                      {itemCount}{" "}
                                      {itemCount === 1 ? "item" : "items"}
                                    </span>
                                    <ChevronDown
                                      size={14}
                                      style={{
                                        transform: expandedSupplierItems.has(
                                          supplier.$id
                                        )
                                          ? "rotate(180deg)"
                                          : "rotate(0deg)",
                                        transition: "transform 0.2s ease",
                                      }}
                                    />
                                  </div>
                                  {expandedSupplierItems.has(supplier.$id) && (
                                    <div className="items-preview">
                                      {supplierItems.map((item) => (
                                        <span
                                          key={item.$id}
                                          className="item-tag"
                                        >
                                          {item.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span
                                  style={{ color: "#9ca3af", fontSize: "13px" }}
                                >
                                  Nenhum item
                                </span>
                              )}
                            </td>
                            <td>
                              <div
                                style={{
                                  maxWidth: "200px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={supplier.notes}
                              >
                                {supplier.notes || "-"}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  onClick={() => {
                                    setEditingSupplier(supplier);
                                    setNewSupplier({
                                      name: supplier.name,
                                      contact_name: supplier.contact_name || "",
                                      email: supplier.email || "",
                                      phone: supplier.phone || "",
                                      address: supplier.address || "",
                                      notes: supplier.notes || "",
                                    });
                                    setIsAddSupplierModalOpen(true);
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#0ea5e9",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "1.5rem",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    transition: "background-color 0.2s",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#0284c7";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#0ea5e9";
                                  }}
                                >
                                  <Edit size={14} />
                                  Editar
                                </button>
                                <button
                                  onClick={() => {
                                    Modal.confirm({
                                      title: "Eliminar Fornecedor",
                                      content: `Tem certeza que deseja eliminar o fornecedor "${supplier.name}"?\n\nNota: Não será possível eliminar se houver items associados.`,
                                      okText: "Eliminar",
                                      okType: "danger",
                                      cancelText: "Cancelar",
                                      onOk: async () => {
                                        try {
                                          await deleteSupplier(supplier.$id);
                                          message.success(
                                            "Fornecedor eliminado com sucesso!"
                                          );
                                        } catch (err) {
                                          console.error(
                                            "Error deleting supplier:",
                                            err
                                          );
                                          message.error(
                                            err.message ||
                                              "Erro ao eliminar fornecedor. Verifique se não há items associados."
                                          );
                                        }
                                      },
                                    });
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#ef4444",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "1.5rem",
                                    cursor: "pointer",
                                    fontSize: "13px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    transition: "background-color 0.2s",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#dc2626";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                      "#ef4444";
                                  }}
                                >
                                  <X size={14} />
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Warehouse Modal (Create/Edit) */}
        {warehouseModalOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="warehouse-modal-overlay"
              onClick={() => {
                setWarehouseModalOpen(false);
                setEditingWarehouse(null);
                setWarehouseForm({
                  name: "",
                  description: "",
                  address: "",
                  is_active: true,
                });
              }}
            >
              <div
                className="warehouse-modal-container"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="warehouse-modal-header">
                  <h2>
                    {editingWarehouse ? "Editar Armazém" : "Criar Novo Armazém"}
                  </h2>
                  <button
                    className="warehouse-close-btn"
                    onClick={() => {
                      setWarehouseModalOpen(false);
                      setEditingWarehouse(null);
                      setWarehouseForm({
                        name: "",
                        description: "",
                        address: "",
                        is_active: true,
                      });
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="warehouse-modal-body">
                  <div className="warehouse-form-group">
                    <label htmlFor="warehouse-name">Nome do Armazém *</label>
                    <input
                      id="warehouse-name"
                      type="text"
                      className="warehouse-input"
                      placeholder="Ex: Armazém Principal"
                      value={warehouseForm.name}
                      onChange={(e) =>
                        setWarehouseForm({
                          ...warehouseForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="warehouse-form-group">
                    <label htmlFor="warehouse-description">Descrição</label>
                    <textarea
                      id="warehouse-description"
                      className="warehouse-textarea"
                      placeholder="Descrição do armazém..."
                      value={warehouseForm.description}
                      onChange={(e) =>
                        setWarehouseForm({
                          ...warehouseForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="warehouse-form-group">
                    <label htmlFor="warehouse-address">Morada</label>
                    <input
                      id="warehouse-address"
                      type="text"
                      className="warehouse-input"
                      placeholder="Ex: Rua Principal 123, Lisboa"
                      value={warehouseForm.address}
                      onChange={(e) =>
                        setWarehouseForm({
                          ...warehouseForm,
                          address: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="warehouse-form-group">
                    <div className="warehouse-checkbox-wrapper">
                      <input
                        type="checkbox"
                        id="warehouse-active"
                        checked={warehouseForm.is_active}
                        onChange={(e) =>
                          setWarehouseForm({
                            ...warehouseForm,
                            is_active: e.target.checked,
                          })
                        }
                      />
                      <label htmlFor="warehouse-active">Armazém ativo</label>
                    </div>
                  </div>
                </div>

                <div className="warehouse-modal-footer">
                  <button
                    className="warehouse-btn warehouse-btn-cancel"
                    onClick={() => {
                      setWarehouseModalOpen(false);
                      setEditingWarehouse(null);
                      setWarehouseForm({
                        name: "",
                        description: "",
                        address: "",
                        is_active: true,
                      });
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="warehouse-btn warehouse-btn-submit"
                    onClick={async () => {
                      if (!warehouseForm.name.trim()) {
                        message.warning(
                          "Por favor insira um nome para o armazém"
                        );
                        return;
                      }

                      try {
                        if (editingWarehouse) {
                          await updateWarehouse(
                            editingWarehouse.$id,
                            warehouseForm
                          );
                        } else {
                          await createWarehouse(warehouseForm);
                        }
                        setWarehouseModalOpen(false);
                        setEditingWarehouse(null);
                        setWarehouseForm({
                          name: "",
                          description: "",
                          address: "",
                          is_active: true,
                        });
                      } catch (err) {
                        message.error(
                          `Erro ao ${
                            editingWarehouse ? "atualizar" : "criar"
                          } armazém: ${err.message}`
                        );
                      }
                    }}
                    disabled={!warehouseForm.name.trim()}
                  >
                    {editingWarehouse ? "Atualizar" : "Criar Armazém"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Warehouse Edit/Delete Modal */}
        {editWarehouseModalOpen &&
          editingWarehouse &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="warehouse-modal-overlay"
              onClick={() => {
                setEditWarehouseModalOpen(false);
                setEditingWarehouse(null);
              }}
            >
              <div
                className="warehouse-modal-container"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="warehouse-modal-header">
                  <h2>Editar Armazém</h2>
                  <button
                    className="warehouse-close-btn"
                    onClick={() => {
                      setEditWarehouseModalOpen(false);
                      setEditingWarehouse(null);
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="warehouse-modal-body">
                  <div className="warehouse-form-group">
                    <label htmlFor="edit-warehouse-name">
                      Nome do Armazém *
                    </label>
                    <input
                      id="edit-warehouse-name"
                      type="text"
                      className="warehouse-input"
                      placeholder="Ex: Armazém Principal"
                      value={editingWarehouse.name}
                      onChange={(e) =>
                        setEditingWarehouse({
                          ...editingWarehouse,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="warehouse-form-group">
                    <label htmlFor="edit-warehouse-description">
                      Descrição
                    </label>
                    <textarea
                      id="edit-warehouse-description"
                      className="warehouse-textarea"
                      placeholder="Descrição do armazém..."
                      value={editingWarehouse.description || ""}
                      onChange={(e) =>
                        setEditingWarehouse({
                          ...editingWarehouse,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                    />
                  </div>

                  <div className="warehouse-form-group">
                    <label htmlFor="edit-warehouse-address">Morada</label>
                    <input
                      id="edit-warehouse-address"
                      type="text"
                      className="warehouse-input"
                      placeholder="Rua, Cidade, País"
                      value={editingWarehouse.address || ""}
                      onChange={(e) =>
                        setEditingWarehouse({
                          ...editingWarehouse,
                          address: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="warehouse-form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={editingWarehouse.is_active}
                        onChange={(e) =>
                          setEditingWarehouse({
                            ...editingWarehouse,
                            is_active: e.target.checked,
                          })
                        }
                        style={{ marginRight: "8px" }}
                      />
                      Armazém Ativo
                    </label>
                  </div>
                </div>

                <div className="warehouse-modal-footer">
                  <button
                    className="warehouse-btn warehouse-btn-delete"
                    onClick={() => {
                      Modal.confirm({
                        title: "Eliminar Armazém",
                        content: `Tem certeza que deseja eliminar o armazém "${editingWarehouse.name}"?\n\nNota: Não será possível eliminar se houver inventário associado.`,
                        okText: "Eliminar",
                        okType: "danger",
                        cancelText: "Cancelar",
                        onOk: async () => {
                          try {
                            await apiCall(
                              `/stock/warehouses/${editingWarehouse.$id}`,
                              {
                                method: "DELETE",
                              }
                            );
                            message.success("Armazém eliminado com sucesso!");
                            setEditWarehouseModalOpen(false);
                            setEditingWarehouse(null);
                            await fetchWarehouses();
                          } catch (err) {
                            console.error("Error deleting warehouse:", err);
                            message.error(
                              err.message ||
                                "Erro ao eliminar armazém. Verifique se não há inventário associado."
                            );
                          }
                        },
                      });
                    }}
                  >
                    <Trash2 size={16} />
                    Eliminar Armazém
                  </button>
                  <button
                    className="warehouse-btn warehouse-btn-create"
                    onClick={async () => {
                      if (!editingWarehouse.name.trim()) {
                        message.warning("Por favor, insira o nome do armazém");
                        return;
                      }

                      try {
                        await apiCall(
                          `/stock/warehouses/${editingWarehouse.$id}`,
                          {
                            method: "PUT",
                            body: JSON.stringify({
                              name: editingWarehouse.name.trim(),
                              description:
                                editingWarehouse.description?.trim() || null,
                              address: editingWarehouse.address?.trim() || null,
                              is_active: editingWarehouse.is_active,
                            }),
                          }
                        );
                        message.success("Armazém atualizado com sucesso!");
                        setEditWarehouseModalOpen(false);
                        setEditingWarehouse(null);
                        await fetchWarehouses();
                      } catch (err) {
                        console.error("Error updating warehouse:", err);
                        message.error(
                          "Erro ao atualizar armazém. Tente novamente."
                        );
                      }
                    }}
                    disabled={!editingWarehouse.name.trim()}
                  >
                    <Save size={16} />
                    Guardar Alterações
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Add Item to Warehouse Modal */}
        {addToWarehouseModalOpen &&
          selectedWarehouse &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="transfer-modal-overlay"
              onClick={() => {
                setAddToWarehouseModalOpen(false);
                setAddToWarehouseForm({ item_id: null, qty: 0, position: "" });
              }}
            >
              <div
                className="transfer-modal-container"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="transfer-modal-header">
                  <h2>Adicionar Item ao Armazém</h2>
                  <button
                    className="transfer-close-btn"
                    onClick={() => {
                      setAddToWarehouseModalOpen(false);
                      setAddToWarehouseForm({
                        item_id: null,
                        qty: 0,
                        min_qty: 0,
                        position: "",
                      });
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="transfer-modal-body">
                  <div
                    className="transfer-item-card"
                    style={{ marginBottom: "20px" }}
                  >
                    <div className="transfer-item-label">Armazém Destino</div>
                    <div className="transfer-item-name">
                      {selectedWarehouse.name}
                    </div>
                    {selectedWarehouse.address && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#6b7280",
                          marginTop: "4px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <MapPin size={14} />
                        {selectedWarehouse.address}
                      </div>
                    )}
                  </div>

                  <div className="transfer-form-group">
                    <label htmlFor="add-item-select">Selecionar Item *</label>
                    <Select
                      id="add-item-select"
                      value={addToWarehouseForm.item_id || undefined}
                      onChange={(value) => {
                        console.log("Selected item:", value);
                        setAddToWarehouseForm({
                          ...addToWarehouseForm,
                          item_id: value || null,
                        });
                      }}
                      placeholder="Escolha um item para adicionar..."
                      showSearch
                      allowClear
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.label ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      style={{ width: "100%", height: "44px" }}
                      className="custom-select"
                      options={stockItems
                        .filter((item) => {
                          const alreadyInWarehouse = warehouseInventory.some(
                            (invItem) =>
                              String(invItem.$id) === String(item.$id)
                          );
                          return !alreadyInWarehouse;
                        })
                        .map((item) => ({
                          value: item.$id,
                          label: `${item.name}${
                            item.category ? ` - ${item.category}` : ""
                          }${
                            item.cost_price
                              ? ` - €${item.cost_price.toFixed(2)}`
                              : ""
                          }`,
                        }))}
                    />
                    {stockItems.filter((item) => {
                      const alreadyInWarehouse = warehouseInventory.some(
                        (invItem) => String(invItem.$id) === String(item.$id)
                      );
                      return !alreadyInWarehouse;
                    }).length === 0 && (
                      <div
                        style={{
                          padding: "12px",
                          backgroundColor: "#fef3c7",
                          borderRadius: "6px",
                          marginTop: "8px",
                          fontSize: "13px",
                          color: "#92400e",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <AlertTriangle size={16} />
                        <span>Todos os items já estão neste armazém</span>
                      </div>
                    )}
                  </div>

                  <div className="transfer-form-group">
                    <label htmlFor="add-qty">Quantidade *</label>
                    <input
                      id="add-qty"
                      type="number"
                      className="transfer-input"
                      min="1"
                      value={addToWarehouseForm.qty}
                      onChange={(e) =>
                        setAddToWarehouseForm({
                          ...addToWarehouseForm,
                          qty: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="Quantidade a adicionar"
                    />
                  </div>

                  <div className="transfer-form-group">
                    <label htmlFor="add-min-qty">Quantidade Mínima</label>
                    <input
                      id="add-min-qty"
                      type="number"
                      className="transfer-input"
                      min="0"
                      value={addToWarehouseForm.min_qty}
                      onChange={(e) =>
                        setAddToWarehouseForm({
                          ...addToWarehouseForm,
                          min_qty: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="Quantidade mínima de stock"
                    />
                  </div>

                  <div className="transfer-form-group">
                    <label htmlFor="add-position">Posição (Opcional)</label>
                    <input
                      id="add-position"
                      type="text"
                      className="transfer-input"
                      value={addToWarehouseForm.position}
                      onChange={(e) =>
                        setAddToWarehouseForm({
                          ...addToWarehouseForm,
                          position: e.target.value,
                        })
                      }
                      placeholder="Ex: A1-B5, Prateleira 3, etc."
                    />
                    <div
                      className="transfer-hint"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <MapPin size={14} />
                      <span>
                        Use códigos de posição para facilitar a localização do
                        item
                      </span>
                    </div>
                  </div>
                </div>

                <div className="transfer-modal-footer">
                  <button
                    className="transfer-btn transfer-btn-cancel"
                    onClick={() => {
                      setAddToWarehouseModalOpen(false);
                      setAddToWarehouseForm({
                        item_id: null,
                        qty: 0,
                        min_qty: 0,
                        position: "",
                      });
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="transfer-btn transfer-btn-submit"
                    onClick={async () => {
                      if (!addToWarehouseForm.item_id) {
                        message.warning("Por favor selecione um item");
                        return;
                      }
                      if (addToWarehouseForm.qty <= 0) {
                        message.warning(
                          "Por favor insira uma quantidade válida"
                        );
                        return;
                      }

                      try {
                        await addItemToWarehouse(
                          addToWarehouseForm.item_id,
                          selectedWarehouse.$id,
                          addToWarehouseForm.qty,
                          addToWarehouseForm.min_qty,
                          addToWarehouseForm.position
                        );
                        setAddToWarehouseModalOpen(false);
                        setAddToWarehouseForm({
                          item_id: null,
                          qty: 0,
                          min_qty: 0,
                          position: "",
                        });
                        message.success(
                          "Item adicionado ao armazém com sucesso!"
                        );
                      } catch (err) {
                        message.error(`Erro ao adicionar item: ${err.message}`);
                      }
                    }}
                    disabled={
                      !addToWarehouseForm.item_id || addToWarehouseForm.qty <= 0
                    }
                  >
                    <Plus size={16} />
                    Adicionar Item
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Edit Warehouse Inventory Modal */}
        {warehouseItemEditModalOpen &&
          typeof document !== "undefined" &&
          editingWarehouseItem &&
          createPortal(
            <div
              className="transfer-modal-overlay"
              onClick={() => {
                setWarehouseItemEditModalOpen(false);
                setEditingWarehouseItem(null);
                setWarehouseItemEditState({});
              }}
            >
              <div
                className="transfer-modal-container"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "500px" }}
              >
                {/* Modal Header with Image */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    padding: "24px 24px 20px",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <h2
                      style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}
                    >
                      Editar Item no Armazém
                    </h2>
                    <button
                      className="transfer-close-btn"
                      onClick={() => {
                        setWarehouseItemEditModalOpen(false);
                        setEditingWarehouseItem(null);
                        setWarehouseItemEditState({});
                      }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Item Info Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "16px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "8px",
                    }}
                  >
                    {editingWarehouseItem.image_id ? (
                      <img
                        src={getImageUrl(editingWarehouseItem.image_id)}
                        alt={editingWarehouseItem.name}
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "8px",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "8px",
                          background: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <Package size={32} color="#9ca3af" />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <h3
                        style={{
                          margin: "0 0 4px 0",
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#1a1a1a",
                        }}
                      >
                        {editingWarehouseItem.name}
                      </h3>
                      {editingWarehouseItem.category && (
                        <p
                          style={{
                            margin: "0 0 4px 0",
                            fontSize: "13px",
                            color: "#6b7280",
                          }}
                        >
                          {editingWarehouseItem.category}
                        </p>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "13px",
                          color: "#0ea5e9",
                          fontWeight: "500",
                        }}
                      >
                        <Warehouse size={14} />
                        {selectedWarehouse?.name}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="transfer-modal-body">
                  <div className="transfer-form-group">
                    <label htmlFor="edit-qty">Quantidade *</label>
                    <input
                      id="edit-qty"
                      type="number"
                      className="transfer-input"
                      min="0"
                      value={warehouseItemEditState.qty ?? ""}
                      onChange={(e) =>
                        setWarehouseItemEditState({
                          ...warehouseItemEditState,
                          qty: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="Quantidade disponível"
                    />
                  </div>

                  <div className="transfer-form-group">
                    <label htmlFor="edit-min-qty">Quantidade Mínima</label>
                    <input
                      id="edit-min-qty"
                      type="number"
                      className="transfer-input"
                      min="0"
                      value={warehouseItemEditState.min_qty ?? ""}
                      onChange={(e) =>
                        setWarehouseItemEditState({
                          ...warehouseItemEditState,
                          min_qty: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="Quantidade mínima"
                    />
                  </div>

                  <div className="transfer-form-group">
                    <label htmlFor="edit-position">Posição no Armazém</label>
                    <input
                      id="edit-position"
                      type="text"
                      className="transfer-input"
                      value={warehouseItemEditState.position ?? ""}
                      onChange={(e) =>
                        setWarehouseItemEditState({
                          ...warehouseItemEditState,
                          position: e.target.value,
                        })
                      }
                      placeholder="Ex: A1-B5, Prateleira 3, etc."
                    />
                    <div
                      className="transfer-hint"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <MapPin size={14} />
                      <span>
                        Use códigos de posição para facilitar a localização
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="transfer-modal-footer">
                  <button
                    className="transfer-btn transfer-btn-cancel"
                    onClick={() => {
                      setWarehouseItemEditModalOpen(false);
                      setEditingWarehouseItem(null);
                      setWarehouseItemEditState({});
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="transfer-btn transfer-btn-submit"
                    onClick={async () => {
                      try {
                        await updateWarehouseInventory(
                          editingWarehouseItem.$id,
                          selectedWarehouse.$id,
                          warehouseItemEditState
                        );
                        setWarehouseItemEditModalOpen(false);
                        setEditingWarehouseItem(null);
                        setWarehouseItemEditState({});
                        message.success("Item atualizado com sucesso!");
                      } catch (err) {
                        message.error(`Erro ao atualizar: ${err.message}`);
                      }
                    }}
                  >
                    <Save size={16} />
                    Guardar Alterações
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
            <div
              className="transfer-modal-overlay"
              onClick={() => {
                setTransferModalOpen(false);
                setTransferForm({
                  item: null,
                  from_warehouse_id: null,
                  to_warehouse_id: null,
                  qty: 0,
                });
              }}
            >
              <div
                className="transfer-modal-container"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="transfer-modal-header">
                  <h2>Transferir Stock</h2>
                  <button
                    className="transfer-close-btn"
                    onClick={() => {
                      setTransferModalOpen(false);
                      setTransferForm({
                        item: null,
                        from_warehouse_id: null,
                        to_warehouse_id: null,
                        qty: 0,
                      });
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="transfer-modal-body">
                  {transferForm.item && (
                    <>
                      <div className="transfer-item-card">
                        <div className="transfer-item-label">Item</div>
                        <div className="transfer-item-name">
                          {transferForm.item.name}
                        </div>
                        <div className="transfer-item-qty">
                          Total disponível:{" "}
                          <span>{transferForm.item.qty || 0} unidades</span>
                        </div>
                      </div>

                      <div className="transfer-form-group">
                        <label htmlFor="transfer-from">De (Armazém)</label>
                        <div
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            fontSize: "14px",
                            border: "1px solid #d1d5db",
                            borderRadius: "1.5rem",
                            backgroundColor: "#f9fafb",
                            color: "#374151",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Warehouse size={16} color="#0ea5e9" />
                          <span style={{ fontWeight: "500" }}>
                            {warehouses.find(
                              (w) =>
                                String(w.$id) ===
                                String(transferForm.from_warehouse_id)
                            )?.name || "Armazém atual"}
                          </span>
                          <span
                            style={{ color: "#6b7280", marginLeft: "auto" }}
                          >
                            (
                            {transferForm.item.warehouses?.find(
                              (w) =>
                                String(w.warehouse_id) ===
                                String(transferForm.from_warehouse_id)
                            )?.qty || 0}{" "}
                            unidades)
                          </span>
                        </div>
                      </div>

                      <div className="transfer-form-group">
                        <label htmlFor="transfer-to">Para (Armazém) *</label>
                        <Select
                          id="transfer-to"
                          value={transferForm.to_warehouse_id || undefined}
                          onChange={(value) =>
                            setTransferForm({
                              ...transferForm,
                              to_warehouse_id: value || null,
                            })
                          }
                          placeholder="Selecione o armazém de destino"
                          showSearch
                          allowClear
                          optionFilterProp="children"
                          filterOption={(input, option) =>
                            (option?.label ?? "")
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          style={{ width: "100%", height: "44px" }}
                          className="custom-select"
                          options={warehouses
                            .filter(
                              (w) =>
                                String(w.$id) !==
                                String(transferForm.from_warehouse_id)
                            )
                            .map((warehouse) => ({
                              value: warehouse.$id,
                              label: warehouse.name,
                            }))}
                        />
                      </div>

                      <div className="transfer-form-group">
                        <label htmlFor="transfer-qty">Quantidade *</label>
                        <input
                          id="transfer-qty"
                          type="number"
                          className="transfer-input"
                          min="1"
                          max={
                            transferForm.from_warehouse_id
                              ? transferForm.item.warehouses?.find(
                                  (w) =>
                                    String(w.warehouse_id) ===
                                    String(transferForm.from_warehouse_id)
                                )?.qty || 0
                              : 0
                          }
                          value={transferForm.qty}
                          onChange={(e) =>
                            setTransferForm({
                              ...transferForm,
                              qty: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="Quantidade a transferir"
                        />
                        {transferForm.from_warehouse_id && (
                          <div className="transfer-hint">
                            Máximo disponível:{" "}
                            {transferForm.item.warehouses?.find(
                              (w) =>
                                String(w.warehouse_id) ===
                                String(transferForm.from_warehouse_id)
                            )?.qty || 0}{" "}
                            unidades
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="transfer-modal-footer">
                  <button
                    className="transfer-btn transfer-btn-cancel"
                    onClick={() => {
                      setTransferModalOpen(false);
                      setTransferForm({
                        item: null,
                        from_warehouse_id: null,
                        to_warehouse_id: null,
                        qty: 0,
                      });
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="transfer-btn transfer-btn-submit"
                    onClick={async () => {
                      const maxQty =
                        transferForm.item.warehouses?.find(
                          (w) =>
                            String(w.warehouse_id) ===
                            String(transferForm.from_warehouse_id)
                        )?.qty || 0;

                      if (
                        !transferForm.from_warehouse_id ||
                        !transferForm.to_warehouse_id
                      ) {
                        message.warning(
                          "Por favor selecione os armazéns de origem e destino"
                        );
                        return;
                      }
                      if (transferForm.qty <= 0) {
                        message.warning(
                          "Por favor insira uma quantidade válida"
                        );
                        return;
                      }
                      if (transferForm.qty > maxQty) {
                        message.warning(
                          `Quantidade excede o disponível (${maxQty} unidades)`
                        );
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
                        setTransferForm({
                          item: null,
                          from_warehouse_id: null,
                          to_warehouse_id: null,
                          qty: 0,
                        });
                        message.success("Transferência realizada com sucesso!");
                      } catch (err) {
                        message.error(
                          `Erro ao transferir stock: ${err.message}`
                        );
                      }
                    }}
                    disabled={
                      !transferForm.from_warehouse_id ||
                      !transferForm.to_warehouse_id ||
                      transferForm.qty <= 0 ||
                      transferForm.qty >
                        (transferForm.item.warehouses?.find(
                          (w) =>
                            String(w.warehouse_id) ===
                            String(transferForm.from_warehouse_id)
                        )?.qty || 0)
                    }
                  >
                    <Truck size={16} />
                    Transferir
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Bulk Quantity Change Modal */}
        {bulkQtyModalOpen &&
          bulkQtyForm.item &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="transfer-modal-overlay"
              onClick={() => {
                setBulkQtyModalOpen(false);
                setBulkQtyForm({ item: null, action: "add", qty: 0 });
              }}
            >
              <div
                className="transfer-modal-container"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="transfer-modal-header">
                  <h2>Ajustar Quantidade</h2>
                  <button
                    className="transfer-close-btn"
                    onClick={() => {
                      setBulkQtyModalOpen(false);
                      setBulkQtyForm({ item: null, action: "add", qty: 0 });
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="transfer-modal-body">
                  {/* Item Card */}
                  <div className="transfer-item-card">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      {bulkQtyForm.item.image_id ? (
                        <img
                          src={getImageUrl(bulkQtyForm.item.image_id)}
                          alt={bulkQtyForm.item.name}
                          style={{
                            width: "60px",
                            height: "60px",
                            objectFit: "cover",
                            borderRadius: "8px",
                            border: "2px solid #e5e7eb",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "60px",
                            height: "60px",
                            backgroundColor: "#f3f4f6",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "2px solid #e5e7eb",
                          }}
                        >
                          <Package size={28} color="#9ca3af" />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div className="transfer-item-name">
                          {bulkQtyForm.item.name}
                        </div>
                        <div className="transfer-item-qty">
                          Quantidade atual:{" "}
                          <span style={{ color: "#3b82f6", fontWeight: "600" }}>
                            {bulkQtyForm.item.warehouse_qty || 0} unidades
                          </span>
                        </div>
                        {bulkQtyForm.item.warehouse_position && (
                          <div
                            style={{
                              fontSize: "13px",
                              color: "#6b7280",
                              marginTop: "4px",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <MapPin size={14} />
                            Posição: {bulkQtyForm.item.warehouse_position}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Selector */}
                  <div className="transfer-form-group">
                    <label>Tipo de Operação *</label>
                    <div
                      style={{ display: "flex", gap: "8px", marginTop: "8px" }}
                    >
                      <button
                        onClick={() =>
                          setBulkQtyForm({ ...bulkQtyForm, action: "add" })
                        }
                        style={{
                          flex: 1,
                          padding: "12px",
                          borderRadius: "8px",
                          border:
                            bulkQtyForm.action === "add"
                              ? "2px solid #10b981"
                              : "1px solid #d1d5db",
                          backgroundColor:
                            bulkQtyForm.action === "add" ? "#d1fae5" : "white",
                          color:
                            bulkQtyForm.action === "add"
                              ? "#065f46"
                              : "#6b7280",
                          fontWeight: "500",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <Plus size={18} />
                        <span>Adicionar</span>
                      </button>
                      <button
                        onClick={() =>
                          setBulkQtyForm({ ...bulkQtyForm, action: "remove" })
                        }
                        style={{
                          flex: 1,
                          padding: "12px",
                          borderRadius: "8px",
                          border:
                            bulkQtyForm.action === "remove"
                              ? "2px solid #ef4444"
                              : "1px solid #d1d5db",
                          backgroundColor:
                            bulkQtyForm.action === "remove"
                              ? "#fee2e2"
                              : "white",
                          color:
                            bulkQtyForm.action === "remove"
                              ? "#991b1b"
                              : "#6b7280",
                          fontWeight: "500",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <Minus size={18} />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>

                  {/* Quantity Input */}
                  <div className="transfer-form-group">
                    <label htmlFor="bulk-qty">
                      {bulkQtyForm.action === "add"
                        ? "Quantidade a Adicionar *"
                        : "Quantidade a Remover *"}
                    </label>
                    <input
                      id="bulk-qty"
                      type="number"
                      className="transfer-input"
                      min="0"
                      max={
                        bulkQtyForm.action === "remove"
                          ? bulkQtyForm.item.warehouse_qty
                          : undefined
                      }
                      value={bulkQtyForm.qty}
                      onChange={(e) =>
                        setBulkQtyForm({
                          ...bulkQtyForm,
                          qty: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder={
                        bulkQtyForm.action === "add"
                          ? "Ex: 1000"
                          : `Máx: ${bulkQtyForm.item.warehouse_qty}`
                      }
                      style={{ fontSize: "16px", padding: "12px" }}
                    />
                    {bulkQtyForm.action === "remove" &&
                      bulkQtyForm.item.warehouse_qty && (
                        <div
                          className="transfer-hint"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <AlertTriangle size={14} color="#f59e0b" />
                          <span>
                            Máximo disponível para remover:{" "}
                            {bulkQtyForm.item.warehouse_qty} unidades
                          </span>
                        </div>
                      )}
                    {bulkQtyForm.qty > 0 && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "12px",
                          borderRadius: "8px",
                          backgroundColor: "#f0f9ff",
                          border: "1px solid #bae6fd",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#0369a1",
                            fontWeight: "500",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <BarChart3 size={16} />
                          <span>Resultado da Operação:</span>
                        </div>
                        <div
                          style={{
                            fontSize: "15px",
                            color: "#0c4a6e",
                            fontWeight: "600",
                            marginTop: "4px",
                          }}
                        >
                          {bulkQtyForm.item.warehouse_qty || 0} →{" "}
                          {bulkQtyForm.action === "add"
                            ? (bulkQtyForm.item.warehouse_qty || 0) +
                              bulkQtyForm.qty
                            : Math.max(
                                0,
                                (bulkQtyForm.item.warehouse_qty || 0) -
                                  bulkQtyForm.qty
                              )}{" "}
                          unidades
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="transfer-modal-footer">
                  <button
                    className="transfer-btn transfer-btn-cancel"
                    onClick={() => {
                      setBulkQtyModalOpen(false);
                      setBulkQtyForm({ item: null, action: "add", qty: 0 });
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="transfer-btn transfer-btn-submit"
                    onClick={async () => {
                      if (bulkQtyForm.qty <= 0) {
                        message.warning(
                          "Por favor insira uma quantidade válida"
                        );
                        return;
                      }

                      if (
                        bulkQtyForm.action === "remove" &&
                        bulkQtyForm.qty > bulkQtyForm.item.warehouse_qty
                      ) {
                        message.warning(
                          `Quantidade excede o disponível (${bulkQtyForm.item.warehouse_qty} unidades)`
                        );
                        return;
                      }

                      try {
                        const newQty =
                          bulkQtyForm.action === "add"
                            ? (bulkQtyForm.item.warehouse_qty || 0) +
                              bulkQtyForm.qty
                            : Math.max(
                                0,
                                (bulkQtyForm.item.warehouse_qty || 0) -
                                  bulkQtyForm.qty
                              );

                        await updateWarehouseInventory(
                          bulkQtyForm.item.$id,
                          selectedWarehouse.$id,
                          {
                            qty: newQty,
                            position: bulkQtyForm.item.warehouse_position,
                          }
                        );

                        setBulkQtyModalOpen(false);
                        setBulkQtyForm({ item: null, action: "add", qty: 0 });
                        message.success("Quantidade atualizada com sucesso!");
                      } catch (err) {
                        message.error(
                          `Erro ao atualizar quantidade: ${err.message}`
                        );
                      }
                    }}
                    disabled={bulkQtyForm.qty <= 0}
                    style={{
                      backgroundColor:
                        bulkQtyForm.action === "add" ? "#10b981" : "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {bulkQtyForm.action === "add" ? (
                      <>
                        <Plus size={18} />
                        <span>Adicionar</span>
                      </>
                    ) : (
                      <>
                        <Minus size={18} />
                        <span>Remover</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Edit Item Modal */}
        {isEditModalOpen &&
          editingItem &&
          typeof document !== "undefined" &&
          createPortal(
            <div className="modal-overlay">
              <div className="modal-container">
                {/* Modal Header */}
                <div className="modal-header">
                  <div className="header-text">
                    <h2>Editar Item de Stock</h2>
                    <p>Atualize os detalhes do item</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingItem(null);
                    }}
                    className="close-button"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="modal-content">
                  {/* Image Upload Section */}
                  <div>
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

                    {/* Existing Image Display (when editing and no new image selected) */}
                    {editingItem.image_id && !imagePreview && (
                      <div style={{ marginBottom: "16px" }}>
                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            padding: "16px",
                            backgroundColor: "#ffffff",
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: "200px",
                              backgroundColor: "#ffffff",
                              backgroundImage: `url(${getImageUrl(
                                editingItem.image_id
                              )})`,
                              backgroundSize: "contain",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "center",
                              borderRadius: "1.5rem",
                              marginBottom: "12px",
                              border: "1px solid #e5e7eb",
                            }}
                          ></div>
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
                              onClick={() => editFileInputRef.current?.click()}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "8px 16px",
                                backgroundColor: "#3b82f6",
                                color: "white",
                                border: "none",
                                borderRadius: "1.5rem",
                                fontSize: "14px",
                                cursor: "pointer",
                              }}
                            >
                              <Upload size={16} />
                              Substituir Imagem
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentImageId(null);
                                setImagePreview(null);
                                setEditingItem({
                                  ...editingItem,
                                  image_id: null,
                                });
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "8px 16px",
                                backgroundColor: "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: "1.5rem",
                                fontSize: "14px",
                                cursor: "pointer",
                              }}
                            >
                              <Trash2 size={16} />
                              Remover Imagem
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Image Upload Area (no image) */}
                    {!imagePreview && !editingItem.image_id && (
                      <div
                        onClick={() => editFileInputRef.current?.click()}
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
                          e.currentTarget.style.borderColor = "#3b82f6";
                          e.currentTarget.style.backgroundColor = "#eff6ff";
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

                    {/* Image Preview with Actions */}
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
                                borderRadius: "1.5rem",
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
                              borderRadius: "1.5rem",
                              fontSize: "14px",
                              fontWeight: "500",
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
                                backgroundColor: removingBackground
                                  ? "#9ca3af"
                                  : "#10b981",
                                color: "white",
                                border: "none",
                                borderRadius: "1.5rem",
                                fontSize: "14px",
                                fontWeight: "500",
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
                                borderRadius: "1.5rem",
                                fontSize: "14px",
                                fontWeight: "500",
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
                            onClick={() => editFileInputRef.current?.click()}
                            disabled={removingBackground}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 16px",
                              backgroundColor: "#f3f4f6",
                              color: "#374151",
                              border: "1px solid #d1d5db",
                              borderRadius: "1.5rem",
                              fontSize: "14px",
                              fontWeight: "500",
                              cursor: removingBackground
                                ? "not-allowed"
                                : "pointer",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <Upload size={16} />
                            Trocar Imagem
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Name Field */}
                  <div>
                    <label
                      htmlFor="edit-item-name"
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Nome do Item *
                    </label>
                    <AntInput
                      id="edit-item-name"
                      value={editingItem.name}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, name: e.target.value })
                      }
                      placeholder="Digite o nome do item"
                      style={{
                        height: "40px",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  {/* Description Field */}
                  <div>
                    <label
                      htmlFor="edit-item-description"
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Descrição
                    </label>
                    <AntInput.TextArea
                      id="edit-item-description"
                      value={editingItem.description || ""}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          description: e.target.value,
                        })
                      }
                      placeholder="Digite uma descrição (opcional)"
                      rows={3}
                      style={{
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  {/* Supplier Field */}
                  <div>
                    <label
                      htmlFor="edit-item-supplier"
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Fornecedor
                    </label>
                    <Select
                      id="edit-item-supplier"
                      value={editingItem.supplier_id || undefined}
                      onChange={(value) =>
                        setEditingItem({
                          ...editingItem,
                          supplier_id: value || null,
                        })
                      }
                      placeholder="Sem fornecedor"
                      showSearch
                      allowClear
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.label ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      style={{ width: "100%", height: "44px" }}
                      className="custom-select"
                      options={suppliers.map((supplier) => ({
                        value: supplier.$id,
                        label: supplier.name,
                      }))}
                    />
                  </div>

                  {/* Cost Price Field */}
                  <div>
                    <label
                      htmlFor="edit-item-cost"
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Preço de Custo (€)
                    </label>
                    <AntInput
                      id="edit-item-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingItem.cost_price}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          cost_price: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      style={{
                        height: "40px",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  {/* Min Quantity Field */}
                  <div>
                    <label
                      htmlFor="edit-item-min"
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Quantidade Mínima
                    </label>
                    <AntInput
                      id="edit-item-min"
                      type="number"
                      min="0"
                      value={
                        editingItem.min_quantity || editingItem.min_qty || 0
                      }
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          min_quantity: parseInt(e.target.value) || 0,
                          min_qty: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      style={{
                        height: "40px",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  {/* Warehouse Inventory Section */}
                  {editingItem.warehouses &&
                    editingItem.warehouses.length > 0 && (
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "14px",
                            fontWeight: "500",
                            color: "#374151",
                            marginBottom: "12px",
                          }}
                        >
                          Inventário por Armazém
                        </label>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {editingItem.warehouses.map((wh) => (
                            <div
                              key={wh.warehouse_id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px",
                                backgroundColor: "#f9fafb",
                                borderRadius: "1.5rem",
                                border: "1px solid #e5e7eb",
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontWeight: "500",
                                    color: "#374151",
                                  }}
                                >
                                  {wh.warehouse_name}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#6b7280",
                                    marginTop: "2px",
                                  }}
                                >
                                  Quantidade: {wh.qty}{" "}
                                  {wh.position && `• Posição: ${wh.position}`}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  Modal.confirm({
                                    title: "Remover Stock do Armazém",
                                    content: `Remover todo o stock de "${editingItem.name}" do armazém "${wh.warehouse_name}"?`,
                                    okText: "Remover",
                                    okType: "danger",
                                    cancelText: "Cancelar",
                                    onOk: async () => {
                                      try {
                                        await apiCall(
                                          `/stock/items/${editingItem.$id}/inventory/${wh.warehouse_id}`,
                                          { method: "DELETE" }
                                        );
                                        await fetchStock();
                                        // Update editingItem to reflect changes
                                        const updatedItem = await apiCall(
                                          `/stock/items/${editingItem.$id}`
                                        );
                                        setEditingItem(updatedItem);
                                        message.success(
                                          "Stock removido do armazém com sucesso!"
                                        );
                                      } catch (err) {
                                        message.error(
                                          `Erro ao remover stock: ${err.message}`
                                        );
                                      }
                                    },
                                  });
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "6px 12px",
                                  backgroundColor: "#ef4444",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={14} />
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Hidden File Input for Image Upload */}
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleImageSelect}
                    style={{ display: "none" }}
                  />
                </div>

                {/* Modal Footer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "24px",
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  {/* Delete Button - Left Side */}
                  <button
                    onClick={() => {
                      Modal.confirm({
                        title: "Eliminar Item",
                        content: `Tem certeza que deseja eliminar "${editingItem.name}"? Esta ação irá remover o item de TODOS os armazéns e não pode ser desfeita.`,
                        okText: "Eliminar",
                        okType: "danger",
                        cancelText: "Cancelar",
                        onOk: async () => {
                          try {
                            await deleteItem(editingItem.$id);
                            setIsEditModalOpen(false);
                            setEditingItem(null);
                            message.success("Item eliminado com sucesso!");
                          } catch (err) {
                            message.error(
                              `Erro ao eliminar item: ${err.message}`
                            );
                          }
                        },
                      });
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "white",
                      backgroundColor: "#dc2626",
                      border: "none",
                      borderRadius: "1.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={16} />
                    Eliminar Item
                  </button>

                  {/* Save/Cancel Buttons - Right Side */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => {
                        setIsEditModalOpen(false);
                        setEditingItem(null);
                      }}
                      style={{
                        padding: "8px 16px",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "1.5rem",
                        cursor: "pointer",
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        if (!editingItem.name.trim()) {
                          message.warning("Por favor insira o nome do item");
                          return;
                        }

                        try {
                          setLoading(true);
                          let imageIdToSave = editingItem.image_id;

                          // If there's a new image to upload
                          if (
                            croppedImageBlob ||
                            (imagePreview && selectedImage)
                          ) {
                            const blobToUpload =
                              croppedImageBlob || selectedImage;

                            // Upload the image
                            const reader = new FileReader();
                            const base64Promise = new Promise(
                              (resolve, reject) => {
                                reader.onload = () => resolve(reader.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(blobToUpload);
                              }
                            );

                            const imageData = await base64Promise;
                            const fileName = `stock-${Date.now()}.jpg`;

                            const response = await apiCall(
                              "/stock/upload-image",
                              {
                                method: "POST",
                                body: JSON.stringify({
                                  imageData,
                                  filename: fileName,
                                }),
                              }
                            );

                            imageIdToSave = response.$id;
                          }

                          await apiCall(`/stock/items/${editingItem.$id}`, {
                            method: "PUT",
                            body: JSON.stringify({
                              name: editingItem.name,
                              description: editingItem.description || null,
                              supplier_id: editingItem.supplier_id || null,
                              cost_price: editingItem.cost_price,
                              min_qty:
                                editingItem.min_quantity || editingItem.min_qty,
                              image_id: imageIdToSave,
                            }),
                          });

                          // Refresh stock data
                          await fetchStock();

                          // Reset image states
                          resetImage();

                          setIsEditModalOpen(false);
                          setEditingItem(null);
                          message.success("Item atualizado com sucesso!");
                        } catch (err) {
                          message.error(
                            `Erro ao atualizar item: ${err.message}`
                          );
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={!editingItem.name.trim()}
                      style={{
                        padding: "8px 16px",
                        fontSize: "14px",
                        fontWeight: "500",
                        borderRadius: "1.5rem",
                        border: "none",
                        cursor: !editingItem.name.trim()
                          ? "not-allowed"
                          : "pointer",
                        backgroundColor: !editingItem.name.trim()
                          ? "#9ca3af"
                          : "#3b82f6",
                        color: "white",
                      }}
                    >
                      Guardar Alterações
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Add Supplier Modal */}
        {isAddSupplierModalOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="warehouse-modal-overlay"
              onClick={() => {
                setIsAddSupplierModalOpen(false);
                setEditingSupplier(null);
                setNewSupplier({
                  name: "",
                  contact_name: "",
                  email: "",
                  phone: "",
                  address: "",
                  notes: "",
                });
              }}
            >
              <div
                className="warehouse-modal-container"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="warehouse-modal-header">
                  <h2>
                    {editingSupplier
                      ? "Editar Fornecedor"
                      : "Adicionar Fornecedor"}
                  </h2>
                  <button
                    className="warehouse-close-btn"
                    onClick={() => {
                      setIsAddSupplierModalOpen(false);
                      setEditingSupplier(null);
                      setNewSupplier({
                        name: "",
                        contact_name: "",
                        email: "",
                        phone: "",
                        address: "",
                        notes: "",
                      });
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="warehouse-modal-body">
                  <div className="warehouse-form-group">
                    <label htmlFor="supplier-name">Nome do Fornecedor *</label>
                    <input
                      id="supplier-name"
                      type="text"
                      value={newSupplier.name}
                      onChange={(e) =>
                        setNewSupplier({ ...newSupplier, name: e.target.value })
                      }
                      placeholder="Ex: Fornecedor ABC"
                      className="warehouse-input"
                      autoFocus
                    />
                  </div>

                  <div className="warehouse-form-group">
                    <label htmlFor="supplier-contact">Nome de Contacto</label>
                    <input
                      id="supplier-contact"
                      type="text"
                      value={newSupplier.contact_name}
                      onChange={(e) =>
                        setNewSupplier({
                          ...newSupplier,
                          contact_name: e.target.value,
                        })
                      }
                      placeholder="Ex: João Silva"
                      className="warehouse-input"
                    />
                  </div>

                  <div className="warehouse-form-row">
                    <div className="warehouse-form-group">
                      <label htmlFor="supplier-email">Email</label>
                      <input
                        id="supplier-email"
                        type="email"
                        value={newSupplier.email}
                        onChange={(e) =>
                          setNewSupplier({
                            ...newSupplier,
                            email: e.target.value,
                          })
                        }
                        placeholder="email@fornecedor.com"
                        className="warehouse-input"
                      />
                    </div>

                    <div className="warehouse-form-group">
                      <label htmlFor="supplier-phone">Telefone</label>
                      <input
                        id="supplier-phone"
                        type="tel"
                        value={newSupplier.phone}
                        onChange={(e) =>
                          setNewSupplier({
                            ...newSupplier,
                            phone: e.target.value,
                          })
                        }
                        placeholder="+351 123 456 789"
                        className="warehouse-input"
                      />
                    </div>
                  </div>

                  <div className="warehouse-form-group">
                    <label htmlFor="supplier-address">Morada</label>
                    <input
                      id="supplier-address"
                      type="text"
                      value={newSupplier.address}
                      onChange={(e) =>
                        setNewSupplier({
                          ...newSupplier,
                          address: e.target.value,
                        })
                      }
                      placeholder="Rua, Cidade, País"
                      className="warehouse-input"
                    />
                  </div>

                  <div className="warehouse-form-group">
                    <label htmlFor="supplier-notes">Notas</label>
                    <textarea
                      id="supplier-notes"
                      value={newSupplier.notes}
                      onChange={(e) =>
                        setNewSupplier({
                          ...newSupplier,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Informações adicionais sobre o fornecedor..."
                      className="warehouse-input"
                      rows={3}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </div>

                <div className="warehouse-modal-footer">
                  <button
                    className="warehouse-btn warehouse-btn-cancel"
                    onClick={() => {
                      setIsAddSupplierModalOpen(false);
                      setEditingSupplier(null);
                      setNewSupplier({
                        name: "",
                        contact_name: "",
                        email: "",
                        phone: "",
                        address: "",
                        notes: "",
                      });
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="warehouse-btn warehouse-btn-create"
                    onClick={async () => {
                      if (!newSupplier.name.trim()) {
                        message.warning(
                          "Por favor, insira o nome do fornecedor"
                        );
                        return;
                      }

                      try {
                        if (editingSupplier) {
                          await updateSupplier(
                            editingSupplier.$id,
                            newSupplier
                          );
                          message.success("Fornecedor atualizado com sucesso!");
                        } else {
                          await createSupplier(newSupplier);
                          message.success("Fornecedor criado com sucesso!");
                        }
                        setIsAddSupplierModalOpen(false);
                        setEditingSupplier(null);
                        setNewSupplier({
                          name: "",
                          contact_name: "",
                          email: "",
                          phone: "",
                          address: "",
                          notes: "",
                        });
                      } catch (err) {
                        console.error("Error saving supplier:", err);
                        message.error(
                          err.message ||
                            `Erro ao ${
                              editingSupplier ? "atualizar" : "criar"
                            } fornecedor. Tente novamente.`
                        );
                      }
                    }}
                    disabled={!newSupplier.name.trim()}
                  >
                    {editingSupplier ? (
                      <>
                        <Save size={16} />
                        Guardar Alterações
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Criar Fornecedor
                      </>
                    )}
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
                      Arraste para reposicionar. Use os cantos para
                      redimensionar.
                    </p>
                  </div>
                  <button onClick={handleCropperClose} className="close-button">
                    <X size={20} />
                  </button>
                </div>

                {/* Cropper Content */}
                <div className="cropper-content">
                  <div
                    className="cropper-container"
                    style={{
                      width: "100%",
                      height: "100%",
                      maxWidth: "600px",
                      maxHeight: "500px",
                      margin: "0 auto",
                    }}
                  >
                    <Cropper
                      ref={cropperRef}
                      src={cropImage}
                      className="cropper"
                      stencilProps={{
                        aspectRatio: undefined,
                        movable: true,
                        resizable: true,
                      }}
                      stencilSize={({ boundary }) => {
                        if (!boundary || !boundary.width || !boundary.height) {
                          return { width: 250, height: 250 };
                        }
                        return {
                          width: Math.min(boundary.width * 0.7, 400),
                          height: Math.min(boundary.height * 0.7, 400),
                        };
                      }}
                      defaultCoordinates={({ imageSize, visibleArea }) => {
                        if (
                          !visibleArea ||
                          !visibleArea.width ||
                          !visibleArea.height
                        ) {
                          return { left: 0, top: 0, width: 250, height: 250 };
                        }
                        // Center the stencil with 70% of the visible area
                        const width = Math.min(visibleArea.width * 0.7, 400);
                        const height = Math.min(visibleArea.height * 0.7, 400);
                        const left = (visibleArea.width - width) / 2;
                        const top = (visibleArea.height - height) / 2;

                        return {
                          left,
                          top,
                          width,
                          height,
                        };
                      }}
                      imageRestriction="fitArea"
                      minWidth={100}
                      minHeight={100}
                      maxWidth={({ imageSize, visibleArea }) => {
                        return visibleArea ? visibleArea.width : 800;
                      }}
                      maxHeight={({ imageSize, visibleArea }) => {
                        return visibleArea ? visibleArea.height : 800;
                      }}
                      defaultTransforms={{
                        rotate: 0,
                        flip: { horizontal: false, vertical: false },
                      }}
                      transitions={false}
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

      {/* Custom Warehouse Dropdown */}
      {openWarehouseDropdown &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={warehouseDropdownRef}
            style={{
              position: "fixed",
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow:
                "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
              minWidth: "320px",
              maxWidth: "400px",
              zIndex: 10001,
              padding: "12px",
              animation: "fadeIn 0.15s ease-out",
            }}
          >
            {warehouseDropdownLoading ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <RefreshCw
                  className="animate-spin"
                  size={24}
                  style={{ margin: "0 auto", color: "#0ea5e9" }}
                />
                <p
                  style={{
                    marginTop: "12px",
                    fontSize: "13px",
                    color: "#64748b",
                    margin: 0,
                  }}
                >
                  A carregar detalhes...
                </p>
              </div>
            ) : itemWarehouseDetails[openWarehouseDropdown]?.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                <Package
                  size={32}
                  style={{ margin: "0 auto 8px", opacity: 0.5 }}
                />
                <p style={{ margin: 0, fontSize: "14px" }}>Sem armazéns</p>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    marginBottom: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Armazéns com este item
                </div>
                {(itemWarehouseDetails[openWarehouseDropdown] || []).map(
                  (wh, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "12px",
                        borderRadius: "6px",
                        backgroundColor: "#f8fafc",
                        marginBottom:
                          idx <
                          (itemWarehouseDetails[openWarehouseDropdown] || [])
                            .length -
                            1
                            ? "8px"
                            : 0,
                        border: "1px solid #e2e8f0",
                        transition: "all 0.2s",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#eff6ff";
                        e.currentTarget.style.borderColor = "#bfdbfe";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#f8fafc";
                        e.currentTarget.style.borderColor = "#e2e8f0";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "8px",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Warehouse size={14} color="#0ea5e9" />
                          <span
                            style={{
                              fontWeight: 700,
                              color: "#1e293b",
                              fontSize: "14px",
                            }}
                          >
                            {wh.warehouse_name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#0ea5e9",
                            fontSize: "13px",
                            backgroundColor: "#e0f2fe",
                            padding: "3px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          {wh.qty || 0} un.
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "#64748b",
                          fontSize: "12px",
                        }}
                      >
                        <MapPin size={12} />
                        <span>{wh.warehouse_address || "Sem localização"}</span>
                      </div>
                      {wh.position && (
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "11px",
                            color: "#64748b",
                            backgroundColor: "white",
                            padding: "4px 6px",
                            borderRadius: "3px",
                            display: "inline-block",
                          }}
                        >
                          <strong>Posição:</strong> {wh.position}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
