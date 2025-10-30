"use client";

import type React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Save,
  X,
  Eye,
  Edit,
  Square,
  Circle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Plus,
  Menu,
  ZoomIn,
  ZoomOut,
  Minimize2,
  Loader2,
  Copy,
  UtensilsCrossed,
  CheckCircle,
  MessageSquare,
} from "lucide-react";
import {
  tableLayouts,
  tables,
  orders as ordersApi,
  getAuthToken,
} from "../../lib/api";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import { throttle } from "../../lib/throttle";
import NumberFlow from '@number-flow/react';
import "./TableLayout.css";

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Types
interface Chair {
  id: string;
  position: "top" | "bottom" | "left" | "right";
  angle: number;
}

interface Table {
  id: string;
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "round" | "square";
  chairs: Chair[];
  chairsConfig: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
  status?: "available" | "occupied" | "reserved";
  groupColor?: string; // For multi-table orders
  orderIds?: string[]; // Track which orders this table belongs to
}

interface Layout {
  id: string;
  name: string;
  width: number;
  height: number;
  tables: Table[];
}

interface TableLayoutManagerProps {
  user?: any;
  onOrderCreate?: (tableNumbers: number[]) => void;
}

// Hardcoded layouts for demo
const INITIAL_LAYOUTS: Layout[] = [];

// Helper function to generate chairs from database data
const generateChairsFromData = (tableData: any): Chair[] => {
  const chairs: Chair[] = [];
  const chairsConfig = {
    top: tableData.chairsTop || tableData.chairs_top || false,
    bottom: tableData.chairsBottom || tableData.chairs_bottom || false,
    left: tableData.chairsLeft || tableData.chairs_left || false,
    right: tableData.chairsRight || tableData.chairs_right || false,
  };

  const activeSides = [
    chairsConfig.top && "top",
    chairsConfig.bottom && "bottom",
    chairsConfig.left && "left",
    chairsConfig.right && "right",
  ].filter(Boolean) as Array<"top" | "bottom" | "left" | "right">;

  if (
    activeSides.length === 0 ||
    !(tableData.chairsCount || tableData.chairs_count)
  )
    return [];

  const count = tableData.chairsCount || tableData.chairs_count;
  const baseChairsPerSide = Math.floor(count / activeSides.length);
  const remainingChairs = count % activeSides.length;

  activeSides.forEach((side, sideIndex) => {
    const sideChairCount =
      baseChairsPerSide + (sideIndex < remainingChairs ? 1 : 0);

    for (let i = 0; i < sideChairCount; i++) {
      chairs.push({
        id: `chair-${chairs.length}`,
        position: side,
        angle:
          side === "top"
            ? 0
            : side === "right"
            ? 90
            : side === "bottom"
            ? 180
            : 270,
      });
    }
  });

  return chairs;
};

// Helper function to convert database table to component format
const convertDbTableToComponent = (dbTable: any): Table => {
  return {
    id: dbTable.id.toString(),
    number: dbTable.tableNumber || dbTable.table_number, // Support both camelCase and snake_case
    x: dbTable.x,
    y: dbTable.y,
    width: dbTable.width,
    height: dbTable.height,
    shape: dbTable.shape as "round" | "square",
    chairs: generateChairsFromData(dbTable),
    chairsConfig: {
      top: dbTable.chairsTop || dbTable.chairs_top || false,
      bottom: dbTable.chairsBottom || dbTable.chairs_bottom || false,
      left: dbTable.chairsLeft || dbTable.chairs_left || false,
      right: dbTable.chairsRight || dbTable.chairs_right || false,
    },
  };
};

// Helper function to convert database layout to component format
const convertDbLayoutToComponent = (dbLayout: any): Layout => {
  return {
    id: dbLayout.id.toString(),
    name: dbLayout.name,
    width: dbLayout.width,
    height: dbLayout.height,
    tables: dbLayout.tables
      ? dbLayout.tables.map(convertDbTableToComponent)
      : [],
  };
};

const TableLayoutManager: React.FC<TableLayoutManagerProps> = ({
  user,
  onOrderCreate,
}) => {
  const router = useRouter();
  const { socket, connected } = useWebSocketContext();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [currentLayoutIndex, setCurrentLayoutIndex] = useState(0);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedTables, setSelectedTables] = useState<string[]>([]); // Changed to store table IDs instead of numbers
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "addTable"
  );
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ordersData, setOrdersData] = useState<any[]>([]);
  const [tableStatuses, setTableStatuses] = useState<
    Record<
      string,
      {
        status: "available" | "occupied" | "reserved";
        groupColor?: string;
        orderIds?: string[];
      }
    >
  >({});
  const [allTables, setAllTables] = useState<any[]>([]); // All tables from all layouts for order lookup
  const [selectedTableOrders, setSelectedTableOrders] = useState<any[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load menu items
  const loadMenuItems = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/menu`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setMenuItems(data.documents || []);
      }
    } catch (error) {
      console.error("Error loading menu items:", error);
    }
  };

  // Load layouts from API on component mount
  useEffect(() => {
    loadLayouts();
    loadAllTablesAndOrders();
    loadMenuItems();
  }, []);

  // Refresh orders when switching to view mode OR when layout changes
  useEffect(() => {
    if (mode === "view" && layouts.length > 0) {
      loadAllTablesAndOrders();
    }
  }, [mode, currentLayoutIndex]);

  // Recalculate statuses when layout changes
  useEffect(() => {
    const layout = layouts[currentLayoutIndex];
    if (layout && allTables.length > 0) {
      console.log("=== LAYOUT CHANGED - RECALCULATING STATUSES ===");
      console.log("New layout ID:", layout.id);
      calculateTableStatuses(allTables, ordersData, layout.id);
    }
  }, [currentLayoutIndex, layouts, allTables, ordersData]);

  // Generate group colors for multi-table orders
  const generateGroupColors = (orderCount: number): string[] => {
    const colors = [
      "#8B5CF6", // Purple
      "#06B6D4", // Cyan
      "#10B981", // Emerald
      "#F59E0B", // Amber
      "#EF4444", // Red
      "#3B82F6", // Blue
      "#F97316", // Orange
      "#84CC16", // Lime
      "#EC4899", // Pink
      "#6366F1", // Indigo
    ];

    // Repeat colors if we have more orders than colors
    return Array.from(
      { length: orderCount },
      (_, i) => colors[i % colors.length]
    );
  };

  // Load all tables and orders to determine statuses
  const loadAllTablesAndOrders = async () => {
    try {
      // Get all tables from all layouts
      const allTablesResponse = await tables.list();
      const allTablesData = allTablesResponse.documents || [];
      setAllTables(allTablesData);

      // Get all orders
      const ordersResponse = await ordersApi.list();
      const ordersData = ordersResponse.documents || [];
      setOrdersData(ordersData);

      console.log("=== LOADING TABLES AND ORDERS ===");
      const layout = layouts[currentLayoutIndex];
      console.log("Current layout when loading:", layout?.id);
      console.log("All tables fetched:", allTablesData.length);
      console.log("All orders fetched:", ordersData.length);

      // Calculate table statuses with layout ID
      if (layout) {
        calculateTableStatuses(allTablesData, ordersData, layout.id);
      }
    } catch (error) {
      console.error("Error loading tables and orders:", error);
    }
  };

  // Calculate table statuses based on orders
  const calculateTableStatuses = (
    allTablesData: any[],
    ordersData: any[],
    layoutId: string
  ) => {
    const statuses: Record<
      string,
      {
        status: "available" | "occupied" | "reserved";
        groupColor?: string;
        orderIds?: string[];
      }
    > = {};

    // Get the current layout name from the layouts array
    const currentLayout = layouts.find((l) => l.id === layoutId);
    const layoutName = currentLayout?.name;

    console.log("=== DEBUG TABLE FILTERING ===");
    console.log("Looking for layout ID:", layoutId, "Layout Name:", layoutName);

    // Check each table's layout_name
    allTablesData.forEach((table, index) => {
      if (index < 3) {
        console.log(`Table ${index} RAW DATA:`, table);
        console.log(`Table ${index} PROCESSED:`, {
          id: table.$id || table.id,
          tableNumber: table.tableNumber,
          layout_name: table.layout_name,
          matches: table.layout_name === layoutName,
        });
      }
    });

    // Filter tables by layout_name instead of layout_id
    const currentLayoutTables = allTablesData.filter(
      (table) => table.layout_name === layoutName
    );

    currentLayoutTables.forEach((table) => {
      const tableId = table.$id || table.id;
      if (tableId) {
        statuses[tableId] = { status: "available" };
      }
    });

    console.log("Filtering for layout name:", layoutName);
    console.log("Tables in current layout:", currentLayoutTables.length);
    console.log("Total tables in system:", allTablesData.length);

    // Group orders by their table combinations
    const orderGroups: Record<string, any[]> = {};

    ordersData.forEach((order) => {
      if (order.table_id && Array.isArray(order.table_id)) {
        // Filter out table IDs that don't belong to current layout
        const tablesInCurrentLayout = order.table_id.filter(
          (tableId: string) => {
            const table = allTablesData.find(
              (t) => (t.$id || t.id) === tableId
            );
            return table && table.layout_name === layoutName;
          }
        );

        // Only add to order groups if at least one table is in current layout
        if (tablesInCurrentLayout.length > 0) {
          // Sort table IDs to create consistent group keys
          const sortedTableIds = [...tablesInCurrentLayout].sort();
          const groupKey = sortedTableIds.join(",");

          if (!orderGroups[groupKey]) {
            orderGroups[groupKey] = [];
          }
          orderGroups[groupKey].push(order);
        }
      }
    });

    // Generate colors for multi-table groups
    const groupKeys = Object.keys(orderGroups);
    const multiTableGroups = groupKeys.filter((key) => key.includes(","));
    const groupColors = generateGroupColors(multiTableGroups.length);

    // Apply statuses and colors
    groupKeys.forEach((groupKey, groupIndex) => {
      const groupOrders = orderGroups[groupKey];
      const tableIds = groupKey.split(",");
      const isMultiTable = tableIds.length > 1;

      // Only assign group colors to multi-table orders
      const groupColor = isMultiTable
        ? groupColors[multiTableGroups.indexOf(groupKey)]
        : undefined;

      tableIds.forEach((tableId) => {
        // Only update if this table exists in our statuses (it was found in allTablesData)
        if (statuses[tableId]) {
          statuses[tableId] = {
            status: "occupied",
            groupColor: groupColor, // Will be undefined for single tables
            orderIds: groupOrders.map((order) => order.id || order.$id),
          };
        }
      });
    });

    console.log("Calculated table statuses:", statuses);
    console.log("Orders data count:", ordersData.length);
    console.log("Multi-table groups:", multiTableGroups.length);
    setTableStatuses(statuses);
  };

  // Mock table statuses - in a real app, this would come from orders API
  const getTableStatus = (
    tableId: string
  ): "available" | "occupied" | "reserved" => {
    if (mode === "edit") {
      // In edit mode, all tables appear available (no status colors)
      return "available";
    }

    // Get status by table ID
    if (tableStatuses[tableId]) {
      return tableStatuses[tableId].status;
    }

    return "available";
  };

  // Get table group color for multi-table orders
  const getTableGroupColor = (tableId: string): string | undefined => {
    if (mode === "edit") {
      // No group colors in edit mode
      return undefined;
    }

    // Get group color by table ID
    if (tableStatuses[tableId]) {
      return tableStatuses[tableId].groupColor;
    }

    return undefined;
  };

  // Handle table selection for orders
  const handleTableSelection = (tableNumber: number, tableId: string) => {
    if (mode === "edit") return; // Don't handle selection in edit mode

    const status = getTableStatus(tableId);
    if (status !== "available") return; // Only allow selection of available tables

    setSelectedTables((prev) => {
      if (prev.includes(tableId)) {
        return prev.filter((id) => id !== tableId);
      } else {
        return [...prev, tableId];
      }
    });
  };

  // Create order with selected tables
  const handleCreateOrder = () => {
    if (selectedTables.length === 0) return;

    // selectedTables now contains table IDs
    const tablesParam = selectedTables.join(",");
    router.push(`/order/${tablesParam}`);

    // Clear selection after order creation
    setSelectedTables([]);
  };

  const loadLayouts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const dbLayouts = await tableLayouts.list();
      const convertedLayouts = dbLayouts.map(convertDbLayoutToComponent);

      setLayouts(convertedLayouts);
      setCurrentLayoutIndex(0);
    } catch (error) {
      console.error("Error loading layouts:", error);
      setError("Erro ao carregar layouts");
      // Fallback to empty state
      setLayouts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      setZoom(0.5);
    }
  }, []);

  // WebSocket Real-Time Updates
  useEffect(() => {
    if (!socket || !connected) return;

    console.log("🔌 TableLayout: Setting up WebSocket listeners");

    // Subscribe to layout-specific events if in view mode
    const layout = layouts[currentLayoutIndex];
    if (layout?.id && mode === "view") {
      console.log(`📡 Subscribing to layout: ${layout.id}`);
      socket.emit("subscribe:layout", layout.id);
    }

    // Order events - refresh table statuses
    const handleOrderCreated = (order: any) => {
      console.log("📦 Order created via WebSocket:", order);
      loadAllTablesAndOrders();
    };

    const handleOrderUpdated = (order: any) => {
      console.log("📝 Order updated via WebSocket:", order);
      loadAllTablesAndOrders();

      // Update selectedTableOrders if modal is open and this order belongs to the selected table
      if (showOrderModal) {
        setSelectedTableOrders((prev) => {
          const orderExists = prev.some(
            (o) => (o.id || o.$id) === (order.id || order.$id)
          );
          if (orderExists) {
            return prev.map((o) =>
              (o.id || o.$id) === (order.id || order.$id) ? order : o
            );
          }
          return prev;
        });
      }
    };

    const handleOrderDeleted = (data: any) => {
      console.log("🗑️ Order deleted via WebSocket:", data);
      loadAllTablesAndOrders();

      // Update selectedTableOrders if modal is open
      if (showOrderModal) {
        const deletedOrderId = data.id || data.$id;
        setSelectedTableOrders((prev) =>
          prev.filter((o) => (o.id || o.$id) !== deletedOrderId)
        );
      }
    };

    // Table events - refresh layouts
    const handleTableCreated = (table: any) => {
      console.log("🪑 Table created via WebSocket:", table);
      // Only refresh if it belongs to current layout
      if (layout && table.layout_id === layout.id) {
        loadLayouts();
        loadAllTablesAndOrders();
      }
    };

    const handleTableUpdated = (table) => {
      console.log("✏️ Table updated via WebSocket:", table);
      // Update allTables state directly
      setAllTables((prev) =>
        prev.map((t) =>
          t.id === table.id || t.$id === table.id ? { ...t, ...table } : t
        )
      );
      // Optionally update layouts if table properties affect layout
      setLayouts((prev) =>
        prev.map((layout) =>
          layout.id === table.layout_id
            ? {
                ...layout,
                tables: layout.tables.map((t) =>
                  t.id === table.id ? { ...t, ...table } : t
                ),
              }
            : layout
        )
      );
      // Optionally recalculate statuses if needed
      calculateTableStatuses(
        allTables.map((t) => (t.id === table.id ? { ...t, ...table } : t)),
        ordersData,
        layouts[currentLayoutIndex]?.id
      );
    };

    const handleTableDeleted = (data: any) => {
      console.log("🗑️ Table deleted via WebSocket:", data);
      loadLayouts();
      loadAllTablesAndOrders();
    };

    // Layout events
    const handleLayoutCreated = (layout: any) => {
      console.log("🏢 Layout created via WebSocket:", layout);
      loadLayouts();
    };

    const handleLayoutUpdated = (layout: any) => {
      console.log("🏢 Layout updated via WebSocket:", layout);
      if (layout.id === layouts[currentLayoutIndex]?.id) {
        loadLayouts();
      }
    };

    const handleLayoutDeleted = (data: any) => {
      console.log("🗑️ Layout deleted via WebSocket:", data);
      loadLayouts();
    };

    // Register all event listeners
    socket.on("order:created", handleOrderCreated);
    socket.on("order:updated", handleOrderUpdated);
    socket.on("order:deleted", handleOrderDeleted);
    socket.on("table:created", handleTableCreated);
    socket.on("table:updated", handleTableUpdated);
    socket.on("table:deleted", handleTableDeleted);
    socket.on("layout:created", handleLayoutCreated);
    socket.on("layout:updated", handleLayoutUpdated);
    socket.on("layout:deleted", handleLayoutDeleted);

    // Cleanup function
    return () => {
      console.log("🔌 TableLayout: Cleaning up WebSocket listeners");

      // Unsubscribe from layout
      if (layout?.id && mode === "view") {
        console.log(`📡 Unsubscribing from layout: ${layout.id}`);
        socket.emit("unsubscribe:layout", layout.id);
      }

      // Remove all event listeners
      socket.off("order:created", handleOrderCreated);
      socket.off("order:updated", handleOrderUpdated);
      socket.off("order:deleted", handleOrderDeleted);
      socket.off("table:created", handleTableCreated);
      socket.off("table:updated", handleTableUpdated);
      socket.off("table:deleted", handleTableDeleted);
      socket.off("layout:created", handleLayoutCreated);
      socket.off("layout:updated", handleLayoutUpdated);
      socket.off("layout:deleted", handleLayoutDeleted);
    };
  }, [socket, connected, currentLayoutIndex, layouts, mode]);

  // Reset state when leaving edit mode
  useEffect(() => {
    if (mode === "view") {
      setIsSidebarOpen(false);
      setSelectedTable(null);
      setExpandedSection(null);
      // Discard all unsaved changes when leaving edit mode
      if (hasUnsavedChanges) {
        handleDiscard();
      }
    } else if (mode === "edit") {
      setIsSidebarOpen(true);
      setExpandedSection("addTable");
    }
  }, [mode]);

  const currentLayout = layouts[currentLayoutIndex];

  // Safety check for currentLayout
  if (!isLoading && !currentLayout && layouts.length > 0) {
    setCurrentLayoutIndex(0);
    return null;
  }

  const getMaxChairs = (table: Table): number => {
    if (table.shape === "round") {
      const circumference = Math.PI * Math.max(table.width, table.height);
      return Math.floor(circumference / 25); // 25px per chair spacing
    } else {
      const perimeter = 2 * (table.width + table.height);
      return Math.floor(perimeter / 25);
    }
  };

  const generateChairs = (table: Table, count: number): Chair[] => {
    const chairs: Chair[] = [];
    const { chairsConfig } = table;
    const activeSides = [
      chairsConfig.top && "top",
      chairsConfig.bottom && "bottom",
      chairsConfig.left && "left",
      chairsConfig.right && "right",
    ].filter(Boolean) as Array<"top" | "bottom" | "left" | "right">;

    if (activeSides.length === 0) return [];

    const baseChairsPerSide = Math.floor(count / activeSides.length);
    const remainingChairs = count % activeSides.length;

    activeSides.forEach((side, sideIndex) => {
      const sideChairCount =
        baseChairsPerSide + (sideIndex < remainingChairs ? 1 : 0);

      for (let i = 0; i < sideChairCount; i++) {
        chairs.push({
          id: `chair-${chairs.length}`,
          position: side,
          angle:
            side === "top"
              ? 0
              : side === "right"
              ? 90
              : side === "bottom"
              ? 180
              : 270,
        });
      }
    });

    return chairs;
  };

  const updateTable = useCallback(
    (tableId: string, updates: Partial<Table>) => {
      // Update local state only - API calls happen on save
      setLayouts((prev) =>
        prev.map((layout, idx) =>
          idx === currentLayoutIndex
            ? {
                ...layout,
                tables: layout.tables.map((table) =>
                  table.id === tableId
                    ? {
                        ...table,
                        ...updates,
                        chairs:
                          updates.chairs !== undefined
                            ? updates.chairs
                            : table.chairs,
                      }
                    : table
                ),
              }
            : layout
        )
      );
      setHasUnsavedChanges(true);
    },
    [currentLayoutIndex]
  );

  const addTable = (shape: "round" | "square") => {
    if (!currentLayout) return;

    const defaultChairCount = 4;
    const newTable: Table = {
      id: `temp_${Date.now()}`, // Temporary ID for new tables
      number: getNextAvailableTableNumber(),
      x: 50,
      y: 50,
      width: shape === "round" ? 80 : 100,
      height: shape === "round" ? 80 : 60,
      shape,
      chairs: [],
      chairsConfig: { top: true, bottom: true, left: true, right: true },
    };

    // Generate chairs for the new table
    const tempTable = { ...newTable };
    newTable.chairs = generateChairs(tempTable, defaultChairCount);

    setLayouts((prev) =>
      prev.map((layout, idx) =>
        idx === currentLayoutIndex
          ? { ...layout, tables: [...layout.tables, newTable] }
          : layout
      )
    );
    setSelectedTable(newTable.id);
    setHasUnsavedChanges(true);
  };

  const deleteTable = (tableId: string) => {
    setLayouts((prev) =>
      prev.map((layout, idx) =>
        idx === currentLayoutIndex
          ? {
              ...layout,
              tables: layout.tables.filter((t) => t.id !== tableId),
            }
          : layout
      )
    );
    if (selectedTable === tableId) {
      setSelectedTable(null);
    }
    setHasUnsavedChanges(true);
  };

  const duplicateTable = (tableId: string) => {
    if (!currentLayout) return;

    const originalTable = currentLayout.tables.find((t) => t.id === tableId);
    if (!originalTable) return;

    // Create duplicated table with same properties but new ID and position
    const duplicatedTable: Table = {
      id: `temp_${Date.now()}`, // Temporary ID for new table
      number: getNextAvailableTableNumber(),
      x: Math.min(
        originalTable.x + 20,
        currentLayout.width - originalTable.width
      ), // Offset position
      y: Math.min(
        originalTable.y + 20,
        currentLayout.height - originalTable.height
      ),
      width: originalTable.width,
      height: originalTable.height,
      shape: originalTable.shape,
      chairs: [...originalTable.chairs], // Copy chairs array
      chairsConfig: { ...originalTable.chairsConfig }, // Copy chairs config
    };

    setLayouts((prev) =>
      prev.map((layout, idx) =>
        idx === currentLayoutIndex
          ? { ...layout, tables: [...layout.tables, duplicatedTable] }
          : layout
      )
    );

    // Select the new duplicated table
    setSelectedTable(duplicatedTable.id);
    setHasUnsavedChanges(true);
  };

  const getNextAvailableTableNumber = (): number => {
    if (!currentLayout) return 1;
    const existingNumbers = currentLayout.tables.map((t) => t.number);
    let num = 1;
    while (existingNumbers.includes(num)) {
      num++;
    }
    return num;
  };

  const isTableNumberUnique = (number: number, excludeId: string): boolean => {
    if (!currentLayout) return true;
    return !currentLayout.tables.some(
      (t) => t.number === number && t.id !== excludeId
    );
  };

  const handleTableMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (mode !== "edit" || !currentLayout) return;
    e.stopPropagation();

    const table = currentLayout.tables.find((t) => t.id === tableId);
    if (!table) return;

    setSelectedTable(tableId);
    setIsDragging(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = currentLayout.width / rect.width;
    const scaleY = currentLayout.height / rect.height;

    setDragOffset({
      x: (e.clientX - rect.left) * scaleX - table.x,
      y: (e.clientY - rect.top) * scaleY - table.y,
    });
  };

  const handleTableClick = (tableId: string) => {
    if (!currentLayout) return;

    const table = currentLayout.tables.find((t) => t.id === tableId);
    if (!table) return;

    if (mode === "edit") {
      setSelectedTable(tableId);
    } else {
      const status = getTableStatus(tableId);

      // If table is occupied, show order details
      if (status === "occupied" && tableStatuses[tableId]?.orderIds) {
        const tableOrders = ordersData.filter((order) =>
          tableStatuses[tableId].orderIds?.includes(order.id || order.$id)
        );
        setSelectedTableOrders(tableOrders);
        setShowOrderModal(true);
      } else if (status === "available") {
        // In view mode, handle table selection for available tables
        handleTableSelection(table.number, tableId);
      }
    }
  };

  const handleTableTouchStart = (e: React.TouchEvent, tableId: string) => {
    if (mode !== "edit" || !currentLayout) return;
    e.stopPropagation();

    const table = currentLayout.tables.find((t) => t.id === tableId);
    if (!table) return;

    setSelectedTable(tableId);
    setIsDragging(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = currentLayout.width / rect.width;
    const scaleY = currentLayout.height / rect.height;

    setDragOffset({
      x: (touch.clientX - rect.left) * scaleX - table.x,
      y: (touch.clientY - rect.top) * scaleY - table.y,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !selectedTable || !canvasRef.current || !currentLayout)
        return;

      const rect = canvasRef.current.getBoundingClientRect();
      const table = currentLayout.tables.find((t) => t.id === selectedTable);
      if (!table) return;

      const scaleX = currentLayout.width / rect.width;
      const scaleY = currentLayout.height / rect.height;

      const x = Math.max(
        0,
        Math.min(
          (e.clientX - rect.left) * scaleX - dragOffset.x,
          currentLayout.width - table.width
        )
      );
      const y = Math.max(
        0,
        Math.min(
          (e.clientY - rect.top) * scaleY - dragOffset.y,
          currentLayout.height - table.height
        )
      );

      updateTable(selectedTable, { x, y });
    },
    [isDragging, selectedTable, dragOffset, currentLayout, updateTable]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !selectedTable || !canvasRef.current || !currentLayout)
        return;

      const rect = canvasRef.current.getBoundingClientRect();
      const table = currentLayout.tables.find((t) => t.id === selectedTable);
      if (!table) return;

      const touch = e.touches[0];
      const scaleX = currentLayout.width / rect.width;
      const scaleY = currentLayout.height / rect.height;

      const x = Math.max(
        0,
        Math.min(
          (touch.clientX - rect.left) * scaleX - dragOffset.x,
          currentLayout.width - table.width
        )
      );
      const y = Math.max(
        0,
        Math.min(
          (touch.clientY - rect.top) * scaleY - dragOffset.y,
          currentLayout.height - table.height
        )
      );

      updateTable(selectedTable, { x, y });
    },
    [isDragging, selectedTable, dragOffset, currentLayout, updateTable]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [
    isDragging,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
  ]);

  const selectedTableData = currentLayout?.tables.find(
    (t) => t.id === selectedTable
  );

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handleSave = async () => {
    if (!currentLayout) return;

    try {
      setIsSaving(true);
      setError(null);

      // First, update the layout dimensions if changed
      await tableLayouts.update(currentLayout.id, {
        name: currentLayout.name,
        width: currentLayout.width,
        height: currentLayout.height,
      });

      // Get existing tables from the database to compare
      const existingDbTables = await tables.getByLayout(currentLayout.id);
      const existingTableIds = existingDbTables.map((t: any) =>
        t.id.toString()
      );
      const currentTableIds = currentLayout.tables.map((t) => t.id);

      // Handle new tables (with temporary IDs)
      for (const table of currentLayout.tables) {
        if (table.id.startsWith("temp_")) {
          // Create new table
          const tableData = {
            layout_id: currentLayout.id, // Keep as string/UUID
            table_number: table.number,
            x: table.x,
            y: table.y,
            width: table.width,
            height: table.height,
            shape: table.shape,
            chairs_top: table.chairsConfig.top,
            chairs_bottom: table.chairsConfig.bottom,
            chairs_left: table.chairsConfig.left,
            chairs_right: table.chairsConfig.right,
            chairs_count: table.chairs.length,
          };
          await tables.create(tableData);
        } else if (existingTableIds.includes(table.id)) {
          // Update existing table
          const tableData = {
            table_number: table.number,
            x: table.x,
            y: table.y,
            width: table.width,
            height: table.height,
            shape: table.shape,
            chairs_top: table.chairsConfig.top,
            chairs_bottom: table.chairsConfig.bottom,
            chairs_left: table.chairsConfig.left,
            chairs_right: table.chairsConfig.right,
            chairs_count: table.chairs.length,
          };
          await tables.update(table.id, tableData);
        }
      }

      // Delete tables that no longer exist in the layout
      for (const existingTableId of existingTableIds) {
        if (!currentTableIds.includes(existingTableId)) {
          await tables.delete(existingTableId);
        }
      }

      console.log("Layout saved successfully");

      // Reload the layout from the database to get the real IDs
      await loadLayouts();

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error saving layout:", error);
      setError("Erro ao guardar layout");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    loadLayouts(); // Reload from API to discard changes
    setHasUnsavedChanges(false);
    setSelectedTable(null);
    setError(null);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.3));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  const renameLayout = (index: number, newName: string) => {
    setLayouts((prev) =>
      prev.map((layout, idx) =>
        idx === index ? { ...layout, name: newName } : layout
      )
    );
    setHasUnsavedChanges(true);
  };

  const deleteLayout = async (index: number) => {
    const layout = layouts[index];
    if (!layout) return;

    try {
      await tableLayouts.delete(layout.id);

      setLayouts((prev) => prev.filter((_, idx) => idx !== index));

      // Adjust current index if needed
      if (currentLayoutIndex >= layouts.length - 1) {
        setCurrentLayoutIndex(Math.max(0, layouts.length - 2));
      }

      setHasUnsavedChanges(true);
    } catch (error) {
      console.error("Error deleting layout:", error);
      setError("Erro ao eliminar layout");
    }
  };

  const addNewLayout = async () => {
    try {
      const layoutCount = layouts.length;
      const newLayout = await tableLayouts.create({
        name: `Nova Sala ${layoutCount + 1}`,
        width: 800,
        height: 600,
      });

      const convertedLayout = convertDbLayoutToComponent(newLayout);
      setLayouts((prev) => [...prev, convertedLayout]);
      setCurrentLayoutIndex(layouts.length); // Select the new layout
      setHasUnsavedChanges(false); // New layout is already saved
    } catch (error) {
      console.error("Error creating layout:", error);
      setError("Erro ao criar layout");
    }
  };

  return (
    <div className="table-layout-manager">
      {isLoading && (
        <div className="loading-overlay">
          <Loader2 className="spinner" size={32} />
          <span>A carregar layouts...</span>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {!isLoading && layouts.length === 0 && (
        <div className="empty-state">
          <h3>Nenhum layout encontrado</h3>
          <p>Crie o seu primeiro layout de mesas</p>
          <button className="create-first-layout-btn" onClick={addNewLayout}>
            <Plus size={16} />
            Criar Layout
          </button>
        </div>
      )}

      {!isLoading && layouts.length > 0 && currentLayout && (
        <>
          <div className="layout-tabs">
            <div className="tabs-list">
              {layouts.map((layout, index) => (
                <div
                  key={layout.id}
                  className={`tab ${
                    currentLayoutIndex === index ? "active" : ""
                  }`}
                  onClick={() => {
                    setCurrentLayoutIndex(index);
                    setSelectedTable(null);
                  }}
                >
                  {mode === "edit" ? (
                    <input
                      type="text"
                      value={layout.name}
                      onChange={(e) => renameLayout(index, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="tab-name-input"
                    />
                  ) : (
                    <span className="tab-name-text">{layout.name}</span>
                  )}
                  {mode === "edit" && layouts.length > 1 && (
                    <button
                      className="tab-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLayout(index);
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {mode === "edit" && (
                <button className="add-tab-btn" onClick={addNewLayout}>
                  <Plus size={16} />
                  Nova Sala
                </button>
              )}
            </div>
          </div>{" "}
          <div className="layout-header">
            <div className="layout-title">
              {mode === "edit" && (
                <button
                  className="sidebar-toggle"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                  <Menu size={20} />
                </button>
              )}
              <h3>{currentLayout.name}</h3>
              <span className="table-count">
                {currentLayout.tables.length} mesas
              </span>
              {mode === "view" && selectedTables.length > 0 && (
                <span className="selected-count">
                  {selectedTables.length} mesa
                  {selectedTables.length > 1 ? "s" : ""} selecionada
                  {selectedTables.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="layout-actions">
              {mode === "view" && selectedTables.length > 0 && (
                <>
                  <button
                    className="create-order-btn"
                    onClick={handleCreateOrder}
                  >
                    <UtensilsCrossed size={16} />
                    Criar Pedido ({selectedTables.length} mesa
                    {selectedTables.length > 1 ? "s" : ""})
                  </button>
                  <button
                    className="clear-selection-btn"
                    onClick={() => setSelectedTables([])}
                    title="Limpar seleção"
                  >
                    <X size={16} />
                  </button>
                </>
              )}

              {mode === "view" && selectedTables.length === 0 && (
                <button
                  className="mode-toggle edit-btn"
                  onClick={() => setMode("edit")}
                >
                  <Edit size={16} />
                  Editar
                </button>
              )}

              {mode === "edit" && (
                <>
                  {hasUnsavedChanges && (
                    <button
                      className={`save-header-btn ${isSaving ? "saving" : ""}`}
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 size={16} /> : <Save size={16} />}
                      {isSaving ? "A Guardar..." : "Guardar"}
                    </button>
                  )}
                  <button
                    className="cancel-edit-btn"
                    onClick={() => setMode("view")}
                    title="Cancelar edição"
                  >
                    <X size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="layout-content">
            {mode === "edit" && (
              <div
                className={`control-sidebar ${
                  isSidebarOpen ? "open" : "closed"
                }`}
              >
                <div className="sidebar-panel">
                  <button
                    className={`panel-header ${
                      expandedSection === "addTable" ? "active" : ""
                    }`}
                    onClick={() => toggleSection("addTable")}
                  >
                    <span>Adicionar Mesa</span>
                    {expandedSection === "addTable" ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                  {expandedSection === "addTable" && (
                    <div className="panel-content">
                      <div className="add-table-buttons">
                        <button
                          className="add-table-btn square"
                          onClick={() => addTable("square")}
                        >
                          <Square size={24} />
                          <span>Quadrada</span>
                        </button>
                        <button
                          className="add-table-btn round"
                          onClick={() => addTable("round")}
                        >
                          <Circle size={24} />
                          <span>Redonda</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="sidebar-panel">
                  <button
                    className={`panel-header ${
                      expandedSection === "layoutSize" ? "active" : ""
                    }`}
                    onClick={() => toggleSection("layoutSize")}
                  >
                    <span>Tamanho do Layout</span>
                    {expandedSection === "layoutSize" ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                  {expandedSection === "layoutSize" && (
                    <div className="panel-content">
                      <div className="size-controls">
                        <div className="size-input-group">
                          <label>
                            <Maximize2 size={14} />
                            Largura
                          </label>
                          <input
                            type="number"
                            value={currentLayout.width}
                            onChange={(e) => {
                              const newWidth =
                                Number.parseInt(e.target.value) || 600;
                              setLayouts((prev) =>
                                prev.map((layout, idx) =>
                                  idx === currentLayoutIndex
                                    ? { ...layout, width: newWidth }
                                    : layout
                                )
                              );
                              setHasUnsavedChanges(true);
                            }}
                            min={400}
                            max={1200}
                          />
                        </div>
                        <div className="size-input-group">
                          <label>
                            <Maximize2 size={14} />
                            Altura
                          </label>
                          <input
                            type="number"
                            value={currentLayout.height}
                            onChange={(e) => {
                              const newHeight =
                                Number.parseInt(e.target.value) || 400;
                              setLayouts((prev) =>
                                prev.map((layout, idx) =>
                                  idx === currentLayoutIndex
                                    ? { ...layout, height: newHeight }
                                    : layout
                                )
                              );
                              setHasUnsavedChanges(true);
                            }}
                            min={300}
                            max={800}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="sidebar-panel">
                  <button
                    className={`panel-header ${
                      expandedSection === "zoomControls" ? "active" : ""
                    }`}
                    onClick={() => toggleSection("zoomControls")}
                  >
                    <span>Controles de Zoom</span>
                    {expandedSection === "zoomControls" ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                  {expandedSection === "zoomControls" && (
                    <div className="panel-content">
                      <div className="zoom-controls">
                        <button
                          className="zoom-btn"
                          onClick={handleZoomOut}
                          title="Zoom Out"
                        >
                          <ZoomOut size={18} />
                        </button>
                        <span className="zoom-level">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          className="zoom-btn"
                          onClick={handleZoomIn}
                          title="Zoom In"
                        >
                          <ZoomIn size={18} />
                        </button>
                        <button
                          className="zoom-btn zoom-reset"
                          onClick={handleZoomReset}
                          title="Reset Zoom"
                        >
                          <Minimize2 size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {selectedTableData && (
                  <div className="sidebar-panel selected">
                    <button
                      className={`panel-header ${
                        expandedSection === "tableProps" ? "active" : ""
                      }`}
                      onClick={() => toggleSection("tableProps")}
                    >
                      <span>Mesa {selectedTableData.number}</span>
                      {expandedSection === "tableProps" ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </button>
                    {expandedSection === "tableProps" && (
                      <div className="panel-content">
                        <div className="table-props-content">
                          <div className="prop-group">
                            <label>Número da Mesa</label>
                            <input
                              type="number"
                              value={selectedTableData.number}
                              onChange={(e) => {
                                const newNumber =
                                  Number.parseInt(e.target.value) || 1;
                                if (
                                  isTableNumberUnique(
                                    newNumber,
                                    selectedTableData.id
                                  )
                                ) {
                                  updateTable(selectedTableData.id, {
                                    number: newNumber,
                                  });
                                }
                              }}
                              min={1}
                              className={
                                !isTableNumberUnique(
                                  selectedTableData.number,
                                  selectedTableData.id
                                )
                                  ? "error"
                                  : ""
                              }
                            />
                          </div>

                          <div className="prop-group-row">
                            <div className="prop-group">
                              <label>Largura</label>
                              <input
                                type="number"
                                value={selectedTableData.width}
                                onChange={(e) =>
                                  updateTable(selectedTableData.id, {
                                    width:
                                      Number.parseInt(e.target.value) || 60,
                                  })
                                }
                                min={40}
                                max={200}
                              />
                            </div>
                            <div className="prop-group">
                              <label>Altura</label>
                              <input
                                type="number"
                                value={selectedTableData.height}
                                onChange={(e) =>
                                  updateTable(selectedTableData.id, {
                                    height:
                                      Number.parseInt(e.target.value) || 40,
                                  })
                                }
                                min={40}
                                max={200}
                              />
                            </div>
                          </div>

                          <div className="prop-group">
                            <label>
                              Cadeiras
                              <span className="chair-count-badge">
                                {selectedTableData.chairs.length} /{" "}
                                {getMaxChairs(selectedTableData)}
                              </span>
                            </label>
                            <input
                              type="range"
                              value={selectedTableData.chairs.length}
                              onChange={(e) => {
                                const count = Number.parseInt(e.target.value);
                                updateTable(selectedTableData.id, {
                                  chairs: generateChairs(
                                    selectedTableData,
                                    count
                                  ),
                                });
                              }}
                              min={0}
                              max={getMaxChairs(selectedTableData)}
                              className="chair-slider"
                            />
                          </div>

                          <div className="prop-group">
                            <label>Posição das Cadeiras</label>
                            <div className="chair-position-grid">
                              {(
                                ["top", "right", "bottom", "left"] as const
                              ).map((side) => (
                                <label key={side} className="checkbox-item">
                                  <input
                                    type="checkbox"
                                    checked={
                                      selectedTableData.chairsConfig[side]
                                    }
                                    onChange={(e) => {
                                      const newConfig = {
                                        ...selectedTableData.chairsConfig,
                                        [side]: e.target.checked,
                                      };
                                      const newChairs = generateChairs(
                                        {
                                          ...selectedTableData,
                                          chairsConfig: newConfig,
                                        },
                                        selectedTableData.chairs.length
                                      );
                                      updateTable(selectedTableData.id, {
                                        chairsConfig: newConfig,
                                        chairs: newChairs,
                                      });
                                    }}
                                  />
                                  <span>
                                    {side === "top"
                                      ? "Cima"
                                      : side === "bottom"
                                      ? "Baixo"
                                      : side === "left"
                                      ? "Esquerda"
                                      : "Direita"}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="table-actions">
                            <button
                              className="duplicate-table-btn"
                              onClick={() =>
                                duplicateTable(selectedTableData.id)
                              }
                              title="Duplicar Mesa"
                            >
                              <Copy size={16} />
                              Duplicar Mesa
                            </button>

                            <button
                              className="delete-table-btn"
                              onClick={() => deleteTable(selectedTableData.id)}
                            >
                              <Trash2 size={16} />
                              Eliminar Mesa
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="layout-canvas-wrapper" ref={wrapperRef}>
              <div
                ref={canvasRef}
                className="layout-canvas"
                style={{
                  width: currentLayout.width,
                  height: currentLayout.height,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              >
                {currentLayout.tables.map((table) => {
                  // Calculate order total for this table
                  let orderTotal = 0;
                  if (mode === "view" && tableStatuses[table.id]?.orderIds) {
                    const tableOrders = ordersData.filter((order) =>
                      tableStatuses[table.id].orderIds?.includes(
                        order.id || order.$id
                      )
                    );
                    orderTotal = tableOrders.reduce((sum, order) => {
                      const price = order.price || 0;
                      const quantity = order.quantity || 1;
                      return sum + price * quantity;
                    }, 0);
                  }

                  return (
                    <TableComponent
                      key={table.id}
                      table={{
                        ...table,
                        status: getTableStatus(table.id),
                        groupColor: getTableGroupColor(table.id),
                      }}
                      isSelected={selectedTable === table.id}
                      isSelectedForOrder={selectedTables.includes(table.id)}
                      mode={mode}
                      onMouseDown={(e) => handleTableMouseDown(e, table.id)}
                      onTouchStart={(e) => handleTableTouchStart(e, table.id)}
                      onClick={() => handleTableClick(table.id)}
                      orderTotal={orderTotal}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          {/* Order Details Modal - Rendered via Portal to bypass stacking context */}
          {showOrderModal &&
          typeof window !== "undefined" &&
          typeof document !== "undefined" &&
          document.body
            ? createPortal(
                <OrderDetailsModal
                  orders={selectedTableOrders}
                  menuItems={menuItems}
                  onClose={() => setShowOrderModal(false)}
                  onRefresh={loadAllTablesAndOrders}
                  onOrderUpdate={(orderId, updates) => {
                    setSelectedTableOrders((prev) =>
                      prev.map((o) =>
                        (o.id || o.$id) === orderId ? updates : o
                      )
                    );
                  }}
                  onOrderDelete={(orderId) => {
                    setSelectedTableOrders((prev) =>
                      prev.filter((o) => (o.id || o.$id) !== orderId)
                    );
                  }}
                />,
                document.body
              )
            : null}
        </>
      )}
    </div>
  );
};

// Order Details Modal Component
interface OrderDetailsModalProps {
  orders: any[];
  menuItems: any[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onOrderUpdate: (orderId: string, updates: any) => void;
  onOrderDelete: (orderId: string) => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  orders,
  menuItems,
  onClose,
  onRefresh,
  onOrderUpdate,
  onOrderDelete,
}) => {
  const router = useRouter();
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [editingStatus, setEditingStatus] = useState<string>("pendente");
  const [editingPrice, setEditingPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Helper function to get menu item by ID
  const getMenuItem = (menuItemId: string) => {
    return menuItems.find(
      (item) => item.$id === menuItemId || item.id === menuItemId
    );
  };

  // Helper function to get image URL
  const getImageUrl = (imageId: string) => {
    if (!imageId || imageId === "undefined" || imageId === "null") return null;
    return `${API_BASE_URL}/files/imagens-menu/${imageId}`;
  };

  // Start editing an order
  const startEditing = (order: any) => {
    const orderId = order.$id || order.id;
    setEditingOrderId(orderId);
    setEditingNotes(order.notas || "");
    setEditingStatus(order.status || "pendente");
    setEditingPrice(order.price || 0);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingOrderId(null);
    setEditingNotes("");
    setEditingStatus("pendente");
    setEditingPrice(0);
  };

  // Save changes to order
  const saveChanges = async (order: any) => {
    const orderId = order.$id || order.id;
    setIsSaving(true);

    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notas: editingNotes,
          status: editingStatus,
          price: editingPrice,
        }),
      });

      if (response.ok) {
        const updatedOrder = await response.json();

        // Update local state immediately
        onOrderUpdate(orderId, {
          ...order,
          ...updatedOrder,
          notas: editingNotes,
          status: editingStatus,
          price: editingPrice,
        });

        // Refetch orders in background
        onRefresh();
        cancelEditing();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Update error:", errorData);
        alert(
          "Erro ao atualizar pedido: " +
            (errorData.error || "Erro desconhecido")
        );
      }
    } catch (error) {
      console.error("Error updating order:", error);
      alert("Erro ao atualizar pedido");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete order
  const deleteOrder = async (order: any) => {
    const orderId = order.$id || order.id;

    setConfirmDialog({
      show: true,
      message: "Tem a certeza?",
      onConfirm: async () => {
        setConfirmDialog(null);

        try {
          await ordersApi.delete(orderId);

          // Update local state immediately
          onOrderDelete(orderId);

          // Refetch orders in background
          onRefresh();

          // Close modal if no orders left
          if (orders.length <= 1) {
            onClose();
          }
        } catch (error) {
          console.error("Error deleting order:", error);
          alert("Erro ao eliminar pedido");
        }
      },
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendente":
        return "#f59e0b";
      case "aceite":
        return "#3b82f6";
      case "pronto":
        return "#10b981";
      case "a ser entregue...":
        return "#8b5cf6";
      case "entregue":
        return "#6366f1";
      case "completo":
        return "#059669";
      case "cancelado":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const statusOptions = [
    { value: "pendente", label: "Pendente" },
    { value: "aceite", label: "Aceite" },
    { value: "pronto", label: "Pronto" },
    { value: "a ser entregue...", label: "A ser entregue" },
    { value: "entregue", label: "Entregue" },
    { value: "completo", label: "Completo" },
    { value: "cancelado", label: "Cancelado" },
  ];

  // Calculate total - use order.price instead of menu price
  const total = orders.reduce((sum, order) => {
    const price = order.price || 0;
    const quantity = order.quantity || 1;
    return sum + price * quantity;
  }, 0);

  // Sort orders by created_at (newest first)
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = new Date(a.created_at || a.$createdAt || 0).getTime();
    const dateB = new Date(b.created_at || b.$createdAt || 0).getTime();
    return dateA - dateB; // Oldest first (chronological order)
  });

  // Extract table IDs from orders to determine which tables to navigate to
  const tableIds =
    sortedOrders.length > 0 && sortedOrders[0].table_id
      ? sortedOrders[0].table_id
      : [];

  // Handle adding more orders - navigate to order page with these table IDs
  const handleAddMoreOrders = () => {
    if (tableIds.length > 0) {
      const tableIdsParam = tableIds.join(",");
      router.push(`/order/${tableIdsParam}`);
    }
  };

  return (
    <div className="order-modal-overlay" onClick={onClose}>
      <div className="clean-order-modal" onClick={(e) => e.stopPropagation()}>
        {/* Simple Header */}
        <div className="clean-modal-header">
          <h2>Pedidos da Mesa</h2>
          <button className="clean-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="clean-modal-body">
          {orders.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="orders-list">
              {sortedOrders.map((order) => {
                const menuItem = getMenuItem(order.menu_item_id);
                const orderId = order.$id || order.id;
                const isEditing = editingOrderId === orderId;
                const imageUrl = menuItem?.image_id
                  ? getImageUrl(menuItem.image_id)
                  : null;
                const currentPrice = order.price || menuItem?.preco || 0;
                const currentQuantity = order.quantity || 1;
                const itemTotal = currentPrice * currentQuantity;

                return (
                  <div
                    key={orderId}
                    className={`order-item ${isEditing ? "editing" : ""}`}
                  >
                    {isEditing ? (
                      // Edit Mode
                      <div className="order-edit-mode">
                        <div className="edit-row">
                          <div className="edit-group">
                            <label>Item</label>
                            <div className="item-info">
                              {imageUrl && (
                                <img
                                  src={imageUrl}
                                  alt={menuItem?.nome || ""}
                                  className="item-thumb"
                                />
                              )}
                              <span className="item-name">
                                {menuItem?.nome || "Item desconhecido"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="edit-row">
                          <div className="edit-group">
                            <label>Estado</label>
                            <select
                              value={editingStatus}
                              onChange={(e) => setEditingStatus(e.target.value)}
                            >
                              {statusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="edit-group">
                            <label>Preço</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingPrice}
                              onChange={(e) =>
                                setEditingPrice(parseFloat(e.target.value) || 0)
                              }
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="edit-row">
                          <div className="edit-group full">
                            <label>Notas</label>
                            <textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              placeholder="Notas do pedido..."
                              rows={2}
                            />
                          </div>
                        </div>

                        <div className="edit-row">
                          <div className="edit-actions">
                            <button
                              className="btn-save"
                              onClick={() => saveChanges(order)}
                              disabled={isSaving}
                            >
                              {isSaving ? "A guardar..." : "Guardar"}
                            </button>
                            <button
                              className="btn-cancel"
                              onClick={cancelEditing}
                              disabled={isSaving}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <>
                        <div className="card-order-main">
                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt={menuItem?.nome || ""}
                              className="order-image"
                            />
                          )}
                          <div className="order-info">
                            <div className="order-name">
                              {menuItem?.nome || "Item desconhecido"}
                            </div>
                            <div className="order-details">
                              <span className="price">
                                €<NumberFlow value={currentPrice} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
                              </span>
                              <span className="separator">•</span>
                              <span
                                className={`status status-${
                                  order.status || "pendente"
                                }`}
                              >
                                {order.status || "pendente"}
                              </span>
                            </div>
                            {order.notas && (
                              <div className="order-notes">{order.notas}</div>
                            )}
                          </div>
                          <div className="order-total">
                            €<NumberFlow value={itemTotal} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
                          </div>
                        </div>
                        <div className="order-actions">
                          <button
                            className="btn-edit"
                            onClick={() => startEditing(order)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => deleteOrder(order)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Total and Add Order Button */}
        {sortedOrders.length > 0 && (
          <div className="clean-modal-footer">
            <button
              className="add-order-btn-modal"
              onClick={handleAddMoreOrders}
              title="Adicionar mais pedidos"
            >
              <Plus size={18} />
              Adicionar Pedido
            </button>
            <div className="footer-total-section">
              <span className="footer-label">Total</span>
              <span className="footer-total">€<NumberFlow value={total} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /></span>
            </div>
          </div>
        )}

        {/* Confirm Dialog */}
        {confirmDialog?.show && (
          <div
            className="confirm-overlay"
            onClick={() => setConfirmDialog(null)}
          >
            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-content">
                <h3>Confirmar</h3>
                <p>{confirmDialog.message}</p>
              </div>
              <div className="confirm-actions">
                <button
                  className="confirm-btn cancel"
                  onClick={() => setConfirmDialog(null)}
                >
                  Cancelar
                </button>
                <button
                  className="confirm-btn confirm"
                  onClick={confirmDialog.onConfirm}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface TableComponentProps {
  table: Table;
  isSelected: boolean;
  isSelectedForOrder: boolean;
  mode: "view" | "edit";
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onClick: () => void;
  orderTotal?: number; // Add order total prop
}

const TableComponent: React.FC<TableComponentProps> = ({
  table,
  isSelected,
  isSelectedForOrder,
  mode,
  onMouseDown,
  onTouchStart,
  onClick,
  orderTotal = 0,
}) => {
  const chairsByPosition = {
    top: table.chairs.filter((c) => c.position === "top"),
    bottom: table.chairs.filter((c) => c.position === "bottom"),
    left: table.chairs.filter((c) => c.position === "left"),
    right: table.chairs.filter((c) => c.position === "right"),
  };

  const renderChairs = (position: "top" | "bottom" | "left" | "right") => {
    const chairs = chairsByPosition[position];
    if (chairs.length === 0) return null;

    const isVertical = position === "left" || position === "right";
    const spacing = isVertical
      ? table.height / (chairs.length + 1)
      : table.width / (chairs.length + 1);

    return chairs.map((chair, index) => {
      let style: React.CSSProperties = {};

      if (position === "top") {
        style = {
          left: `${spacing * (index + 1)}px`,
          top: "-16px",
        };
      } else if (position === "bottom") {
        style = {
          left: `${spacing * (index + 1)}px`,
          bottom: "-16px",
        };
      } else if (position === "left") {
        style = {
          top: `${spacing * (index + 1)}px`,
          left: "-16px",
        };
      } else if (position === "right") {
        style = {
          top: `${spacing * (index + 1)}px`,
          right: "-16px",
        };
      }

      return (
        <div
          key={chair.id}
          className={`chair ${position} chair-appear`}
          style={style}
        />
      );
    });
  };

  const getTableClasses = () => {
    let classes = `table-wrapper`;

    if (mode === "edit") {
      classes += " editable";
      if (isSelected) classes += " selected";
    } else {
      // View mode - show status and selection
      if (table.status) classes += ` status-${table.status}`;
      if (table.groupColor) classes += " has-group-color";
      if (isSelectedForOrder) classes += " selected-for-order";
      classes += " clickable";
    }

    return classes;
  };

  const getTableStyle = (): React.CSSProperties => {
    return {
      left: table.x,
      top: table.y,
      width: table.width,
      height: table.height,
    };
  };

  return (
    <div
      className={getTableClasses()}
      style={getTableStyle()}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={onClick}
    >
      <div
        className={`table ${table.shape}`}
        style={
          mode === "view"
            ? {
                background:
                  table.status === "occupied" && table.groupColor
                    ? `linear-gradient(135deg, ${table.groupColor}15 0%, ${table.groupColor}25 100%)`
                    : table.status === "occupied"
                    ? "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)"
                    : "linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)",
                borderColor:
                  table.status === "occupied" && table.groupColor
                    ? table.groupColor
                    : table.status === "occupied"
                    ? "#ef4444"
                    : "#cbd5e0",
              }
            : undefined
        }
      >
        <div className="table-content">
          <span className="table-number">{table.number}</span>
          {mode === "view" && orderTotal > 0 && (
            <span className="table-order-total">€<NumberFlow value={orderTotal} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} /></span>
          )}
        </div>
      </div>
      {renderChairs("top")}
      {renderChairs("bottom")}
      {renderChairs("left")}
      {renderChairs("right")}
    </div>
  );
};

export default TableLayoutManager;
