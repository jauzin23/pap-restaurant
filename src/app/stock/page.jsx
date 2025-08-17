"use client";

import { useMediaQuery } from "react-responsive";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";
import Header from "../components/Header";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
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

export default function Stock() {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [user, setUser] = useState(null);
  const router = useRouter();
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [movementMode, setMovementMode] = useState("add"); // Default to "add"
  const [movementList, setMovementList] = useState([]);
  const [editingRows, setEditingRows] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartAnimation, setCartAnimation] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(false); // Default to closed
  const [cartPulse, setCartPulse] = useState(false); // New state for cart notification
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    description: "",
    supplier: "",
    location: "",
    cost_price: 0,
    qty: 0, // Default to 0, cannot be changed
    min_qty: 0,
  });
  const [addItemLoading, setAddItemLoading] = useState(false);

  // Dropdown data states
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);

  const ITEMS_PER_PAGE = 50;

  const { databases, account } = useApp();

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

  // Redirect mobile users
  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [isMobile, router]);

  // Auth check
  useEffect(() => {
    account
      .get()
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router, account]);

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
      // Set empty arrays on error
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
    if (loading) return; // Prevent double calls
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

    // Trigger cart pulse animation to notify user
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 800);

    // Simple cart animation
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

    // Validate required fields
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

      // Reset form and close modal
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

      // Refresh stock list
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

  // Loading state
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f0f_1px,transparent_1px),linear-gradient(to_bottom,#0f0f0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/10 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-t-purple-500 border-r-pink-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>
          <div className="mt-8 text-center">
            <h2 className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
              Mesa+
            </h2>
            <p className="text-white/50 text-sm">A carregar o dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const ItemCard = ({ item, onClick, isMovementMode = false }) => (
    <div
      className={`group relative bg-neutral-900/90 backdrop-blur-sm border-2 border-neutral-700/50 rounded-2xl p-4 transition-all duration-200 hover:border-neutral-600/50 hover:shadow-lg hover:shadow-neutral-900/20 ${
        isMovementMode
          ? "cursor-pointer hover:border-purple-500/50 active:scale-95"
          : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-white text-lg truncate group-hover:text-purple-300 transition-colors">
            {item.name}
          </h4>
          <p className="text-sm text-neutral-400 truncate">
            {item.category || item.description}
          </p>
        </div>
        <div
          className={`px-2 py-1 rounded-lg text-xs font-medium ${
            item.qty <= item.min_qty
              ? "bg-red-500/20 text-red-300 border border-red-500/30"
              : "bg-green-500/20 text-green-300 border border-green-500/30"
          }`}
        >
          {item.qty <= item.min_qty ? "Baixo" : "OK"}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-neutral-400">Stock atual</span>
          <span
            className={`font-mono font-bold text-lg ${
              item.qty <= item.min_qty ? "text-red-400" : "text-green-400"
            }`}
          >
            {item.qty}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-neutral-400">Mínimo</span>
          <span className="font-mono text-yellow-400">{item.min_qty}</span>
        </div>
        {item.cost_price && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-neutral-400">Preço</span>
            <span className="font-mono text-blue-400">
              €{item.cost_price.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{item.supplier || "N/A"}</span>
        <span>{item.location || "N/A"}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Grid background (consistent with menu and pedidos) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f0f_1px,transparent_1px),linear-gradient(to_bottom,#0f0f0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none z-0" />

      <Header user={user} logo="/logo-icon.svg" />

      {/* Floating Shopping Cart - Simplified Animation */}
      {activeTab === "movement" && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-end">
              {movementList.length > 0 ? (
                <div className="bg-neutral-900/95 backdrop-blur-sm border border-neutral-700/50 rounded-t-2xl shadow-2xl overflow-hidden">
                  {/* Cart Header - Always Visible */}
                  <div
                    className={`px-6 py-4 border-b border-neutral-700/50 bg-gradient-to-r from-purple-600/10 to-purple-700/5 ${
                      cartPulse
                        ? "bg-gradient-to-r from-green-600/20 to-green-700/10"
                        : ""
                    } transition-colors duration-300`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl transition-colors duration-300 ${
                            cartAnimation || cartPulse
                              ? "bg-green-500/20 border border-green-500/30"
                              : "bg-purple-500/20 border border-purple-500/30"
                          }`}
                        >
                          <ShoppingCart
                            className={`w-5 h-5 transition-colors duration-300 ${
                              cartAnimation || cartPulse
                                ? "text-green-400"
                                : "text-purple-400"
                            }`}
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-lg">
                            {movementMode === "add"
                              ? "Adicionar ao Stock"
                              : "Remover do Stock"}
                          </h3>
                          <p className="text-sm text-neutral-400">
                            {movementList.length}{" "}
                            {movementList.length === 1
                              ? "produto selecionado"
                              : "produtos selecionados"}{" "}
                            •{" "}
                            {movementList.reduce(
                              (sum, item) => sum + item.qty,
                              0
                            )}{" "}
                            unidades
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all duration-200 ${
                            cartPulse
                              ? "bg-green-500/30 text-green-200 border-green-500/50 scale-105"
                              : movementMode === "add"
                              ? "bg-green-500/20 text-green-300 border-green-500/30"
                              : "bg-red-500/20 text-red-300 border-red-500/30"
                          }`}
                        >
                          {movementList.reduce(
                            (sum, item) => sum + item.qty,
                            0
                          )}
                        </div>
                        <button
                          onClick={() => setIsCartExpanded(!isCartExpanded)}
                          className={`p-2 rounded-xl font-medium transition-all duration-200 hover:scale-105 ${
                            isCartExpanded
                              ? "bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white"
                              : "bg-purple-600 hover:bg-purple-700 text-white"
                          }`}
                        >
                          {isCartExpanded ? (
                            <X className="w-5 h-5" />
                          ) : (
                            <Package className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Content - Simplified Animation */}
                  {isCartExpanded && (
                    <div className="animate-in fade-in duration-200">
                      {/* Quick Preview */}
                      <div className="px-6 py-4 max-h-32 overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {movementList.slice(0, 8).map(({ item, qty }) => (
                            <div
                              key={item.$id}
                              className="flex items-center gap-3 bg-neutral-800/50 rounded-lg px-3 py-2"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white text-sm truncate">
                                  {item.name}
                                </p>
                                <p className="text-xs text-neutral-400 truncate">
                                  {item.category || item.description}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    handleQuantityChange(item.$id, -1)
                                  }
                                  className="w-6 h-6 rounded-md bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 flex items-center justify-center transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 text-center font-mono font-bold text-white text-sm">
                                  {qty}
                                </span>
                                <button
                                  onClick={() =>
                                    handleQuantityChange(item.$id, 1)
                                  }
                                  className="w-6 h-6 rounded-md bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 flex items-center justify-center transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {movementList.length > 8 && (
                            <div className="flex items-center justify-center bg-neutral-800/30 rounded-lg px-3 py-2">
                              <p className="text-sm text-neutral-400">
                                +{movementList.length - 8} mais itens
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="px-6 py-4 border-t border-neutral-700/50 bg-neutral-900/50">
                        <div className="flex gap-3">
                          <button
                            onClick={() => setMovementList([])}
                            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white rounded-xl font-medium transition-colors"
                          >
                            Limpar Tudo
                          </button>
                          <button
                            onClick={() => setIsCartOpen(true)}
                            className="px-4 py-2 bg-neutral-600 hover:bg-neutral-500 text-neutral-200 hover:text-white rounded-xl font-medium transition-colors"
                          >
                            Ver Detalhes
                          </button>
                          <button
                            onClick={() => {
                              handleConfirmMovement();
                            }}
                            disabled={loading}
                            className={`flex-1 py-2 px-4 rounded-xl font-bold text-white transition-all duration-200 shadow-lg hover:shadow-xl ${
                              movementMode === "add"
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-red-600 hover:bg-red-700"
                            } ${
                              loading
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:scale-[1.02]"
                            }`}
                          >
                            {loading ? (
                              <div className="flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Processando...
                              </div>
                            ) : (
                              `Confirmar ${
                                movementMode === "add" ? "Adição" : "Remoção"
                              }`
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty State - Minimized Cart Indicator */
                <div className="bg-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 rounded-t-2xl px-6 py-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-neutral-700/50">
                      <ShoppingCart className="w-4 h-4 text-neutral-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-300">
                        {movementMode === "add"
                          ? "Selecione itens para adicionar"
                          : "Selecione itens para remover"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Clique nos produtos para começar
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-4 py-2 text-white hover:text-white bg-neutral-900/60 hover:bg-neutral-800 rounded-xl border border-neutral-700 hover:border-neutral-600"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </Button>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTabSwitch("overview")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                activeTab === "overview"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "bg-neutral-800/50 text-neutral-400 hover:text-white hover:bg-neutral-700/50 border border-neutral-700"
              }`}
            >
              <Eye className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => handleTabSwitch("movement")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                activeTab === "movement"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "bg-neutral-800/50 text-neutral-400 hover:text-white hover:bg-neutral-700/50 border border-neutral-700"
              }`}
            >
              <Package className="w-4 h-4" />
              Editar Stock
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Overview Header with Actions */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Overview do Stock
                </h2>
                <p className="text-neutral-400">
                  Gestão e monitorização do inventário
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800 transition"
                  onClick={fetchStock}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Atualizar
                </Button>
                <Button
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-green-600/50 bg-green-600 text-white hover:bg-green-700 transition shadow-lg"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Novo Item
                </Button>
              </div>
            </div>

            {/* Warnings Section */}
            <div className="space-y-4">
              {/* Critical Stock Alert - qty <= min_qty */}
              {criticalStock.length > 0 && (
                <div className="bg-gradient-to-r from-red-500/10 to-red-600/5 border-l-4 border-red-500 rounded-xl p-6 shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-red-200">
                          Stock Crítico
                        </h3>
                        <span className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-sm font-medium text-red-300">
                          {criticalStock.length}{" "}
                          {criticalStock.length === 1 ? "item" : "itens"}
                        </span>
                      </div>
                      <p className="text-red-300/90 mb-4">
                        Os seguintes produtos estão com stock crítico e requerem
                        reposição imediata.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {criticalStock.map((item) => (
                          <div
                            key={item.$id}
                            className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 hover:bg-red-500/15 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium text-red-200 text-sm truncate">
                                {item.name}
                              </h4>
                              <span className="font-mono text-red-400 text-sm font-bold">
                                {item.qty}
                              </span>
                            </div>
                            <p className="text-xs text-red-300/70 mb-2">
                              {item.category || item.description}
                            </p>
                            <button
                              onClick={() => {
                                handleTabSwitch("movement");
                              }}
                              className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
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

              {/* Warning Stock Alert - qty > min_qty and qty <= min_qty + 5 (only show if no critical) */}
              {criticalStock.length === 0 && warningStock.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 border-l-4 border-yellow-500 rounded-xl p-6 shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-yellow-200">
                          Stock Baixo
                        </h3>
                        <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-sm font-medium text-yellow-300">
                          {warningStock.length}{" "}
                          {warningStock.length === 1 ? "item" : "itens"}
                        </span>
                      </div>
                      <p className="text-yellow-300/90 mb-4">
                        Produtos próximos do limite mínimo. Considere fazer
                        reposição em breve.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {warningStock.slice(0, 10).map((item) => (
                          <button
                            key={item.$id}
                            onClick={() => {
                              handleTabSwitch("movement");
                              handleItemClick(item);
                            }}
                            className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm font-medium transition-colors"
                          >
                            {item.name} ({item.qty})
                          </button>
                        ))}
                        {warningStock.length > 10 && (
                          <span className="px-3 py-1.5 text-yellow-300/70 text-sm">
                            +{warningStock.length - 10} mais
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Overview table */}
            <div className="bg-neutral-900/80 rounded-xl shadow-lg border border-neutral-700 overflow-hidden">
              <div className="p-4 border-b border-neutral-700">
                <h1 className="text-2xl font-bold text-white">Inventário</h1>
                <p className="text-neutral-400 text-sm">
                  {stockItems.length} itens no total
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-white">
                  <thead className="bg-neutral-800">
                    <tr>
                      <th className="p-3 text-left font-semibold">Nome</th>
                      <th className="p-3 text-left font-semibold">Categoria</th>
                      <th className="p-3 text-left font-semibold">
                        Fornecedor
                      </th>
                      <th className="p-3 text-left font-semibold">Local</th>
                      <th className="p-3 text-left font-semibold">Preço</th>
                      <th className="p-3 text-left font-semibold">Stock</th>
                      <th className="p-3 text-left font-semibold">Mín.</th>
                      <th className="p-3 text-left font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockItems.map((item) => (
                      <tr
                        key={item.$id}
                        className="border-b border-neutral-800 hover:bg-neutral-800/40 transition-colors"
                      >
                        <td className="p-3">
                          <input
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 w-32 text-white text-sm font-semibold focus:border-purple-500 focus:outline-none"
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
                        <td className="p-3">
                          <input
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 w-24 text-white text-sm focus:border-purple-500 focus:outline-none"
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
                        <td className="p-3">
                          <input
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 w-28 text-white text-sm focus:border-purple-500 focus:outline-none"
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
                        <td className="p-3">
                          <input
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 w-20 text-white text-sm focus:border-purple-500 focus:outline-none"
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
                        <td className="p-3">
                          <input
                            type="number"
                            step="0.01"
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 w-16 text-white text-sm focus:border-purple-500 focus:outline-none"
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
                        <td className="p-3">
                          <span
                            className={`font-mono font-bold ${
                              item.qty <= item.min_qty
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          >
                            {item.qty}
                          </span>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 w-16 text-white text-sm font-mono focus:border-purple-500 focus:outline-none"
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
                        <td className="p-3">
                          <Button
                            size="sm"
                            className="bg-blue-700 hover:bg-blue-800 text-white rounded px-3 py-1 text-xs"
                            onClick={() => handleSaveEdit(item.$id)}
                            disabled={loading || !editingRows[item.$id]}
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
          <div className="space-y-8">
            {/* Controls */}
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-white placeholder:text-neutral-400 focus:border-purple-500/50 focus:outline-none"
                />
              </div>

              <div className="flex rounded-xl border border-neutral-700/50 bg-neutral-800/50 p-1">
                <button
                  onClick={() => setMovementMode("remove")}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    movementMode === "remove"
                      ? "bg-red-600 text-white shadow-lg"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  Remover
                </button>
                <button
                  onClick={() => setMovementMode("add")}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    movementMode === "add"
                      ? "bg-green-600 text-white shadow-lg"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </button>
              </div>
            </div>

            {/* Movement Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
              <div className="flex justify-center items-center gap-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-white font-mono">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Cart Modal */}
      {isCartOpen && movementList.length > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-neutral-900/95 backdrop-blur-sm border border-neutral-700/50 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-neutral-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl ${
                      movementMode === "add"
                        ? "bg-green-500/10 border border-green-500/20"
                        : "bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    <ShoppingCart
                      className={`w-5 h-5 ${
                        movementMode === "add"
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {movementMode === "add"
                        ? "Adicionar Stock"
                        : "Remover Stock"}
                    </h3>
                    <p className="text-sm text-neutral-400">
                      {movementList.length} itens selecionados
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 rounded-xl bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-3 max-h-60 overflow-y-auto mb-6">
                {movementList.map(({ item, qty }) => (
                  <div
                    key={item.$id}
                    className="flex items-center gap-3 bg-neutral-800/50 rounded-xl p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">
                        {item.name}
                      </h4>
                      <p className="text-sm text-neutral-400">
                        {item.category || item.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuantityChange(item.$id, -1)}
                        className="w-8 h-8 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center font-mono font-bold text-white">
                        {qty}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.$id, 1)}
                        className="w-8 h-8 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveFromList(item.$id)}
                        className="w-8 h-8 rounded-lg bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-400 hover:text-white flex items-center justify-center transition-colors ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  handleConfirmMovement();
                  setIsCartOpen(false);
                }}
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all duration-200 ${
                  movementMode === "add"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {loading
                  ? "A processar..."
                  : `Confirmar ${
                      movementMode === "add" ? "Adição" : "Remoção"
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-neutral-900/95 backdrop-blur-sm border border-neutral-700/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-700/50 bg-gradient-to-r from-green-600/10 to-emerald-600/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-500/20 border border-green-500/30">
                    <Package className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Adicionar Novo Item
                    </h3>
                    <p className="text-sm text-neutral-400">
                      Preencha os dados do novo produto
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetAddItemForm();
                  }}
                  className="p-2 rounded-xl bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {dropdownsLoading && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">A carregar dados...</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
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
                      className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-white placeholder:text-neutral-400 focus:border-green-500/50 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Categoria
                    </label>
                    <div className="relative">
                      <select
                        value={newItem.category}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 bg-neutral-800/80 border border-neutral-600/50 rounded-xl text-white focus:border-green-500 focus:outline-none transition-all duration-200 appearance-none cursor-pointer hover:bg-neutral-800"
                        disabled={dropdownsLoading}
                      >
                        <option
                          value=""
                          className="bg-neutral-800 text-neutral-400"
                        >
                          Selecionar categoria...
                        </option>
                        {categories.map((category) => (
                          <option
                            key={category.$id}
                            value={category.name || category.category}
                            className="bg-neutral-800 text-white py-2"
                          >
                            {category.name || category.category}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg
                          className="w-5 h-5 text-neutral-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
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
                      className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-white placeholder:text-neutral-400 focus:border-green-500/50 focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Fornecedor
                    </label>
                    <div className="relative">
                      <select
                        value={newItem.supplier}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            supplier: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 bg-neutral-800/80 border border-neutral-600/50 rounded-xl text-white focus:border-green-500 focus:outline-none transition-all duration-200 appearance-none cursor-pointer hover:bg-neutral-800"
                        disabled={dropdownsLoading}
                      >
                        <option
                          value=""
                          className="bg-neutral-800 text-neutral-400"
                        >
                          Selecionar fornecedor...
                        </option>
                        {suppliers.map((supplier) => (
                          <option
                            key={supplier.$id}
                            value={supplier.name || supplier.supplier}
                            className="bg-neutral-800 text-white py-2"
                          >
                            {supplier.name || supplier.supplier}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg
                          className="w-5 h-5 text-neutral-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock & Pricing Information */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Localização
                    </label>
                    <div className="relative">
                      <select
                        value={newItem.location}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            location: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 bg-neutral-800/80 border border-neutral-600/50 rounded-xl text-white focus:border-green-500 focus:outline-none transition-all duration-200 appearance-none cursor-pointer hover:bg-neutral-800"
                        disabled={dropdownsLoading}
                      >
                        <option
                          value=""
                          className="bg-neutral-800 text-neutral-400"
                        >
                          Selecionar localização...
                        </option>
                        {locations.map((location) => (
                          <option
                            key={location.$id}
                            value={location.name || location.location}
                            className="bg-neutral-800 text-white py-2"
                          >
                            {location.name || location.location}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg
                          className="w-5 h-5 text-neutral-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
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
                      className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-white placeholder:text-neutral-400 focus:border-green-500/50 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
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
                      className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-white placeholder:text-neutral-400 focus:border-green-500/50 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Preview Card */}
                  <div className="mt-6 p-4 bg-neutral-800/30 border border-neutral-700/30 rounded-xl">
                    <h4 className="text-sm font-medium text-neutral-300 mb-3">
                      Pré-visualização:
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Nome:</span>
                        <span className="text-white font-medium">
                          {newItem.name || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Categoria:</span>
                        <span className="text-white">
                          {newItem.category || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Stock:</span>
                        <span className="font-mono text-neutral-400">
                          0 (inicial)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Mínimo:</span>
                        <span className="font-mono text-yellow-400">
                          {newItem.min_qty || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-neutral-700/50 bg-neutral-900/50">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetAddItemForm();
                  }}
                  className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddNewItem}
                  disabled={addItemLoading || !newItem.name.trim()}
                  className={`px-6 py-3 rounded-xl font-bold text-white transition-all duration-200 shadow-lg hover:shadow-xl ${
                    !newItem.name.trim()
                      ? "bg-neutral-600 cursor-not-allowed opacity-50"
                      : addItemLoading
                      ? "bg-green-600/70 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 hover:scale-[1.02]"
                  }`}
                >
                  {addItemLoading ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Adicionando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Adicionar Item
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
