"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Socket } from "socket.io-client";
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
  Minus,
  Menu,
  ZoomIn,
  ZoomOut,
  Minimize2,
  Loader2,
  Copy,
  UtensilsCrossed,
  CheckCircle,
  MessageSquare,
  ChevronRight,
  ShoppingBag,
  Clock,
  Check,
} from "lucide-react";
import {
  tableLayouts,
  tables,
  orders as ordersApi,
  takeawayApi,
  getAuthToken,
  auth,
} from "../../lib/api";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import { throttle } from "../../lib/throttle";
import NumberFlow from "@number-flow/react";
import { BrowserQRCodeReader } from "@zxing/browser";
import "./TableLayout.scss";

/**
 * KEY OPTIMIZATIONS FOR TABLE DRAGGING PERFORMANCE
 *
 * 1. USE REFS INSTEAD OF STATE FOR DRAG POSITION
 *    - Avoid React re-renders during drag
 *    - Update DOM directly via transform
 *
 * 2. USE RAF (requestAnimationFrame) FOR SMOOTH UPDATES
 *    - Batch DOM updates to next frame
 *    - Prevent multiple updates per frame
 *
 * 3. MEMOIZE EXPENSIVE CALCULATIONS
 *    - useMemo for table statuses
 *    - React.memo for TableComponent
 *
 * 4. DEBOUNCE STATE UPDATES
 *    - Only update React state on mouseup
 *    - Keep visual updates via DOM manipulation
 */

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
  user: any;
  onOrderCreate?: () => void;
  onLoaded?: () => void;
}

const useOptimizedDrag = (
  currentLayout: Layout | undefined,
  updateTable: (tableId: string, updates: Partial<Table>) => void,
  setSelectedTable: (id: string | null) => void,
  setHasUnsavedChanges: (value: boolean) => void
) => {
  const dragStateRef = useRef({
    isDragging: false,
    tableId: null as string | null,
    element: null as HTMLElement | null,
    offset: { x: 0, y: 0 },
    rafId: null as number | null,
    lastPosition: { x: 0, y: 0 },
  });

  const startDrag = useCallback(
    (
      e: React.MouseEvent | React.TouchEvent,
      tableId: string,
      canvasRef: React.RefObject<HTMLDivElement | null>
    ) => {
      if (!currentLayout) return;
      const table = currentLayout.tables.find((t) => t.id === tableId);
      if (!table || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = currentLayout.width / rect.width;
      const scaleY = currentLayout.height / rect.height;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      dragStateRef.current = {
        isDragging: true,
        tableId,
        element: e.currentTarget as HTMLElement,
        offset: {
          x: (clientX - rect.left) * scaleX - table.x,
          y: (clientY - rect.top) * scaleY - table.y,
        },
        rafId: null,
        lastPosition: { x: table.x, y: table.y },
      };

      // Add dragging class for cursor
      (e.currentTarget as HTMLElement).classList.add("is-dragging");
      setSelectedTable(tableId);
    },
    [currentLayout, setSelectedTable]
  );

  const handleMove = useCallback(
    (
      e: MouseEvent | TouchEvent,
      canvasRef: React.RefObject<HTMLDivElement | null>
    ) => {
      const dragState = dragStateRef.current;
      if (
        !dragState.isDragging ||
        !dragState.element ||
        !canvasRef.current ||
        !currentLayout
      )
        return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const table = currentLayout.tables.find(
        (t) => t.id === dragState.tableId
      );
      if (!table) return;

      const scaleX = currentLayout.width / rect.width;
      const scaleY = currentLayout.height / rect.height;

      const clientX =
        "touches" in e
          ? (e as TouchEvent).touches[0].clientX
          : (e as MouseEvent).clientX;
      const clientY =
        "touches" in e
          ? (e as TouchEvent).touches[0].clientY
          : (e as MouseEvent).clientY;

      // Calculate new position
      const x = Math.max(
        0,
        Math.min(
          (clientX - rect.left) * scaleX - dragState.offset.x,
          currentLayout.width - table.width
        )
      );
      const y = Math.max(
        0,
        Math.min(
          (clientY - rect.top) * scaleY - dragState.offset.y,
          currentLayout.height - table.height
        )
      );

      // Cancel previous RAF if exists
      if (dragState.rafId !== null) {
        cancelAnimationFrame(dragState.rafId);
      }

      // Schedule DOM update for next frame
      dragState.rafId = requestAnimationFrame(() => {
        if (dragState.element) {
          // Direct DOM manipulation - use left/top for absolute positioning
          // This gives pixel-perfect mouse following (no offset issues)
          dragState.element.style.left = `${x}px`;
          dragState.element.style.top = `${y}px`;
          dragState.element.style.transition = "none";
        }
        dragState.rafId = null;
      });

      // Store position for final state update
      dragState.lastPosition = { x, y };
    },
    [currentLayout]
  );

  const endDrag = useCallback(() => {
    const dragState = dragStateRef.current;
    if (!dragState.isDragging) return;

    // Cancel pending RAF
    if (dragState.rafId !== null) {
      cancelAnimationFrame(dragState.rafId);
    }

    // Remove dragging class (React will handle final position via re-render)
    if (dragState.element) {
      dragState.element.classList.remove("is-dragging");
      // Don't reset left/top - React will override with final state values
    }

    // NOW update React state (only once at end)
    if (dragState.tableId && dragState.lastPosition) {
      updateTable(dragState.tableId, {
        x: dragState.lastPosition.x,
        y: dragState.lastPosition.y,
      });
      setHasUnsavedChanges(true);
    }

    // Reset drag state
    dragStateRef.current = {
      isDragging: false,
      tableId: null,
      element: null,
      offset: { x: 0, y: 0 },
      rafId: null,
      lastPosition: { x: 0, y: 0 },
    };
  }, [updateTable, setHasUnsavedChanges]);

  return {
    startDrag,
    handleMove,
    endDrag,
    isDragging: dragStateRef.current.isDragging,
  };
};

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
  onLoaded,
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
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [takeawayOrders, setTakeawayOrders] = useState<any[]>([]);
  const [showTakeawayModal, setShowTakeawayModal] = useState(false);
  const [qrModal, setQrModal] = useState({
    open: false,
    takeawayId: null,
    success: false,
  });
  const [qrError, setQrError] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [tableAnimations, setTableAnimations] = useState<
    Record<string, "entering" | "moving" | "exiting" | null>
  >({});
  const [previousTablePositions, setPreviousTablePositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
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
    const loadData = async () => {
      await Promise.all([
        loadLayouts(),
        loadAllTablesAndOrders(),
        loadMenuItems(),
      ]);
      if (onLoaded) onLoaded();
    };
    loadData();
  }, [onLoaded]);

  // Close modal if selected table has no active orders after ordersData updates
  useEffect(() => {
    if (showOrderModal && selectedTable) {
      const status = getTableStatus(selectedTable);
      const hasOrders =
        Array.isArray(tableStatuses[selectedTable]?.orderIds) &&
        tableStatuses[selectedTable].orderIds.length > 0;
      if (status === "available" || !hasOrders) {
        setShowOrderModal(false);
        setSelectedTableOrders([]);
      }
    }
  }, [ordersData, showOrderModal, selectedTable, tableStatuses]);

  // Refresh orders when switching to view mode OR when layout changes
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip the very first render
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (mode === "view" && layouts.length > 0) {
      loadAllTablesAndOrders();
    }
  }, [mode, currentLayoutIndex]);

  // Keep selectedTableOrders in sync with ordersData when modal is open
  useEffect(() => {
    if (showOrderModal && selectedTableOrders.length > 0) {
      // Get the order IDs from the currently displayed orders
      const displayedOrderIds = selectedTableOrders.map((o) => o.$id || o.id);

      // Find the latest versions of these orders from ordersData
      const updatedOrders = ordersData.filter((order) =>
        displayedOrderIds.includes(order.$id || order.id)
      );

      // Only update if we found matching orders and they're different
      if (updatedOrders.length > 0) {
        setSelectedTableOrders(updatedOrders);
      }
    }
  }, [ordersData, showOrderModal]);

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

      // Get all orders (dine-in only now)
      const ordersResponse = await ordersApi.list();
      const ordersData = ordersResponse.documents || [];
      setOrdersData(ordersData);

      // Get takeaway orders from dedicated endpoint
      try {
        const takeawayResponse = await takeawayApi.list();
        const takeawayData = (takeawayResponse.documents || []).filter(
          (order: any) =>
            order.status !== "entregue" && order.status !== "cancelado"
        );
        setTakeawayOrders(takeawayData);
      } catch (takeawayError) {
        console.log("Takeaway API not available yet:", takeawayError);
        setTakeawayOrders([]);
      }

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
  const calculateTableStatuses = useCallback(
    (allTablesData: any[], ordersData: any[], layoutId: string) => {
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
      console.log(
        "Looking for layout ID:",
        layoutId,
        "Layout Name:",
        layoutName
      );

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
          statuses[tableId] = {
            status: "available",
            groupColor: undefined,
            orderIds: [],
          };
        }
      });

      console.log("Filtering for layout name:", layoutName);
      console.log("Tables in current layout:", currentLayoutTables.length);
      console.log("Total tables in system:", allTablesData.length);

      // Only filter out paid/cancelled orders - delivered orders should still occupy tables
      const activeOrders = ordersData.filter((order) => {
        const status = order.status || "pendente";
        return status !== "pago" && status !== "paid" && status !== "cancelado";
      });

      console.log(
        "Total orders:",
        ordersData.length,
        "Active orders:",
        activeOrders.length
      );

      // Group orders by their table combinations
      const orderGroups: Record<string, any[]> = {};

      activeOrders.forEach((order) => {
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
          if (statuses[tableId] && groupOrders.length > 0) {
            statuses[tableId] = {
              status: "occupied",
              groupColor: groupColor, // Will be undefined for single tables
              orderIds: groupOrders.map((order) => order.id || order.$id),
            };
          }
        });
      });

      // After assigning occupied status, ensure tables with no active orders are available
      currentLayoutTables.forEach((table) => {
        const tableId = table.$id || table.id;

        // Check if this table has ANY active orders
        const hasActiveOrders = activeOrders.some((order) => {
          if (order.table_id && Array.isArray(order.table_id)) {
            return order.table_id.includes(tableId);
          }
          return false;
        });

        // If no active orders for this table, force it to available
        if (!hasActiveOrders) {
          statuses[tableId] = {
            status: "available",
            groupColor: undefined,
            orderIds: [],
          };
        }
      });

      console.log("Final calculated table statuses:", statuses);

      console.log("Calculated table statuses:", statuses);
      console.log("Orders data count:", ordersData.length);
      console.log("Multi-table groups:", multiTableGroups.length);
      setTableStatuses(statuses);
    },
    []
  );
  useEffect(() => {
    const layout = layouts[currentLayoutIndex];
    if (layout && allTables.length > 0) {
      console.log("=== RECALCULATING TABLE STATUSES ===");
      console.log("Layout ID:", layout.id);
      console.log("Orders count:", ordersData.length);
      console.log("Tables count:", allTables.length);

      calculateTableStatuses(allTables, ordersData, layout.id);
    }
  }, [
    currentLayoutIndex,
    layouts,
    allTables,
    ordersData,
    calculateTableStatuses,
  ]);

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
    if (mode === "edit") {
      return; // Don't handle selection in edit mode
    }

    const status = getTableStatus(tableId);

    if (status !== "available") {
      return; // Only allow selection of available tables
    }

    setSelectedTables((prev) => {
      const isAlreadySelected = prev.includes(tableId);
      const newSelection = isAlreadySelected
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId];

      return newSelection;
    });
  };

  // Handle takeaway order creation
  const handleTakeawayOrder = () => {
    if (takeawayOrders.length > 0) {
      setShowTakeawayModal(true);
    } else {
      setIsCreatingOrder(true);
      router.push("/order/takeaway");
    }
  };

  // Handle QR scan for takeaway delivery
  const handleQrScan = async (scanned: string) => {
    setQrError("");
    if (!qrModal.takeawayId) return;
    setQrLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/takeaway/${qrModal.takeawayId}/verify-qr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ qrToken: scanned }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Show success state
        setQrModal((prev) => ({ ...prev, success: true }));
        setQrLoading(false);

        // Update local state
        setTakeawayOrders((prev) =>
          prev.filter((o) => (o.id || o.$id) !== qrModal.takeawayId)
        );

        // Close modals after 2 seconds
        setTimeout(() => {
          setQrModal({ open: false, takeawayId: null, success: false });
          // Close takeaway modal if no orders left
          if (takeawayOrders.length <= 1) {
            setShowTakeawayModal(false);
          }
          // Refetch to ensure sync
          loadAllTablesAndOrders();
        }, 2000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setQrError(
          errorData.error || "QR code inválido ou erro de verificação."
        );
      }
    } catch (err) {
      setQrError(
        err instanceof Error ? err.message : "Erro de rede. Tente novamente."
      );
    } finally {
      setQrLoading(false);
    }
  };

  // Create order with selected tables
  const handleCreateOrder = () => {
    if (selectedTables.length === 0) {
      return;
    }

    // Show loading state
    setIsCreatingOrder(true);

    // Use separate path segments for catch-all route
    // For [[...mesas]] route: /order/id1/id2/id3
    const encodedTables = selectedTables.map((id: string) =>
      encodeURIComponent(id)
    );
    const tablePath = encodedTables.join("/");

    router.push(`/order/${tablePath}`);

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
      (socket as Socket).emit("subscribe:layout", layout.id);
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

      // Ignore updates in edit mode
      if (mode === "edit") {
        console.log("⚠️ Ignoring table creation in edit mode");
        return;
      }

      // Only update if it belongs to current layout
      if (layout && table.layout_id === layout.id) {
        const convertedTable = convertDbTableToComponent(table);

        // Check if table already exists to prevent duplicates
        const tableExists = layouts.some((l) =>
          l.tables.some((t) => t.id === table.id)
        );

        if (tableExists) {
          console.log(`⚠️ Table ${table.id} already exists, skipping creation`);
          return;
        }

        // Mark table as entering for animation
        setTableAnimations((prev) => ({ ...prev, [table.id]: "entering" }));

        // Add table to layout
        setLayouts((prev) =>
          prev.map((l) =>
            l.id === table.layout_id
              ? { ...l, tables: [...l.tables, convertedTable] }
              : l
          )
        );

        // Add to allTables (check for duplicates here too)
        setAllTables((prev) => {
          const exists = prev.some(
            (t) => t.id === table.id || t.$id === table.id
          );
          if (exists) return prev;
          return [...prev, table];
        });

        // Remove animation state after animation completes
        setTimeout(() => {
          setTableAnimations((prev) => {
            const updated = { ...prev };
            delete updated[table.id];
            return updated;
          });
        }, 500);
      }
    };

    const handleTableUpdated = (table: any) => {
      console.log("✏️ Table updated via WebSocket:", table);

      // Ignore updates in edit mode to prevent conflicts with local dragging
      if (mode === "edit") {
        console.log("⚠️ Ignoring table update in edit mode");
        return;
      }

      // Check if position changed for movement animation
      const previousPos = previousTablePositions[table.id];
      const hasPositionChanged =
        previousPos && (previousPos.x !== table.x || previousPos.y !== table.y);

      if (hasPositionChanged) {
        setTableAnimations((prev) => ({ ...prev, [table.id]: "moving" }));
        setTimeout(() => {
          setTableAnimations((prev) => {
            const updated = { ...prev };
            delete updated[table.id];
            return updated;
          });
        }, 300);
      }

      // Convert table data
      const convertedTable = convertDbTableToComponent(table);

      // Batch state updates to reduce re-renders
      setAllTables((prev) =>
        prev.map((t) =>
          t.id === table.id || t.$id === table.id ? { ...t, ...table } : t
        )
      );

      setLayouts((prev) =>
        prev.map((layout) =>
          layout.id === table.layout_id
            ? {
                ...layout,
                tables: layout.tables.map((t) =>
                  t.id === table.id ? convertedTable : t
                ),
              }
            : layout
        )
      );

      // Store new position for future comparisons
      if (hasPositionChanged) {
        setPreviousTablePositions((prev) => ({
          ...prev,
          [table.id]: { x: table.x, y: table.y },
        }));
      }
    };

    const handleTableDeleted = (data: any) => {
      console.log("🗑️ Table deleted via WebSocket:", data);

      // Ignore updates in edit mode
      if (mode === "edit") {
        console.log("⚠️ Ignoring table deletion in edit mode");
        return;
      }

      const tableId = data.id || data.tableId;

      // Mark table as exiting for animation
      setTableAnimations((prev) => ({ ...prev, [tableId]: "exiting" }));

      // Remove table after animation completes
      setTimeout(() => {
        setLayouts((prev) =>
          prev.map((l) => ({
            ...l,
            tables: l.tables.filter((t) => t.id !== tableId),
          }))
        );

        setAllTables((prev) =>
          prev.filter((t) => t.id !== tableId && t.$id !== tableId)
        );

        // Clean up animation state
        setTableAnimations((prev) => {
          const updated = { ...prev };
          delete updated[tableId];
          return updated;
        });

        // Clean up position tracking
        setPreviousTablePositions((prev) => {
          const updated = { ...prev };
          delete updated[tableId];
          return updated;
        });
      }, 300);
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

    // Takeaway events
    const handleTakeawayCreated = (order: any) => {
      console.log("🛍️ Takeaway created via WebSocket:", order);
      setTakeawayOrders((prev) => [order, ...prev]);
    };

    const handleTakeawayUpdated = (order: any) => {
      console.log("✏️ Takeaway updated via WebSocket:", order);
      setTakeawayOrders((prev) =>
        prev.map((o) =>
          (o.id || o.$id) === (order.id || order.$id) ? { ...o, ...order } : o
        )
      );
    };

    const handleTakeawayDeleted = (data: any) => {
      console.log("🗑️ Takeaway deleted via WebSocket:", data);
      const deletedId = data.id || data.$id;
      setTakeawayOrders((prev) =>
        prev.filter((o) => (o.id || o.$id) !== deletedId)
      );
    };

    const handleTakeawayCompleted = (data: any) => {
      console.log("✅ Takeaway completed via WebSocket:", data);
      const completedId = data.id || data.$id;
      setTakeawayOrders((prev) =>
        prev.filter((o) => (o.id || o.$id) !== completedId)
      );
    };

    // Register all event listeners
    (socket as Socket).on("order:created", handleOrderCreated);
    (socket as Socket).on("order:updated", handleOrderUpdated);
    (socket as Socket).on("order:deleted", handleOrderDeleted);
    (socket as Socket).on("order:paid", (data) => {
      console.log("💸 Order paid event received via WebSocket", data);

      // Remove paid orders from ordersData immediately
      const paidOrderIds = data.order_item_ids || [];
      setOrdersData((prev) =>
        prev.filter((order) => !paidOrderIds.includes(order.id || order.$id))
      );

      // Then refresh to ensure consistency
      loadAllTablesAndOrders();
    });
    (socket as Socket).on("table:created", handleTableCreated);
    (socket as Socket).on("table:updated", handleTableUpdated);
    (socket as Socket).on("table:deleted", handleTableDeleted);
    (socket as Socket).on("layout:created", handleLayoutCreated);
    (socket as Socket).on("layout:updated", handleLayoutUpdated);
    (socket as Socket).on("layout:deleted", handleLayoutDeleted);
    (socket as Socket).on("takeaway:created", handleTakeawayCreated);
    (socket as Socket).on("takeaway:updated", handleTakeawayUpdated);
    (socket as Socket).on("takeaway:deleted", handleTakeawayDeleted);
    (socket as Socket).on("takeaway:completed", handleTakeawayCompleted);

    // Cleanup function
    return () => {
      console.log("🔌 TableLayout: Cleaning up WebSocket listeners");

      // Unsubscribe from layout
      if (layout?.id && mode === "view") {
        console.log(`📡 Unsubscribing from layout: ${layout.id}`);
        (socket as Socket).emit("unsubscribe:layout", layout.id);
      }

      // Remove all event listeners
      (socket as Socket).off("order:created", handleOrderCreated);
      (socket as Socket).off("order:updated", handleOrderUpdated);
      (socket as Socket).off("order:deleted", handleOrderDeleted);
      (socket as Socket).off("order:paid");
      (socket as Socket).off("table:created", handleTableCreated);
      (socket as Socket).off("table:updated", handleTableUpdated);
      (socket as Socket).off("table:deleted", handleTableDeleted);
      (socket as Socket).off("layout:created", handleLayoutCreated);
      (socket as Socket).off("layout:updated", handleLayoutUpdated);
      (socket as Socket).off("layout:deleted", handleLayoutDeleted);
      (socket as Socket).off("takeaway:created", handleTakeawayCreated);
      (socket as Socket).off("takeaway:updated", handleTakeawayUpdated);
      (socket as Socket).off("takeaway:deleted", handleTakeawayDeleted);
      (socket as Socket).off("takeaway:completed", handleTakeawayCompleted);
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

  // Initialize optimized drag hook (after all dependencies are defined)
  const {
    startDrag,
    handleMove,
    endDrag,
    isDragging: isDraggingOptimized,
  } = useOptimizedDrag(
    currentLayout,
    updateTable,
    setSelectedTable,
    setHasUnsavedChanges
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

    // Use optimized drag start
    startDrag(e, tableId, canvasRef);
    setIsDragging(true);
  };

  const handleTableClick = (tableId: string) => {
    if (!currentLayout) return;

    const table = currentLayout.tables.find((t) => t.id === tableId);
    if (!table) return;

    if (mode === "edit") {
      setSelectedTable(tableId);
    } else {
      const status = getTableStatus(tableId);

      // Only open modal if table is occupied AND has non-empty orderIds
      if (
        status === "occupied" &&
        Array.isArray(tableStatuses[tableId]?.orderIds) &&
        tableStatuses[tableId].orderIds.length > 0
      ) {
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

    // Use optimized drag start
    startDrag(e, tableId, canvasRef);
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      // Use optimized move handler
      handleMove(e, canvasRef);
    },
    [isDragging, handleMove]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      // Use optimized move handler
      handleMove(e, canvasRef);
    },
    [isDragging, handleMove]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    // Use optimized end drag
    endDrag();
    setIsDragging(false);
  }, [isDragging, endDrag]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    // Use optimized end drag
    endDrag();
    setIsDragging(false);
  }, [isDragging, endDrag]);

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

      // STEP 1: Delete tables that no longer exist in the layout FIRST
      // This prevents "table number already exists" errors when recreating tables
      for (const existingTableId of existingTableIds) {
        if (!currentTableIds.includes(existingTableId)) {
          console.log(`Deleting removed table: ${existingTableId}`);
          await tables.delete(existingTableId);
        }
      }

      // STEP 2: Update existing tables
      for (const table of currentLayout.tables) {
        if (
          !table.id.startsWith("temp_") &&
          existingTableIds.includes(table.id)
        ) {
          console.log(
            `Updating existing table: ${table.id} (number ${table.number})`
          );
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

      // STEP 3: Create new tables (with temporary IDs) LAST
      for (const table of currentLayout.tables) {
        if (table.id.startsWith("temp_")) {
          console.log(`Creating new table: number ${table.number}`);
          const tableData = {
            layout_id: currentLayout.id,
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
        }
      }

      console.log("Layout saved successfully");

      // Reload the layout from the database to get the real IDs
      await loadLayouts();

      setHasUnsavedChanges(false);

      // Clear selections and exit edit mode
      setSelectedTable(null);
      setSelectedTables([]);
      setMode("view");
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
      {isCreatingOrder && (
        <div className="loading-overlay">
          <Loader2 className="spinner" size={32} />
          <span>A criar pedido...</span>
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
                <>
                  <button
                    className="create-order-btn takeaway-btn"
                    onClick={handleTakeawayOrder}
                  >
                    <ShoppingBag size={16} />
                    Takeaway
                    {takeawayOrders.length > 0 && (
                      <span className="takeaway-badge">
                        {takeawayOrders.length}
                      </span>
                    )}
                  </button>
                  <button
                    className="mode-toggle edit-btn"
                    onClick={() => setMode("edit")}
                  >
                    <Edit size={16} />
                    Editar
                  </button>
                </>
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
                            <span className="size-value-badge">
                              {currentLayout.width}px
                            </span>
                          </label>
                          <div className="stepper-input">
                            <button
                              type="button"
                              className="stepper-btn"
                              onClick={() => {
                                const newWidth = Math.max(
                                  400,
                                  currentLayout.width - 50
                                );
                                setLayouts((prev) =>
                                  prev.map((layout, idx) =>
                                    idx === currentLayoutIndex
                                      ? { ...layout, width: newWidth }
                                      : layout
                                  )
                                );
                                setHasUnsavedChanges(true);
                              }}
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="range"
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
                              step={50}
                              className="layout-slider"
                            />
                            <button
                              type="button"
                              className="stepper-btn"
                              onClick={() => {
                                const newWidth = Math.min(
                                  1200,
                                  currentLayout.width + 50
                                );
                                setLayouts((prev) =>
                                  prev.map((layout, idx) =>
                                    idx === currentLayoutIndex
                                      ? { ...layout, width: newWidth }
                                      : layout
                                  )
                                );
                                setHasUnsavedChanges(true);
                              }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="size-input-group">
                          <label>
                            <Maximize2 size={14} />
                            Altura
                            <span className="size-value-badge">
                              {currentLayout.height}px
                            </span>
                          </label>
                          <div className="stepper-input">
                            <button
                              type="button"
                              className="stepper-btn"
                              onClick={() => {
                                const newHeight = Math.max(
                                  300,
                                  currentLayout.height - 50
                                );
                                setLayouts((prev) =>
                                  prev.map((layout, idx) =>
                                    idx === currentLayoutIndex
                                      ? { ...layout, height: newHeight }
                                      : layout
                                  )
                                );
                                setHasUnsavedChanges(true);
                              }}
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="range"
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
                              step={50}
                              className="layout-slider"
                            />
                            <button
                              type="button"
                              className="stepper-btn"
                              onClick={() => {
                                const newHeight = Math.min(
                                  800,
                                  currentLayout.height + 50
                                );
                                setLayouts((prev) =>
                                  prev.map((layout, idx) =>
                                    idx === currentLayoutIndex
                                      ? { ...layout, height: newHeight }
                                      : layout
                                  )
                                );
                                setHasUnsavedChanges(true);
                              }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
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
                            <label>
                              Número da Mesa
                              <span className="size-value-badge">
                                {selectedTableData.number}
                              </span>
                            </label>
                            <div className="stepper-input">
                              <button
                                type="button"
                                className="stepper-btn"
                                onClick={() => {
                                  const newNumber = Math.max(
                                    1,
                                    selectedTableData.number - 1
                                  );
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
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                className="table-number-display"
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
                              />
                              <button
                                type="button"
                                className="stepper-btn"
                                onClick={() => {
                                  const newNumber =
                                    selectedTableData.number + 1;
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
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="prop-group-row">
                            <div className="prop-group">
                              <label>
                                Largura
                                <span className="size-value-badge">
                                  {selectedTableData.width}px
                                </span>
                              </label>
                              <div className="stepper-input">
                                <button
                                  type="button"
                                  className="stepper-btn"
                                  onClick={() =>
                                    updateTable(selectedTableData.id, {
                                      width: Math.max(
                                        20,
                                        selectedTableData.width - 5
                                      ),
                                    })
                                  }
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  className="table-dimension-display"
                                  value={selectedTableData.width}
                                  onChange={(e) =>
                                    updateTable(selectedTableData.id, {
                                      width:
                                        Number.parseInt(e.target.value) || 60,
                                    })
                                  }
                                  min={20}
                                />
                                <button
                                  type="button"
                                  className="stepper-btn"
                                  onClick={() =>
                                    updateTable(selectedTableData.id, {
                                      width: selectedTableData.width + 5,
                                    })
                                  }
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="prop-group">
                              <label>
                                Altura
                                <span className="size-value-badge">
                                  {selectedTableData.height}px
                                </span>
                              </label>
                              <div className="stepper-input">
                                <button
                                  type="button"
                                  className="stepper-btn"
                                  onClick={() =>
                                    updateTable(selectedTableData.id, {
                                      height: Math.max(
                                        20,
                                        selectedTableData.height - 5
                                      ),
                                    })
                                  }
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  className="table-dimension-display"
                                  value={selectedTableData.height}
                                  onChange={(e) =>
                                    updateTable(selectedTableData.id, {
                                      height:
                                        Number.parseInt(e.target.value) || 40,
                                    })
                                  }
                                  min={20}
                                />
                                <button
                                  type="button"
                                  className="stepper-btn"
                                  onClick={() =>
                                    updateTable(selectedTableData.id, {
                                      height: selectedTableData.height + 5,
                                    })
                                  }
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
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
                              <Copy size={18} />
                            </button>

                            <button
                              className="delete-table-btn"
                              onClick={() => deleteTable(selectedTableData.id)}
                              title="Eliminar Mesa"
                            >
                              <Trash2 size={18} />
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

                  const animationClass = tableAnimations[table.id]
                    ? `table-${tableAnimations[table.id]}`
                    : "";

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
                      className={animationClass}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          {/* Takeaway Orders Modal */}
          {showTakeawayModal &&
          typeof window !== "undefined" &&
          typeof document !== "undefined" &&
          document.body
            ? createPortal(
                <div
                  className="table-layout-manager-modals modal-overlay takeaway-modal-overlay"
                  onClick={() => setShowTakeawayModal(false)}
                >
                  <div
                    className="modal-content takeaway-orders-modal"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="modal-header">
                      <h3>
                        <ShoppingBag size={20} />
                        Pedidos Takeaway ({takeawayOrders.length})
                      </h3>
                      <button
                        className="modal-close"
                        onClick={() => setShowTakeawayModal(false)}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="modal-body takeaway-orders-list">
                      {takeawayOrders.length === 0 ? (
                        <div className="takeaway-empty-state">
                          <ShoppingBag size={48} strokeWidth={1.5} />
                          <h4>Sem pedidos takeaway</h4>
                          <p>Crie um novo pedido para começar</p>
                        </div>
                      ) : (
                        takeawayOrders.map((order) => {
                          const orderTotal = parseFloat(order.total_price) || 0;
                          const statusClass = (order.status || "pendente")
                            .toLowerCase()
                            .replace(/\s+/g, "-");
                          const items = order.items || [];

                          return (
                            <div
                              key={order.id || order.$id}
                              className="takeaway-order-card"
                            >
                              <div className="order-card-header">
                                <div className="order-info">
                                  <h4>{order.customer_name || "Cliente"}</h4>
                                  <span className="order-phone">
                                    {order.customer_phone || "Sem telefone"}
                                  </span>
                                  {order.customer_email && (
                                    <span className="order-email">
                                      {order.customer_email}
                                    </span>
                                  )}
                                </div>
                                <div className="order-header-right">
                                  <span
                                    className={`status-badge status-${statusClass}`}
                                  >
                                    {order.status || "pendente"}
                                  </span>
                                  <div className="order-total">
                                    €{orderTotal.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              <div className="order-card-body">
                                <div className="order-items-list">
                                  {items.map((item: any, idx: number) => (
                                    <div
                                      key={item.id || idx}
                                      className="order-item-row"
                                    >
                                      <span className="item-qty">
                                        {item.quantity}x
                                      </span>
                                      <span className="item-name">
                                        {item.item_name || "Item"}
                                      </span>
                                      <span className="item-price">
                                        €
                                        {(
                                          parseFloat(item.price) *
                                          (item.quantity || 1)
                                        ).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {order.special_requests && (
                                  <div className="order-notes">
                                    <MessageSquare size={12} />
                                    {order.special_requests}
                                  </div>
                                )}
                              </div>
                              <div className="order-card-actions">
                                <button
                                  className="action-btn delete-btn"
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        "Tem certeza que deseja eliminar este pedido?"
                                      )
                                    )
                                      return;
                                    try {
                                      await takeawayApi.delete(
                                        order.id || order.$id
                                      );
                                      setTakeawayOrders((prev) =>
                                        prev.filter(
                                          (o) =>
                                            (o.id || o.$id) !==
                                            (order.id || order.$id)
                                        )
                                      );
                                    } catch (error) {
                                      console.error(
                                        "Failed to delete takeaway order:",
                                        error
                                      );
                                    }
                                  }}
                                >
                                  <Trash2 size={14} />
                                  Eliminar
                                </button>
                                {order.status !== "pronto" ? (
                                  <button
                                    className="action-btn ready-btn"
                                    onClick={async () => {
                                      try {
                                        await takeawayApi.update(
                                          order.id || order.$id,
                                          { status: "pronto" }
                                        );
                                        setTakeawayOrders((prev) =>
                                          prev.map((o) =>
                                            (o.id || o.$id) ===
                                            (order.id || order.$id)
                                              ? { ...o, status: "pronto" }
                                              : o
                                          )
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Failed to mark as ready:",
                                          error
                                        );
                                      }
                                    }}
                                  >
                                    <Check size={14} />
                                    Marcar como Pronto
                                  </button>
                                ) : (
                                  <button
                                    className="action-btn complete-btn"
                                    onClick={() => {
                                      setQrModal({
                                        open: true,
                                        takeawayId: order.id || order.$id,
                                        success: false,
                                      });
                                    }}
                                  >
                                    <Check size={14} />
                                    Marcar como Entregue
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="modal-footer">
                      <button
                        className="footer-button primary"
                        onClick={() => {
                          setShowTakeawayModal(false);
                          setIsCreatingOrder(true);
                          router.push("/order/takeaway");
                        }}
                      >
                        <Plus size={16} />
                        Novo Pedido Takeaway
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )
            : null}
          {/* QR Scan Modal for Takeaway Delivery */}
          {qrModal.open && (
            <QRScanModal
              open={qrModal.open}
              onClose={() => {
                setQrModal({ open: false, takeawayId: null, success: false });
                setQrError("");
              }}
              onScan={handleQrScan}
              errorText={qrError}
              loading={qrLoading}
              success={qrModal.success}
            />
          )}
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
                  setIsCreatingOrder={setIsCreatingOrder}
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
  setIsCreatingOrder: (loading: boolean) => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  orders,
  menuItems,
  onClose,
  onRefresh,
  onOrderUpdate,
  onOrderDelete,
  setIsCreatingOrder,
}) => {
  const router = useRouter();
  const { socket, connected } = useWebSocketContext();
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [editingStatus, setEditingStatus] = useState<string>("pendente");
  const [editingPrice, setEditingPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingStatusOrderId, setUpdatingStatusOrderId] = useState<
    string | null
  >(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every 10 seconds for elapsed time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // WebSocket listeners for real-time updates
  useEffect(() => {
    if (!socket || !connected) return;

    console.log(
      "🔌 OrderModal: Setting up WebSocket listeners, orders count:",
      orders.length
    );

    const handleOrderUpdate = (order: any) => {
      console.log("🔄 OrderModal: Order updated received:", order);

      const updatedOrderId = order.$id || order.id;

      // Check if this update affects any of the orders in this modal
      const affectedOrder = orders.find(
        (o) => (o.$id || o.id) === updatedOrderId
      );

      console.log(
        "OrderModal: Affected order found:",
        !!affectedOrder,
        "Updated order ID:",
        updatedOrderId
      );

      if (affectedOrder) {
        console.log("✅ OrderModal: Updating order in modal");
        // Update the specific order with all the new data
        onOrderUpdate(updatedOrderId, { ...affectedOrder, ...order });
      }
    };

    const handleOrderDelete = (data: any) => {
      console.log("🗑️ OrderModal: Order deleted received:", data);

      const deletedOrderId = data.id || data.$id;

      // Check if the deleted order is in this modal
      const affectedOrder = orders.find(
        (o) => (o.$id || o.id) === deletedOrderId
      );

      if (affectedOrder) {
        console.log("✅ OrderModal: Removing order from modal");
        onOrderDelete(deletedOrderId);
        // If no orders left, close modal
        if (orders.length === 1) {
          onClose();
        }
      }
    };

    const handleOrderCreate = (order: any) => {
      console.log("➕ OrderModal: New order created received:", order);

      // Check if this new order belongs to any of the tables in this modal
      const orderTableIds = order.table_id || [];
      const modalTableIds = orders.flatMap((o) => o.table_id || []);

      // Check if there's any overlap between order tables and modal tables
      const hasMatchingTable = orderTableIds.some((tableId: string) =>
        modalTableIds.includes(tableId)
      );

      if (hasMatchingTable) {
        console.log("✅ OrderModal: New order matches table, refreshing");
        // Refresh to get the new order
        onRefresh();
      }
    };

    // Subscribe to WebSocket events (CORRECT EVENT NAMES)
    (socket as Socket).on("order:updated", handleOrderUpdate);
    (socket as Socket).on("order:deleted", handleOrderDelete);
    (socket as Socket).on("order:created", handleOrderCreate);

    console.log("✅ OrderModal: WebSocket listeners registered");

    // Cleanup
    return () => {
      console.log("🧹 OrderModal: Cleaning up WebSocket listeners");
      (socket as Socket).off("order:updated", handleOrderUpdate);
      (socket as Socket).off("order:deleted", handleOrderDelete);
      (socket as Socket).off("order:created", handleOrderCreate);
    };
  }, [
    socket,
    connected,
    orders,
    onRefresh,
    onOrderUpdate,
    onOrderDelete,
    onClose,
  ]);

  // Helper function to get menu item by ID
  const getMenuItem = (menuItemId: string) => {
    return menuItems.find(
      (item) => item.$id === menuItemId || item.id === menuItemId
    );
  };

  // Helper function to get image URL
  const getImageUrl = (imageId: string) => {
    if (!imageId || imageId === "undefined" || imageId === "null") return null;

    // Get S3 bucket URL from environment (fallback to API redirect if not set)
    const S3_BUCKET_URL = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL;

    if (S3_BUCKET_URL) {
      return `${S3_BUCKET_URL}/imagens-menu/${imageId}`;
    } else {
      return `${API_BASE_URL}/upload/files/imagens-menu/${imageId}`;
    }
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
      }
    } catch (error) {
      console.error("Error updating order:", error);
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
      case "a ser entregue":
        return "#8b5cf6";
      case "entregue":
        return "#6366f1";
      default:
        return "#6b7280";
    }
  };

  const statusOptions = [
    { value: "pendente", label: "Pendente" },
    { value: "aceite", label: "Aceite" },
    { value: "pronto", label: "Pronto" },
    { value: "a ser entregue", label: "A ser entregue" },
    { value: "entregue", label: "Entregue" },
  ];

  // Get next status in workflow
  const getNextStatus = (currentStatus: string): string | null => {
    const workflow = [
      "pendente",
      "aceite",
      "pronto",
      "a ser entregue",
      "entregue",
    ];
    const currentIndex = workflow.indexOf(currentStatus);

    // If status is not in workflow or is the last one, return null (no next status)
    if (currentIndex === -1 || currentIndex === workflow.length - 1) {
      return null;
    }

    return workflow[currentIndex + 1];
  };

  // Cycle status forward
  const cycleStatusForward = async (order: any) => {
    const orderId = order.$id || order.id;
    const currentStatus = order.status || "pendente";
    const nextStatus = getNextStatus(currentStatus);

    if (!nextStatus) {
      // Already at the end of the workflow
      return;
    }

    setUpdatingStatusOrderId(orderId);
    setIsSaving(true);

    try {
      const token = getAuthToken();

      // Get current user from auth
      let userId;
      try {
        const currentUser = await auth.get();
        userId = currentUser?.$id || currentUser?.id;
      } catch (authError) {
        console.warn(
          "Could not get current user, continuing without userId:",
          authError
        );
        userId = null;
      }
      const currentTimestamp = new Date().toISOString();

      // Determine which logging fields to send based on the status transition
      const updateData: any = {
        status: nextStatus,
      };

      // Add logging fields based on the transition
      if (nextStatus === "aceite") {
        // pendente → aceite
        updateData.aceite_por = userId;
        updateData.aceite_a = currentTimestamp;
      } else if (nextStatus === "pronto") {
        // aceite → pronto
        updateData.preparado_por = userId;
        updateData.preparado_a = currentTimestamp;
      } else if (nextStatus === "a ser entregue") {
        // pronto → a ser entregue (NEW: Waiter starts delivering)
        updateData.a_ser_entregue_por = userId;
        updateData.a_ser_entregue_a = currentTimestamp;
      } else if (nextStatus === "entregue") {
        // a ser entregue → entregue
        updateData.entregue_por = userId;
        updateData.entregue_a = currentTimestamp;
      }

      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const updatedOrder = await response.json();

        // Update local state immediately
        onOrderUpdate(orderId, {
          ...order,
          ...updatedOrder,
          status: nextStatus,
        });

        // Refetch orders in background
        onRefresh();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Update error:", errorData);
      }
    } catch (error) {
      console.error("Error updating order status:", error);
    } finally {
      console.log("🔄 Clearing loading state for order:", orderId);
      setIsSaving(false);
      setUpdatingStatusOrderId(null);
    }
  };

  // Calculate total - use order.price instead of menu price
  const total = orders.reduce((sum, order) => {
    const price = order.price || 0;
    const quantity = order.quantity || 1;
    return sum + price * quantity;
  }, 0);

  // Store initial order of orders by created_at, and keep it fixed
  const initialOrderRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (!initialOrderRef.current && orders.length > 0) {
      initialOrderRef.current = [...orders]
        .sort((a, b) => {
          const dateA = new Date(a.created_at || a.$createdAt || 0).getTime();
          const dateB = new Date(b.created_at || b.$createdAt || 0).getTime();
          return dateA - dateB;
        })
        .map((o) => o.id || o.$id);
    }
    // If the set of order IDs changes (e.g. new order added or deleted), reset
    if (initialOrderRef.current) {
      const currentIds = orders.map((o) => o.id || o.$id);
      if (
        initialOrderRef.current.length !== currentIds.length ||
        !initialOrderRef.current.every((id) => currentIds.includes(id))
      ) {
        initialOrderRef.current = [...orders]
          .sort((a, b) => {
            const dateA = new Date(a.created_at || a.$createdAt || 0).getTime();
            const dateB = new Date(b.created_at || b.$createdAt || 0).getTime();
            return dateA - dateB;
          })
          .map((o) => o.id || o.$id);
      }
    }
  }, [orders]);

  // Render orders in the fixed initial order
  const sortedOrders = initialOrderRef.current
    ? initialOrderRef.current
        .map((id) => orders.find((o) => (o.id || o.$id) === id))
        .filter(Boolean)
    : orders;

  // Use sortedOrders everywhere instead of orders

  // Helper function to calculate elapsed time
  const getElapsedTime = (createdAt: string): string => {
    const created = new Date(createdAt);
    const diffMs = currentTime.getTime() - created.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) {
      return "agora";
    } else if (diffMinutes === 1) {
      return "1 min";
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      if (mins === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${mins}m`;
    }
  };

  // Extract table IDs from orders to determine which tables to navigate to
  const tableIds =
    sortedOrders.length > 0 && sortedOrders[0].table_id
      ? sortedOrders[0].table_id
      : [];

  // Handle adding more orders - navigate to order page with these table IDs
  const handleAddMoreOrders = () => {
    if (tableIds.length > 0) {
      // Show loading state
      setIsCreatingOrder(true);

      // Use separate path segments for catch-all route
      const encodedTables = tableIds.map((id: string) =>
        encodeURIComponent(id)
      );
      const tablePath = encodedTables.join("/");
      router.push(`/order/${tablePath}`);
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
            <div className="orders-table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Imagem</th>
                    <th>Item</th>
                    <th>Tempo</th>
                    <th>Preço</th>
                    <th>Estado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
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

                    if (isEditing) {
                      return (
                        <tr key={orderId} className="order-row editing">
                          <td colSpan={6}>
                            <div className="order-edit-mode">
                              <div className="edit-row">
                                <div className="edit-group">
                                  <label>Item</label>
                                  <div className="order-modal-item-info">
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
                                    onChange={(e) =>
                                      setEditingStatus(e.target.value)
                                    }
                                  >
                                    {statusOptions.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="edit-group">
                                  <label>
                                    Preço
                                    <span className="size-value-badge">
                                      {editingPrice.toFixed(2)}€
                                    </span>
                                  </label>
                                  <div className="stepper-input">
                                    <button
                                      type="button"
                                      className="stepper-btn"
                                      onClick={() =>
                                        setEditingPrice(
                                          Math.max(0, editingPrice - 0.5)
                                        )
                                      }
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <span className="price-display">
                                      {editingPrice.toFixed(2)}€
                                    </span>
                                    <button
                                      type="button"
                                      className="stepper-btn"
                                      onClick={() =>
                                        setEditingPrice(editingPrice + 0.5)
                                      }
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="edit-row">
                                <div className="edit-group full">
                                  <label>Notas</label>
                                  <textarea
                                    value={editingNotes}
                                    onChange={(e) =>
                                      setEditingNotes(e.target.value)
                                    }
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
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={orderId} className="order-row">
                        {/* Image Cell */}
                        <td className="image-cell">
                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt={menuItem?.nome || ""}
                              className="order-image"
                            />
                          )}
                        </td>

                        {/* Item Cell */}
                        <td className="item-cell">
                          <div className="item-info-wrapper">
                            <div className="order-item-name">
                              {menuItem?.nome || "Item desconhecido"}
                            </div>
                            {order.notas && (
                              <div className="order-item-notes">
                                {order.notas}
                              </div>
                            )}
                            {/* Staff workflow - professional display */}
                            {(order.aceite_por_user ||
                              order.preparado_por_user ||
                              order.a_ser_entregue_por_user ||
                              order.entregue_por_user) && (
                              <div className="order-staff-workflow">
                                {order.aceite_por_user && (
                                  <div className="staff-member">
                                    <img
                                      src={(() => {
                                        const S3_BUCKET_URL =
                                          process.env
                                            .NEXT_PUBLIC_AWS_S3_BUCKET_URL;
                                        return S3_BUCKET_URL
                                          ? `${S3_BUCKET_URL}/imagens-perfil/${order.aceite_por_user.profile_image}`
                                          : `${API_BASE_URL}/upload/files/imagens-perfil/${order.aceite_por_user.profile_image}`;
                                      })()}
                                      alt={order.aceite_por_user.nome}
                                      className="staff-pfp"
                                    />
                                    <div className="staff-details">
                                      <span className="staff-name">
                                        {order.aceite_por_user.nome}
                                      </span>
                                      <span className="staff-role">Aceite</span>
                                    </div>
                                  </div>
                                )}
                                {order.preparado_por_user && (
                                  <div className="staff-member">
                                    <img
                                      src={(() => {
                                        const S3_BUCKET_URL =
                                          process.env
                                            .NEXT_PUBLIC_AWS_S3_BUCKET_URL;
                                        return S3_BUCKET_URL
                                          ? `${S3_BUCKET_URL}/imagens-perfil/${order.preparado_por_user.profile_image}`
                                          : `${API_BASE_URL}/upload/files/imagens-perfil/${order.preparado_por_user.profile_image}`;
                                      })()}
                                      alt={order.preparado_por_user.nome}
                                      className="staff-pfp"
                                    />
                                    <div className="staff-details">
                                      <span className="staff-name">
                                        {order.preparado_por_user.nome}
                                      </span>
                                      <span className="staff-role">
                                        Preparado
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {order.a_ser_entregue_por_user && (
                                  <div className="staff-member">
                                    <img
                                      src={(() => {
                                        const S3_BUCKET_URL =
                                          process.env
                                            .NEXT_PUBLIC_AWS_S3_BUCKET_URL;
                                        return S3_BUCKET_URL
                                          ? `${S3_BUCKET_URL}/imagens-perfil/${order.a_ser_entregue_por_user.profile_image}`
                                          : `${API_BASE_URL}/upload/files/imagens-perfil/${order.a_ser_entregue_por_user.profile_image}`;
                                      })()}
                                      alt={order.a_ser_entregue_por_user.nome}
                                      className="staff-pfp"
                                    />
                                    <div className="staff-details">
                                      <span className="staff-name">
                                        {order.a_ser_entregue_por_user.nome}
                                      </span>
                                      <span className="staff-role">
                                        A Entregar
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {order.entregue_por_user && (
                                  <div className="staff-member">
                                    <img
                                      src={(() => {
                                        const S3_BUCKET_URL =
                                          process.env
                                            .NEXT_PUBLIC_AWS_S3_BUCKET_URL;
                                        return S3_BUCKET_URL
                                          ? `${S3_BUCKET_URL}/imagens-perfil/${order.entregue_por_user.profile_image}`
                                          : `${API_BASE_URL}/upload/files/imagens-perfil/${order.entregue_por_user.profile_image}`;
                                      })()}
                                      alt={order.entregue_por_user.nome}
                                      className="staff-pfp"
                                    />
                                    <div className="staff-details">
                                      <span className="staff-name">
                                        {order.entregue_por_user.nome}
                                      </span>
                                      <span className="staff-role">
                                        Entregue
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Time Cell */}
                        <td className="time-cell">
                          <span className="elapsed-time">
                            {getElapsedTime(
                              order.created_at || order.$createdAt
                            )}
                          </span>
                        </td>

                        {/* Price Cell */}
                        <td className="price-cell">
                          €
                          <NumberFlow
                            value={itemTotal}
                            format={{
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }}
                          />
                        </td>

                        {/* Status Cell */}
                        <td className="status-cell">
                          <span
                            className={`status-badge status-${(
                              order.status || "pendente"
                            ).replace(/\s+/g, "-")} ${
                              getNextStatus(order.status || "pendente")
                                ? "clickable"
                                : ""
                            } ${
                              updatingStatusOrderId === orderId
                                ? "updating"
                                : ""
                            }`}
                            onClick={() => {
                              if (
                                getNextStatus(order.status || "pendente") &&
                                updatingStatusOrderId !== orderId
                              ) {
                                cycleStatusForward(order);
                              }
                            }}
                            title={
                              updatingStatusOrderId === orderId
                                ? "A atualizar..."
                                : getNextStatus(order.status || "pendente")
                                ? `Clicar para mudar para: ${getNextStatus(
                                    order.status || "pendente"
                                  )}`
                                : "Estado final"
                            }
                          >
                            {updatingStatusOrderId === orderId ? (
                              <Loader2 size={14} className="spinner" />
                            ) : (
                              order.status || "pendente"
                            )}
                            {getNextStatus(order.status || "pendente") &&
                              updatingStatusOrderId !== orderId && (
                                <ChevronRight size={14} />
                              )}
                          </span>
                        </td>

                        {/* Actions Cell */}
                        <td className="actions-cell">
                          <button
                            className="action-btn-edit"
                            onClick={() => startEditing(order)}
                          >
                            Editar
                          </button>
                          <button
                            className="action-btn-delete"
                            onClick={() => deleteOrder(order)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
              <span className="footer-total">
                €
                <NumberFlow
                  value={total}
                  format={{
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }}
                />
              </span>
            </div>
          </div>
        )}

        {/* Confirm Dialog */}
        {confirmDialog?.show && (
          <div
            className="delete-modal-overlay"
            onClick={() => setConfirmDialog(null)}
          >
            <div
              className="delete-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="delete-modal-icon">
                <Trash2 size={24} />
              </div>
              <div className="delete-modal-text">
                <h3>Eliminar Pedido</h3>
                <p>{confirmDialog.message}</p>
              </div>
              <div className="delete-modal-actions">
                <button
                  className="delete-modal-btn delete-modal-cancel"
                  onClick={() => setConfirmDialog(null)}
                >
                  <X size={16} />
                  Cancelar
                </button>
                <button
                  className="delete-modal-btn delete-modal-confirm"
                  onClick={confirmDialog.onConfirm}
                >
                  <Trash2 size={16} />
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

// QR Scan Modal Component for Takeaway Delivery
interface QRScanModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (scanned: string) => void;
  errorText: string;
  loading: boolean;
  success?: boolean;
}

const QRScanModal: React.FC<QRScanModalProps> = ({
  open,
  onClose,
  onScan,
  errorText,
  loading,
  success = false,
}) => {
  if (!open) return null;

  return createPortal(
    <div className="qr-scan-modal-overlay">
      <div className="qr-scan-modal-content">
        {success ? (
          // Success state
          <div className="qr-scan-modal-body qr-scan-success">
            <div className="qr-scan-success-icon">
              <Check size={48} />
            </div>
            <h3>Pedido Confirmado!</h3>
            <p>O pedido takeaway foi entregue com sucesso.</p>
          </div>
        ) : (
          // Scanning state
          <>
            <div className="qr-scan-modal-header">
              <h2>Verificar QR Code - Entrega Takeaway</h2>
              <button onClick={onClose} className="qr-scan-modal-close">
                &times;
              </button>
            </div>
            <div className="qr-scan-modal-body">
              <QRScanZXingComponent onScan={onScan} freeze={loading} />
              {errorText && <div className="qr-scan-error">{errorText}</div>}
              <div className="qr-scan-instructions">
                Aponte a câmera para o QR code enviado por email ao cliente.
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

// QR Reader Component using ZXing
interface QRScanZXingComponentProps {
  onScan: (scanned: string) => void;
  freeze: boolean;
}

function QRScanZXingComponent({ onScan, freeze }: QRScanZXingComponentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    let codeReader: BrowserQRCodeReader | undefined;
    let active = true;

    const startScan = async () => {
      if (videoRef.current && !freeze) {
        try {
          codeReader = new BrowserQRCodeReader();
          const controls = await codeReader.decodeFromVideoDevice(
            undefined,
            videoRef.current,
            (result, err) => {
              if (result && active) {
                onScan(result.getText());
                active = false;
                if (controlsRef.current) {
                  controlsRef.current.stop();
                }
              }
            }
          );
          controlsRef.current = controls;
        } catch (error) {
          console.error("QR Scanner error:", error);
        }
      }
    };

    startScan();

    return () => {
      active = false;
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
      // Note: BrowserQRCodeReader doesn't have a reset method
    };
  }, [onScan, freeze]);

  return (
    <div className="qr-scan-video-container">
      <video ref={videoRef} className="qr-scan-video" />
      {freeze && (
        <div className="qr-scan-freeze-overlay">Verificando QR...</div>
      )}
    </div>
  );
}

interface TableComponentProps {
  table: Table;
  isSelected: boolean;
  isSelectedForOrder: boolean;
  mode: "view" | "edit";
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onClick: () => void;
  orderTotal?: number; // Add order total prop
  className?: string; // Add className for animations
}

const TableComponent = React.memo<TableComponentProps>(
  ({
    table,
    isSelected,
    isSelectedForOrder,
    mode,
    onMouseDown,
    onTouchStart,
    onClick,
    orderTotal = 0,
    className = "",
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

      // Add animation class if provided
      if (className) classes += ` ${className}`;

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
              <span className="table-order-total">
                €
                <NumberFlow
                  value={orderTotal}
                  format={{
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }}
                />
              </span>
            )}
          </div>
        </div>
        {renderChairs("top")}
        {renderChairs("bottom")}
        {renderChairs("left")}
        {renderChairs("right")}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if these specific props change
    return (
      prevProps.table.x === nextProps.table.x &&
      prevProps.table.y === nextProps.table.y &&
      prevProps.table.width === nextProps.table.width &&
      prevProps.table.height === nextProps.table.height &&
      prevProps.table.number === nextProps.table.number &&
      prevProps.table.shape === nextProps.table.shape &&
      prevProps.table.chairs.length === nextProps.table.chairs.length &&
      prevProps.table.status === nextProps.table.status && // ADD THIS LINE
      prevProps.table.groupColor === nextProps.table.groupColor && // ADD THIS LINE
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isSelectedForOrder === nextProps.isSelectedForOrder &&
      prevProps.orderTotal === nextProps.orderTotal &&
      prevProps.className === nextProps.className &&
      prevProps.mode === nextProps.mode
    );
  }
);

export default TableLayoutManager;
