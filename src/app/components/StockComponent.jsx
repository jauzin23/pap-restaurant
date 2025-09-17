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
} from "lucide-react";
import {
  COL_STOCK,
  DBRESTAURANTE,
  COL_CATEGORY_STOCK,
  COL_SUPPLIER,
  LOCATION_STOCK,
} from "@/lib/appwrite";

export default function StockComponent() {
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [movementMode, setMovementMode] = useState("add");
  const [movementList, setMovementList] = useState([]);
  const [editingRows, setEditingRows] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartAnimation, setCartAnimation] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
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
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  // Reset movement list when mode changes
  useEffect(() => {
    setMovementList([]);
  }, [movementMode]);

  // Initial data fetch
  useEffect(() => {
    fetchStock();
  }, []);

  // Fetch dropdown data for the add modal
  const fetchDropdownData = useCallback(async () => {
    setDropdownsLoading(true);
    try {
      const [categoriesRes, suppliersRes, locationsRes] = await Promise.all([
        databases.listDocuments(DBRESTAURANTE, COL_CATEGORY_STOCK),
        databases.listDocuments(DBRESTAURANTE, COL_SUPPLIER),
        databases.listDocuments(DBRESTAURANTE, LOCATION_STOCK),
      ]);

      setCategories(categoriesRes.documents);
      setSuppliers(suppliersRes.documents);
      setLocations(locationsRes.documents);
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
    if (loading) return;
    setLoading(true);
    try {
      const res = await databases.listDocuments(DBRESTAURANTE, COL_STOCK);
      setStockItems(res.documents);
    } catch (err) {
      console.error("Error fetching stock:", err);
    } finally {
      setLoading(false);
    }
  }, [databases, loading]);

  const handleTabSwitch = useCallback((tab) => {
    setActiveTab(tab);
    setMovementList([]);
    setSearchTerm("");
    setCurrentPage(1);
    setIsCartOpen(false);
    setIsCartExpanded(false);
    setCurrentPage(1);
  }, []);

  const handleItemClick = useCallback((item) => {
    setMovementList((prev) => {
      const existing = prev.find((i) => i.item.$id === item.$id);
      if (existing) {
        return prev.map((i) =>
          i.item.$id === item.$id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { item, qty: 1 }];
    });

    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 800);

    setCartAnimation(true);
    setTimeout(() => setCartAnimation(false), 300);
  }, []);

  const handleQuantityChange = useCallback((id, delta) => {
    setMovementList((prev) =>
      prev
        .map((i) =>
          i.item.$id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i
        )
        .filter((i) => i.qty > 0)
    );
  }, []);

  const handleRemoveFromList = useCallback((id) => {
    setMovementList((prev) => prev.filter((i) => i.item.$id !== id));
  }, []);

  const handleConfirmMovement = useCallback(async () => {
    if (!movementList.length || loading) return;

    setLoading(true);
    try {
      const updates = movementList.map(({ item, qty }) => {
        const newQty =
          movementMode === "remove" ? item.qty - qty : item.qty + qty;
        return databases.updateDocument(DBRESTAURANTE, COL_STOCK, item.$id, {
          qty: Math.max(0, newQty),
        });
      });

      await Promise.all(updates);
      setMovementList([]);
      await fetchStock();
    } catch (err) {
      console.error("Error updating stock:", err);
      alert("Erro ao atualizar stock");
    } finally {
      setLoading(false);
    }
  }, [movementList, movementMode, databases, loading, fetchStock]);

  const handleSaveEdit = useCallback(
    async (itemId) => {
      const edits = editingRows[itemId];
      if (!edits || loading) return;

      setLoading(true);
      try {
        await databases.updateDocument(DBRESTAURANTE, COL_STOCK, itemId, edits);
        setEditingRows((prev) => ({ ...prev, [itemId]: undefined }));
        await fetchStock();
      } catch (err) {
        console.error("Error updating item:", err);
        alert("Erro ao atualizar item");
      } finally {
        setLoading(false);
      }
    },
    [editingRows, databases, loading, fetchStock]
  );

  const handleAddNewItem = useCallback(async () => {
    if (addItemLoading) return;

    if (!newItem.name.trim()) {
      alert("Nome do produto é obrigatório");
      return;
    }

    setAddItemLoading(true);
    try {
      await databases.createDocument(DBRESTAURANTE, COL_STOCK, "unique()", {
        name: newItem.name.trim(),
        category: newItem.category.trim() || null,
        description: newItem.description.trim() || null,
        supplier: newItem.supplier.trim() || null,
        location: newItem.location.trim() || null,
        cost_price: parseFloat(newItem.cost_price) || 0,
        qty: parseInt(newItem.qty) || 0,
        min_qty: parseInt(newItem.min_qty) || 0,
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

  const ItemCard = ({ item, onClick, isMovementMode = false }) => (
    <div
      style={{
        backgroundColor: "white",
        border: "2px solid #e2e8f0",
        borderRadius: "12px",
        padding: "16px",
        cursor: isMovementMode ? "pointer" : "default",
        transition: "all 0.2s",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
      }}
      onMouseEnter={(e) => {
        if (isMovementMode) {
          e.target.style.borderColor = "#3b82f6";
          e.target.style.transform = "translateY(-2px)";
          e.target.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
        }
      }}
      onMouseLeave={(e) => {
        if (isMovementMode) {
          e.target.style.borderColor = "#e2e8f0";
          e.target.style.transform = "translateY(0)";
          e.target.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
        }
      }}
      onClick={onClick}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              fontWeight: "bold",
              color: "#1e293b",
              fontSize: "18px",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </h4>
          <p
            style={{
              fontSize: "14px",
              color: "#64748b",
              margin: "4px 0 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.category || item.description}
          </p>
        </div>
        <div
          style={{
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "500",
            backgroundColor: item.qty <= item.min_qty ? "#fef2f2" : "#f0fdf4",
            color: item.qty <= item.min_qty ? "#dc2626" : "#16a34a",
            border:
              item.qty <= item.min_qty
                ? "1px solid #fecaca"
                : "1px solid #bbf7d0",
          }}
        >
          {item.qty <= item.min_qty ? "Baixo" : "OK"}
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <span style={{ fontSize: "14px", color: "#64748b" }}>
            Stock atual
          </span>
          <span
            style={{
              fontFamily: "monospace",
              fontWeight: "bold",
              fontSize: "18px",
              color: item.qty <= item.min_qty ? "#dc2626" : "#16a34a",
            }}
          >
            {item.qty}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <span style={{ fontSize: "14px", color: "#64748b" }}>Mínimo</span>
          <span style={{ fontFamily: "monospace", color: "#f59e0b" }}>
            {item.min_qty}
          </span>
        </div>
        {item.cost_price && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "14px", color: "#64748b" }}>Preço</span>
            <span style={{ fontFamily: "monospace", color: "#3b82f6" }}>
              €{item.cost_price.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "12px",
          color: "#9ca3af",
        }}
      >
        <span>{item.supplier || "N/A"}</span>
        <span>{item.location || "N/A"}</span>
      </div>
    </div>
  );

  return (
    <div
      style={{ backgroundColor: "white", minHeight: "100%", padding: "24px" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "600",
            color: "#1e293b",
            margin: 0,
          }}
        >
          Gestão de Stock
        </h1>
        <div style={{ display: "flex", gap: "12px" }}>
          <Button
            onClick={fetchStock}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              backgroundColor: "#f1f5f9",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        <button
          onClick={() => handleTabSwitch("overview")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 24px",
            borderRadius: "8px",
            fontWeight: "500",
            border: "none",
            cursor: "pointer",
            backgroundColor: activeTab === "overview" ? "#3b82f6" : "#f1f5f9",
            color: activeTab === "overview" ? "white" : "#64748b",
          }}
        >
          <Eye size={16} />
          Overview
        </button>
        <button
          onClick={() => handleTabSwitch("movement")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 24px",
            borderRadius: "8px",
            fontWeight: "500",
            border: "none",
            cursor: "pointer",
            backgroundColor: activeTab === "movement" ? "#3b82f6" : "#f1f5f9",
            color: activeTab === "movement" ? "white" : "#64748b",
          }}
        >
          <Package size={16} />
          Editar Stock
        </button>
      </div>

      {/* Content */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Overview Header with Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1e293b",
                  margin: 0,
                }}
              >
                Overview do Stock
              </h2>
              <p style={{ color: "#64748b", margin: "4px 0 0 0" }}>
                Gestão e monitorização do inventário
              </p>
            </div>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              <Plus size={16} />
              Novo Item
            </Button>
          </div>

          {/* Warnings Section */}
          {criticalStock.length > 0 && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderLeft: "4px solid #dc2626",
                borderRadius: "8px",
                padding: "24px",
              }}
            >
              <div style={{ display: "flex", gap: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#fee2e2",
                  }}
                >
                  <AlertTriangle size={20} style={{ color: "#dc2626" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#991b1b",
                        margin: 0,
                      }}
                    >
                      Stock Crítico
                    </h3>
                    <span
                      style={{
                        padding: "4px 12px",
                        backgroundColor: "#fee2e2",
                        border: "1px solid #fecaca",
                        borderRadius: "20px",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#991b1b",
                      }}
                    >
                      {criticalStock.length}{" "}
                      {criticalStock.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  <p style={{ color: "#b91c1c", marginBottom: "16px" }}>
                    Os seguintes produtos estão com stock crítico e requerem
                    reposição imediata.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(250px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {criticalStock.map((item) => (
                      <div
                        key={item.$id}
                        style={{
                          backgroundColor: "#fee2e2",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          padding: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "4px",
                          }}
                        >
                          <h4
                            style={{
                              fontWeight: "500",
                              color: "#991b1b",
                              fontSize: "14px",
                              margin: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.name}
                          </h4>
                          <span
                            style={{
                              fontFamily: "monospace",
                              color: "#dc2626",
                              fontSize: "14px",
                              fontWeight: "bold",
                            }}
                          >
                            {item.qty}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#b91c1c",
                            marginBottom: "8px",
                          }}
                        >
                          {item.category || item.description}
                        </p>
                        <button
                          onClick={() => handleTabSwitch("movement")}
                          style={{
                            width: "100%",
                            backgroundColor: "#dc2626",
                            color: "white",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Repor Agora
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Overview table */}
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px", borderBottom: "1px solid #e2e8f0" }}>
              <h1
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1e293b",
                  margin: 0,
                }}
              >
                Inventário
              </h1>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "14px",
                  margin: "4px 0 0 0",
                }}
              >
                {stockItems.length} itens no total
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead style={{ backgroundColor: "#f8fafc" }}>
                  <tr>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Nome
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Categoria
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Fornecedor
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Local
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Preço
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Stock
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Mín.
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.map((item) => (
                    <tr
                      key={item.$id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                      onMouseEnter={(e) =>
                        (e.target.parentElement.style.backgroundColor =
                          "#f8fafc")
                      }
                      onMouseLeave={(e) =>
                        (e.target.parentElement.style.backgroundColor =
                          "transparent")
                      }
                    >
                      <td style={{ padding: "12px" }}>
                        <input
                          style={{
                            backgroundColor: "white",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            width: "120px",
                            color: "#1e293b",
                            fontSize: "14px",
                            fontWeight: "500",
                          }}
                          defaultValue={item.name || ""}
                          onChange={(e) =>
                            setEditingRows((prev) => ({
                              ...prev,
                              [item.$id]: {
                                ...prev[item.$id],
                                name: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td style={{ padding: "12px" }}>
                        <input
                          style={{
                            backgroundColor: "white",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            width: "100px",
                            color: "#1e293b",
                            fontSize: "14px",
                          }}
                          defaultValue={item.category || ""}
                          onChange={(e) =>
                            setEditingRows((prev) => ({
                              ...prev,
                              [item.$id]: {
                                ...prev[item.$id],
                                category: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td style={{ padding: "12px" }}>
                        <input
                          style={{
                            backgroundColor: "white",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            width: "110px",
                            color: "#1e293b",
                            fontSize: "14px",
                          }}
                          defaultValue={item.supplier || ""}
                          onChange={(e) =>
                            setEditingRows((prev) => ({
                              ...prev,
                              [item.$id]: {
                                ...prev[item.$id],
                                supplier: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td style={{ padding: "12px" }}>
                        <input
                          style={{
                            backgroundColor: "white",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            width: "80px",
                            color: "#1e293b",
                            fontSize: "14px",
                          }}
                          defaultValue={item.location || ""}
                          onChange={(e) =>
                            setEditingRows((prev) => ({
                              ...prev,
                              [item.$id]: {
                                ...prev[item.$id],
                                location: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td style={{ padding: "12px" }}>
                        <input
                          type="number"
                          step="0.01"
                          style={{
                            backgroundColor: "white",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            width: "80px",
                            color: "#1e293b",
                            fontSize: "14px",
                          }}
                          defaultValue={item.cost_price || ""}
                          onChange={(e) =>
                            setEditingRows((prev) => ({
                              ...prev,
                              [item.$id]: {
                                ...prev[item.$id],
                                cost_price: parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: "bold",
                            color:
                              item.qty <= item.min_qty ? "#dc2626" : "#16a34a",
                          }}
                        >
                          {item.qty}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <input
                          type="number"
                          min="0"
                          style={{
                            backgroundColor: "white",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            width: "60px",
                            color: "#1e293b",
                            fontSize: "14px",
                            fontFamily: "monospace",
                          }}
                          defaultValue={item.min_qty || ""}
                          onChange={(e) =>
                            setEditingRows((prev) => ({
                              ...prev,
                              [item.$id]: {
                                ...prev[item.$id],
                                min_qty: parseInt(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </td>
                      <td style={{ padding: "12px" }}>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(item.$id)}
                          disabled={loading || !editingRows[item.$id]}
                          style={{
                            backgroundColor: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            padding: "6px 12px",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          Guardar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Movement Tab */}
      {activeTab === "movement" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Controls */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ position: "relative", flex: 1, maxWidth: "400px" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9ca3af",
                }}
              />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: "100%",
                  paddingLeft: "40px",
                  paddingRight: "16px",
                  paddingTop: "12px",
                  paddingBottom: "12px",
                  backgroundColor: "white",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  color: "#1e293b",
                  fontSize: "14px",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                backgroundColor: "white",
                padding: "4px",
              }}
            >
              <button
                onClick={() => setMovementMode("remove")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontWeight: "500",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    movementMode === "remove" ? "#dc2626" : "transparent",
                  color: movementMode === "remove" ? "white" : "#64748b",
                }}
              >
                <Minus size={16} />
                Remover
              </button>
              <button
                onClick={() => setMovementMode("add")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontWeight: "500",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    movementMode === "add" ? "#16a34a" : "transparent",
                  color: movementMode === "add" ? "white" : "#64748b",
                }}
              >
                <Plus size={16} />
                Adicionar
              </button>
            </div>
          </div>

          {/* Movement Items Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px",
            }}
          >
            {paginatedItems.map((item) => (
              <ItemCard
                key={item.$id}
                item={item}
                onClick={() => handleItemClick(item)}
                isMovementMode={true}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <Button
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "8px 16px",
                  backgroundColor: currentPage === 1 ? "#f1f5f9" : "#3b82f6",
                  color: currentPage === 1 ? "#9ca3af" : "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                Anterior
              </Button>
              <span style={{ color: "#1e293b", fontFamily: "monospace" }}>
                {currentPage} / {totalPages}
              </span>
              <Button
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                style={{
                  padding: "8px 16px",
                  backgroundColor:
                    currentPage === totalPages ? "#f1f5f9" : "#3b82f6",
                  color: currentPage === totalPages ? "#9ca3af" : "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    currentPage === totalPages ? "not-allowed" : "pointer",
                }}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Floating Movement Cart */}
      {activeTab === "movement" && movementList.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            zIndex: 50,
            minWidth: "300px",
            maxWidth: "400px",
          }}
        >
          <div
            style={{
              padding: "16px",
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: movementMode === "add" ? "#f0fdf4" : "#fef2f2",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <div
                  style={{
                    padding: "8px",
                    borderRadius: "8px",
                    backgroundColor:
                      movementMode === "add" ? "#dcfce7" : "#fee2e2",
                  }}
                >
                  <ShoppingCart
                    size={16}
                    style={{
                      color: movementMode === "add" ? "#16a34a" : "#dc2626",
                    }}
                  />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1e293b",
                      margin: 0,
                    }}
                  >
                    {movementMode === "add"
                      ? "Adicionar ao Stock"
                      : "Remover do Stock"}
                  </h3>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      margin: "2px 0 0 0",
                    }}
                  >
                    {movementList.length}{" "}
                    {movementList.length === 1 ? "produto" : "produtos"} •{" "}
                    {movementList.reduce((sum, item) => sum + item.qty, 0)}{" "}
                    unidades
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartExpanded(!isCartExpanded)}
                style={{
                  padding: "8px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {isCartExpanded ? <X size={16} /> : <Package size={16} />}
              </button>
            </div>
          </div>

          {isCartExpanded && (
            <div style={{ padding: "16px" }}>
              <div
                style={{
                  maxHeight: "200px",
                  overflowY: "auto",
                  marginBottom: "16px",
                }}
              >
                {movementList.map(({ item, qty }) => (
                  <div
                    key={item.$id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "8px",
                      padding: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: "500",
                          color: "#1e293b",
                          fontSize: "14px",
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          margin: "2px 0 0 0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.category || item.description}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <button
                        onClick={() => handleQuantityChange(item.$id, -1)}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "4px",
                          backgroundColor: "#fee2e2",
                          color: "#dc2626",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Minus size={12} />
                      </button>
                      <span
                        style={{
                          width: "32px",
                          textAlign: "center",
                          fontFamily: "monospace",
                          fontWeight: "bold",
                          color: "#1e293b",
                          fontSize: "14px",
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.$id, 1)}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "4px",
                          backgroundColor: "#dcfce7",
                          color: "#16a34a",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setMovementList([])}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#f1f5f9",
                    color: "#64748b",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontWeight: "500",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Limpar
                </button>
                <button
                  onClick={handleConfirmMovement}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontWeight: "600",
                    color: "white",
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    backgroundColor: loading
                      ? "#9ca3af"
                      : movementMode === "add"
                      ? "#16a34a"
                      : "#dc2626",
                  }}
                >
                  {loading
                    ? "Processando..."
                    : `Confirmar ${
                        movementMode === "add" ? "Adição" : "Remoção"
                      }`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add New Item Modal */}
      {isAddModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "24px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1e293b",
                    margin: 0,
                  }}
                >
                  Adicionar Novo Item
                </h2>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#64748b",
                    margin: "4px 0 0 0",
                  }}
                >
                  Preencha os dados do novo produto
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddItemForm();
                }}
                style={{
                  padding: "8px",
                  color: "#64748b",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div
              style={{
                padding: "24px",
                overflowY: "auto",
                maxHeight: "calc(90vh - 140px)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Nome do Produto *
                    </label>
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
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Categoria
                    </label>
                    <select
                      value={newItem.category}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                      disabled={dropdownsLoading}
                    >
                      <option value="">Selecionar categoria...</option>
                      {categories.map((category) => (
                        <option
                          key={category.$id}
                          value={category.name || category.category}
                        >
                          {category.name || category.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
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
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "14px",
                        resize: "none",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label
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
                    <select
                      value={newItem.supplier}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          supplier: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                      disabled={dropdownsLoading}
                    >
                      <option value="">Selecionar fornecedor...</option>
                      {suppliers.map((supplier) => (
                        <option
                          key={supplier.$id}
                          value={supplier.name || supplier.supplier}
                        >
                          {supplier.name || supplier.supplier}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Localização
                    </label>
                    <select
                      value={newItem.location}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          location: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                      disabled={dropdownsLoading}
                    >
                      <option value="">Selecionar localização...</option>
                      {locations.map((location) => (
                        <option
                          key={location.$id}
                          value={location.name || location.location}
                        >
                          {location.name || location.location}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
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
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "8px",
                      }}
                    >
                      Stock Mínimo
                    </label>
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
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        fontSize: "14px",
                      }}
                    />
                  </div>
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
                padding: "24px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetAddItemForm();
                }}
                style={{
                  padding: "8px 16px",
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
                onClick={handleAddNewItem}
                disabled={addItemLoading || !newItem.name.trim()}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: "500",
                  borderRadius: "6px",
                  border: "none",
                  cursor:
                    addItemLoading || !newItem.name.trim()
                      ? "not-allowed"
                      : "pointer",
                  backgroundColor:
                    addItemLoading || !newItem.name.trim()
                      ? "#9ca3af"
                      : "#16a34a",
                  color: "white",
                }}
              >
                {addItemLoading ? "A guardar..." : "Adicionar Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
