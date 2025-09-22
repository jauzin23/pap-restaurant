"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import {
  COL_STOCK,
  DBRESTAURANTE,
  COL_CATEGORY_STOCK,
  COL_SUPPLIER,
  LOCATION_STOCK,
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

  // Dropdown data states
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);

  const ITEMS_PER_PAGE = 50;
  const { databases } = useApp();

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
      await databases.createDocument(DBRESTAURANTE, COL_STOCK, "unique()", {
        name: trimmedName,
        category: newItem.category?.trim() || null,
        description: newItem.description?.trim() || null,
        supplier: newItem.supplier?.trim() || null,
        location: newItem.location?.trim() || null,
        cost_price: Math.max(0, parseFloat(newItem.cost_price) || 0),
        qty: Math.max(0, parseInt(newItem.qty) || 0),
        min_qty: Math.max(0, parseInt(newItem.min_qty) || 0),
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
      setIsAddModalOpen(false);

      await fetchStock();
    } catch (err) {
      console.error("Error adding new item:", err);
      alert("Erro ao adicionar produto. Verifique os dados e tente novamente.");
    } finally {
      setAddItemLoading(false);
    }
  }, [newItem, databases, addItemLoading, fetchStock]);

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
  }, []);

  const ItemCard = ({ item, onClick, isMovementMode = false }) => {
    if (!item) return null;

    const isEditing = editingRows[item.$id];
    const getStatusInfo = (current, minimum) => {
      if (current <= minimum) return { status: "critical", label: "Crítico" };
      if (current <= minimum + 5) return { status: "warning", label: "Baixo" };
      return { status: "ok", label: "OK" };
    };

    const statusInfo = getStatusInfo(item.qty || 0, item.min_qty || 0);

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
