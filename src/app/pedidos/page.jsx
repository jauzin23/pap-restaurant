"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ArrowLeft,
  Edit,
  Trash2,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  ChefHat,
  Users,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  client,
  account,
  databases,
  DBRESTAURANTE,
  COL_MENU,
  COL_ORDERS,
  COL_TABLES,
} from "@/lib/appwrite";
import { Query } from "appwrite";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useMediaQuery } from "react-responsive";

const DB_ID = DBRESTAURANTE;
const MENU_COLLECTION_ID = COL_MENU;
const ORDERS_COLLECTION_ID = COL_ORDERS;
const TABLES_COLLECTION_ID = COL_TABLES;

export default function OrdersPage() {
  const [user, setUser] = useState(null);
  const router = useRouter();
  const [activeOrders, setActiveOrders] = useState([]); // Unpaid orders
  const [paidOrders, setPaidOrders] = useState([]); // Paid orders
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [menuSearchTerm, setMenuSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [tableNumber, setTableNumber] = useState("");
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [paidOrdersPage, setPaidOrdersPage] = useState(1);
  const [ordersPerPage] = useState(25);

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
    pendente: "Pendente",
    preparando: "Preparando",
    concluido: "Concluído",
    pago: "Pago",
    cancelado: "Cancelado",
  };

  function getTimeElapsed(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `${diffMins}m atrás`;
    const hours = Math.floor(diffMins / 60);
    return `${hours}h ${diffMins % 60}m atrás`;
  }

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchMenuItems();
      fetchTables();
      subscribeToOrders();
      subscribeToTables();
    }
  }, [user]);

  async function fetchUser() {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
    } catch (err) {
      console.error("User not found:", err);
      router.push("/login");
    }
  }

  async function fetchOrders() {
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
    } finally {
      setLoading(false);
    }
  }

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

  async function fetchMenuItems() {
    try {
      const response = await databases.listDocuments(DB_ID, MENU_COLLECTION_ID);
      setMenuItems(response.documents);
    } catch (err) {
      console.error("Error fetching menu:", err);
    }
  }

  async function fetchTables() {
    try {
      const response = await databases.listDocuments(
        DB_ID,
        TABLES_COLLECTION_ID
      );
      setTables(response.documents);
    } catch (err) {
      console.error("Error fetching tables:", err);
    }
  }

  function subscribeToOrders() {
    const unsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.${ORDERS_COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.events.includes(
            "databases.*.collections.*.documents.*.create"
          )
        ) {
          fetchOrders();
        } else if (
          response.events.includes(
            "databases.*.collections.*.documents.*.update"
          )
        ) {
          fetchOrders();
        } else if (
          response.events.includes(
            "databases.*.collections.*.documents.*.delete"
          )
        ) {
          fetchOrders();
        }
      }
    );
    return unsubscribe;
  }

  function subscribeToTables() {
    const unsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.${TABLES_COLLECTION_ID}.documents`,
      (response) => {
        fetchTables();
      }
    );
    return unsubscribe;
  }

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
    try {
      await databases.updateDocument(DB_ID, ORDERS_COLLECTION_ID, orderId, {
        paid: true,
        status: "pago",
      });

      // Check if table should be freed
      const order = activeOrders.find((o) => o.$id === orderId);
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
    } catch (err) {
      console.error("Erro ao marcar como pago:", err);
    }
  }

  // Update order status
  async function updateOrderStatus(orderId, newStatus) {
    try {
      await databases.updateDocument(DB_ID, ORDERS_COLLECTION_ID, orderId, {
        status: newStatus,
      });
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    }
  }

  // Mark all orders for a table as paid
  async function markTableAsPaid(tableNumber) {
    try {
      const tableOrders = activeOrders.filter(
        (order) => order.numeroMesa === tableNumber && !order.paid
      );

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
    } catch (err) {
      console.error("Erro ao marcar mesa como paga:", err);
    }
  }

  // Delete paid order
  async function deletePaidOrder(orderId) {
    if (!confirm("Tem a certeza que quer apagar este pedido pago?")) return;
    try {
      await databases.deleteDocument(DB_ID, ORDERS_COLLECTION_ID, orderId);
    } catch (err) {
      console.error("Erro ao apagar pedido pago:", err);
    }
  }

  async function handleSave() {
    if (!tableNumber || selectedItems.length === 0) return;

    // Validate that the selected table exists
    const selectedTable = tables.find(
      (t) => t.tableNumber.toString() === tableNumber
    );

    if (!selectedTable) {
      alert("Mesa selecionada não existe!");
      return;
    }

    try {
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
        await databases.updateDocument(
          DB_ID,
          ORDERS_COLLECTION_ID,
          editingOrder.$id,
          orderData
        );
      } else {
        await databases.createDocument(
          DB_ID,
          ORDERS_COLLECTION_ID,
          "unique()",
          orderData
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
    } catch (err) {
      console.error("Erro ao guardar pedido:", err);
    }
  }

  async function handleDelete(orderId) {
    if (!confirm("Tem a certeza que quer apagar este pedido?")) return;
    try {
      const orderToDelete = [...activeOrders, ...paidOrders].find(
        (o) => o.$id === orderId
      );

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
    } catch (err) {
      console.error("Erro ao apagar pedido:", err);
    }
  }

  if (!user)
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mb-4"></div>
        <p className="text-neutral-300 text-lg">A Carregar...</p>
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} logo="/logo.png" />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-neutral-950 border-b border-neutral-800">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  className="flex items-center gap-2 px-4 py-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-all duration-200"
                  onClick={() => router.push("/")}
                >
                  <ArrowLeft className="w-5 h-5" />
                  Voltar
                </button>
                <h1 className="text-2xl font-semibold text-white">
                  Gestão de Pedidos
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                    showCompleted
                      ? "bg-green-950 text-green-300 border-green-800 hover:bg-green-900"
                      : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800"
                  }`}
                >
                  <History className="w-5 h-5" />
                  {showCompleted ? "Ver Activos" : "Ver Pagos"}
                  {showCompleted && (
                    <span className="bg-green-800 text-green-200 px-2 py-1 rounded-full text-xs font-medium">
                      {paidOrders.length}
                    </span>
                  )}
                </button>
                {!showCompleted && (
                  <button
                    onClick={openAddModal}
                    className="bg-white text-black hover:bg-neutral-100 flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 font-medium cursor-pointer"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Active Orders by Table */}
            {!showCompleted && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">
                  Pedidos Ativos (Por Mesa)
                </h2>
                {Object.keys(groupOrdersByTable(activeOrders)).length === 0 ? (
                  <p className="text-gray-400">
                    Nenhum pedido ativo no momento.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupOrdersByTable(activeOrders)).map(
                      ([tableNumber, orders]) => (
                        <div
                          key={tableNumber}
                          className="border border-gray-700 rounded-lg bg-gray-800 overflow-hidden"
                        >
                          <div
                            className="p-4 bg-gray-700 cursor-pointer flex items-center justify-between hover:bg-gray-600 transition-colors"
                            onClick={() => toggleTableExpansion(tableNumber)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-semibold text-white">
                                Mesa {tableNumber}
                              </span>
                              <span className="px-2 py-1 bg-red-600 text-white text-sm rounded">
                                {orders.length} pedido
                                {orders.length > 1 ? "s" : ""}
                              </span>
                              {/* Table-level status summary */}
                              <div className="flex gap-1">
                                {(() => {
                                  const statuses = orders.reduce(
                                    (acc, order) => {
                                      const status = order.status || "pendente";
                                      acc[status] = (acc[status] || 0) + 1;
                                      return acc;
                                    },
                                    {}
                                  );

                                  return Object.entries(statuses).map(
                                    ([status, count]) => (
                                      <span
                                        key={status}
                                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${statusColors[status]}`}
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
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-lg font-bold text-green-400">
                                Total: €{getTableTotal(tableNumber).toFixed(2)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markTableAsPaid(parseInt(tableNumber));
                                }}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors cursor-pointer"
                              >
                                Marcar Mesa como Paga
                              </button>
                              {expandedTables.has(tableNumber) ? (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </div>

                          {expandedTables.has(tableNumber) && (
                            <div className="p-4 space-y-3">
                              {orders.map((order) => (
                                <div
                                  key={order.$id}
                                  className="bg-gray-900 p-4 rounded border border-gray-600"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <h4 className="font-semibold text-white">
                                        Pedido #{order.$id.slice(-6)}
                                      </h4>
                                      <p className="text-sm text-gray-400">
                                        {new Date(
                                          order.$createdAt
                                        ).toLocaleString("pt")}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg font-bold text-green-400">
                                        €{order.total.toFixed(2)}
                                      </span>
                                      {/* Status update buttons */}
                                      {order.status === "pendente" && (
                                        <button
                                          onClick={() =>
                                            updateOrderStatus(
                                              order.$id,
                                              "preparando"
                                            )
                                          }
                                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors cursor-pointer"
                                        >
                                          Preparar
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
                                          className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors cursor-pointer"
                                        >
                                          Entregar
                                        </button>
                                      )}
                                      {(order.status === "concluido" ||
                                        !order.status) && (
                                        <button
                                          onClick={() =>
                                            markOrderAsPaid(order.$id)
                                          }
                                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors cursor-pointer"
                                        >
                                          Marcar como Pago
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    {(order.items || order.itens || []).map(
                                      (item, idx) => {
                                        // Parse item if it's a JSON string
                                        const parsedItem =
                                          typeof item === "string"
                                            ? JSON.parse(item)
                                            : item;
                                        return (
                                          <div
                                            key={idx}
                                            className="flex justify-between text-sm"
                                          >
                                            <span className="text-gray-300">
                                              {parsedItem.quantidade}x{" "}
                                              {parsedItem.nome}
                                              {parsedItem.notas && (
                                                <span className="text-gray-500 ml-2">
                                                  ({parsedItem.notas})
                                                </span>
                                              )}
                                            </span>
                                            <span className="text-gray-300">
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
                                  <div className="mt-3 flex gap-2">
                                    <button
                                      onClick={() => openEditModal(order)}
                                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors cursor-pointer"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => handleDelete(order.$id)}
                                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors cursor-pointer"
                                    >
                                      Apagar
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
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">
                    Pedidos Pagos
                  </h2>
                  {paidOrders.length > 0 && (
                    <div className="text-sm text-gray-400">
                      Total: {paidOrders.length} pedidos
                    </div>
                  )}
                </div>

                {paidOrders.length === 0 ? (
                  <p className="text-gray-400">Nenhum pedido pago hoje.</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {paidOrders
                        .slice(
                          (paidOrdersPage - 1) * ordersPerPage,
                          paidOrdersPage * ordersPerPage
                        )
                        .map((order) => (
                          <div
                            key={order.$id}
                            className="bg-gray-800 p-4 rounded border border-gray-700"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold text-white">
                                  Mesa {order.numeroMesa} - Pedido #
                                  {order.$id.slice(-6)}
                                </h4>
                                <p className="text-sm text-gray-400">
                                  {new Date(order.$createdAt).toLocaleString(
                                    "pt"
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <span className="text-lg font-bold text-green-400">
                                    €{order.total.toFixed(2)}
                                  </span>
                                  <div className="text-sm text-green-500 font-medium">
                                    ✓ Pago
                                  </div>
                                </div>
                                <button
                                  onClick={() => deletePaidOrder(order.$id)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 space-y-1">
                              {(order.items || order.itens || []).map(
                                (item, idx) => {
                                  // Parse item if it's a JSON string
                                  const parsedItem =
                                    typeof item === "string"
                                      ? JSON.parse(item)
                                      : item;
                                  return (
                                    <div
                                      key={idx}
                                      className="flex justify-between text-sm text-gray-300"
                                    >
                                      <span>
                                        {parsedItem.quantidade}x{" "}
                                        {parsedItem.nome}
                                        {parsedItem.notas && (
                                          <span className="text-gray-500 ml-2">
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
                          </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {Math.ceil(paidOrders.length / ordersPerPage) > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <button
                          onClick={() =>
                            setPaidOrdersPage(Math.max(1, paidOrdersPage - 1))
                          }
                          disabled={paidOrdersPage === 1}
                          className="px-3 py-2 bg-neutral-800 text-white rounded border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                                className={`px-3 py-2 rounded border cursor-pointer ${
                                  page === paidOrdersPage
                                    ? "bg-white text-black border-white"
                                    : "bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700"
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
                          className="px-3 py-2 bg-neutral-800 text-white rounded border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 rounded-lg border border-neutral-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">
                    {editingOrder ? "Editar Pedido" : "Novo Pedido"}
                  </h2>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Order Form */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Mesa
                      </label>
                      <select
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-600 cursor-pointer"
                      >
                        <option value="">Selecionar Mesa</option>
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
                                        ? "bg-green-500"
                                        : "bg-red-500"
                                    }`}
                                  ></div>
                                  <span className="text-sm text-neutral-400">
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
                        Itens Selecionados
                      </h3>
                      {selectedItems.length === 0 ? (
                        <p className="text-neutral-500">
                          Nenhum item selecionado
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {selectedItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="bg-neutral-900 p-3 rounded-lg border border-neutral-800"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-white">
                                  {item.nome}
                                </h4>
                                <button
                                  onClick={() => removeItemFromOrder(idx)}
                                  className="text-red-400 hover:text-red-300 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                  <label className="block text-xs text-neutral-400 mb-1">
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
                                    className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm"
                                    min="1"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-neutral-400 mb-1">
                                    Preço (€)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.preco}
                                    onChange={(e) =>
                                      updateItemPrice(idx, e.target.value)
                                    }
                                    className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-neutral-400 mb-1">
                                  Notas
                                </label>
                                <textarea
                                  value={item.notas}
                                  onChange={(e) =>
                                    updateItemNotes(idx, e.target.value)
                                  }
                                  className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm"
                                  rows={2}
                                  placeholder="Notas especiais..."
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
                          <div className="border-t border-neutral-800 pt-3">
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
                        className="flex-1 px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-900 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={!tableNumber || selectedItems.length === 0}
                        className="flex-1 px-4 py-2 bg-white text-black rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {editingOrder ? "Atualizar" : "Criar"} Pedido
                      </button>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Procurar Itens do Menu
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-4 h-4" />
                        <input
                          type="text"
                          value={menuSearchTerm}
                          onChange={(e) => setMenuSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
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
                            className="bg-neutral-900 p-3 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors cursor-pointer"
                            onClick={() => addItemToOrder(item)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h4 className="font-medium text-white">
                                  {item.nome}
                                </h4>
                                {item.descricao && (
                                  <p className="text-sm text-neutral-400 mt-1">
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
                                        className="px-2 py-1 bg-neutral-700 text-neutral-300 text-xs rounded-full border border-neutral-600"
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
                                          className="px-2 py-1 bg-neutral-700 text-neutral-300 text-xs rounded-full border border-neutral-600"
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
