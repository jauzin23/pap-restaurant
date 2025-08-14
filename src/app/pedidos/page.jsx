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
import Header from "../components/Header";
import { useMediaQuery } from "react-responsive";

const DB_ID = DBRESTAURANTE;
const MENU_COLLECTION_ID = COL_MENU;
const ORDERS_COLLECTION_ID = COL_ORDERS;
const TABLES_COLLECTION_ID = COL_TABLES;

export default function OrdersPage() {
  const [user, setUser] = useState(null);
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]); // Add this for tables
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [router]);

  // Form fields
  const [tableNumber, setTableNumber] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [menuSearchTerm, setMenuSearchTerm] = useState("");

  const statusColors = {
    pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
    preparando: "bg-blue-100 text-blue-800 border-blue-200",
    concluido: "bg-green-100 text-green-800 border-green-200",
    cancelado: "bg-red-100 text-red-800 border-red-200",
  };

  const statusIcons = {
    pendente: Clock,
    preparando: ChefHat,
    concluido: CheckCircle,
    cancelado: AlertCircle,
  };

  const statusLabels = {
    pendente: "Pendente",
    preparando: "A Preparar",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };

  // Helper function to parse order items safely
  function parseOrderItems(itens) {
    return itens.map((item) => {
      try {
        // If it's already an object, return as is
        if (typeof item === "object") return item;
        // If it's a string, parse it
        return JSON.parse(item);
      } catch (error) {
        console.error("Error parsing order item:", error);
        return item;
      }
    });
  }

  // Helper function to process orders and parse their items
  function processOrders(ordersArray) {
    return ordersArray.map((order) => ({
      ...order,
      itens: parseOrderItems(order.itens),
    }));
  }

  useEffect(() => {
    fetchOrders();
    fetchMenu();
    fetchTables(); // Add this

    // Setup realtime subscription for orders
    const unsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.${ORDERS_COLLECTION_ID}.documents`,
      (response) => {
        const { events, payload } = response;

        // Process the payload to parse items
        const processedPayload = {
          ...payload,
          itens: parseOrderItems(payload.itens),
        };

        // Check for create events
        if (events.some((event) => event.includes("create"))) {
          if (processedPayload.status === "concluido") {
            setCompletedOrders((prev) => {
              if (prev.find((order) => order.$id === processedPayload.$id)) {
                return prev;
              }
              return [processedPayload, ...prev];
            });
          } else {
            setOrders((prev) => {
              if (prev.find((order) => order.$id === processedPayload.$id)) {
                return prev;
              }
              return [processedPayload, ...prev];
            });
          }
        }
        // Check for update events
        else if (events.some((event) => event.includes("update"))) {
          // If order was completed, move to completed orders
          if (processedPayload.status === "concluido") {
            setOrders((prev) =>
              prev.filter((order) => order.$id !== processedPayload.$id)
            );
            setCompletedOrders((prev) => {
              const filtered = prev.filter(
                (order) => order.$id !== processedPayload.$id
              );
              return [processedPayload, ...filtered];
            });
          } else {
            // Update in active orders
            setOrders((prev) =>
              prev.map((order) =>
                order.$id === processedPayload.$id ? processedPayload : order
              )
            );
            // Remove from completed if it was there
            setCompletedOrders((prev) =>
              prev.filter((order) => order.$id !== processedPayload.$id)
            );
          }
        }
        // Check for delete events
        else if (events.some((event) => event.includes("delete"))) {
          setOrders((prev) =>
            prev.filter((order) => order.$id !== processedPayload.$id)
          );
          setCompletedOrders((prev) =>
            prev.filter((order) => order.$id !== processedPayload.$id)
          );
        }
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    account
      .get()
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router]);

  async function fetchOrders() {
    try {
      const res = await databases.listDocuments(DB_ID, ORDERS_COLLECTION_ID);
      const allOrders = processOrders(res.documents);

      // Separate completed from active orders
      const activeOrders = allOrders.filter(
        (order) => order.status !== "concluido"
      );
      const completedOrders = allOrders.filter(
        (order) => order.status === "concluido"
      );

      setOrders(activeOrders);
      setCompletedOrders(completedOrders);
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
    }
    setLoading(false);
  }

  async function fetchMenu() {
    try {
      const res = await databases.listDocuments(DB_ID, MENU_COLLECTION_ID);
      setMenuItems(res.documents);
    } catch (err) {
      console.error("Erro ao carregar menu:", err);
    }
  }

  async function fetchTables() {
    try {
      const res = await databases.listDocuments(DB_ID, TABLES_COLLECTION_ID);
      // Sort tables by table number for better UX
      const sortedTables = res.documents.sort(
        (a, b) => a.tableNumber - b.tableNumber
      );
      setTables(sortedTables);
    } catch (err) {
      console.error("Erro ao carregar mesas:", err);
    }
  }

  function openAddModal() {
    setEditingOrder(null);
    setTableNumber("");
    setSelectedItems([]);
    setMenuSearchTerm("");
    setModalOpen(true);
  }

  function openEditModal(order) {
    setEditingOrder(order);
    setTableNumber(order.numeroMesa.toString());
    const parsedItems = parseOrderItems(order.itens);
    setSelectedItems(
      parsedItems.map((item) => ({
        nome: item.nome,
        notas: item.notas || "",
        preco: item.preco,
        menuItem: menuItems.find((m) => m.nome === item.nome),
      }))
    );
    setModalOpen(true);
  }

  function addItemToOrder(menuItem) {
    const newItem = {
      nome: menuItem.nome,
      notas: "",
      preco: menuItem.preco,
      menuItem: menuItem,
    };
    setSelectedItems([...selectedItems, newItem]);
  }

  function removeItemFromOrder(index) {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  }

  function updateItemNotes(index, notas) {
    const updated = [...selectedItems];
    updated[index].notas = notas;
    setSelectedItems(updated);
  }

  async function handleSave() {
    try {
      const total = selectedItems.reduce((sum, item) => sum + item.preco, 0);

      // Clean the items - only store essential data, not the full menuItem object
      const cleanItems = selectedItems.map((item) => ({
        nome: item.nome,
        notas: item.notas || "",
        preco: item.preco,
      }));

      const orderData = {
        numeroMesa: parseInt(tableNumber),
        itens: cleanItems.map((item) => JSON.stringify(item)), // Convert to strings as expected
        status: "pendente",
        total: total,
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

        // Update table status to occupied when creating a new order
        const selectedTable = tables.find(
          (t) => t.tableNumber.toString() === tableNumber
        );
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
      const orderToDelete = [...orders, ...completedOrders].find(
        (o) => o.$id === orderId
      );

      await databases.deleteDocument(DB_ID, ORDERS_COLLECTION_ID, orderId);

      // Free up the table when order is deleted
      if (orderToDelete) {
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
    } catch (err) {
      console.error("Erro ao apagar pedido:", err);
    }
  }

  async function updateOrderStatus(orderId, newStatus) {
    try {
      await databases.updateDocument(DB_ID, ORDERS_COLLECTION_ID, orderId, {
        status: newStatus,
      });

      // Free up the table when order is completed
      if (newStatus === "concluido") {
        const order = orders.find((o) => o.$id === orderId);
        if (order) {
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
      console.error("Erro ao atualizar status:", err);
    }
  }

  const currentOrders = showCompleted ? completedOrders : orders;
  const filteredOrders = currentOrders.filter((order) => {
    const matchesSearch =
      order.numeroMesa.toString().includes(searchTerm) ||
      order.itens.some((item) =>
        item.nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesStatus =
      filterStatus === "all" || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredMenuItems = menuItems.filter((item) =>
    item.nome.toLowerCase().includes(menuSearchTerm.toLowerCase())
  );

  if (!user)
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-b-4 border-gray-300 mb-4"></div>
        <p className="text-gray-700 text-lg">A Carregar...</p>
      </div>
    );

  return (
    <>
      <Header user={user} logo="/logo.png" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-200 transition-all duration-200"
                  onClick={() => router.push("/")}
                >
                  <ArrowLeft className="w-5 h-5" />
                  Voltar
                </button>
                <h1 className="text-2xl font-bold text-gray-800">
                  Gestão de Pedidos
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                    showCompleted
                      ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                      : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  <History className="w-5 h-5" />
                  {showCompleted ? "Ver Activos" : "Ver Concluídos"}
                  {showCompleted && (
                    <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-xs">
                      {completedOrders.length}
                    </span>
                  )}
                </button>
                {!showCompleted && (
                  <button
                    onClick={openAddModal}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Filters */}
          {!showCompleted && (
            <div className="mb-8 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Procurar por mesa ou item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-10 pr-8 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                >
                  <option value="all">Todos os Pedidos</option>
                  <option value="pendente">Pendentes</option>
                  <option value="preparando">A Preparar</option>
                  <option value="cancelado">Cancelados</option>
                </select>
              </div>
            </div>
          )}

          {/* Orders Grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <AnimatePresence>
              {loading ? (
                <div className="col-span-full text-center py-12">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-b-4 border-gray-300 mb-4 mx-auto"></div>
                  <p className="text-gray-700 text-lg">A carregar pedidos...</p>
                </div>
              ) : (
                filteredOrders.map((order, index) => {
                  const StatusIcon = statusIcons[order.status];
                  return (
                    <motion.div
                      key={order.$id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden"
                    >
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-100 text-blue-600 rounded-full p-2">
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-gray-800">
                                Mesa {order.numeroMesa}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {new Date(
                                  order.criadoEm || order.$createdAt
                                ).toLocaleTimeString("pt-PT")}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${
                              statusColors[order.status]
                            }`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusLabels[order.status]}
                          </span>
                        </div>

                        {/* Items */}
                        <div className="space-y-3 mb-4">
                          {order.itens.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-start"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-800">
                                  {item.nome}
                                </p>
                                {item.notas && (
                                  <p className="text-sm text-gray-500 italic">
                                    "{item.notas}"
                                  </p>
                                )}
                              </div>
                              <span className="font-bold text-gray-800">
                                €{Number(item.preco || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Total */}
                        <div className="border-t border-gray-100 pt-3 mb-4">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-lg text-gray-800">
                              Total
                            </span>
                            <span className="font-bold text-lg text-blue-600">
                              €{order.total.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {!showCompleted && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(order)}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                            >
                              <Edit className="w-4 h-4" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(order.$id)}
                              className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Apagar
                            </button>
                          </div>
                        )}

                        {/* Status Update */}
                        {!showCompleted &&
                          order.status !== "concluido" &&
                          order.status !== "cancelado" && (
                            <div className="mt-3 flex gap-2">
                              {order.status === "pendente" && (
                                <button
                                  onClick={() =>
                                    updateOrderStatus(order.$id, "preparando")
                                  }
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors duration-200 text-sm"
                                >
                                  Começar a Preparar
                                </button>
                              )}
                              {order.status === "preparando" && (
                                <button
                                  onClick={() =>
                                    updateOrderStatus(order.$id, "concluido")
                                  }
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors duration-200 text-sm"
                                >
                                  Marcar Concluído
                                </button>
                              )}
                            </div>
                          )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </motion.div>

          {!loading && filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                {showCompleted ? (
                  <History className="w-8 h-8 text-gray-400" />
                ) : (
                  <Users className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                {showCompleted
                  ? "Nenhum pedido concluído"
                  : "Nenhum pedido encontrado"}
              </h3>
              <p className="text-gray-500">
                {showCompleted
                  ? "Os pedidos concluídos aparecerão aqui"
                  : "Crie um novo pedido para começar"}
              </p>
            </div>
          )}

          {/* Modal */}
          <AnimatePresence>
            {modalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
                >
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold">
                        {editingOrder ? "Editar Pedido" : "Novo Pedido"}
                      </h2>
                      <button
                        onClick={() => setModalOpen(false)}
                        className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors duration-200"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Column - Order Details */}
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selecionar Mesa
                          </label>
                          <select
                            value={tableNumber}
                            onChange={(e) => setTableNumber(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                          >
                            <option value="">Selecione uma mesa...</option>
                            {tables
                              .filter(
                                (table) =>
                                  table.status === "free" ||
                                  (editingOrder &&
                                    table.tableNumber.toString() ===
                                      tableNumber)
                              )
                              .map((table) => (
                                <option
                                  key={table.$id}
                                  value={table.tableNumber}
                                >
                                  Mesa {table.tableNumber} ({table.chairs}{" "}
                                  lugares) -{" "}
                                  {table.shape === "circular"
                                    ? "Redonda"
                                    : "Retangular"}
                                </option>
                              ))}
                          </select>
                          {tables.length === 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                              A carregar mesas...
                            </p>
                          )}
                        </div>

                        {/* Selected Items */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Itens Selecionados ({selectedItems.length})
                          </label>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {selectedItems.map((item, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h4 className="font-medium text-gray-800">
                                      {item.nome}
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                      €{item.preco.toFixed(2)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => removeItemFromOrder(index)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-1 transition-colors duration-200"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Notas especiais (ex: sem queijo, extra picante...)"
                                  value={item.notas}
                                  onChange={(e) =>
                                    updateItemNotes(index, e.target.value)
                                  }
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                />
                              </motion.div>
                            ))}
                            {selectedItems.length === 0 && (
                              <div className="text-center py-8 text-gray-500">
                                Nenhum item selecionado ainda
                              </div>
                            )}
                          </div>
                          {selectedItems.length > 0 && (
                            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-blue-800">
                                  Total do Pedido
                                </span>
                                <span className="text-xl font-bold text-blue-600">
                                  €
                                  {selectedItems
                                    .reduce((sum, item) => sum + item.preco, 0)
                                    .toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column - Menu Items */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Adicionar Itens do Menu
                          </label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                              type="text"
                              placeholder="Procurar itens do menu..."
                              value={menuSearchTerm}
                              onChange={(e) =>
                                setMenuSearchTerm(e.target.value)
                              }
                              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            />
                          </div>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {filteredMenuItems.map((item) => (
                            <motion.div
                              key={item.$id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer"
                              onClick={() => addItemToOrder(item)}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-gray-800">
                                  {item.nome}
                                </h4>
                                <span className="font-bold text-blue-600">
                                  €{item.preco.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {item.ingredientes?.map((ing) => (
                                  <span
                                    key={ing}
                                    className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600"
                                  >
                                    {ing}
                                  </span>
                                ))}
                              </div>
                            </motion.div>
                          ))}
                          {filteredMenuItems.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                              Nenhum item do menu encontrado
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                    <button
                      onClick={() => setModalOpen(false)}
                      className="px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors duration-200"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!tableNumber || selectedItems.length === 0}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      {editingOrder ? "Atualizar Pedido" : "Criar Pedido"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
