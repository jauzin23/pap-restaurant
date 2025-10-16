"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Edit,
  Eye,
  Plus,
  Trash2,
  RotateCw,
  Save,
  Square,
  Circle,
  Settings,
  Grid,
  Move,
  X,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { databases, client } from "@/lib/appwrite";
import { Query } from "appwrite";
import {
  DBRESTAURANTE,
  COL_ORDERS,
  COL_TABLES,
  COL_MENU,
} from "@/lib/appwrite";

// Database constants
const DATABASE_ID = DBRESTAURANTE;
const TABLES_COLLECTION_ID = COL_TABLES;
const ORDERS_COLLECTION_ID = COL_ORDERS;
const MENU_COLLECTION_ID = COL_MENU;

interface Table {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  chairs: number;
  rotation: number;
  tableNumber: number;
  shape: "rectangle" | "circle";
  status: "free" | "occupied" | "reserved";
  chairSides: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

interface Order {
  $id: string;
  numeroMesa: number[];
  total: number;
  items?: any[];
  itens?: any[];
  $createdAt: string;
  paid?: boolean;
  paymentMethod?: string;
  staffID?: string;
}

interface MenuItem {
  $id: string;
  name?: string;
  nome?: string;
  price?: number;
  preco?: number;
  category?: string;
  categoria?: string;
  description?: string;
  descricao?: string;
}

interface User {
  $id?: string;
  labels?: string[];
  name?: string;
  email?: string;
}

interface RestaurantTabsLayoutProps {
  user: User | null;
  onTableSelect?: (tableNumber: number) => void;
}

// Order Modal Component
const OrderModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tableNumbers: number[];
  menuItems: MenuItem[];
  onCreateOrder: (items: any[], tableNumbers: number[]) => void;
}> = ({ isOpen, onClose, tableNumbers, menuItems, onCreateOrder }) => {
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = useMemo(() => {
    const cats = [
      "all",
      ...new Set(
        menuItems.map((item) => item.category || item.categoria || "outros")
      ),
    ];
    return cats.filter(Boolean);
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch = (item.name || item.nome || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" ||
        (item.category || item.categoria) === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  const addItem = useCallback((item: MenuItem) => {
    const newItem = {
      nome: item.name || item.nome,
      preco: item.price || item.preco,
      quantidade: 1,
      notas: "",
      status: "pendente",
      paid: false,
    };
    setSelectedItems((prev) => [...prev, newItem]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) return;
    setSelectedItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantidade: quantity } : item
      )
    );
  }, []);

  const total = useMemo(() => {
    return selectedItems.reduce(
      (sum, item) => sum + item.preco * item.quantidade,
      0
    );
  }, [selectedItems]);

  const handleCreateOrder = useCallback(() => {
    if (selectedItems.length === 0) return;
    onCreateOrder(selectedItems, tableNumbers);
    setSelectedItems([]);
    onClose();
  }, [selectedItems, tableNumbers, onCreateOrder, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              New Order - Table{tableNumbers.length > 1 ? "s" : ""}{" "}
              {tableNumbers.join(", ")}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex h-[60vh]">
          {/* Menu Items */}
          <div className="w-1/2 p-6 border-r border-gray-200 overflow-y-auto">
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === "all"
                      ? "All Categories"
                      : category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div
                  key={item.$id}
                  onClick={() => addItem(item)}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-gray-900">
                        {item.name || item.nome}
                      </span>
                      {(item.description || item.descricao) && (
                        <p className="text-sm text-gray-500 mt-1">
                          {item.description || item.descricao}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-green-600">
                      €{(item.price || item.preco || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Items */}
          <div className="w-1/2 p-6 overflow-y-auto">
            <h3 className="font-bold text-gray-900 mb-4">Selected Items</h3>

            <div className="space-y-3">
              {selectedItems.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-gray-900">
                      {item.nome}
                    </span>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => updateQuantity(index, item.quantidade - 1)}
                      className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 bg-white border rounded">
                      {item.quantidade}
                    </span>
                    <button
                      onClick={() => updateQuantity(index, item.quantidade + 1)}
                      className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                    >
                      +
                    </button>
                    <span className="ml-auto font-bold">
                      €{(item.preco * item.quantidade).toFixed(2)}
                    </span>
                  </div>

                  <input
                    type="text"
                    placeholder="Notes..."
                    value={item.notas || ""}
                    onChange={(e) =>
                      setSelectedItems((prev) =>
                        prev.map((prevItem, i) =>
                          i === index
                            ? { ...prevItem, notas: e.target.value }
                            : prevItem
                        )
                      )
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>

            {selectedItems.length === 0 && (
              <p className="text-gray-500 text-center mt-8">
                No items selected
              </p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-gray-900">
              Total: €{total.toFixed(2)}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={selectedItems.length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg"
              >
                Create Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RestaurantTabsLayout: React.FC<RestaurantTabsLayoutProps> = ({
  user,
  onTableSelect,
}) => {
  const [activeTab, setActiveTab] = useState<"view" | "edit">("view");
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManager] = useState(
    () => user?.labels?.includes("manager") || false
  );

  // Edit mode states
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasChanges, setHasChanges] = useState(false);

  // Order modal states
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderTableNumbers, setOrderTableNumbers] = useState<number[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Calculate canvas dimensions
  const canvasDimensions = useMemo(() => {
    if (tables.length === 0) {
      return { width: 800, height: 600, scale: 1, offsetX: 0, offsetY: 0 };
    }

    // Find bounds of all tables
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    tables.forEach((table) => {
      minX = Math.min(minX, table.x);
      maxX = Math.max(maxX, table.x + table.width);
      minY = Math.min(minY, table.y);
      maxY = Math.max(maxY, table.y + table.height);
    });

    const padding = 100;
    const width = Math.max(800, maxX - minX + padding * 2);
    const height = Math.max(600, maxY - minY + padding * 2);

    return {
      width,
      height,
      scale: 1,
      offsetX: padding - minX,
      offsetY: padding - minY,
    };
  }, [tables]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tables
        const tablesRes = await databases.listDocuments(
          DATABASE_ID,
          TABLES_COLLECTION_ID,
          [Query.limit(100)]
        );
        const tablesData = tablesRes.documents.map((doc) => ({
          id: doc.$id,
          x: doc.posX,
          y: doc.posY,
          width: doc.width,
          height: doc.height,
          chairs: doc.chairs,
          rotation: doc.rotation,
          tableNumber: doc.tableNumber,
          shape: doc.shape as "rectangle" | "circle",
          status: "free" as const,
          chairSides: {
            top: doc.chairTop ?? true,
            right: doc.chairRight ?? true,
            bottom: doc.chairBottom ?? true,
            left: doc.chairLeft ?? true,
          },
        }));

        // Fetch orders to determine table status
        const ordersRes = await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          [Query.equal("paid", false), Query.limit(100)]
        );
        const ordersData = ordersRes.documents as unknown as Order[];

        // Fetch menu items
        const menuRes = await databases.listDocuments(
          DATABASE_ID,
          MENU_COLLECTION_ID,
          [Query.limit(100)]
        );
        const menuData = menuRes.documents as unknown as MenuItem[];

        // Update table status based on orders
        const updatedTables = tablesData.map((table) => ({
          ...table,
          status: ordersData.some((order) =>
            order.numeroMesa.includes(table.tableNumber)
          )
            ? ("occupied" as const)
            : ("free" as const),
        }));

        setTables(updatedTables);
        setOrders(ordersData);
        setMenuItems(menuData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Enhanced mouse event handlers for smooth dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tableId: string) => {
      if (activeTab !== "edit") return;

      e.preventDefault();
      e.stopPropagation();
      setSelectedTable(tableId);
      setIsDragging(true);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const table = tables.find((t) => t.id === tableId);
      if (!table) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setDragOffset({
        x: mouseX - (table.x + canvasDimensions.offsetX),
        y: mouseY - (table.y + canvasDimensions.offsetY),
      });

      dragStartPos.current = { x: mouseX, y: mouseY };

      // Add global mouse events for better dragging experience
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    },
    [activeTab, tables, canvasDimensions]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!isDragging || !selectedTable || activeTab !== "edit") return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate new position with bounds checking
      const table = tables.find((t) => t.id === selectedTable);
      if (!table) return;

      const maxX =
        canvasDimensions.width - canvasDimensions.offsetX - table.width;
      const maxY =
        canvasDimensions.height - canvasDimensions.offsetY - table.height;

      const newX = Math.max(
        0,
        Math.min(maxX, mouseX - dragOffset.x - canvasDimensions.offsetX)
      );
      const newY = Math.max(
        0,
        Math.min(maxY, mouseY - dragOffset.y - canvasDimensions.offsetY)
      );

      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTable ? { ...t, x: newX, y: newY } : t
        )
      );

      setHasChanges(true);
    },
    [isDragging, selectedTable, activeTab, dragOffset, canvasDimensions, tables]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  // Global mouse events for better dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Enhanced table creation with better positioning
  const createTable = useCallback(() => {
    // Find a good position for the new table (avoid overlaps)
    let x = 100;
    let y = 100;
    const tableSize = 80;
    const spacing = 20;

    // Simple grid placement to avoid overlaps
    const gridSize = tableSize + spacing;
    let placed = false;

    for (let row = 0; row < 10 && !placed; row++) {
      for (let col = 0; col < 10 && !placed; col++) {
        const testX = col * gridSize + 50;
        const testY = row * gridSize + 50;

        // Check if position is free
        const overlaps = tables.some((table) => {
          const dx = Math.abs(table.x - testX);
          const dy = Math.abs(table.y - testY);
          return dx < tableSize && dy < tableSize;
        });

        if (!overlaps) {
          x = testX;
          y = testY;
          placed = true;
        }
      }
    }

    const newTable: Table = {
      id: `temp-${Date.now()}`,
      x,
      y,
      width: tableSize,
      height: tableSize,
      chairs: 4,
      rotation: 0,
      tableNumber: Math.max(...tables.map((t) => t.tableNumber), 0) + 1,
      shape: "rectangle",
      status: "free",
      chairSides: { top: true, right: true, bottom: true, left: true },
    };

    setTables((prev) => [...prev, newTable]);
    setSelectedTable(newTable.id);
    setHasChanges(true);
  }, [tables]);

  // Table deletion function
  const deleteTable = useCallback(async (tableId: string) => {
    if (!confirm("Are you sure you want to delete this table?")) return;

    try {
      if (!tableId.startsWith("temp-")) {
        await databases.deleteDocument(
          DATABASE_ID,
          TABLES_COLLECTION_ID,
          tableId
        );
      }
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      setSelectedTable(null);
      setHasChanges(true);
    } catch (error) {
      console.error("Error deleting table:", error);
    }
  }, []);

  // Enhanced save changes with proper ID handling
  const saveChanges = useCallback(async () => {
    if (!hasChanges) return;

    try {
      const savePromises = [];

      for (const table of tables) {
        const tableData = {
          posX: table.x,
          posY: table.y,
          width: table.width,
          height: table.height,
          chairs: table.chairs,
          rotation: table.rotation,
          tableNumber: table.tableNumber,
          shape: table.shape,
          chairTop: table.chairSides.top,
          chairRight: table.chairSides.right,
          chairBottom: table.chairSides.bottom,
          chairLeft: table.chairSides.left,
        };

        if (table.id.startsWith("temp-")) {
          // Create new table
          savePromises.push(
            databases
              .createDocument(
                DATABASE_ID,
                TABLES_COLLECTION_ID,
                "unique()",
                tableData
              )
              .then((newDoc) => ({
                oldId: table.id,
                newId: newDoc.$id,
              }))
          );
        } else {
          // Update existing table
          savePromises.push(
            databases.updateDocument(
              DATABASE_ID,
              TABLES_COLLECTION_ID,
              table.id,
              tableData
            )
          );
        }
      }

      const results = await Promise.all(savePromises);

      // Update IDs for newly created tables
      setTables((prev) =>
        prev.map((table) => {
          const result = results.find((r) => r && r.oldId === table.id);
          return result ? { ...table, id: result.newId } : table;
        })
      );

      setHasChanges(false);
      alert("Layout saved successfully!");
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Error saving changes. Please try again.");
    }
  }, [tables, hasChanges]);

  // Table update functions
  const updateTable = useCallback(
    (tableId: string, updates: Partial<Table>) => {
      setTables((prev) =>
        prev.map((table) =>
          table.id === tableId ? { ...table, ...updates } : table
        )
      );
      setHasChanges(true);
    },
    []
  );

  const rotateTable = useCallback(
    (tableId: string) => {
      updateTable(tableId, {
        rotation:
          tables.find((t) => t.id === tableId)?.rotation === 270
            ? 0
            : (tables.find((t) => t.id === tableId)?.rotation || 0) + 90,
      });
    },
    [tables, updateTable]
  );

  // Order management
  const openOrderModal = useCallback((tableNumbers: number[]) => {
    setOrderTableNumbers(tableNumbers);
    setShowOrderModal(true);
  }, []);

  const createOrder = useCallback(
    async (items: any[], tableNumbers: number[]) => {
      try {
        const total = items.reduce(
          (sum, item) => sum + item.preco * item.quantidade,
          0
        );

        const orderData = {
          numeroMesa: tableNumbers,
          itens: items.map((item) => JSON.stringify(item)),
          total,
          paid: false,
          status: "pendente",
          criadoEm: new Date().toISOString(),
          staffID: user?.$id || "unknown",
        };

        await databases.createDocument(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          "unique()",
          orderData
        );

        // Update table status
        setTables((prev) =>
          prev.map((table) =>
            tableNumbers.includes(table.tableNumber)
              ? { ...table, status: "occupied" as const }
              : table
          )
        );

        alert("Order created successfully!");
      } catch (error) {
        console.error("Error creating order:", error);
        alert("Error creating order. Please try again.");
      }
    },
    [user]
  );

  // Get orders for a specific table
  const getTableOrders = useCallback(
    (tableNumber: number) => {
      return orders.filter((order) => order.numeroMesa.includes(tableNumber));
    },
    [orders]
  );

  // Render table component
  const renderTable = useCallback(
    (table: Table) => {
      const isSelected = selectedTable === table.id;
      const isEditMode = activeTab === "edit";
      const tableOrders = getTableOrders(table.tableNumber);
      const tableTotal = tableOrders.reduce(
        (sum, order) => sum + (order.total || 0),
        0
      );

      return (
        <div
          key={table.id}
          className={`absolute cursor-pointer transition-all duration-200 ${
            isEditMode ? "hover:scale-105" : ""
          } ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
          style={{
            left: table.x + canvasDimensions.offsetX,
            top: table.y + canvasDimensions.offsetY,
            width: table.width,
            height: table.height,
            transform: `rotate(${table.rotation}deg)`,
            transformOrigin: "center",
          }}
          onMouseDown={(e) => handleMouseDown(e, table.id)}
          onClick={(e) => {
            e.stopPropagation();
            if (activeTab === "view") {
              if (onTableSelect) {
                onTableSelect(table.tableNumber);
              } else if (table.status === "free") {
                openOrderModal([table.tableNumber]);
              }
            } else if (activeTab === "edit") {
              setSelectedTable(table.id);
            }
          }}
        >
          {/* Table */}
          <div
            className={`w-full h-full border-2 flex flex-col items-center justify-center font-bold text-lg shadow-lg transition-colors ${
              table.status === "occupied"
                ? "bg-red-100 border-red-400 text-red-700"
                : table.status === "reserved"
                ? "bg-yellow-100 border-yellow-400 text-yellow-700"
                : "bg-green-100 border-green-400 text-green-700"
            }`}
            style={{
              borderRadius: table.shape === "circle" ? "50%" : "8px",
            }}
          >
            <span className="text-xl font-bold">{table.tableNumber}</span>
            {activeTab === "view" && tableTotal > 0 && (
              <span className="text-xs font-medium bg-white bg-opacity-80 px-2 py-1 rounded mt-1">
                €{tableTotal.toFixed(2)}
              </span>
            )}
          </div>

          {/* Status indicator */}
          {activeTab === "view" && (
            <div
              className={`absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-white ${
                table.status === "occupied"
                  ? "bg-red-500"
                  : table.status === "reserved"
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
            />
          )}

          {/* Edit controls */}
          {isEditMode && isSelected && (
            <div className="absolute -top-8 left-0 flex gap-1 bg-white rounded-lg shadow-lg p-1 border">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  rotateTable(table.id);
                }}
                className="p-1 hover:bg-gray-100 rounded text-blue-600"
                title="Rotate"
              >
                <RotateCw size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTable(table.id);
                }}
                className="p-1 hover:bg-gray-100 rounded text-red-600"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      );
    },
    [
      selectedTable,
      activeTab,
      canvasDimensions,
      handleMouseDown,
      onTableSelect,
      rotateTable,
      deleteTable,
      getTableOrders,
      openOrderModal,
    ]
  );

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading restaurant layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* Order Modal */}
      <OrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        tableNumbers={orderTableNumbers}
        menuItems={menuItems}
        onCreateOrder={createOrder}
      />

      {/* Header with tabs */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab("view")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "view"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Eye className="inline-block w-4 h-4 mr-2" />
              Restaurant View
            </button>
            {isManager && (
              <button
                onClick={() => setActiveTab("edit")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "edit"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Edit className="inline-block w-4 h-4 mr-2" />
                Edit Layout
              </button>
            )}
          </div>

          {/* Edit mode controls */}
          {activeTab === "edit" && isManager && (
            <div className="flex items-center space-x-2">
              <button
                onClick={createTable}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="inline-block w-4 h-4 mr-2" />
                Add Table
              </button>
              {hasChanges && (
                <button
                  onClick={saveChanges}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="inline-block w-4 h-4 mr-2" />
                  Save Changes
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "view" ? (
          /* View Mode */
          <div className="w-full h-full flex items-center justify-center p-8">
            <div
              className="bg-white rounded-lg shadow-lg border border-gray-200 relative overflow-hidden"
              style={{
                width: canvasDimensions.width,
                height: canvasDimensions.height,
                backgroundImage: `
                  linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            >
              {tables.map(renderTable)}

              {/* Empty state */}
              {tables.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Grid className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No tables in layout</p>
                    <p className="text-sm">Switch to edit mode to add tables</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Edit Mode */
          <div className="w-full h-full flex">
            {/* Canvas */}
            <div className="flex-1 flex items-center justify-center p-8">
              <div
                ref={canvasRef}
                className="bg-white rounded-lg shadow-lg border border-gray-200 relative overflow-hidden cursor-crosshair"
                style={{
                  width: canvasDimensions.width,
                  height: canvasDimensions.height,
                  backgroundImage: `
                    linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: "20px 20px",
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={() => setSelectedTable(null)}
              >
                {tables.map(renderTable)}

                {/* Edit instructions */}
                {tables.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Move className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">
                        Click "Add Table" to start
                      </p>
                      <p className="text-sm">
                        Drag tables to move, click to select
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Properties panel */}
            {selectedTable && (
              <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">Table Properties</h3>
                {(() => {
                  const table = tables.find((t) => t.id === selectedTable);
                  if (!table) return null;

                  return (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Table Number
                        </label>
                        <input
                          type="number"
                          value={table.tableNumber}
                          onChange={(e) =>
                            updateTable(table.id, {
                              tableNumber: parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="1"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Shape
                        </label>
                        <div className="flex space-x-2">
                          <button
                            onClick={() =>
                              updateTable(table.id, { shape: "rectangle" })
                            }
                            className={`flex-1 p-2 border rounded-md flex items-center justify-center ${
                              table.shape === "rectangle"
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-gray-300"
                            }`}
                          >
                            <Square className="w-4 h-4 mr-1" />
                            Rectangle
                          </button>
                          <button
                            onClick={() =>
                              updateTable(table.id, { shape: "circle" })
                            }
                            className={`flex-1 p-2 border rounded-md flex items-center justify-center ${
                              table.shape === "circle"
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-gray-300"
                            }`}
                          >
                            <Circle className="w-4 h-4 mr-1" />
                            Circle
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Width
                          </label>
                          <input
                            type="number"
                            value={table.width}
                            onChange={(e) =>
                              updateTable(table.id, {
                                width: parseInt(e.target.value) || 80,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="40"
                            max="200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Height
                          </label>
                          <input
                            type="number"
                            value={table.height}
                            onChange={(e) =>
                              updateTable(table.id, {
                                height: parseInt(e.target.value) || 80,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="40"
                            max="200"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Chairs: {table.chairs}
                        </label>
                        <input
                          type="range"
                          value={table.chairs}
                          onChange={(e) =>
                            updateTable(table.id, {
                              chairs: parseInt(e.target.value),
                            })
                          }
                          className="w-full"
                          min="2"
                          max="12"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rotation: {table.rotation}°
                        </label>
                        <input
                          type="range"
                          value={table.rotation}
                          onChange={(e) =>
                            updateTable(table.id, {
                              rotation: parseInt(e.target.value),
                            })
                          }
                          className="w-full"
                          min="0"
                          max="360"
                          step="15"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Chair Placement
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(table.chairSides).map(
                            ([side, enabled]) => (
                              <label key={side} className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={(e) =>
                                    updateTable(table.id, {
                                      chairSides: {
                                        ...table.chairSides,
                                        [side]: e.target.checked,
                                      },
                                    })
                                  }
                                  className="mr-2"
                                />
                                <span className="text-sm capitalize">
                                  {side}
                                </span>
                              </label>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-6">
            <span>
              Total Tables: <strong>{tables.length}</strong>
            </span>
            <span>
              Available:{" "}
              <strong className="text-green-600">
                {tables.filter((t) => t.status === "free").length}
              </strong>
            </span>
            <span>
              Occupied:{" "}
              <strong className="text-red-600">
                {tables.filter((t) => t.status === "occupied").length}
              </strong>
            </span>
            {activeTab === "view" && (
              <span>
                Revenue:{" "}
                <strong className="text-blue-600">
                  €
                  {orders
                    .reduce((sum, order) => sum + (order.total || 0), 0)
                    .toFixed(2)}
                </strong>
              </span>
            )}
          </div>
          {hasChanges && (
            <span className="text-amber-600 font-medium">
              ● Unsaved changes
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestaurantTabsLayout;
