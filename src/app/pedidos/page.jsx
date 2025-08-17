"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "@/lib/appwrite";

const DB_ID = DBRESTAURANTE;
const MENU_COLLECTION_ID = COL_MENU;
const ORDERS_COLLECTION_ID = COL_ORDERS;
const TABLES_COLLECTION_ID = COL_TABLES;

export default function OrdersPage() {
  const router = useRouter();
  const { databases, account, client } = useApp();

  // State declarations
  const [user, setUser] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]); // Unpaid orders
  const [paidOrders, setPaidOrders] = useState([]); // Paid orders
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [menuSearchTerm, setMenuSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [paidOrdersPage, setPaidOrdersPage] = useState(1);
  const [ordersPerPage] = useState(25);

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
      const table = order.numeroMesa.toString();
      if (!grouped[table]) {
        grouped[table] = [];
      }
      grouped[table].push(order);
      return grouped;
    }, {});
  }

  function getTableTotal(tableNumber) {
    const tableOrders = activeOrders.filter(
      (order) =>
        order.numeroMesa.toString() === tableNumber.toString() && !order.paid
    );
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
    concluido: CheckCircle,
    pago: CheckCircle,
    cancelado: AlertCircle,
  };

  const statusColors = {
    pendente: "bg-yellow-900 text-yellow-300 border-yellow-800",
    preparando: "bg-blue-900 text-blue-300 border-blue-800",
    concluido: "bg-green-900 text-green-300 border-green-800",
    pago: "bg-green-900 text-green-300 border-green-800",
    cancelado: "bg-red-900 text-red-300 border-red-800",
  };

  const statusLabels = {
    pendente: "A aguardar",
    preparando: "A preparar",
    concluido: "Pronto",
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

      // Group orders by table
      const ordersByTable = currentOrders.reduce((acc, order) => {
        const tableNum = order.numeroMesa;
        if (!acc[tableNum]) acc[tableNum] = [];
        acc[tableNum].push(order);
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
    setTableNumber(order.numeroMesa.toString());
    setModalOpen(true);
  }

  function addItemToOrder(item) {
    const existingItem = selectedItems.find((si) => si.nome === item.nome);
    if (existingItem) {
      setSelectedItems(
        selectedItems.map((si) =>
          si.nome === item.nome ? { ...si, quantidade: si.quantidade + 1 } : si
        )
      );
    } else {
      setSelectedItems([
        ...selectedItems,
        { ...item, quantidade: 1, notas: "" },
      ]);
    }
  }

  function removeItemFromOrder(index) {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  }

  function updateItemQuantity(index, quantity) {
    if (quantity <= 0) {
      removeItemFromOrder(index);
      return;
    }
    const updated = [...selectedItems];
    updated[index].quantidade = quantity;
    setSelectedItems(updated);
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

  // Mark order as paid
  async function markOrderAsPaid(orderId) {
    if (markingPaid.has(orderId)) return; // Prevent double clicks

    setMarkingPaid((prev) => new Set([...prev, orderId]));
    try {
      // Optimistic update - immediately move order to paid state
      const order = activeOrders.find((o) => o.$id === orderId);
      if (order) {
        const updatedOrder = { ...order, paid: true, status: "pago" };

        // Update UI immediately
        setActiveOrders((prev) => prev.filter((o) => o.$id !== orderId));
        setPaidOrders((prev) => [updatedOrder, ...prev]);
      }

      // Then update database
      await databases.updateDocument(DB_ID, ORDERS_COLLECTION_ID, orderId, {
        paid: true,
        status: "pago",
      });

      // Check if table should be freed
      if (order) {
        // Get all orders for this table
        const allOrdersRes = await databases.listDocuments(
          DB_ID,
          ORDERS_COLLECTION_ID,
          [Query.equal("numeroMesa", order.numeroMesa)]
        );

        // Check if all orders for this table are paid
        const unpaidOrders = allOrdersRes.documents.filter(
          (doc) => !doc.paid && doc.$id !== orderId
        );

        if (unpaidOrders.length === 0) {
          // All orders are paid, free the table
          const table = tables.find((t) => t.tableNumber === order.numeroMesa);
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
  async function markTableAsPaid(tableNumber) {
    if (markingTablePaid.has(tableNumber)) return; // Prevent double clicks

    setMarkingTablePaid((prev) => new Set([...prev, tableNumber]));
    try {
      const tableOrders = activeOrders.filter(
        (order) => order.numeroMesa === tableNumber && !order.paid
      );

      // Optimistic update - immediately move all table orders to paid
      const updatedOrders = tableOrders.map((order) => ({
        ...order,
        paid: true,
        status: "pago",
      }));

      setActiveOrders((prev) =>
        prev.filter(
          (order) => !(order.numeroMesa === tableNumber && !order.paid)
        )
      );
      setPaidOrders((prev) => [...updatedOrders, ...prev]);

      // Update database
      for (const order of tableOrders) {
        await databases.updateDocument(DB_ID, ORDERS_COLLECTION_ID, order.$id, {
          paid: true,
          status: "pago",
        });
      }

      // Free the table
      const table = tables.find((t) => t.tableNumber === tableNumber);
      if (table && table.status === "occupied") {
        await databases.updateDocument(DB_ID, TABLES_COLLECTION_ID, table.$id, {
          status: "free",
        });
      }
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
    if (!tableNumber || selectedItems.length === 0 || saving) return;

    setSaving(true);
    try {
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
        numeroMesa: parseInt(tableNumber),
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
          // Check if there are any remaining orders for this table
          const allOrdersRes = await databases.listDocuments(
            DB_ID,
            ORDERS_COLLECTION_ID,
            [Query.equal("numeroMesa", orderToDelete.numeroMesa)]
          );

          // If no orders left for this table, free it
          if (allOrdersRes.documents.length === 0) {
            const table = tables.find(
              (t) => t.tableNumber === orderToDelete.numeroMesa
            );
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
    <div className="min-h-screen flex flex-col bg-black">
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
                    className="bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-2 px-2 py-2 rounded-xl border border-neutral-600 hover:border-neutral-500 font-medium shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-black">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Active Orders by Table */}
            {!showCompleted && (
              <section className="space-y-6">
                <h2 className="text-xl font-bold text-white">
                  Pedidos ativos (Por Mesa)
                </h2>
                {Object.keys(groupOrdersByTable(activeOrders)).length === 0 ? (
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

                            {/* Status badges */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {(() => {
                                const statuses = orders.reduce((acc, order) => {
                                  const status = order.status || "pendente";
                                  acc[status] = (acc[status] || 0) + 1;
                                  return acc;
                                }, {});

                                return Object.entries(statuses).map(
                                  ([status, count]) => (
                                    <span
                                      key={status}
                                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border ${statusColors[status]}`}
                                    >
                                      {(() => {
                                        const StatusIcon = statusIcons[status];
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
                                Total: €{getTableTotal(tableNumber).toFixed(2)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markTableAsPaid(parseInt(tableNumber));
                                }}
                                disabled={markingTablePaid.has(
                                  parseInt(tableNumber)
                                )}
                                className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium border border-green-500/30 hover:border-green-500/50 disabled:opacity-50"
                              >
                                {markingTablePaid.has(parseInt(tableNumber)) ? (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span>A processar...</span>
                                  </div>
                                ) : (
                                  "Marcar Mesa como Paga"
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Orders List */}
                          {expandedTables.has(tableNumber) && (
                            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
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
                                      €{order.total.toFixed(2)}
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
                                        return (
                                          <div
                                            key={idx}
                                            className="flex justify-between text-xs"
                                          >
                                            <span className="text-white/80">
                                              {parsedItem.quantidade}x{" "}
                                              {parsedItem.nome}
                                              {parsedItem.notas && (
                                                <span className="text-white/50 ml-1">
                                                  ({parsedItem.notas})
                                                </span>
                                              )}
                                            </span>
                                            <span className="text-white/80">
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

                                  {/* Action buttons */}
                                  <div className="flex flex-wrap gap-1">
                                    {order.status === "pendente" && (
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.$id,
                                            "preparando"
                                          )
                                        }
                                        disabled={updatingStatus.has(order.$id)}
                                        className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs rounded border border-blue-500/30 disabled:opacity-50"
                                      >
                                        {updatingStatus.has(order.$id) ? (
                                          <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          "A preparar"
                                        )}
                                      </button>
                                    )}
                                    {order.status === "preparando" && (
                                      <button
                                        onClick={() =>
                                          updateOrderStatus(
                                            order.$id,
                                            "concluido"
                                          )
                                        }
                                        disabled={updatingStatus.has(order.$id)}
                                        className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs rounded border border-orange-500/30 disabled:opacity-50"
                                      >
                                        {updatingStatus.has(order.$id) ? (
                                          <div className="w-3 h-3 border border-orange-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          "Servir"
                                        )}
                                      </button>
                                    )}
                                    {(order.status === "concluido" ||
                                      !order.status) && (
                                      <button
                                        onClick={() =>
                                          markOrderAsPaid(order.$id)
                                        }
                                        disabled={markingPaid.has(order.$id)}
                                        className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded border border-green-500/30 disabled:opacity-50"
                                      >
                                        {markingPaid.has(order.$id) ? (
                                          <div className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          "Pagar"
                                        )}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => openEditModal(order)}
                                      className="px-2 py-1 bg-neutral-700/60 hover:bg-neutral-600 text-white text-xs rounded border border-neutral-600"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => handleDelete(order.$id)}
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
              </section>
            )}

            {/* Paid Orders */}
            {showCompleted && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">
                    pedidos Pagas
                  </h2>
                  {paidOrders.length > 0 && (
                    <div className="text-sm text-white/60">
                      Total: {paidOrders.length} pedidos
                    </div>
                  )}
                </div>

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
                      {paidOrders
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
                                  Mesa {order.numeroMesa}
                                </h4>
                                <p className="text-xs text-white/60">
                                  Pedido #{order.$id.slice(-6)}
                                </p>
                                <p className="text-xs text-white/50">
                                  {new Date(order.$createdAt).toLocaleString(
                                    "pt"
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-bold text-green-400">
                                  €{order.total.toFixed(2)}
                                </span>
                                <div className="text-xs text-green-400 font-medium flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Pago
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

                            <div className="flex justify-end">
                              <button
                                onClick={() => deletePaidOrder(order.$id)}
                                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs border border-red-500/30 hover:border-red-500/50 flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                Apagar
                              </button>
                            </div>
                          </div>
                        ))}
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900/95 backdrop-blur-sm rounded-xl border border-neutral-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {editingOrder ? "Editar Pedido" : "Novo Pedido"}
                </h2>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-white/60 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Order Form */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Mesa
                    </label>
                    <select
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-800/60 border border-neutral-600 rounded-xl text-white focus:outline-none focus:border-neutral-500"
                    >
                      <option value="">Seleccionar Mesa</option>
                      {tables
                        .sort((a, b) => a.tableNumber - b.tableNumber)
                        .map((table) => (
                          <option key={table.$id} value={table.tableNumber}>
                            Mesa {table.tableNumber} (
                            {table.status === "free" ? "Livre" : "Ocupada"})
                          </option>
                        ))}
                    </select>
                    {tableNumber && (
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

                  <div>
                    <h3 className="text-lg font-medium text-white mb-4">
                      Itens Seleccionados
                    </h3>
                    {selectedItems.length === 0 ? (
                      <p className="text-white/60">Nenhum item seleccionado</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-neutral-800/60 p-3 rounded-xl border border-neutral-700"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-white">
                                {item.nome}
                              </h4>
                              <button
                                onClick={() => removeItemFromOrder(idx)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <label className="block text-xs text-white/70 mb-1">
                                  Quantidade
                                </label>
                                <input
                                  type="number"
                                  value={item.quantidade}
                                  onChange={(e) =>
                                    updateItemQuantity(
                                      idx,
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-2 py-1 bg-neutral-700/60 border border-neutral-600 rounded-lg text-white text-sm"
                                  min="1"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-white/70 mb-1">
                                  Preço (€)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.preco}
                                  onChange={(e) =>
                                    updateItemPrice(idx, e.target.value)
                                  }
                                  className="w-full px-2 py-1 bg-neutral-700/60 border border-neutral-600 rounded-lg text-white text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-white/70 mb-1">
                                Observações
                              </label>
                              <textarea
                                value={item.notas}
                                onChange={(e) =>
                                  updateItemNotes(idx, e.target.value)
                                }
                                className="w-full px-2 py-1 bg-neutral-700/60 border border-neutral-600 rounded-lg text-white text-sm"
                                rows={2}
                                placeholder="Observações especiais..."
                              />
                            </div>
                            <div className="mt-2 text-right">
                              <span className="text-white font-medium">
                                Total: €
                                {(item.quantidade * item.preco).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
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
                      onClick={() => setModalOpen(false)}
                      disabled={saving}
                      className="flex-1 px-4 py-2 border border-neutral-600 text-white/80 rounded-xl hover:bg-neutral-800/60 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={
                        !tableNumber || selectedItems.length === 0 || saving
                      }
                      className="flex-1 px-4 py-2 bg-neutral-800 text-white rounded-xl hover:bg-neutral-700 border border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Procurar Itens da Ementa
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                      <input
                        type="text"
                        value={menuSearchTerm}
                        onChange={(e) => setMenuSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-neutral-800/60 border border-neutral-600 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-neutral-500"
                        placeholder="Procurar por nome..."
                      />
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {menuItems
                      .filter((item) =>
                        item.nome
                          .toLowerCase()
                          .includes(menuSearchTerm.toLowerCase())
                      )
                      .map((item) => (
                        <div
                          key={item.$id}
                          className="bg-neutral-800/60 p-3 rounded-xl border border-neutral-700 hover:border-neutral-600 cursor-pointer hover:bg-neutral-800/80"
                          onClick={() => addItemToOrder(item)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-white">
                                {item.nome}
                              </h4>
                              {item.descricao && (
                                <p className="text-sm text-white/60 mt-1">
                                  {item.descricao}
                                </p>
                              )}
                            </div>
                            <span className="font-bold text-white ml-2">
                              €{Number(item.preco || 0).toFixed(2)}
                            </span>
                          </div>

                          {/* Ingredients badges */}
                          {item.ingredientes && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {Array.isArray(item.ingredientes)
                                ? item.ingredientes.map((ingredient, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-1 bg-neutral-700/60 text-white/70 text-xs rounded-lg border border-neutral-600"
                                    >
                                      {ingredient}
                                    </span>
                                  ))
                                : typeof item.ingredientes === "string"
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
              <h3 className="text-lg font-semibold text-white">Confirmação</h3>
            </div>
            <p className="text-white/80 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={hideConfirm}
                className="flex-1 px-4 py-2 border border-neutral-600 text-white/80 rounded-lg hover:bg-neutral-800/60"
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
  );
}
