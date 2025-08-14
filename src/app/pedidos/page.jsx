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
import Footer from "../components/Footer";
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
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    if (isMobile) router.push("/unsupported");
  }, [router, isMobile]);

  // Form fields
  const [tableNumber, setTableNumber] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [menuSearchTerm, setMenuSearchTerm] = useState("");

  const statusColors = {
    pendente: "bg-amber-950 text-amber-300 border-amber-800",
    preparando: "bg-blue-950 text-blue-300 border-blue-800",
    concluido: "bg-green-950 text-green-300 border-green-800",
    cancelado: "bg-red-950 text-red-300 border-red-800",
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
    if (!Array.isArray(itens)) return [];
    return itens.map((item) => {
      try {
        if (typeof item === "object") return item;
        return JSON.parse(item);
      } catch (error) {
        console.error("Error parsing order item:", error);
        return item;
      }
    });
  }

  // Helper function to calculate time elapsed
  function getTimeElapsed(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInMinutes = Math.floor((now - created) / (1000 * 60));

    if (diffInMinutes < 1) return "Agora mesmo";
    if (diffInMinutes === 1) return "1 minuto atrás";
    if (diffInMinutes < 60) return `${diffInMinutes} minutos atrás`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return "1 hora atrás";
    if (diffInHours < 24) return `${diffInHours} horas atrás`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "1 dia atrás";
    return `${diffInDays} dias atrás`;
  }
  function processOrders(ordersArray) {
    return ordersArray.map((order) => ({
      ...order,
      itens: parseOrderItems(order.itens || []),
    }));
  }

  useEffect(() => {
    fetchOrders();
    fetchMenu();
    fetchTables();

    // Setup realtime subscription for orders
    const unsubscribe = client.subscribe(
      `databases.${DB_ID}.collections.${ORDERS_COLLECTION_ID}.documents`,
      (response) => {
        const { events, payload } = response;

        const processedPayload = {
          ...payload,
          itens: parseOrderItems(payload.itens || []),
        };

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
        } else if (events.some((event) => event.includes("update"))) {
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
            setOrders((prev) =>
              prev.map((order) =>
                order.$id === processedPayload.$id ? processedPayload : order
              )
            );
            setCompletedOrders((prev) =>
              prev.filter((order) => order.$id !== processedPayload.$id)
            );
          }
        } else if (events.some((event) => event.includes("delete"))) {
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
    const parsedItems = parseOrderItems(order.itens || []);
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

      const cleanItems = selectedItems.map((item) => ({
        nome: item.nome,
        notas: item.notas || "",
        preco: item.preco,
      }));

      const orderData = {
        numeroMesa: parseInt(tableNumber),
        itens: cleanItems.map((item) => JSON.stringify(item)),
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
      (order.itens &&
        order.itens.some(
          (item) =>
            item.nome &&
            item.nome.toLowerCase().includes(searchTerm.toLowerCase())
        ));
    const matchesStatus =
      filterStatus === "all" || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredMenuItems = menuItems.filter((item) =>
    item.nome.toLowerCase().includes(menuSearchTerm.toLowerCase())
  );

  if (!user)
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white border-b-4 border-neutral-700 mb-4"></div>
        <p className="text-neutral-300 text-lg">A Carregar...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-black flex flex-col">
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                    showCompleted
                      ? "bg-green-950 text-green-300 border-green-800 hover:bg-green-900"
                      : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800"
                  }`}
                >
                  <History className="w-5 h-5" />
                  {showCompleted ? "Ver Activos" : "Ver Concluídos"}
                  {showCompleted && (
                    <span className="bg-green-800 text-green-200 px-2 py-1 rounded-full text-xs font-medium">
                      {completedOrders.length}
                    </span>
                  )}
                </button>
                {!showCompleted && (
                  <button
                    onClick={openAddModal}
                    className="bg-white text-black hover:bg-neutral-100 flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 font-medium"
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
            {/* Filters */}
            {!showCompleted && (
              <div className="mb-8 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Procurar por mesa ou item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-all duration-200"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="pl-10 pr-8 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-600 transition-all duration-200"
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
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white border-b-4 border-neutral-700 mb-4 mx-auto"></div>
                    <p className="text-neutral-300 text-lg">
                      A carregar pedidos...
                    </p>
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
                        className="bg-neutral-950 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-all duration-300 overflow-hidden"
                      >
                        <div className="p-6">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-neutral-900 text-white rounded-lg p-2">
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg text-white">
                                  Mesa {order.numeroMesa}
                                </h3>
                                <div className="space-y-0.5">
                                  <p className="text-sm text-neutral-400">
                                    {new Date(
                                      order.criadoEm || order.$createdAt
                                    ).toLocaleTimeString("pt-PT", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                  <p className="text-xs text-neutral-500">
                                    {getTimeElapsed(
                                      order.criadoEm || order.$createdAt
                                    )}
                                  </p>
                                </div>
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
                            {order.itens &&
                              order.itens.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-start"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-white">
                                      {item.nome}
                                    </p>
                                    {item.notas && (
                                      <p className="text-sm text-neutral-400 italic">
                                        "{item.notas}"
                                      </p>
                                    )}
                                  </div>
                                  <span className="font-semibold text-white">
                                    €{Number(item.preco || 0).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                          </div>

                          {/* Total */}
                          <div className="border-t border-neutral-800 pt-3 mb-4">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-lg text-white">
                                Total
                              </span>
                              <span className="font-bold text-lg text-white">
                                €{(order.total || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          {!showCompleted && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => openEditModal(order)}
                                className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Edit className="w-4 h-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleDelete(order.$id)}
                                className="flex-1 bg-red-950 hover:bg-red-900 text-red-300 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
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
                                    className="flex-1 bg-blue-950 hover:bg-blue-900 text-blue-300 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium cursor-pointer"
                                  >
                                    Começar a Preparar
                                  </button>
                                )}
                                {order.status === "preparando" && (
                                  <button
                                    onClick={() =>
                                      updateOrderStatus(order.$id, "concluido")
                                    }
                                    className="flex-1 bg-green-950 hover:bg-green-900 text-green-300 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium cursor-pointer"
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
                <div className="bg-neutral-900 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  {showCompleted ? (
                    <History className="w-8 h-8 text-neutral-500" />
                  ) : (
                    <Users className="w-8 h-8 text-neutral-500" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-neutral-300 mb-2">
                  {showCompleted
                    ? "Nenhum pedido concluído"
                    : "Nenhum pedido encontrado"}
                </h3>
                <p className="text-neutral-500">
                  {showCompleted
                    ? "Os pedidos concluídos aparecerão aqui"
                    : "Crie um novo pedido para começar"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-950 rounded-lg border border-neutral-800 w-full max-w-6xl max-h-[95vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-neutral-900 text-white p-6 border-b border-neutral-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">
                    {editingOrder ? "Editar Pedido" : "Novo Pedido"}
                  </h2>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full p-2 transition-colors duration-200 cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div
                className="p-6 overflow-y-auto max-h-[calc(95vh-200px)]"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#404040 #171717",
                }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Order Details */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Selecionar Mesa
                      </label>
                      <select
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-600 transition-all duration-200"
                      >
                        <option value="">Selecione uma mesa...</option>
                        {tables
                          .filter(
                            (table) =>
                              table.status === "free" ||
                              (editingOrder &&
                                table.tableNumber.toString() === tableNumber)
                          )
                          .map((table) => (
                            <option key={table.$id} value={table.tableNumber}>
                              Mesa {table.tableNumber} ({table.chairs} lugares)
                              -{" "}
                              {table.shape === "circular"
                                ? "Redonda"
                                : "Retangular"}
                            </option>
                          ))}
                      </select>
                      {tables.length === 0 && (
                        <p className="text-sm text-neutral-500 mt-1">
                          A carregar mesas...
                        </p>
                      )}
                    </div>

                    {/* Selected Items */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-3">
                        Itens Selecionados ({selectedItems.length})
                      </label>
                      <div
                        className="space-y-3 max-h-64 overflow-y-auto"
                        style={{
                          scrollbarWidth: "thin",
                          scrollbarColor: "#404040 #171717",
                        }}
                      >
                        {selectedItems.map((item, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-neutral-900 rounded-lg p-4 border border-neutral-800"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-medium text-white">
                                  {item.nome}
                                </h4>
                                <p className="text-sm text-neutral-400">
                                  €{item.preco.toFixed(2)}
                                </p>
                              </div>
                              <button
                                onClick={() => removeItemFromOrder(index)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-950 rounded-full p-1 transition-colors duration-200 cursor-pointer"
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
                              className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                            />
                          </motion.div>
                        ))}
                        {selectedItems.length === 0 && (
                          <div className="text-center py-8 text-neutral-500">
                            Nenhum item selecionado ainda
                          </div>
                        )}
                      </div>
                      {selectedItems.length > 0 && (
                        <div className="mt-4 p-4 bg-neutral-900 rounded-lg border border-neutral-700">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-neutral-300">
                              Total do Pedido
                            </span>
                            <span className="text-xl font-bold text-white">
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
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Adicionar Itens do Menu
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
                        <input
                          type="text"
                          placeholder="Procurar itens do menu..."
                          value={menuSearchTerm}
                          onChange={(e) => setMenuSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div
                      className="space-y-3 max-h-80 overflow-y-auto"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#404040 #171717",
                      }}
                    >
                      {filteredMenuItems.map((item) => (
                        <motion.div
                          key={item.$id}
                          className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 hover:border-neutral-700 hover:bg-neutral-850 hover:shadow-lg hover:shadow-neutral-900/50 transition-all duration-200 cursor-pointer"
                          onClick={() => addItemToOrder(item)}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-medium text-white text-sm">
                              {item.nome}
                            </h4>
                            <span className="font-semibold text-white text-sm">
                              €{item.preco.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.ingredientes?.slice(0, 3).map((ing) => (
                              <span
                                key={ing}
                                className="px-1.5 py-0.5 text-xs rounded-full bg-neutral-800 text-neutral-400"
                              >
                                {ing}
                              </span>
                            ))}
                            {item.ingredientes?.length > 3 && (
                              <span className="px-1.5 py-0.5 text-xs rounded-full bg-neutral-800 text-neutral-400">
                                +{item.ingredientes.length - 3} mais
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                      {filteredMenuItems.length === 0 && (
                        <div className="text-center py-8 text-neutral-500">
                          Nenhum item do menu encontrado
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-neutral-900 px-6 py-4 flex justify-end gap-3 border-t border-neutral-800">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-3 text-neutral-300 border border-neutral-700 rounded-lg hover:bg-neutral-800 hover:text-white transition-colors duration-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!tableNumber || selectedItems.length === 0}
                  className="px-6 py-3 bg-white text-black rounded-lg hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-all duration-200 font-medium cursor-pointer"
                >
                  {editingOrder ? "Atualizar Pedido" : "Criar Pedido"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
