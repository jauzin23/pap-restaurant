"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import {
  COL_STOCK,
  DBRESTAURANTE,
  COL_CATEGORY_STOCK,
  COL_SUPPLIER,
  LOCATION_STOCK,
  BUCKET_STOCK_IMG,
} from "@/lib/appwrite";
import "./StockComponent.scss";

export default function StockComponent() {
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [movementCart, setMovementCart] = useState({});
  const [editingRows, setEditingRows] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
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
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [croppedImageBlob, setCroppedImageBlob] = useState(null);
  const [imageCache, setImageCache] = useState({});
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Crop states
  const [cropArea, setCropArea] = useState({
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [originalImageDimensions, setOriginalImageDimensions] = useState({
    width: 0,
    height: 0,
  });

  // Dropdown data states
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);

  const ITEMS_PER_PAGE = 50;
  const { databases, storage } = useApp();

  // Image handling functions
  const getImageUrl = useCallback(
    (imageId) => {
      if (!storage || !imageId) return null;

      if (imageCache[imageId]) {
        return imageCache[imageId];
      }

      try {
        const url = storage.getFileView(BUCKET_STOCK_IMG, imageId);
        setImageCache((prev) => ({
          ...prev,
          [imageId]: url,
        }));
        return url;
      } catch (error) {
        console.error("Error getting image URL:", error);
        return null;
      }
    },
    [storage, imageCache]
  );

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

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setCropModalOpen(true);

      // Create image to get dimensions
      const img = new Image();
      img.onload = () => {
        setOriginalImageDimensions({ width: img.width, height: img.height });
        // Set initial crop area to center
        const size = Math.min(img.width, img.height, 300);
        setCropArea({
          x: (img.width - size) / 2,
          y: (img.height - size) / 2,
          width: size,
          height: size,
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCropMouseDown = useCallback(
    (e, action) => {
      e.preventDefault();
      e.stopPropagation();

      if (action === "drag") {
        setIsDragging(true);
        setDragStart({
          x: e.clientX - cropArea.x,
          y: e.clientY - cropArea.y,
        });
      } else if (action === "resize") {
        setIsResizing(true);
        setDragStart({
          x: e.clientX - cropArea.width,
          y: e.clientY - cropArea.height,
        });
      }
    },
    [cropArea]
  );

  const handleCropMouseMove = useCallback(
    (e) => {
      if (isDragging) {
        const newX = Math.max(
          0,
          Math.min(
            e.clientX - dragStart.x,
            originalImageDimensions.width - cropArea.width
          )
        );
        const newY = Math.max(
          0,
          Math.min(
            e.clientY - dragStart.y,
            originalImageDimensions.height - cropArea.height
          )
        );

        setCropArea((prev) => ({
          ...prev,
          x: newX,
          y: newY,
        }));
      } else if (isResizing) {
        const newWidth = Math.max(
          50,
          Math.min(
            e.clientX - dragStart.x,
            originalImageDimensions.width - cropArea.x
          )
        );
        const newHeight = Math.max(
          50,
          Math.min(
            e.clientY - dragStart.y,
            originalImageDimensions.height - cropArea.y
          )
        );

        setCropArea((prev) => ({
          ...prev,
          width: newWidth,
          height: newHeight,
        }));
      }
    },
    [isDragging, isResizing, dragStart, originalImageDimensions, cropArea]
  );

  const handleCropMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (cropModalOpen) {
      document.addEventListener("mousemove", handleCropMouseMove);
      document.addEventListener("mouseup", handleCropMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleCropMouseMove);
        document.removeEventListener("mouseup", handleCropMouseUp);
      };
    }
  }, [cropModalOpen, handleCropMouseMove, handleCropMouseUp]);

  const applyCrop = useCallback(() => {
    if (!imagePreview || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imageRef.current;

    // Set canvas size
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;

    // Draw cropped image
    ctx.drawImage(
      img,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      0,
      0,
      cropArea.width,
      cropArea.height
    );

    canvas.toBlob(
      (blob) => {
        setCroppedImageBlob(blob);

        const croppedUrl = URL.createObjectURL(blob);
        setImagePreview(croppedUrl);
        setCropModalOpen(false);
      },
      "image/jpeg",
      0.9
    );
  }, [imagePreview, cropArea]);

  const resetImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
    setCroppedImageBlob(null);
    setCurrentImageId(null);
    setCropModalOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const uploadImage = useCallback(async () => {
    if (!storage || !croppedImageBlob) return null;

    try {
      const fileName = `stock-${Date.now()}.jpg`;
      const file = new File([croppedImageBlob], fileName, {
        type: "image/jpeg",
      });

      const uploadResult = await storage.createFile(
        BUCKET_STOCK_IMG,
        "unique()",
        file
      );
      return uploadResult.$id;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error("Erro ao fazer upload da imagem");
    }
  }, [storage, croppedImageBlob]);

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
    if (!databases) return;

    setDropdownsLoading(true);
    try {
      const [categoriesRes, suppliersRes, locationsRes] = await Promise.all([
        databases.listDocuments(DBRESTAURANTE, COL_CATEGORY_STOCK),
        databases.listDocuments(DBRESTAURANTE, COL_SUPPLIER),
        databases.listDocuments(DBRESTAURANTE, LOCATION_STOCK),
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
  }, [databases]);

  // Fetch dropdown data when add modal opens
  useEffect(() => {
    if (isAddModalOpen && categories.length === 0) {
      fetchDropdownData();
    }
  }, [isAddModalOpen, categories.length, fetchDropdownData]);

  const fetchStock = useCallback(async () => {
    if (!databases || loading) return;

    setLoading(true);
    try {
      const res = await databases.listDocuments(DBRESTAURANTE, COL_STOCK);
      setStockItems(res.documents || []);
    } catch (err) {
      console.error("Error fetching stock:", err);
      setStockItems([]);
    } finally {
      setLoading(false);
    }
  }, [databases, loading]);

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
    if (!Object.keys(movementCart).length || loading || !databases) return;

    setLoading(true);
    try {
      const updates = [];

      for (const [itemId, qty] of Object.entries(movementCart)) {
        const item = stockItems.find((i) => i.$id === itemId);
        if (!item) continue;

        const newQty = Math.max(0, item.qty + qty);
        updates.push(
          databases.updateDocument(DBRESTAURANTE, COL_STOCK, itemId, {
            qty: newQty,
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
  }, [movementCart, databases, loading, fetchStock, stockItems]);

  const handleSaveEdit = useCallback(
    async (itemId) => {
      const edits = editingRows[itemId];
      if (!edits || loading || !databases) return;

      setLoading(true);
      try {
        await databases.updateDocument(DBRESTAURANTE, COL_STOCK, itemId, {
          qty: Math.max(0, parseInt(edits.qty) || 0),
          min_qty: Math.max(0, parseInt(edits.min_qty) || 0),
          cost_price: Math.max(0, parseFloat(edits.cost_price) || 0),
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
    [editingRows, databases, loading, fetchStock]
  );

  const handleAddNewItem = useCallback(async () => {
    if (addItemLoading || !databases) return;

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

      await databases.createDocument(DBRESTAURANTE, COL_STOCK, "unique()", {
        name: trimmedName,
        category: newItem.category?.trim() || null,
        description: newItem.description?.trim() || null,
        supplier: newItem.supplier?.trim() || null,
        location: newItem.location?.trim() || null,
        cost_price: Math.max(0, parseFloat(newItem.cost_price) || 0),
        qty: Math.max(0, parseInt(newItem.qty) || 0),
        min_qty: Math.max(0, parseInt(newItem.min_qty) || 0),
        image_id: imageId,
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
    databases,
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

  const ItemCard = ({ item, onClick, isMovementMode = false }) => {
    if (!item) return null;

    const isEditing = editingRows[item.$id];
    const getStatusInfo = (current, minimum) => {
      if (current <= minimum) return { status: "critical", label: "Crítico" };
      if (current <= minimum + 5) return { status: "warning", label: "Baixo" };
      return { status: "ok", label: "OK" };
    };

    const statusInfo = getStatusInfo(item.qty || 0, item.min_qty || 0);
    const itemImageUrl = item.image_id ? getImageUrl(item.image_id) : null;

    return (
      <div
        className={`item-card ${isEditing ? "editable" : ""} ${
          isMovementMode ? "movement-mode" : ""
        }`}
        onClick={
          isMovementMode
            ? onClick
            : !isEditing
            ? (e) => {
                if (
                  !e.target.closest(".edit-actions") &&
                  !e.target.closest(".movement-controls")
                ) {
                  setEditingRows((prev) => ({
                    ...prev,
                    [item.$id]: {
                      qty: item.qty || 0,
                      min_qty: item.min_qty || 0,
                      cost_price: item.cost_price || 0,
                    },
                  }));
                }
              }
            : undefined
        }
      >
        {/* Item image */}
        <div className="card-image">
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
          <div
            className={`item-image-placeholder ${itemImageUrl ? "hidden" : ""}`}
          >
            <Package size={32} />
          </div>
        </div>

        {/* Status badge at the top */}
        <div className={`status-badge ${statusInfo.status}`}>
          {statusInfo.label}
        </div>

        {/* Edit overlay icon for hover effect */}
        {!isMovementMode && !isEditing && (
          <div className="edit-overlay">
            <Edit className="edit-icon" />
          </div>
        )}

        <div className="card-header">
          <div className="item-info">
            <h3 className="item-name">{item.name || "Nome não disponível"}</h3>
            <p className="item-category">
              {item.category || item.description || "Sem categoria"}
            </p>
          </div>
        </div>

        <div className="stock-info">
          <div className="stock-row">
            <span className="label">Stock atual</span>
            {isEditing ? (
              <input
                type="number"
                min="0"
                className="editable-input"
                value={editingRows[item.$id]?.qty ?? item.qty ?? 0}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  e.stopPropagation();
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
              <span className={`value current ${statusInfo.status}`}>
                {item.qty || 0}
              </span>
            )}
          </div>

          <div className="stock-row">
            <span className="label">Mínimo</span>
            {isEditing ? (
              <input
                type="number"
                min="0"
                className="editable-input"
                value={editingRows[item.$id]?.min_qty ?? item.min_qty ?? 0}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  e.stopPropagation();
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
              <span className="value minimum">{item.min_qty || 0}</span>
            )}
          </div>

          {(item.cost_price || isEditing) && (
            <div className="stock-row">
              <span className="label">Preço</span>
              {isEditing ? (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="editable-input"
                  value={
                    editingRows[item.$id]?.cost_price ?? item.cost_price ?? 0
                  }
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    e.stopPropagation();
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
                <span className="value price">
                  €{(item.cost_price || 0).toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="card-footer">
          <span className="supplier">{item.supplier || "N/A"}</span>
          <span className="location">{item.location || "N/A"}</span>
        </div>

        {/* Edit buttons in line style at bottom when editing */}
        {isEditing && (
          <div className="edit-actions">
            <button
              className="action-btn save"
              onClick={(e) => {
                e.stopPropagation();
                handleSaveEdit(item.$id);
              }}
              disabled={loading}
            >
              <Save size={14} />
              Guardar
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
            >
              <X size={14} />
              Cancelar
            </button>
          </div>
        )}

        {/* Movement controls with both add and remove buttons - always visible when not editing */}
        {!isEditing && (
          <div className="movement-controls">
            <div className="movement-buttons">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToMovementCart(item.$id, 1);
                }}
                className="movement-btn add"
                disabled={loading}
              >
                <Plus size={16} />
                Adicionar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToMovementCart(item.$id, -1);
                }}
                className="movement-btn remove"
                disabled={loading}
              >
                <Minus size={16} />
                Remover
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Early return if databases is not available
  if (!databases) {
    return (
      <div className="stock-component">
        <div className="loading-state">
          <div className="loading-text">Inicializando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stock-component">
      {/* Header */}
      <div className="stock-header">
        <h1>
          <Package className="header-icon" />
          Gestão de Stock
        </h1>
        <div className="header-actions">
          <button
            onClick={fetchStock}
            disabled={loading}
            className="action-button secondary"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="action-button primary"
            disabled={loading}
          >
            <Plus size={16} />
            Adicionar Item
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="stock-content">
        {/* Stats Overview */}
        <div className="stats-overview">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Total Items</span>
                <Warehouse className="stat-icon" />
              </div>
              <div className="stat-value info">{stockItems.length}</div>
              <div className="stat-description">Items em stock</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Stock Crítico</span>
                <AlertTriangle className="stat-icon" />
              </div>
              <div className="stat-value critical">{criticalStock.length}</div>
              <div className="stat-description">Itens abaixo do mínimo</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Stock Baixo</span>
                <TrendingDown className="stat-icon" />
              </div>
              <div className="stat-value warning">{warningStock.length}</div>
              <div className="stat-description">Itens próximos do mínimo</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-title">Stock OK</span>
                <TrendingUp className="stat-icon" />
              </div>
              <div className="stat-value success">
                {stockItems.length - criticalStock.length - warningStock.length}
              </div>
              <div className="stat-description">Itens com stock adequado</div>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="content-controls">
          <div className="search-container">
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

        {/* Items Grid */}
        <div className="items-container">
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
              <div className="items-grid">
                {paginatedItems.map((item) => (
                  <ItemCard key={item.$id} item={item} isMovementMode={false} />
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
                    Página {currentPage} de {totalPages}
                  </span>

                  <button
                    className="page-button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
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

      {/* Movement Cart - shows whenever there are items in cart */}
      {Object.keys(movementCart).length > 0 && (
        <div className="movement-cart">
          <div className="cart-header">
            <div className="cart-info">
              <div className="cart-icon">
                <ShoppingCart size={16} />
              </div>
              <div className="cart-details">
                <h3 className="cart-title">Movimentos de Stock</h3>
                <p className="cart-subtitle">
                  {Object.keys(movementCart).length}{" "}
                  {Object.keys(movementCart).length === 1
                    ? "produto"
                    : "produtos"}{" "}
                  •{" "}
                  {Object.values(movementCart).reduce(
                    (sum, qty) => sum + Math.abs(qty),
                    0
                  )}{" "}
                  movimentos
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCartExpanded(!isCartExpanded)}
              className="cart-toggle"
            >
              {isCartExpanded ? <X size={16} /> : <Package size={16} />}
            </button>
          </div>

          {isCartExpanded && (
            <div className="cart-content">
              <div className="cart-items">
                {Object.entries(movementCart).map(([itemId, quantity]) => {
                  const item = stockItems.find((i) => i.$id === itemId);
                  if (!item) return null;

                  return (
                    <div key={itemId} className="cart-item">
                      <div className="cart-item-info">
                        <span className="cart-item-name">{item.name}</span>
                        <span
                          className={`cart-item-quantity ${
                            quantity > 0 ? "positive" : "negative"
                          }`}
                        >
                          {quantity > 0 ? "+" : ""}
                          {quantity}
                        </span>
                      </div>
                      <button
                        onClick={() => removeFromMovementCart(itemId)}
                        className="cart-item-remove"
                        disabled={loading}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="cart-actions">
                <button
                  onClick={clearMovementCart}
                  className="action-button secondary"
                  disabled={loading}
                >
                  Limpar
                </button>
                <button
                  onClick={processMovements}
                  className="action-button primary"
                  disabled={Object.keys(movementCart).length === 0 || loading}
                >
                  <Save size={16} />
                  {loading ? "A processar..." : "Aplicar Movimentos"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add New Item Modal */}
      {isAddModalOpen && (
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
                    <div className="image-preview-wrapper">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="image-preview"
                      />
                      <button
                        type="button"
                        onClick={resetImage}
                        className="image-remove-button"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {selectedImage && (
                      <div className="image-info">
                        <div>
                          Tamanho: {(selectedImage.size / 1024).toFixed(1)} KB
                        </div>
                        <div>Nome: {selectedImage.name}</div>
                      </div>
                    )}
                    <div className="image-actions">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="image-action-button secondary"
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
        </div>
      )}

      {/* Image Crop Modal */}
      {cropModalOpen && (
        <div className="modal-overlay crop-modal-overlay">
          <div className="crop-modal-container">
            <div className="crop-modal-header">
              <h3>Cortar Imagem</h3>
              <button
                onClick={() => setCropModalOpen(false)}
                className="close-button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="crop-modal-content">
              <div className="crop-container">
                <img
                  ref={imageRef}
                  src={imagePreview}
                  alt="Crop preview"
                  className="crop-image"
                />
                <div
                  className="crop-overlay"
                  style={{
                    left: cropArea.x,
                    top: cropArea.y,
                    width: cropArea.width,
                    height: cropArea.height,
                  }}
                  onMouseDown={(e) => handleCropMouseDown(e, "drag")}
                >
                  <div
                    className="crop-handle"
                    onMouseDown={(e) => handleCropMouseDown(e, "resize")}
                  />
                </div>
              </div>

              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            <div className="crop-modal-footer">
              <button
                onClick={() => setCropModalOpen(false)}
                className="footer-button cancel"
              >
                Cancelar
              </button>
              <button onClick={applyCrop} className="footer-button primary">
                <Crop size={16} />
                Aplicar Corte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Critical Stock Warnings */}
      {criticalStock.length > 0 && (
        <div className="warning-section">
          <div className="warning-content">
            <div className="warning-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="warning-details">
              <div className="warning-header">
                <h3 className="warning-title">Stock Crítico</h3>
                <span className="warning-badge">
                  {criticalStock.length}{" "}
                  {criticalStock.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <p className="warning-description">
                Os seguintes produtos estão com stock crítico e requerem
                reposição imediata.
              </p>
              <div className="warning-list">
                {criticalStock.slice(0, 5).map((item) => (
                  <div key={item.$id} className="warning-item">
                    <div className="warning-item-info">
                      <span className="warning-item-name">
                        {item.name || "Nome não disponível"}
                      </span>
                      <span className="warning-item-category">
                        {item.category || "N/A"}
                      </span>
                    </div>
                    <div className="warning-item-stock">
                      <span className="warning-item-quantity">
                        {item.qty || 0}
                      </span>
                    </div>
                  </div>
                ))}
                {criticalStock.length > 5 && (
                  <p className="warning-more">
                    +{criticalStock.length - 5} outros produtos com stock
                    crítico
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
