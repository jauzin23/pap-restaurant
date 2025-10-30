"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ArrowLeft,
  Trash2,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  ChefHat,
  History,
  ChevronDown,
  ChevronRight,
  Edit,
  CreditCard,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Query } from "appwrite";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  DBRESTAURANTE,
  COL_MENU,
  COL_ORDERS,
  COL_TABLES,
  PAYMENT_METHODS,
} from "@/lib/appwrite";
import NumberFlow from '@number-flow/react';

const DB_ID = DBRESTAURANTE;
const MENU_COLLECTION_ID = COL_MENU;
const ORDERS_COLLECTION_ID = COL_ORDERS;
const TABLES_COLLECTION_ID = COL_TABLES;

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { databases, account, client } = useApp();

  // State declarations
  const [user, setUser] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]); // Unpaid orders
  const [paidOrders, setPaidOrders] = useState([]); // Paid orders
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [editingOrder, setEditingOrder] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [menuSearchTerm, setMenuSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [paidOrdersPage, setPaidOrdersPage] = useState(1);
  const [ordersPerPage] = useState(25);
  const [multiTableMode, setMultiTableMode] = useState(null); // Array of table numbers for multi-table orders

  // Paid orders filtering and sorting
  const [paidOrdersSearch, setPaidOrdersSearch] = useState("");
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState("all");
  const [paidOrdersSortBy, setPaidOrdersSortBy] = useState("newest");
  const [selectedTableFilter, setSelectedTableFilter] = useState("all");

  // Temporary input states for delayed updates
  const [tempSearchValue, setTempSearchValue] = useState("");
  const [tempMenuSearchValue, setTempMenuSearchValue] = useState("");
  const [tempEditValues, setTempEditValues] = useState({}); // For editing quantities, prices, observations

  // Sync temporary values with actual values
  useEffect(() => {
    setTempSearchValue(paidOrdersSearch);
  }, [paidOrdersSearch]);

  useEffect(() => {
    setTempMenuSearchValue(menuSearchTerm);
  }, [menuSearchTerm]);

  // Initialize temp edit values when selectedItems changes
  useEffect(() => {
    if (selectedItems.length > 0) {
      const initialValues = {};
      selectedItems.forEach((item, idx) => {
        initialValues[`quantity_${idx}`] = item.quantidade?.toString() || "";
        initialValues[`price_${idx}`] = item.preco?.toString() || "";
        initialValues[`notes_${idx}`] = item.notas || "";
      });
      setTempEditValues(initialValues);
    }
  }, [selectedItems]);

  // Loading states to prevent double clicks
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(new Set()); // Track which orders are being deleted
  const [markingPaid, setMarkingPaid] = useState(new Set()); // Track which orders are being marked as paid
  const [updatingStatus, setUpdatingStatus] = useState(new Set()); // Track which orders are being updated
  const [markingTablePaid, setMarkingTablePaid] = useState(new Set()); // Track which tables are being marked as paid

  // Notification system
  const [notifications, setNotifications] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Notification functions
  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmDialog({ message, onConfirm });
  };

  const hideConfirm = () => {
    setConfirmDialog(null);
  };

  // Helper functions for delayed input updates
  const handleSearchInputChange = (value, setValue) => {
    setValue(value);
  };

  const handleSearchInputBlur = (value, setActualValue) => {
    setActualValue(value);
    setPaidOrdersPage(1); // Reset to first page when search changes
  };

  const handleSearchInputKeyPress = (e, value, setActualValue) => {
    if (e.key === "Enter") {
      setActualValue(value);
      setPaidOrdersPage(1); // Reset to first page when search changes
    }
  };

  // Helper for quantity input (delayed update)
  const handleQuantityBlur = (idx, value) => {
    updateItemQuantity(idx, parseInt(value) || 0);
  };

  const handleQuantityKeyPress = (e, idx, value) => {
    if (e.key === "Enter") {
      updateItemQuantity(idx, parseInt(value) || 0);
    }
  };

  // Helper for editing input changes (quantity, price)
  const handleEditInputChange = (key, value) => {
    setTempEditValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Helper for notes input (delayed update)
  const handleNotesBlur = (idx, value) => {
    updateItemNotes(idx, value);
  };

  const handleNotesKeyPress = (e, idx, value) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      updateItemNotes(idx, value);
    }
  };

  // Helper for price input (delayed update)
  const handlePriceBlur = (idx, value) => {
    updateItemPrice(idx, value);
  };

  const handlePriceKeyPress = (e, idx, value) => {
    if (e.key === "Enter") {
      updateItemPrice(idx, value);
    }
  };

  // Callback definitions
  const fetchUser = useCallback(async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
    } catch (err) {
      console.error("User not found:", err);
      router.push("/login");
    }
  }, [account, router]);

  // Table grouping functions

  // Table grouping functions
  function groupOrdersByTable(orders) {
    return orders.reduce((grouped, order) => {
      // Only group single-table orders by table
      const tables = Array.isArray(order.numeroMesa)
        ? order.numeroMesa
        : [order.numeroMesa];

      // Only include single-table orders in table sections
      if (tables.length === 1) {
        const table = tables[0].toString();
        if (!grouped[table]) {
          grouped[table] = [];
        }
        grouped[table].push(order);
      }
      return grouped;
    }, {});
  }

  // Get multi-table orders (orders that span multiple tables)
  function getMultiTableOrders(orders) {
    return orders.filter((order) => {
      const tables = Array.isArray(order.numeroMesa)
        ? order.numeroMesa
        : [order.numeroMesa];
      return tables.length > 1;
    });
  }

  // Get single table orders for a specific table
  function getSingleTableOrders(orders, tableNumber) {
    return orders.filter((order) => {
      const tables = Array.isArray(order.numeroMesa)
        ? order.numeroMesa
        : [order.numeroMesa];
      return (
        tables.length === 1 && tables[0].toString() === tableNumber.toString()
      );
    });
  }

  function getTableTotal(tableNumber) {
    // Only count single-table orders for individual table totals
    const tableOrders = getSingleTableOrders(activeOrders, tableNumber);
    return tableOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  }

  function toggleTableExpansion(tableNumber) {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableNumber)) {
      newExpanded.delete(tableNumber);
    } else {
      newExpanded.add(tableNumber);
    }
    setExpandedTables(newExpanded);
  }

  // Status icons and colors
  const statusIcons = {
    pendente: Clock,
    preparando: ChefHat,
    pronto: CheckCircle,
    servido: CheckCircle,
    pago: CheckCircle,
    cancelado: AlertCircle,
  };

  const statusColors = {
    pendente: "bg-yellow-900 text-yellow-300 border-yellow-800",
    preparando: "bg-blue-900 text-blue-300 border-blue-800",
    pronto: "bg-orange-900 text-orange-300 border-orange-800",
    servido: "bg-green-900 text-green-300 border-green-800",
    pago: "bg-green-900 text-green-300 border-green-800",
    cancelado: "bg-red-900 text-red-300 border-red-800",
  };

  const statusLabels = {
    pendente: "Pendente",
    preparando: "A fazer",
    pronto: "Pronto",
    servido: "Servido",
    pago: "Pago",
    cancelado: "Cancelado",
  };

  // Effects
  useEffect(() => {
    fetchUser();
  }, [account, router]);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchMenuItems();
      fetchTables();
      fetchPaymentMethods();

      // Setup real-time subscriptions
      const ordersUnsubscribe = subscribeToOrders();
      const tablesUnsubscribe = subscribeToTables();

      // Cleanup subscriptions on unmount
      return () => {
        ordersUnsubscribe();
        tablesUnsubscribe();
      };
    }
  }, [user, databases, client]);

  // Handle URL parameters for auto-expanding tables
  useEffect(() => {
    const tableParam = searchParams.get("table");
    const tablesParam = searchParams.get("tables");

    if (tableParam) {
      // Single table parameter
      const tableNumber = parseInt(tableParam, 10);
      if (!isNaN(tableNumber)) {
        setExpandedTables((prev) => new Set([...prev, tableNumber]));
        setTableNumber(tableNumber); // Pre-select for new orders

        // Scroll to the table section after a short delay to ensure it's rendered
        setTimeout(() => {
          const tableElement = document.getElementById(`table-${tableNumber}`);
          if (tableElement) {
            tableElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }, 100);
      }
    } else if (tablesParam) {
      // Multiple tables parameter
      const tableNumbers = tablesParam
        .split(",")
        .map((num) => parseInt(num.trim(), 10))
        .filter((num) => !isNaN(num));
      if (tableNumbers.length > 0) {
        setExpandedTables((prev) => new Set([...prev, ...tableNumbers]));

        // Auto-open modal for multi-table order creation
        setModalOpen(true);
        setEditingOrder(null);
        setSelectedItems([]);

        // Show special message for multi-table order
        setMultiTableMode(tableNumbers);

        // Scroll to first table
        setTimeout(() => {
          const firstTableElement = document.getElementById(
            `table-${tableNumbers[0]}`
          );
          if (firstTableElement) {
            firstTableElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }, 100);
      }
    }
  }, [searchParams]);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await databases.listDocuments(
        DB_ID,
        ORDERS_COLLECTION_ID,
        [Query.orderDesc("$createdAt")]
      );

      // Separate orders by paid status
      const unpaidOrders = response.documents.filter((doc) => !doc.paid);
      const completedOrders = response.documents.filter((doc) => doc.paid);

      setActiveOrders(unpaidOrders);
      setPaidOrders(completedOrders);

      // Update table statuses based on actual orders
      await updateTableStatuses(unpaidOrders);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  }, [databases]);

  // Function to update table statuses based on actual orders
  async function updateTableStatuses(currentOrders) {
    try {
      // Get all tables
      const tablesResponse = await databases.listDocuments(
        DB_ID,
        TABLES_COLLECTION_ID
      );

      // Group orders by table - handle array format
      const ordersByTable = currentOrders.reduce((acc, order) => {
        // Handle both old single table format and new array format
        const tables = Array.isArray(order.numeroMesa)
          ? order.numeroMesa
          : [order.numeroMesa];
        tables.forEach((tableNum) => {
          if (!acc[tableNum]) acc[tableNum] = [];
          acc[tableNum].push(order);
        });
        return acc;
      }, {});

      // Update each table's status
      for (const table of tablesResponse.documents) {
        const tableOrders = ordersByTable[table.tableNumber] || [];
        const shouldBeOccupied = tableOrders.length > 0;
        const currentStatus = table.status || "free";

        // Only update if status needs to change
        if (
          (shouldBeOccupied && currentStatus === "free") ||
          (!shouldBeOccupied && currentStatus === "occupied")
        ) {
          await databases.updateDocument(
            DB_ID,
            TABLES_COLLECTION_ID,
            table.$id,
            { status: shouldBeOccupied ? "occupied" : "free" }
          );
        }
      }
    } catch (err) {
      console.error("Error updating table statuses:", err);
    }
  }

  const fetchMenuItems = useCallback(async () => {
    try {
      const response = await databases.listDocuments(DB_ID, MENU_COLLECTION_ID);
      setMenuItems(response.documents);
    } catch (err) {
      console.error("Error fetching menu:", err);
    }
  }, [databases]);

  const fetchTables = useCallback(async () => {
    try {
      const response = await databases.listDocuments(
        DB_ID,
        TABLES_COLLECTION_ID
      );
      setTables(response.documents);
    } catch (err) {
      console.error("Error fetching tables:", err);
    }
  }, [databases]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const response = await databases.listDocuments(DB_ID, PAYMENT_METHODS);
      setPaymentMethods(response.documents);
    } catch (err) {
      console.error("Error fetching payment methods:", err);
    }
  }, [databases]);

  const subscribeToOrders = useCallback(() => {
    const unsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.${ORDERS_COLLECTION_ID}.documents`,
      (response) => {
        // Handle different events
        if (
          response.events.some(
            (event) =>
              event.includes("databases.*.collections.*.documents.*.create") ||
              event.includes("databases.*.collections.*.documents.*.update") ||
              event.includes("databases.*.collections.*.documents.*.delete")
          )
        ) {
          // Immediate state update for better UX
          setTimeout(() => {
            fetchOrders();
          }, 100); // Small delay to ensure database consistency
        }
      }
    );

    return unsubscribe;
  }, [client, fetchOrders]);

  const subscribeToTables = useCallback(() => {
    const unsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.${TABLES_COLLECTION_ID}.documents`,
      (response) => {
        // Immediate table update
        setTimeout(() => {
          fetchTables();
        }, 100);
      }
    );

    return unsubscribe;
  }, [client, fetchTables]);

  function openAddModal() {
    setEditingOrder(null);
    setSelectedItems([]);
    setTableNumber("");
    setModalOpen(true);
  }

  function openEditModal(order) {
    setEditingOrder(order);
    // Parse items if they are JSON strings
    const items = order.items || order.itens || [];
    const parsedItems = items.map((item) =>
      typeof item === "string" ? JSON.parse(item) : item
    );
    setSelectedItems(parsedItems);

    // Handle both old single table format and new array format
    const tables = Array.isArray(order.numeroMesa)
      ? order.numeroMesa
      : [order.numeroMesa];
    if (tables.length === 1) {
      setTableNumber(tables[0].toString());
      setMultiTableMode(null);
    } else {
      setMultiTableMode(tables);
      setTableNumber("");
    }

    setModalOpen(true);
  }

  function addItemToOrder(item) {
    // Always add as individual item (quantity 1) for individual tracking
    setSelectedItems([
      ...selectedItems,
      {
        ...item,
        quantidade: 1,
        notas: "",
        // Add unique ID for individual tracking
        itemId: `${item.$id}_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      },
    ]);
  }

  function removeItemFromOrder(index) {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  }

  function updateItemQuantity(index, quantity) {
    if (quantity <= 0) {
      removeItemFromOrder(index);
      return;
    }

    const currentItem = selectedItems[index];
    const currentQuantity = currentItem.quantidade;

    if (quantity > currentQuantity) {
      // Add more individual items
      const itemsToAdd = quantity - currentQuantity;
      const newItems = [];

      for (let i = 0; i < itemsToAdd; i++) {
        newItems.push({
          ...currentItem,
          quantidade: 1,
          itemId: `${currentItem.$id}_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
        });
      }

      setSelectedItems([...selectedItems, ...newItems]);
    } else if (quantity < currentQuantity) {
      // Remove some individual items of the same type
      const itemsToRemove = currentQuantity - quantity;
      const itemsOfSameType = selectedItems
        .map((item, idx) => ({ item, originalIndex: idx }))
        .filter(({ item }) => item.nome === currentItem.nome);

      // Remove from the end
      const indicesToRemove = itemsOfSameType
        .slice(-itemsToRemove)
        .map(({ originalIndex }) => originalIndex);

      setSelectedItems(
        selectedItems.filter((_, i) => !indicesToRemove.includes(i))
      );
    }
    // If quantity is the same, do nothing
  }

  function updateItemNotes(index, notas) {
    const updated = [...selectedItems];
    updated[index].notas = notas;
    setSelectedItems(updated);
  }

  function updateItemPrice(index, price) {
    const updated = [...selectedItems];
    updated[index].preco = parseFloat(price) || 0;
    setSelectedItems(updated);
  }

  // Open payment modal
  function openPaymentModal(orderId) {
    setSelectedOrderForPayment(orderId);
    setSelectedPaymentMethod("");
    setPaymentModalOpen(true);
  }

  // Update individual item status
  async function updateItemStatus(orderId, itemIndex, newStatus) {
    try {
      const order = activeOrders.find((o) => o.$id === orderId);
      if (!order) return;

      const items = order.items || order.itens || [];
      const updatedItems = items.map((item, index) => {
        const parsedItem = typeof item === "string" ? JSON.parse(item) : item;
        if (index === itemIndex) {
          parsedItem.status = newStatus;
        }
        return typeof item === "string"
          ? JSON.stringify(parsedItem)
          : parsedItem;
      });

      // Optimistic update
      setActiveOrders((prev) =>
        prev.map((o) =>
          o.$id === orderId
            ? { ...o, items: updatedItems, itens: updatedItems }
            : o
        )
      );

      // Update database
      await databases.updateDocument(DB_ID, ORDERS_COLLECTION_ID, orderId, {
        itens: updatedItems.map((item) =>
          typeof item === "string" ? item : JSON.stringify(item)
        ),
      });

      addNotification(`Item marcado como ${newStatus}`, "success");
    } catch (err) {
      console.error("Error updating item status:", err);
      addNotification("Erro ao atualizar status do item", "error");
      fetchOrders(); // Revert on error
    }
  }

  // Mark order as paid
  async function markOrderAsPaid(orderId, paymentMethod) {
    if (markingPaid.has(orderId)) return; // Prevent double clicks

    setMarkingPaid((prev) => new Set([...prev, orderId]));
    try {
      // Optimistic update - immediately move order to paid state
      const order = activeOrders.find((o) => o.$id === orderId);
      if (order) {
        const updatedOrder = {
          ...order,
          paid: true,
          status: "pago",
          paymentMethod: paymentMethod,
        };

        // Update UI immediately
        setActiveOrders((prev) => prev.filter((o) => o.$id !== orderId));
        setPaidOrders((prev) => [updatedOrder, ...prev]);
      }

      // Then update database
      await databases.updateDocument(DB_ID, ORDERS_COLLECTION_ID, orderId, {
        paid: true,
        status: "pago",
        paymentMethod: paymentMethod,
      });

      // Check if table should be freed
      if (order) {
        // Handle both old single table format and new array format
        const tables = Array.isArray(order.numeroMesa)
          ? order.numeroMesa
          : [order.numeroMesa];

        for (const tableNum of tables) {
          // Get all orders for this table
          const allOrdersRes = await databases.listDocuments(
            DB_ID,
            ORDERS_COLLECTION_ID,
            [Query.contains("numeroMesa", tableNum)]
          );

          // Check if all orders for this table are paid
          const unpaidOrders = allOrdersRes.documents.filter((doc) => {
            if (doc.paid || doc.$id === orderId) return false;
            // Handle both old single table format and new array format
            const docTables = Array.isArray(doc.numeroMesa)
              ? doc.numeroMesa
              : [doc.numeroMesa];
            return docTables.includes(tableNum);
          });

          if (unpaidOrders.length === 0) {
            // All orders are paid, free the table
            const table = tables.find((t) => t.tableNumber === tableNum);
            if (table && table.status === "occupied") {
              await databases.updateDocument(
                DB_ID,
                TABLES_COLLECTION_ID,
                table.$id,
                { status: "free" }
              );
            }
          }
        }
      }
      setPaymentModalOpen(false);
      addNotification("Pedido marcado como pago!", "success");
    } catch (err) {
      console.error("Erro ao marcar como pago:", err);
      addNotification("Erro ao marcar Pedido como pago", "error");
      // Revert optimistic update on error
      fetchOrders();
    } finally {
      setMarkingPaid((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }

  // Update order status
  async function updateOrderStatus(orderId, newStatus) {
    if (updatingStatus.has(orderId)) return; // Prevent double clicks

    setUpdatingStatus((prev) => new Set([...prev, orderId]));
    try {
      // Optimistic update
      setActiveOrders((prev) =>
        prev.map((order) =>
          order.$id === orderId ? { ...order, status: newStatus } : order
        )
      );

      // Then update database
      await databases.updateDocument(DB_ID, ORDERS_COLLECTION_ID, orderId, {
        status: newStatus,
      });
      addNotification(`Estado actualizado para ${newStatus}`, "success");
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      addNotification("Erro ao actualizar estado", "error");
      // Revert on error
      fetchOrders();
    } finally {
      setUpdatingStatus((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }

  // Mark all orders for a table as paid
  async function markTableAsPaid(tableNumber, paymentMethod) {
    if (markingTablePaid.has(tableNumber)) return; // Prevent double clicks

    setMarkingTablePaid((prev) => new Set([...prev, tableNumber]));
    try {
      const tableOrders = activeOrders.filter((order) => {
        if (order.paid) return false;
        // Handle both old single table format and new array format
        const tables = Array.isArray(order.numeroMesa)
          ? order.numeroMesa
          : [order.numeroMesa];
        return tables.includes(tableNumber);
      });

      // Optimistic update - immediately move all table orders to paid
      const updatedOrders = tableOrders.map((order) => ({
        ...order,
        paid: true,
        status: "pago",
        paymentMethod: paymentMethod,
      }));

      setActiveOrders((prev) =>
        prev.filter((order) => {
          if (order.paid) return true;
          // Handle both old single table format and new array format
          const tables = Array.isArray(order.numeroMesa)
            ? order.numeroMesa
            : [order.numeroMesa];
          return !tables.includes(tableNumber);
        })
      );
      setPaidOrders((prev) => [...updatedOrders, ...prev]);

      // Update database
      for (const order of tableOrders) {
        await databases.updateDocument(DB_ID, ORDERS_COLLECTION_ID, order.$id, {
          paid: true,
          status: "pago",
          paymentMethod: paymentMethod,
        });
      }

      // Free the table
      const table = tables.find((t) => t.tableNumber === tableNumber);
      if (table && table.status === "occupied") {
        await databases.updateDocument(DB_ID, TABLES_COLLECTION_ID, table.$id, {
          status: "free",
        });
      }
      setPaymentModalOpen(false);
      addNotification(`Mesa ${tableNumber} marcada como paga!`, "success");
    } catch (err) {
      console.error("Erro ao marcar mesa como paga:", err);
      addNotification("Erro ao marcar mesa como paga", "error");
      // Revert on error
      fetchOrders();
    } finally {
      setMarkingTablePaid((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tableNumber);
        return newSet;
      });
    }
  }

  // Delete paid order
  async function deletePaidOrder(orderId) {
    showConfirm("Tem a certeza que quer apagar este Pedido pago?", async () => {
      try {
        await databases.deleteDocument(DB_ID, ORDERS_COLLECTION_ID, orderId);
        addNotification("Pedido apagado com sucesso!", "success");
      } catch (err) {
        console.error("Erro ao apagar Pedido pago:", err);
        addNotification("Erro ao apagar Pedido", "error");
      }
    });
  }

  async function handleSave() {
    if (
      (!tableNumber && !multiTableMode) ||
      selectedItems.length === 0 ||
      saving
    )
      return;

    setSaving(true);
    try {
      if (multiTableMode) {
        // Handle multi-table order creation - create ONE order with multiple tables
        const total = selectedItems.reduce(
          (sum, item) => sum + item.quantidade * item.preco,
          0
        );

        // Validate that all selected tables exist
        const validTables = [];
        for (const tableNum of multiTableMode) {
          const selectedTable = tables.find((t) => t.tableNumber === tableNum);
          if (selectedTable) {
            validTables.push(tableNum);
          } else {
            console.warn(`Mesa ${tableNum} não encontrada`);
          }
        }

        if (validTables.length === 0) {
          addNotification("Nenhuma mesa válida selecionada!", "error");
          return;
        }

        const orderData = {
          numeroMesa: validTables, // Array of table numbers
          itens: selectedItems.map((item) =>
            JSON.stringify({
              nome: item.nome,
              preco: item.preco,
              quantidade: item.quantidade,
              notas: item.notas || "",
            })
          ),
          total: total,
          paid: false,
          status: "pendente",
          criadoEm: new Date().toISOString(),
          staffID: user.$id,
        };

        // Create temporary order for immediate UI feedback
        const tempOrder = {
          ...orderData,
          $id: `temp-${validTables.join("-")}-${Date.now()}`,
          $createdAt: new Date().toISOString(),
        };

        setActiveOrders((prev) => [tempOrder, ...prev]);

        const response = await databases.createDocument(
          DB_ID,
          ORDERS_COLLECTION_ID,
          "unique()",
          orderData
        );

        // Replace temp order with real one
        setActiveOrders((prev) =>
          prev.map((order) => (order.$id === tempOrder.$id ? response : order))
        );

        // Mark all tables as occupied if they're currently free
        for (const tableNum of validTables) {
          const selectedTable = tables.find((t) => t.tableNumber === tableNum);
          if (selectedTable && selectedTable.status === "free") {
            await databases.updateDocument(
              DB_ID,
              TABLES_COLLECTION_ID,
              selectedTable.$id,
              { status: "occupied" }
            );
          }
        }

        setModalOpen(false);
        setMultiTableMode(null); // Clear multi-table mode
        addNotification(
          `Pedido criado para ${validTables.length} mesa${
            validTables.length > 1 ? "s" : ""
          }!`,
          "success"
        );

        // Clear form state
        setSelectedItems([]);
        setTableNumber("");
        setEditingOrder(null);

        return;
      }

      // Handle single table order (convert to array format for consistency)
      // Validate that the selected table exists
      const selectedTable = tables.find(
        (t) => t.tableNumber.toString() === tableNumber
      );

      if (!selectedTable) {
        addNotification("Mesa não existe!", "error");
        return;
      }

      const total = selectedItems.reduce(
        (sum, item) => sum + item.quantidade * item.preco,
        0
      );

      const orderData = {
        numeroMesa: [parseInt(tableNumber)], // Convert to array format
        itens: selectedItems.map((item) =>
          JSON.stringify({
            nome: item.nome,
            preco: item.preco,
            quantidade: item.quantidade,
            notas: item.notas || "",
          })
        ),
        total: total,
        paid: false,
        status: "pendente",
        criadoEm: new Date().toISOString(),
        staffID: user.$id,
      };

      if (editingOrder) {
        // Optimistic update for editing
        setActiveOrders((prev) =>
          prev.map((order) =>
            order.$id === editingOrder.$id
              ? {
                  ...orderData,
                  $id: editingOrder.$id,
                  $createdAt: editingOrder.$createdAt,
                }
              : order
          )
        );

        await databases.updateDocument(
          DB_ID,
          ORDERS_COLLECTION_ID,
          editingOrder.$id,
          orderData
        );
      } else {
        // Create temporary order for immediate UI feedback
        const tempOrder = {
          ...orderData,
          $id: `temp-${Date.now()}`,
          $createdAt: new Date().toISOString(),
        };

        setActiveOrders((prev) => [tempOrder, ...prev]);

        const response = await databases.createDocument(
          DB_ID,
          ORDERS_COLLECTION_ID,
          "unique()",
          orderData
        );

        // Replace temp order with real one
        setActiveOrders((prev) =>
          prev.map((order) => (order.$id === tempOrder.$id ? response : order))
        );

        // Mark table as occupied if it's currently free
        if (selectedTable && selectedTable.status === "free") {
          await databases.updateDocument(
            DB_ID,
            TABLES_COLLECTION_ID,
            selectedTable.$id,
            { status: "occupied" }
          );
        }
      }

      setModalOpen(false);
      addNotification(
        editingOrder
          ? "Pedido actualizado com sucesso!"
          : "Pedido criado com sucesso!",
        "success"
      );
    } catch (err) {
      console.error("Erro ao guardar pedido:", err);
      addNotification("Erro ao guardar Pedido", "error");
      // Revert optimistic updates on error
      fetchOrders();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(orderId) {
    if (deleting.has(orderId)) return;

    showConfirm("Tem a certeza que quer apagar este Pedido?", async () => {
      setDeleting((prev) => new Set([...prev, orderId]));
      try {
        const orderToDelete = [...activeOrders, ...paidOrders].find(
          (o) => o.$id === orderId
        );

        // Optimistic update - immediately remove from UI
        setActiveOrders((prev) => prev.filter((o) => o.$id !== orderId));
        setPaidOrders((prev) => prev.filter((o) => o.$id !== orderId));

        await databases.deleteDocument(DB_ID, ORDERS_COLLECTION_ID, orderId);

        if (orderToDelete) {
          // Handle both old single table format and new array format
          const tables = Array.isArray(orderToDelete.numeroMesa)
            ? orderToDelete.numeroMesa
            : [orderToDelete.numeroMesa];

          for (const tableNum of tables) {
            // Check if there are any remaining orders for this table
            const allOrdersRes = await databases.listDocuments(
              DB_ID,
              ORDERS_COLLECTION_ID,
              [Query.contains("numeroMesa", tableNum)]
            );

            // Filter to only include orders that actually contain this table
            const actualOrdersForTable = allOrdersRes.documents.filter(
              (doc) => {
                const docTables = Array.isArray(doc.numeroMesa)
                  ? doc.numeroMesa
                  : [doc.numeroMesa];
                return docTables.includes(tableNum);
              }
            );

            // If no orders left for this table, free it
            if (actualOrdersForTable.length === 0) {
              const table = tables.find((t) => t.tableNumber === tableNum);
              if (table && table.status === "occupied") {
                await databases.updateDocument(
                  DB_ID,
                  TABLES_COLLECTION_ID,
                  table.$id,
                  { status: "free" }
                );
              }
            }
          }
        }
        addNotification("Pedido apagado com sucesso!", "success");
      } catch (err) {
        console.error("Erro ao apagar Pedido:", err);
        addNotification("Erro ao apagar Pedido", "error");
        // Revert on error
        fetchOrders();
      } finally {
        setDeleting((prev) => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }
    });
  }

  if (!user)
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f0f_1px,transparent_1px),linear-gradient(to_bottom,#0f0f0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Loading spinner */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/10 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-t-purple-500 border-r-pink-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>

          {/* Logo and text */}
          <div className="mt-8 text-center">
            <div className="mb-4 flex justify-center"></div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
              Mesa+
            </h2>
            <p className="text-white/50 text-sm">A carregar informações...</p>
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Grid background (consistent with other pages) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f0f_1px,transparent_1px),linear-gradient(to_bottom,#0f0f0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none z-0" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <Header user={user} logo="/logo-icon.svg" />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-neutral-900/60 backdrop-blur-sm border-b border-neutral-700">
            <div className="max-w-7xl mx-auto px-6 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    className="flex items-center gap-2 px-4 py-2 text-white bg-neutral-800/60 hover:bg-neutral-700 rounded-xl border border-neutral-600 hover:border-neutral-500"
                    onClick={() => router.push("/")}
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Voltar
                  </button>
                  <h1 className="text-2xl font-semibold text-white">
                    Gestão de pedidos
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                      showCompleted
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-neutral-800/60 text-white border-neutral-600"
                    }`}
                  >
                    <History className="w-5 h-5" />
                    {showCompleted
                      ? "Ver Pedidos Ativos"
                      : "Ver Pedidos Finalizados"}
                    {showCompleted && (
                      <span className="bg-green-500/30 text-green-300 px-2 py-1 rounded-lg text-xs font-medium">
                        {paidOrders.length}
                      </span>
                    )}
                  </button>
                  {!showCompleted && (
                    <button
                      onClick={openAddModal}
                      className="bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-600 hover:border-neutral-500 font-medium shadow-lg"
                    >
                      <Plus className="w-5 h-5" />
                      Novo Pedido
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-aut">
            <div className="max-w-7xl mx-auto px-6 py-8">
              {/* Active Orders by Table */}
              {!showCompleted && (
                <section className="space-y-8">
                  {/* Multi-Table Orders Section */}
                  {getMultiTableOrders(activeOrders).length > 0 && (
                    <div>
                      <h2 className="text-xl font-bold text-white mb-6">
                        Pedidos Multi-Mesa
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {getMultiTableOrders(activeOrders).map((order) => (
                          <div
                            key={order.$id}
                            className="bg-neutral-900/80 backdrop-blur-sm rounded-xl border border-neutral-700 overflow-hidden shadow-lg hover:shadow-xl hover:border-neutral-600 transition-all duration-300"
                          >
                            {/* Multi-Table Order Header */}
                            <div className="bg-neutral-800/60 p-4 border-b border-neutral-700">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-xl font-bold text-white">
                                    Mesa
                                    {Array.isArray(order.numeroMesa) &&
                                    order.numeroMesa.length > 1
                                      ? "s"
                                      : ""}{" "}
                                    {Array.isArray(order.numeroMesa)
                                      ? order.numeroMesa.join(", ")
                                      : order.numeroMesa}
                                  </span>
                                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-sm rounded-lg border border-purple-500/30">
                                    Multi-Mesa
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openEditModal(order)}
                                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg border border-yellow-500 transition-colors duration-200 flex items-center gap-1.5"
                                  >
                                    <Edit className="w-4 h-4" />
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => openPaymentModal(order.$id)}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg border border-green-500 transition-colors duration-200 flex items-center gap-1.5"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                    Pagar
                                  </button>
                                  <button
                                    onClick={() => handleDelete(order.$id)}
                                    disabled={deleting.has(order.$id)}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white text-sm rounded-lg border border-red-500 transition-colors duration-200 flex items-center gap-1.5"
                                  >
                                    {deleting.has(order.$id) ? (
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                    Apagar
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-white/70 text-sm">
                                  #{order.$id.slice(-6)} •{" "}
                                  {new Date(order.$createdAt).toLocaleString(
                                    "pt"
                                  )}
                                </span>
                                <span className="text-xl font-bold text-green-400">
                                  <NumberFlow value={order.total || 0} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />€
                                </span>
                              </div>
                            </div>

                            {/* Multi-Table Order Items */}
                            <div className="p-4 space-y-3">
                              {(order.items || order.itens || []).map(
                                (item, index) => {
                                  const parsedItem =
                                    typeof item === "string"
                                      ? JSON.parse(item)
                                      : item;
                                  return (
                                    <div
                                      key={index}
                                      className="flex justify-between items-center py-2 border-b border-neutral-700/50 last:border-0"
                                    >
                                      <div className="flex-1">
                                        <span className="text-white font-medium">
                                          {parsedItem.nome}
                                        </span>
                                        {parsedItem.notas && (
                                          <p className="text-white/60 text-sm">
                                            {parsedItem.notas}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className="text-white/70 text-sm">
                                          {parsedItem.quantidade ||
                                            parsedItem.quantity}
                                          x
                                        </span>
                                        <span className="text-white font-medium ml-2">
                                          {(
                                            (parsedItem.preco ||
                                              parsedItem.price) *
                                            (parsedItem.quantidade ||
                                              parsedItem.quantity)
                                          ).toFixed(2)}
                                          €
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Single Table Orders Section */}
                  <div>
                    <h2 className="text-xl font-bold text-white mb-6">
                      Pedidos por Mesa Individual
                    </h2>
                    {Object.keys(groupOrdersByTable(activeOrders)).length ===
                      0 && getMultiTableOrders(activeOrders).length === 0 ? (
                      <div className="text-center py-16">
                        <div className="bg-neutral-900/60 backdrop-blur-sm rounded-xl border border-neutral-700 p-8 max-w-md mx-auto">
                          <p className="text-white/70 text-lg mb-2">
                            Não há pedidos ativos no momento.
                          </p>
                          <p className="text-white/50 text-sm">
                            Clique em "Novo Pedido" para começar
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {Object.entries(groupOrdersByTable(activeOrders)).map(
                          ([tableNumber, orders]) => (
                            <div
                              key={tableNumber}
                              id={`table-${tableNumber}`}
                              className="bg-neutral-900/80 backdrop-blur-sm rounded-xl border border-neutral-700 overflow-hidden shadow-lg hover:shadow-xl hover:border-neutral-600 transition-all duration-300"
                            >
                              {/* Table Header */}
                              <div className="bg-neutral-800/60 p-4 border-b border-neutral-700">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl font-bold text-white">
                                      Mesa {tableNumber}
                                    </span>
                                    <span className="px-2 py-1 bg-red-500/20 text-red-400 text-sm rounded-lg border border-red-500/30">
                                      {orders.length} Pedido
                                      {orders.length > 1 ? "s" : ""}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setTableNumber(tableNumber);
                                        setSelectedItems([]);
                                        setEditingOrder(null);
                                        setModalOpen(true);
                                      }}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg border border-blue-500 transition-colors duration-200 flex items-center gap-1.5"
                                      title={`Adicionar pedido à Mesa ${tableNumber}`}
                                    >
                                      <Plus className="w-4 h-4" />
                                      Novo Pedido
                                    </button>
                                    <button
                                      onClick={() =>
                                        toggleTableExpansion(tableNumber)
                                      }
                                      className="text-white/60 hover:text-white"
                                    >
                                      {expandedTables.has(tableNumber) ? (
                                        <ChevronDown className="w-5 h-5" />
                                      ) : (
                                        <ChevronRight className="w-5 h-5" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Status badges */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {(() => {
                                    const statuses = orders.reduce(
                                      (acc, order) => {
                                        const status =
                                          order.status || "pendente";
                                        acc[status] = (acc[status] || 0) + 1;
                                        return acc;
                                      },
                                      {}
                                    );

                                    return Object.entries(statuses).map(
                                      ([status, count]) => (
                                        <span
                                          key={status}
                                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border ${statusColors[status]}`}
                                        >
                                          {(() => {
                                            const StatusIcon =
                                              statusIcons[status];
                                            return (
                                              <StatusIcon className="w-3 h-3" />
                                            );
                                          })()}
                                          {count}x {statusLabels[status]}
                                        </span>
                                      )
                                    );
                                  })()}
                                </div>

                                {/* Table total and pay button */}
                                <div className="flex items-center justify-between">
                                  <span className="text-lg font-bold text-green-400">
                                    Total: €
                                    {getTableTotal(tableNumber).toFixed(2)}
                                  </span>
                                  {(() => {
                                    // Check if all items in all orders for this table are served
                                    const allTableItems = orders.flatMap(
                                      (order) =>
                                        order.items || order.itens || []
                                    );
                                    const allItemsServed = allTableItems.every(
                                      (item) => {
                                        const parsedItem =
                                          typeof item === "string"
                                            ? JSON.parse(item)
                                            : item;
                                        return parsedItem.status === "servido";
                                      }
                                    );

                                    return allItemsServed &&
                                      allTableItems.length > 0 ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedOrderForPayment(
                                            `table-${tableNumber}`
                                          );
                                          setSelectedPaymentMethod("");
                                          setPaymentModalOpen(true);
                                        }}
                                        disabled={markingTablePaid.has(
                                          parseInt(tableNumber)
                                        )}
                                        className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium border border-green-500/30 hover:border-green-500/50 disabled:opacity-50"
                                      >
                                        {markingTablePaid.has(
                                          parseInt(tableNumber)
                                        ) ? (
                                          <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                                            <span>A processar...</span>
                                          </div>
                                        ) : (
                                          "Marcar Mesa como Paga"
                                        )}
                                      </button>
                                    ) : (
                                      <span className="px-3 py-1.5 bg-neutral-500/20 text-neutral-400 rounded-lg text-sm font-medium border border-neutral-500/30">
                                        Itens por servir...
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Orders List */}
                              {expandedTables.has(tableNumber) && (
                                <div className="p-4 space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                                  {orders.map((order) => (
                                    <div
                                      key={order.$id}
                                      className="bg-neutral-800/40 p-3 rounded-lg border border-neutral-700"
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <h4 className="font-semibold text-white text-sm">
                                            Pedido #{order.$id.slice(-6)}
                                          </h4>
                                          <p className="text-xs text-white/60">
                                            {new Date(
                                              order.$createdAt
                                            ).toLocaleString("pt")}
                                          </p>
                                        </div>
                                        <span className="text-sm font-bold text-green-400">
                                          €<NumberFlow value={order.total} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
                                        </span>
                                      </div>

                                      {/* Order items */}
                                      <div className="space-y-1 mb-3">
                                        {(order.items || order.itens || []).map(
                                          (item, idx) => {
                                            const parsedItem =
                                              typeof item === "string"
                                                ? JSON.parse(item)
                                                : item;
                                            const itemStatus =
                                              parsedItem.status || "pendente";
                                            return (
                                              <div
                                                key={idx}
                                                className="flex justify-between items-center text-xs bg-neutral-900/50 p-2 rounded border border-neutral-700"
                                              >
                                                <div className="flex-1">
                                                  <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-white/80">
                                                        {parsedItem.quantidade}x{" "}
                                                        {parsedItem.nome}
                                                      </span>
                                                      <span
                                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                          itemStatus ===
                                                          "pendente"
                                                            ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                                                            : itemStatus ===
                                                              "preparando"
                                                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                                            : itemStatus ===
                                                              "pronto"
                                                            ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                                            : itemStatus ===
                                                              "servido"
                                                            ? "bg-green-500/20 text-green-300 border border-green-500/30"
                                                            : "bg-neutral-500/20 text-neutral-300 border border-neutral-500/30"
                                                        }`}
                                                      >
                                                        {itemStatus ===
                                                        "pendente"
                                                          ? "Pendente"
                                                          : itemStatus ===
                                                            "preparando"
                                                          ? "A fazer"
                                                          : itemStatus ===
                                                            "pronto"
                                                          ? "Pronto"
                                                          : itemStatus ===
                                                            "servido"
                                                          ? "Servido"
                                                          : itemStatus}
                                                      </span>
                                                    </div>
                                                    <span className="text-white/80 ml-2">
                                                      €
                                                      {(
                                                        parsedItem.quantidade *
                                                        parsedItem.preco
                                                      ).toFixed(2)}
                                                    </span>
                                                  </div>
                                                  {parsedItem.notas && (
                                                    <div className="mb-2">
                                                      <span className="text-white/50 text-xs italic">
                                                        {parsedItem.notas}
                                                      </span>
                                                    </div>
                                                  )}
                                                  <div className="flex gap-1">
                                                    {itemStatus ===
                                                      "pendente" && (
                                                      <button
                                                        onClick={() =>
                                                          updateItemStatus(
                                                            order.$id,
                                                            idx,
                                                            "preparando"
                                                          )
                                                        }
                                                        className="px-1 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs border border-blue-500/30 hover:bg-blue-500/30"
                                                      >
                                                        Começar
                                                      </button>
                                                    )}
                                                    {itemStatus ===
                                                      "preparando" && (
                                                      <button
                                                        onClick={() =>
                                                          updateItemStatus(
                                                            order.$id,
                                                            idx,
                                                            "pronto"
                                                          )
                                                        }
                                                        className="px-1 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs border border-orange-500/30 hover:bg-orange-500/30"
                                                      >
                                                        Terminar
                                                      </button>
                                                    )}
                                                    {itemStatus ===
                                                      "pronto" && (
                                                      <button
                                                        onClick={() =>
                                                          updateItemStatus(
                                                            order.$id,
                                                            idx,
                                                            "servido"
                                                          )
                                                        }
                                                        className="px-1 py-0.5 bg-green-500/20 text-green-300 rounded text-xs border border-green-500/30 hover:bg-green-500/30"
                                                      >
                                                        Entregar
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          }
                                        )}
                                      </div>

                                      {/* Action buttons */}
                                      <div className="flex flex-wrap gap-1">
                                        {/* Only show payment button if ALL items are served */}
                                        {(() => {
                                          const allItems =
                                            order.items || order.itens || [];
                                          const allItemsServed = allItems.every(
                                            (item) => {
                                              const parsedItem =
                                                typeof item === "string"
                                                  ? JSON.parse(item)
                                                  : item;
                                              return (
                                                parsedItem.status === "servido"
                                              );
                                            }
                                          );

                                          return (
                                            allItemsServed &&
                                            allItems.length > 0 && (
                                              <button
                                                onClick={() =>
                                                  openPaymentModal(order.$id)
                                                }
                                                disabled={markingPaid.has(
                                                  order.$id
                                                )}
                                                className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded border border-green-500/30 disabled:opacity-50"
                                              >
                                                {markingPaid.has(order.$id) ? (
                                                  <div className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                  "Pagar"
                                                )}
                                              </button>
                                            )
                                          );
                                        })()}
                                        <button
                                          onClick={() => openEditModal(order)}
                                          className="px-2 py-1 bg-neutral-700/60 hover:bg-neutral-600 text-white text-xs rounded border border-neutral-600"
                                        >
                                          Editar
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDelete(order.$id)
                                          }
                                          disabled={deleting.has(order.$id)}
                                          className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs rounded border border-red-500/30 disabled:opacity-50"
                                        >
                                          {deleting.has(order.$id) ? (
                                            <div className="flex items-center space-x-1">
                                              <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                                              <span>A apagar...</span>
                                            </div>
                                          ) : (
                                            "Apagar"
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Paid Orders */}
              {showCompleted && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">
                      Pedidos Pagos
                    </h2>
                    {paidOrders.length > 0 && (
                      <div className="text-sm text-white/60">
                        Total: {paidOrders.length} pedidos
                      </div>
                    )}
                  </div>

                  {/* Filters and Search */}
                  {paidOrders.length > 0 && (
                    <div className="bg-neutral-900/60 backdrop-blur-sm rounded-xl border border-neutral-700 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Search */}
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">
                            Procurar
                          </label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                            <input
                              type="text"
                              value={tempSearchValue}
                              onChange={(e) =>
                                handleSearchInputChange(
                                  e.target.value,
                                  setTempSearchValue
                                )
                              }
                              onBlur={() =>
                                handleSearchInputBlur(
                                  tempSearchValue,
                                  setPaidOrdersSearch
                                )
                              }
                              onKeyDown={(e) =>
                                handleSearchInputKeyPress(
                                  e,
                                  tempSearchValue,
                                  setPaidOrdersSearch
                                )
                              }
                              className="w-full pl-10 pr-4 py-2 bg-black border border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:border-white/50 text-sm"
                              placeholder="Mesa, ID, itens..."
                            />
                          </div>
                        </div>

                        {/* Payment Method Filter */}
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">
                            Método de Pagamento
                          </label>
                          <select
                            value={selectedPaymentFilter}
                            onChange={(e) =>
                              setSelectedPaymentFilter(e.target.value)
                            }
                            className="w-full pl-3 pr-8 py-2 bg-black border border-white/20 rounded text-white focus:outline-none focus:border-white/50 text-sm"
                          >
                            <option value="all">Todos</option>
                            {[
                              ...new Set(
                                paidOrders
                                  .map((order) => order.paymentMethod)
                                  .filter(Boolean)
                              ),
                            ].map((method) => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Table Filter */}
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">
                            Mesa
                          </label>
                          <select
                            value={selectedTableFilter}
                            onChange={(e) =>
                              setSelectedTableFilter(e.target.value)
                            }
                            className="w-full pl-3 pr-8 py-2 bg-black border border-white/20 rounded text-white focus:outline-none focus:border-white/50 text-sm"
                          >
                            <option value="all">Todas</option>
                            {[
                              ...new Set(
                                paidOrders
                                  .map((order) => order.numeroMesa)
                                  .filter(Boolean)
                              ),
                            ]
                              .sort((a, b) => a - b)
                              .map((mesa) => (
                                <option key={mesa} value={mesa}>
                                  Mesa {mesa}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Sort By */}
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">
                            Ordenar por
                          </label>
                          <select
                            value={paidOrdersSortBy}
                            onChange={(e) =>
                              setPaidOrdersSortBy(e.target.value)
                            }
                            className="w-full pl-3 pr-8 py-2 bg-black border border-white/20 rounded text-white focus:outline-none focus:border-white/50 text-sm"
                          >
                            <option value="newest">Mais recente</option>
                            <option value="oldest">Mais antigo</option>
                            <option value="table-asc">Mesa (crescente)</option>
                            <option value="table-desc">
                              Mesa (decrescente)
                            </option>
                            <option value="value-high">Valor (maior)</option>
                            <option value="value-low">Valor (menor)</option>
                          </select>
                        </div>
                      </div>

                      {/* Clear Filters */}
                      {(paidOrdersSearch ||
                        selectedPaymentFilter !== "all" ||
                        selectedTableFilter !== "all" ||
                        paidOrdersSortBy !== "newest") && (
                        <div className="mt-3 pt-3 border-t border-neutral-700">
                          <button
                            onClick={() => {
                              setPaidOrdersSearch("");
                              setSelectedPaymentFilter("all");
                              setSelectedTableFilter("all");
                              setPaidOrdersSortBy("newest");
                              setPaidOrdersPage(1);
                            }}
                            className="text-sm text-white/60 hover:text-white/80 underline"
                          >
                            Limpar filtros
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {paidOrders.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="bg-neutral-900/60 backdrop-blur-sm rounded-xl border border-neutral-700 p-8 max-w-md mx-auto">
                        <p className="text-white/70 text-lg mb-2">
                          Não há pedidos pagas hoje.
                        </p>
                        <p className="text-white/50 text-sm">
                          As pedidos pagas aparecerão aqui
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {(() => {
                          // Filter orders
                          let filteredOrders = paidOrders.filter((order) => {
                            // Search filter
                            if (paidOrdersSearch) {
                              const searchLower =
                                paidOrdersSearch.toLowerCase();
                              const matchesSearch =
                                order.numeroMesa
                                  .toString()
                                  .includes(searchLower) ||
                                order.$id.toLowerCase().includes(searchLower) ||
                                (order.items || order.itens || []).some(
                                  (item) => {
                                    const parsedItem =
                                      typeof item === "string"
                                        ? JSON.parse(item)
                                        : item;
                                    return parsedItem.nome
                                      .toLowerCase()
                                      .includes(searchLower);
                                  }
                                );
                              if (!matchesSearch) return false;
                            }

                            // Payment method filter
                            if (selectedPaymentFilter !== "all") {
                              if (order.paymentMethod !== selectedPaymentFilter)
                                return false;
                            }

                            // Table filter
                            if (selectedTableFilter !== "all") {
                              if (
                                order.numeroMesa.toString() !==
                                selectedTableFilter
                              )
                                return false;
                            }

                            return true;
                          });

                          // Sort orders
                          filteredOrders.sort((a, b) => {
                            switch (paidOrdersSortBy) {
                              case "oldest":
                                return (
                                  new Date(a.$createdAt) -
                                  new Date(b.$createdAt)
                                );
                              case "table-asc":
                                return a.numeroMesa - b.numeroMesa;
                              case "table-desc":
                                return b.numeroMesa - a.numeroMesa;
                              case "value-high":
                                return b.total - a.total;
                              case "value-low":
                                return a.total - b.total;
                              case "newest":
                              default:
                                return (
                                  new Date(b.$createdAt) -
                                  new Date(a.$createdAt)
                                );
                            }
                          });

                          return filteredOrders
                            .slice(
                              (paidOrdersPage - 1) * ordersPerPage,
                              paidOrdersPage * ordersPerPage
                            )
                            .map((order) => (
                              <div
                                key={order.$id}
                                className="bg-neutral-900/80 backdrop-blur-sm rounded-xl border border-neutral-700 p-4 shadow-lg hover:shadow-xl hover:border-neutral-600 transition-all duration-300"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <h4 className="font-semibold text-white">
                                      Mesa
                                      {Array.isArray(order.numeroMesa) &&
                                      order.numeroMesa.length > 1
                                        ? "s"
                                        : ""}{" "}
                                      {Array.isArray(order.numeroMesa)
                                        ? order.numeroMesa.join(", ")
                                        : order.numeroMesa}
                                    </h4>
                                    <p className="text-xs text-white/60">
                                      Pedido #{order.$id.slice(-6)}
                                    </p>
                                    <p className="text-xs text-white/50">
                                      {new Date(
                                        order.$createdAt
                                      ).toLocaleString("pt")}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-lg font-bold text-green-400">
                                      €<NumberFlow value={order.total} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
                                    </span>
                                    <div className="text-xs text-green-400 font-medium flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      Pago
                                      {order.paymentMethod && (
                                        <span className="ml-1 px-1 py-0.5 bg-green-500/20 text-green-300 rounded border border-green-500/30">
                                          {order.paymentMethod}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1 mb-3">
                                  {(order.items || order.itens || []).map(
                                    (item, idx) => {
                                      const parsedItem =
                                        typeof item === "string"
                                          ? JSON.parse(item)
                                          : item;
                                      return (
                                        <div
                                          key={idx}
                                          className="flex justify-between text-xs text-white/80"
                                        >
                                          <span>
                                            {parsedItem.quantidade}x{" "}
                                            {parsedItem.nome}
                                            {parsedItem.notas && (
                                              <span className="text-white/50 ml-1">
                                                ({parsedItem.notas})
                                              </span>
                                            )}
                                          </span>
                                          <span>
                                            €
                                            {(
                                              parsedItem.quantidade *
                                              parsedItem.preco
                                            ).toFixed(2)}
                                          </span>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>

                                {/* Always position delete button at bottom right */}
                                <div className="flex justify-end mt-auto">
                                  <button
                                    onClick={() => deletePaidOrder(order.$id)}
                                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs border border-red-500/30 hover:border-red-500/50 flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Apagar
                                  </button>
                                </div>
                              </div>
                            ));
                        })()}
                      </div>

                      {/* Pagination */}
                      {Math.ceil(paidOrders.length / ordersPerPage) > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                          <button
                            onClick={() =>
                              setPaidOrdersPage(Math.max(1, paidOrdersPage - 1))
                            }
                            disabled={paidOrdersPage === 1}
                            className="px-4 py-2 bg-neutral-800/60 text-white rounded-lg border border-neutral-600 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Anterior
                          </button>

                          <div className="flex gap-1">
                            {Array.from(
                              {
                                length: Math.ceil(
                                  paidOrders.length / ordersPerPage
                                ),
                              },
                              (_, i) => i + 1
                            )
                              .slice(
                                Math.max(0, paidOrdersPage - 3),
                                Math.min(
                                  Math.ceil(paidOrders.length / ordersPerPage),
                                  paidOrdersPage + 2
                                )
                              )
                              .map((page) => (
                                <button
                                  key={page}
                                  onClick={() => setPaidOrdersPage(page)}
                                  className={`px-3 py-2 rounded-lg border ${
                                    page === paidOrdersPage
                                      ? "bg-neutral-700 text-white border-neutral-600"
                                      : "bg-neutral-800/60 text-white/80 border-neutral-600 hover:bg-neutral-700"
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}
                          </div>

                          <button
                            onClick={() =>
                              setPaidOrdersPage(
                                Math.min(
                                  Math.ceil(paidOrders.length / ordersPerPage),
                                  paidOrdersPage + 1
                                )
                              )
                            }
                            disabled={
                              paidOrdersPage ===
                              Math.ceil(paidOrders.length / ordersPerPage)
                            }
                            className="px-4 py-2 bg-neutral-800/60 text-white rounded-lg border border-neutral-600 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Próxima
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>

        {/* Order Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-neutral-900/95 backdrop-blur-sm rounded-xl border border-neutral-700 w-full h-full sm:h-[95vh] max-w-none sm:max-w-[95vw] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent shadow-2xl">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">
                    {editingOrder ? "Editar Pedido" : "Novo Pedido"}
                  </h2>
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      setMultiTableMode(null); // Clear multi-table mode
                    }}
                    className="text-white/60 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex flex-col xl:grid xl:grid-cols-2 gap-4 sm:gap-6 h-full">
                  {/* Order Form */}
                  <div className="space-y-4 sm:space-y-6 xl:flex-1">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Mesas
                      </label>
                      <div className="space-y-3">
                        {/* Selected Tables Display */}
                        {(multiTableMode?.length > 0 || tableNumber) && (
                          <div className="bg-black border-2 border-blue-500/50 rounded p-3">
                            <div className="text-blue-300 text-sm mb-2">
                              {multiTableMode?.length > 1 ||
                              (multiTableMode?.length === 1 && !tableNumber)
                                ? "Pedido para múltiplas mesas:"
                                : "Mesa selecionada:"}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {multiTableMode ? (
                                multiTableMode.map((tableNum, index) => (
                                  <span
                                    key={tableNum}
                                    className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
                                  >
                                    Mesa {tableNum}
                                    <button
                                      onClick={() => {
                                        const newTables = multiTableMode.filter(
                                          (t) => t !== tableNum
                                        );
                                        if (newTables.length === 0) {
                                          setMultiTableMode(null);
                                          setTableNumber("");
                                        } else if (newTables.length === 1) {
                                          setMultiTableMode(null);
                                          setTableNumber(newTables[0]);
                                        } else {
                                          setMultiTableMode(newTables);
                                        }
                                      }}
                                      className="hover:bg-red-500 rounded-full p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))
                              ) : tableNumber ? (
                                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                                  Mesa {tableNumber}
                                  <button
                                    onClick={() => setTableNumber("")}
                                    className="hover:bg-red-500 rounded-full p-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        )}

                        {/* Table Selection Dropdown */}
                        <div>
                          <select
                            value=""
                            onChange={(e) => {
                              const selectedTableNum = parseInt(e.target.value);
                              if (!selectedTableNum) return;

                              // Check if table is already selected
                              const isAlreadySelected =
                                multiTableMode?.includes(selectedTableNum) ||
                                tableNumber == selectedTableNum;

                              if (isAlreadySelected) return;

                              if (multiTableMode) {
                                // Add to existing multi-table selection
                                setMultiTableMode([
                                  ...multiTableMode,
                                  selectedTableNum,
                                ]);
                              } else if (tableNumber) {
                                // Convert single table to multi-table
                                setMultiTableMode([
                                  parseInt(tableNumber),
                                  selectedTableNum,
                                ]);
                                setTableNumber("");
                              } else {
                                // First table selection
                                setTableNumber(selectedTableNum);
                              }
                            }}
                            className="w-full pl-3 pr-8 py-3 sm:py-2 bg-black border-2 border-white/20 rounded text-white text-base sm:text-sm focus:outline-none focus:border-white/50 hover:border-white/30 transition-colors"
                          >
                            <option value="">+ Adicionar Mesa</option>
                            {tables
                              .sort((a, b) => a.tableNumber - b.tableNumber)
                              .filter((table) => {
                                // Filter out already selected tables
                                const isSelected =
                                  multiTableMode?.includes(table.tableNumber) ||
                                  tableNumber == table.tableNumber;
                                return !isSelected;
                              })
                              .map((table) => (
                                <option
                                  key={table.$id}
                                  value={table.tableNumber}
                                >
                                  Mesa {table.tableNumber} (
                                  {table.status === "free"
                                    ? "Livre"
                                    : "Ocupada"}
                                  )
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Table info for single selection */}
                        {tableNumber && !multiTableMode && (
                          <div className="mt-2">
                            {(() => {
                              const selectedTable = tables.find(
                                (t) => t.tableNumber.toString() === tableNumber
                              );
                              if (selectedTable) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-3 h-3 rounded-full ${
                                        selectedTable.status === "free"
                                          ? "bg-green-400"
                                          : "bg-red-400"
                                      }`}
                                    ></div>
                                    <span className="text-sm text-white/70">
                                      Mesa {selectedTable.tableNumber} -{" "}
                                      {selectedTable.status === "free"
                                        ? "Livre"
                                        : "Ocupada"}{" "}
                                      - {selectedTable.chairs} lugares
                                    </span>
                                  </div>
                                );
                              }
                              return (
                                <span className="text-sm text-red-400">
                                  Mesa não encontrada
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-white mb-4">
                        Itens Seleccionados
                      </h3>
                      {selectedItems.length === 0 ? (
                        <p className="text-white/60">
                          Nenhum item seleccionado
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {(() => {
                            // Group items by name for display while keeping individual tracking
                            const groupedItems = selectedItems.reduce(
                              (groups, item, idx) => {
                                const key = item.nome;
                                if (!groups[key]) {
                                  groups[key] = [];
                                }
                                groups[key].push({
                                  ...item,
                                  originalIndex: idx,
                                });
                                return groups;
                              },
                              {}
                            );

                            return Object.entries(groupedItems).map(
                              ([itemName, itemGroup]) => (
                                <div
                                  key={itemName}
                                  className="bg-neutral-800/60 p-3 rounded-xl border border-neutral-700"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-medium text-white">
                                      {itemName}{" "}
                                      {itemGroup.length > 1 && (
                                        <span className="text-sm text-white/60">
                                          ({itemGroup.length} unidades)
                                        </span>
                                      )}
                                    </h4>
                                    <button
                                      onClick={() => {
                                        // Remove all items of this type
                                        const indicesToRemove = itemGroup.map(
                                          (g) => g.originalIndex
                                        );
                                        setSelectedItems(
                                          selectedItems.filter(
                                            (_, i) =>
                                              !indicesToRemove.includes(i)
                                          )
                                        );
                                      }}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Show individual items */}
                                  <div className="space-y-2">
                                    {itemGroup.map((item, groupIdx) => (
                                      <div
                                        key={groupIdx}
                                        className="bg-neutral-700/40 p-2 rounded-lg border border-neutral-600"
                                      >
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-sm text-white/80">
                                            Unidade {groupIdx + 1}
                                          </span>
                                          <button
                                            onClick={() =>
                                              removeItemFromOrder(
                                                item.originalIndex
                                              )
                                            }
                                            className="text-red-400 hover:text-red-300"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                          <div>
                                            <label className="block text-xs text-white/70 mb-1">
                                              Preço (€)
                                            </label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={
                                                tempEditValues[
                                                  `price_${item.originalIndex}`
                                                ] !== undefined
                                                  ? tempEditValues[
                                                      `price_${item.originalIndex}`
                                                    ]
                                                  : item.preco
                                              }
                                              onChange={(e) =>
                                                handleEditInputChange(
                                                  `price_${item.originalIndex}`,
                                                  e.target.value
                                                )
                                              }
                                              onBlur={(e) =>
                                                handlePriceBlur(
                                                  item.originalIndex,
                                                  e.target.value
                                                )
                                              }
                                              onKeyDown={(e) =>
                                                handlePriceKeyPress(
                                                  e,
                                                  item.originalIndex,
                                                  e.target.value
                                                )
                                              }
                                              className="w-full px-2 py-1 bg-black border border-white/30 rounded text-white text-sm focus:outline-none focus:border-white/70 hover:border-white/50 transition-colors"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-white/70 mb-1">
                                              Status
                                            </label>
                                            <select
                                              value={item.status || "pendente"}
                                              onChange={(e) => {
                                                const updated = [
                                                  ...selectedItems,
                                                ];
                                                updated[
                                                  item.originalIndex
                                                ].status = e.target.value;
                                                setSelectedItems(updated);
                                              }}
                                              className="w-full pl-2 pr-6 py-1 bg-black border border-white/30 rounded text-white text-sm focus:outline-none focus:border-white/70 hover:border-white/50 transition-colors"
                                            >
                                              <option value="pendente">
                                                Pendente
                                              </option>
                                              <option value="preparando">
                                                A fazer
                                              </option>
                                              <option value="pronto">
                                                Pronto
                                              </option>
                                              <option value="servido">
                                                Servido
                                              </option>
                                            </select>
                                          </div>
                                        </div>

                                        <div>
                                          <label className="block text-xs text-white/70 mb-1">
                                            Observações
                                          </label>
                                          <textarea
                                            value={
                                              tempEditValues[
                                                `notes_${item.originalIndex}`
                                              ] !== undefined
                                                ? tempEditValues[
                                                    `notes_${item.originalIndex}`
                                                  ]
                                                : item.notas
                                            }
                                            onChange={(e) =>
                                              handleEditInputChange(
                                                `notes_${item.originalIndex}`,
                                                e.target.value
                                              )
                                            }
                                            onBlur={(e) =>
                                              handleNotesBlur(
                                                item.originalIndex,
                                                e.target.value
                                              )
                                            }
                                            onKeyDown={(e) =>
                                              handleNotesKeyPress(
                                                e,
                                                item.originalIndex,
                                                e.target.value
                                              )
                                            }
                                            className="w-full px-2 py-1 bg-black border border-white/30 rounded text-white text-sm focus:outline-none focus:border-white/70 hover:border-white/50 transition-colors placeholder-white/70"
                                            rows={2}
                                            placeholder="Observações especiais..."
                                          />
                                        </div>

                                        <div className="mt-2 text-right">
                                          <span className="text-white font-medium text-sm">
                                            €<NumberFlow value={item.preco} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Add more button */}
                                  <button
                                    onClick={() => {
                                      const baseItem = itemGroup[0];
                                      addItemToOrder({
                                        ...baseItem,
                                        $id: baseItem.$id || baseItem.nome,
                                      });
                                    }}
                                    className="mt-2 w-full px-3 py-1.5 bg-neutral-600/60 hover:bg-neutral-500/60 text-white text-sm rounded-lg border border-neutral-500 transition-colors"
                                  >
                                    + Adicionar mais uma unidade
                                  </button>
                                </div>
                              )
                            );
                          })()}
                          <div className="border-t border-neutral-700 pt-3">
                            <div className="text-right">
                              <span className="text-lg font-bold text-white">
                                Total Geral: €
                                {selectedItems
                                  .reduce(
                                    (sum, item) =>
                                      sum + item.quantidade * item.preco,
                                    0
                                  )
                                  .toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setModalOpen(false);
                          setMultiTableMode(null); // Clear multi-table mode
                        }}
                        disabled={saving}
                        className="flex-1 px-6 py-4 sm:px-4 sm:py-2 border-2 border-white/30 text-white text-base sm:text-sm rounded-xl hover:bg-white/10 hover:border-white/50 disabled:opacity-50 transition-colors touch-manipulation font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={
                          (!tableNumber && !multiTableMode) ||
                          selectedItems.length === 0 ||
                          saving
                        }
                        className="flex-1 px-6 py-4 sm:px-4 sm:py-2 bg-white text-black text-base sm:text-sm rounded-xl hover:bg-white/90 border-2 border-white disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors touch-manipulation"
                      >
                        {saving ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                            <span>
                              {editingOrder ? "Actualizar..." : "A criar..."}
                            </span>
                          </div>
                        ) : (
                          `${editingOrder ? "Actualizar" : "Criar"} Pedido`
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="space-y-4 xl:flex-1">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Procurar Itens da Ementa
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
                        <input
                          type="text"
                          value={tempMenuSearchValue}
                          onChange={(e) =>
                            handleSearchInputChange(
                              e.target.value,
                              setTempMenuSearchValue
                            )
                          }
                          onBlur={() =>
                            handleSearchInputBlur(
                              tempMenuSearchValue,
                              setMenuSearchTerm
                            )
                          }
                          onKeyDown={(e) =>
                            handleSearchInputKeyPress(
                              e,
                              tempMenuSearchValue,
                              setMenuSearchTerm
                            )
                          }
                          className="w-full pl-12 pr-4 py-3 sm:py-2 bg-black border-2 border-white/20 rounded text-white placeholder-white/70 text-base sm:text-sm focus:outline-none focus:border-white/50 hover:border-white/30 transition-colors"
                          placeholder="Procurar por nome, categoria ou tag..."
                        />
                      </div>
                    </div>

                    <div
                      className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent"
                      style={{ maxHeight: "calc(100vh - 300px)" }}
                    >
                      {(() => {
                        // Filter items first
                        const filteredItems = menuItems.filter((item) => {
                          const searchLower = menuSearchTerm.toLowerCase();
                          return (
                            item.nome.toLowerCase().includes(searchLower) ||
                            (item.descricao &&
                              item.descricao
                                .toLowerCase()
                                .includes(searchLower)) ||
                            (item.category &&
                              item.category
                                .toLowerCase()
                                .includes(searchLower)) ||
                            (item.tags &&
                              item.tags.some((tag) =>
                                tag.toLowerCase().includes(searchLower)
                              ))
                          );
                        });

                        // Group by category
                        const groupedItems = filteredItems.reduce(
                          (acc, item) => {
                            const category = item.category || "Sem Categoria";
                            if (!acc[category]) {
                              acc[category] = [];
                            }
                            acc[category].push(item);
                            return acc;
                          },
                          {}
                        );

                        // Sort categories: put "Sem Categoria" last
                        const sortedCategories = Object.keys(groupedItems).sort(
                          (a, b) => {
                            if (a === "Sem Categoria") return 1;
                            if (b === "Sem Categoria") return -1;
                            return a.localeCompare(b);
                          }
                        );

                        return (
                          <div className="space-y-4">
                            {sortedCategories.map((category) => (
                              <div key={category} className="space-y-2">
                                {/* Category Header */}
                                <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-700 pb-3 mb-3">
                                  <h3 className="text-lg sm:text-base font-semibold text-white flex items-center gap-2">
                                    {category === "Sem Categoria" ? (
                                      <span className="px-3 py-2 sm:px-2 sm:py-1 bg-neutral-700/50 text-neutral-300 text-sm rounded-lg border border-neutral-600">
                                        {category}
                                      </span>
                                    ) : (
                                      <span className="px-3 py-2 sm:px-2 sm:py-1 bg-blue-500/20 text-blue-300 text-sm rounded-lg border border-blue-500/30">
                                        {category}
                                      </span>
                                    )}
                                    <span className="text-sm text-white/50">
                                      ({groupedItems[category].length}{" "}
                                      {groupedItems[category].length === 1
                                        ? "item"
                                        : "itens"}
                                      )
                                    </span>
                                  </h3>
                                </div>

                                {/* Category Items */}
                                <div className="grid grid-cols-1 gap-3">
                                  {groupedItems[category].map((item) => (
                                    <div
                                      key={item.$id}
                                      className="bg-neutral-800/60 p-4 rounded-xl border-2 border-neutral-700 hover:border-neutral-500 cursor-pointer hover:bg-neutral-800/80 transition-all duration-200 touch-manipulation active:scale-[0.98] min-h-[100px] sm:min-h-[80px]"
                                      onClick={() => addItemToOrder(item)}
                                    >
                                      <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                          <h4 className="font-medium text-white text-base sm:text-sm line-clamp-2">
                                            {item.nome}
                                          </h4>
                                          {item.descricao && (
                                            <p className="text-sm sm:text-xs text-white/60 mt-2 line-clamp-2">
                                              {item.descricao}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 ml-3">
                                          <span className="font-bold text-green-400 text-lg sm:text-base">
                                            €<NumberFlow value={Number(item.preco || 0)} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
                                          </span>
                                          <Plus className="w-6 h-6 sm:w-5 sm:h-5 text-white/70 hover:text-white transition-colors" />
                                        </div>
                                      </div>

                                      {/* Tags */}
                                      {item.tags && item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                          {item.tags.map((tag, idx) => (
                                            <span
                                              key={idx}
                                              className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-lg border border-purple-500/30"
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Ingredients */}
                                      {item.ingredientes &&
                                        item.ingredientes.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {Array.isArray(item.ingredientes)
                                              ? item.ingredientes.map(
                                                  (ingredient, idx) => (
                                                    <span
                                                      key={idx}
                                                      className="px-2 py-1 bg-neutral-700/60 text-white/70 text-xs rounded-lg border border-neutral-600"
                                                    >
                                                      {ingredient}
                                                    </span>
                                                  )
                                                )
                                              : typeof item.ingredientes ===
                                                "string"
                                              ? item.ingredientes
                                                  .split(",")
                                                  .map((ingredient, idx) => (
                                                    <span
                                                      key={idx}
                                                      className="px-2 py-1 bg-neutral-700/60 text-white/70 text-xs rounded-lg border border-neutral-600"
                                                    >
                                                      {ingredient.trim()}
                                                    </span>
                                                  ))
                                              : null}
                                          </div>
                                        )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                            {filteredItems.length === 0 && (
                              <div className="text-center py-8">
                                <p className="text-white/60">
                                  Nenhum item encontrado
                                </p>
                                <p className="text-white/40 text-sm mt-1">
                                  Tente procurar por outro termo
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Method Modal */}
        {paymentModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900/95 backdrop-blur-sm rounded-xl border border-neutral-700 w-full max-w-md shadow-2xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">
                    Seleccionar Método de Pagamento
                  </h2>
                  <button
                    onClick={() => setPaymentModalOpen(false)}
                    className="text-white/60 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-3">
                      Método de Pagamento
                    </label>
                    <div className="space-y-2">
                      {paymentMethods.map((method) => (
                        <label
                          key={method.$id}
                          className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedPaymentMethod === method.name
                              ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                              : "bg-neutral-800/60 border-neutral-600 text-white hover:bg-neutral-700/60 hover:border-neutral-500"
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method.name}
                            checked={selectedPaymentMethod === method.name}
                            onChange={(e) =>
                              setSelectedPaymentMethod(e.target.value)
                            }
                            className="sr-only"
                          />
                          <div
                            className={`w-4 h-4 rounded-full border-2 mr-3 ${
                              selectedPaymentMethod === method.name
                                ? "border-blue-400 bg-blue-400"
                                : "border-neutral-400"
                            }`}
                          >
                            {selectedPaymentMethod === method.name && (
                              <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                            )}
                          </div>
                          <span className="font-medium">{method.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setPaymentModalOpen(false)}
                      className="flex-1 px-4 py-2 border-2 border-white/30 text-white rounded-xl hover:bg-white/10 hover:border-white/50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        if (selectedOrderForPayment && selectedPaymentMethod) {
                          if (selectedOrderForPayment.startsWith("table-")) {
                            const tableNumber = parseInt(
                              selectedOrderForPayment.replace("table-", "")
                            );
                            markTableAsPaid(tableNumber, selectedPaymentMethod);
                          } else {
                            markOrderAsPaid(
                              selectedOrderForPayment,
                              selectedPaymentMethod
                            );
                          }
                        }
                      }}
                      disabled={!selectedPaymentMethod}
                      className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Confirmar Pagamento
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 rounded-lg border backdrop-blur-sm transform transition-all duration-300 animate-in slide-in-from-right ${
                notification.type === "success"
                  ? "bg-green-500/20 border-green-500/30 text-green-400"
                  : notification.type === "error"
                  ? "bg-red-500/20 border-red-500/30 text-red-400"
                  : "bg-blue-500/20 border-blue-500/30 text-blue-400"
              }`}
            >
              <div className="flex items-center space-x-2">
                {notification.type === "success" && (
                  <CheckCircle className="w-4 h-4" />
                )}
                {notification.type === "error" && (
                  <AlertCircle className="w-4 h-4" />
                )}
                {notification.type === "info" && (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">
                  {notification.message}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Custom Confirmation Dialog */}
        {confirmDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-neutral-900/95 border border-neutral-700 rounded-xl p-6 max-w-md mx-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-4">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
                <h3 className="text-lg font-semibold text-white">
                  Confirmação
                </h3>
              </div>
              <p className="text-white/80 mb-6">{confirmDialog.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={hideConfirm}
                  className="flex-1 px-4 py-2 border-2 border-white/30 text-white rounded-lg hover:bg-white/10 hover:border-white/50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    confirmDialog.onConfirm();
                    hideConfirm();
                  }}
                  className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 border border-red-500/30"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
}
