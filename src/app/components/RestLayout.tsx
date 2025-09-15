"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
// Direct icon imports for bundle size
import {
  Grid,
  Edit,
  Shield,
  ShieldX,
  ExternalLink,
  X,
  Plus,
  Trash2,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  ChefHat,
  History,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Eye,
  EyeOff,
  Check,
  RotateCcw,
  CheckCircle2,
  UtensilsCrossed,
  DollarSign,
  Wallet,
  Package,
} from "lucide-react";
import { databases, client } from "@/lib/appwrite";
import { Query } from "appwrite";
import {
  DBRESTAURANTE,
  COL_ORDERS,
  COL_TABLES,
  COL_MENU,
} from "@/lib/appwrite";
import "./RestLayout.scss";

const DATABASE_ID = DBRESTAURANTE;
const COLLECTION_ID = COL_TABLES;
const SETTINGS_COLLECTION_ID = "689cab26001a260d5abc";
const SETTINGS_DOCUMENT_ID = "main";
const ORDERS_COLLECTION_ID = COL_ORDERS;

interface Order {
  $id: string;
  numeroMesa: number[]; // Database now requires array format
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
  // Individual item status when added to order
  status?: "pendente" | "preparando" | "pronto" | "concluido" | "entregue";
  quantidade?: number;
  notes?: string;
  paid?: boolean; // Individual item payment status
}

interface Table {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  chairs: number;
  rotation: number;
  tableNumber: number;
  shape: string;
  status?: string; // Add status field
  chairSides: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

interface AppwriteDocument {
  $id: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  chairs: number;
  rotation: number;
  tableNumber: number;
  shape: string;
  status?: string;
  chairTop?: boolean;
  chairRight?: boolean;
  chairBottom?: boolean;
  chairLeft?: boolean;
}

interface ChairPosition {
  x: number;
  y: number;
  rotation?: number;
}

interface User {
  $id?: string;
  labels?: string[];
  name?: string;
  email?: string;
}

interface RestaurantDashboardLayoutProps {
  user: User | null;
  onEditRedirect?: () => void;
}

// Memoized Table Component for better performance - Simplified for tablets
const TableComponent = React.memo(
  ({
    table,
    tableScale,
    chairPositions,
    tableStyle,
    tableOrders,
    onClick,
    isSelected,
    isSelectionMode,
    multiTableInfo,
  }: {
    table: Table;
    tableScale: number;
    chairPositions: ChairPosition[];
    tableStyle: { borderRadius: string };
    tableOrders: Order[];
    onClick?: (tableNumber: number) => void;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    multiTableInfo?: {
      isMultiTable: boolean;
      relatedTables: number[];
      order: Order | null;
    };
  }) => {
    // Pre-calculate transform to avoid recalculation
    const tableTransform = useMemo(
      () =>
        `translate3d(${table.x * tableScale}px, ${
          table.y * tableScale
        }px, 0) rotate(${table.rotation}deg)`,
      [table.x, table.y, table.rotation, tableScale]
    );

    // Calculate total amount for this table
    const tableTotal = useMemo(() => {
      const total = tableOrders.reduce((sum, order) => {
        // First try to use the order.total field if it exists
        if (order.total && typeof order.total === "number") {
          return sum + order.total;
        }

        // Fallback to calculating from items if total is not available
        const items = order.items || order.itens || [];
        const orderTotal = items.reduce((itemSum: number, item: any) => {
          const price = item.price || item.preco || 0;
          const quantity = item.quantity || item.quantidade || 1;
          return itemSum + price * quantity;
        }, 0);
        return sum + orderTotal;
      }, 0);

      return total;
    }, [tableOrders, table.tableNumber]);

    // Optimized chair rendering - support all chairs but batch DOM updates
    const chairStyles = useMemo(() => {
      // Only render chairs if scale is large enough to see them
      if (tableScale < 0.3) return "";

      return chairPositions
        .map((chairPos, i) => {
          const chairTransform = `translate3d(-50%, -50%, 0) translate3d(${
            chairPos.x
          }px, ${chairPos.y}px, 0) rotate(${
            -table.rotation + (chairPos.rotation || 0)
          }deg)`;

          return `
          .table-${table.id} .chair-${i} {
            position: absolute;
            width: ${Math.max(8, 12 * tableScale)}px;
            height: ${Math.max(8, 12 * tableScale)}px;
            left: 50%;
            top: 50%;
            transform: ${chairTransform};
            border: 2px solid rgba(255, 255, 255, 0.6);
            border-radius: 3px;
            background-color: ${
              table.status === "occupied"
                ? "rgba(248, 113, 113, 0.8)"
                : "rgba(74, 222, 128, 0.8)"
            };
            transition: background-color 0.3s ease;
            will-change: transform;
          }
        `;
        })
        .join("");
    }, [chairPositions, tableScale, table.id, table.rotation, table.status]);

    return (
      <>
        {chairStyles && (
          <style dangerouslySetInnerHTML={{ __html: chairStyles }} />
        )}
        <div
          className={`table-${
            table.id
          } absolute transition-all duration-200 group ${
            onClick && (!isSelectionMode || !multiTableInfo?.isMultiTable)
              ? "cursor-pointer hover:scale-105 hover:shadow-xl"
              : isSelectionMode && multiTableInfo?.isMultiTable
              ? "cursor-not-allowed opacity-60"
              : "cursor-default"
          }`}
          style={{
            left: 0,
            top: 0,
            width: `${table.width * tableScale}px`,
            height: `${table.height * tableScale}px`,
            transform: tableTransform,
            transformOrigin: "center center",
            willChange: "transform, opacity",
          }}
          onClick={() => onClick?.(table.tableNumber)}
        >
          {/* Table - Show status with colors and multi-table indicators */}
          <div
            className={`w-full h-full border-2 flex flex-col items-center justify-center shadow-lg transition-all duration-300 relative ${
              isSelected
                ? "border-blue-400 bg-blue-500/30 shadow-blue-400/50"
                : multiTableInfo?.isMultiTable
                ? "border-purple-400/80 bg-purple-500/20 hover:border-purple-400 hover:bg-purple-500/30"
                : table.status === "occupied"
                ? "border-red-400/60 bg-red-500/10 hover:border-red-400/80 hover:bg-red-500/20"
                : "border-green-400/60 bg-green-500/10 hover:border-green-400/80 hover:bg-green-500/20"
            }`}
            style={tableStyle}
          >
            {/* Selection indicator */}
            {isSelected && tableScale > 0.3 && (
              <div
                className="absolute bg-blue-400 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                style={{
                  width: `${Math.max(16, 20 * tableScale)}px`,
                  height: `${Math.max(16, 20 * tableScale)}px`,
                  top: `${Math.max(4, 6 * tableScale)}px`,
                  left: `${Math.max(4, 6 * tableScale)}px`,
                }}
              >
                <Check
                  className="text-white"
                  size={Math.max(8, 12 * tableScale)}
                />
              </div>
            )}

            {/* Status indicator - only show if not selected and table is large enough */}
            {!isSelected && tableScale > 0.3 && (
              <div
                className={`absolute rounded-full border-2 border-white shadow-lg ${
                  table.status === "occupied"
                    ? "bg-red-400 shadow-red-400/50"
                    : "bg-green-400 shadow-green-400/50"
                }`}
                style={{
                  width: `${Math.max(8, 12 * tableScale)}px`,
                  height: `${Math.max(8, 12 * tableScale)}px`,
                  top: `${Math.max(4, 6 * tableScale)}px`,
                  right: `${Math.max(4, 6 * tableScale)}px`,
                }}
              />
            )}

            {/* Multi-table indicator */}
            {multiTableInfo?.isMultiTable && tableScale > 0.3 && (
              <div
                className="absolute bg-purple-600 text-white text-xs font-bold px-1 py-0.5 rounded border border-white shadow-lg"
                style={{
                  fontSize: `${Math.max(8, 10 * tableScale)}px`,
                  top: `${Math.max(4, 6 * tableScale)}px`,
                  left: `${Math.max(4, 6 * tableScale)}px`,
                }}
              >
                {multiTableInfo.relatedTables.join("+")}
              </div>
            )}

            {/* Table Number */}
            <span
              className={`font-bold select-none ${
                multiTableInfo?.isMultiTable
                  ? "text-purple-300"
                  : table.status === "occupied"
                  ? "text-red-300"
                  : "text-green-300"
              }`}
              style={{
                fontSize: `${Math.max(12, 18 * tableScale)}px`,
              }}
            >
              {table.tableNumber}
            </span>

            {/* Order Information - Only show if table has orders and is large enough */}
            {tableOrders.length > 0 && tableScale > 0.4 && tableTotal > 0 && (
              <div
                className={`font-bold text-center px-2 py-1 rounded-md shadow-md ${
                  table.status === "occupied"
                    ? "bg-red-50 text-red-900 border-2 border-red-300"
                    : "bg-green-50 text-green-900 border-2 border-green-300"
                }`}
                style={{
                  fontSize: `${Math.max(10, 14 * tableScale)}px`,
                  marginTop: `${Math.max(3, 5 * tableScale)}px`,
                  minWidth: `${Math.max(50, 70 * tableScale)}px`,
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
                  backdropFilter: "blur(2px)",
                  WebkitBackdropFilter: "blur(2px)",
                }}
              >
                €{tableTotal.toFixed(2)}
              </div>
            )}
          </div>

          {/* Chairs as div elements - render all chairs */}
          {tableScale >= 0.3 &&
            chairPositions.map((chairPos, i) => (
              <div key={i} className={`chair-${i}`} />
            ))}
        </div>
      </>
    );
  }
);

TableComponent.displayName = "TableComponent";

TableComponent.displayName = "TableComponent";

// Order Modal Component
const OrderModal = React.memo(
  ({
    isOpen,
    onClose,
    tableNumbers,
    editingOrder,
    isViewOnlyMode,
    selectedItems,
    onItemsChange,
    menuItems,
    menuSearchTerm,
    onMenuSearchChange,
    onAddItem,
    onRemoveItem,
    onUpdateQuantity,
    onUpdateNotes,
    selectedCategory,
    onCategoryChange,
    onSave,
  }: {
    isOpen: boolean;
    onClose: () => void;
    tableNumbers: number[];
    editingOrder: Order | null;
    isViewOnlyMode?: boolean;
    selectedItems: any[];
    onItemsChange: (items: any[]) => void;
    menuItems: MenuItem[];
    menuSearchTerm: string;
    onMenuSearchChange: (term: string) => void;
    onAddItem: (item: MenuItem) => void;
    onRemoveItem: (index: number) => void;
    onUpdateQuantity: (index: number, quantity: number) => void;
    onUpdateNotes: (index: number, notes: string) => void;
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    onSave: () => void;
  }) => {
    if (!isOpen) return null;

    // Get unique categories from menu items
    const categories = [
      "all",
      ...new Set(
        menuItems
          .map((item) => item.category || item.categoria || "outros")
          .filter(Boolean)
      ),
    ];

    const filteredMenuItems = menuItems.filter((item) => {
      const matchesSearch = (item.name || item.nome || "")
        .toLowerCase()
        .includes(menuSearchTerm.toLowerCase());

      const itemCategory = item.category || item.categoria || "outros";
      const matchesCategory =
        selectedCategory === "all" || itemCategory === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    // Group items by category for display
    const groupedItems = filteredMenuItems.reduce((acc, item) => {
      const category = item.category || item.categoria || "outros";
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);

    const total = selectedItems.reduce(
      (sum, item) => sum + item.preco * item.quantidade,
      0
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {isViewOnlyMode
                  ? "Visualizar Pedido"
                  : editingOrder
                  ? "Editar Pedido"
                  : "Novo Pedido"}{" "}
                - Mesa
                {tableNumbers.length > 1 ? "s" : ""} {tableNumbers.join(", ")}
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
            {/* Menu Items - Only show when not in view-only mode */}
            {!isViewOnlyMode && (
              <div className="w-1/2 p-6 border-r border-gray-200 overflow-y-auto">
                <div className="mb-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Procurar menu..."
                    value={menuSearchTerm}
                    onChange={(e) => onMenuSearchChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Category Filter */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todas as Categorias</option>
                    {categories
                      .filter((cat) => cat !== "all")
                      .map((category) => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Display items grouped by category */}
                <div className="space-y-4">
                  {selectedCategory === "all" ? (
                    // Show all categories grouped
                    Object.entries(groupedItems).map(([category, items]) => (
                      <div key={category}>
                        <h3 className="font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </h3>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div
                              key={item.$id}
                              onClick={() => onAddItem(item)}
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
                    ))
                  ) : (
                    // Show single category
                    <div className="space-y-2">
                      {filteredMenuItems.map((item) => (
                        <div
                          key={item.$id}
                          onClick={() => onAddItem(item)}
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
                  )}
                </div>
              </div>
            )}

            {/* Selected Items */}
            <div
              className={`p-6 overflow-y-auto ${
                isViewOnlyMode ? "w-full" : "w-1/2"
              }`}
            >
              <h3 className="font-bold text-gray-900 mb-4">
                {isViewOnlyMode ? "Detalhes do Pedido" : "Itens Selecionados"}
              </h3>

              <div className="space-y-3">
                {selectedItems.map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-900">
                        {item.nome}
                      </span>
                      {!isViewOnlyMode && (
                        <button
                          onClick={() => onRemoveItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      {!isViewOnlyMode && (
                        <button
                          onClick={() =>
                            onUpdateQuantity(
                              index,
                              Math.max(1, item.quantidade - 1)
                            )
                          }
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                        >
                          -
                        </button>
                      )}
                      <span className="px-3 py-1 bg-white border rounded">
                        {item.quantidade}
                      </span>
                      {!isViewOnlyMode && (
                        <button
                          onClick={() =>
                            onUpdateQuantity(index, item.quantidade + 1)
                          }
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                        >
                          +
                        </button>
                      )}
                      <span className="ml-auto font-bold">
                        €{(item.preco * item.quantidade).toFixed(2)}
                      </span>
                    </div>

                    {!isViewOnlyMode ? (
                      <input
                        type="text"
                        placeholder="Notas..."
                        value={item.notas || ""}
                        onChange={(e) => onUpdateNotes(index, e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      item.notas && (
                        <div className="w-full px-2 py-1 text-sm text-gray-600 bg-gray-50 rounded border">
                          Notas: {item.notas}
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>

              {selectedItems.length === 0 && (
                <p className="text-gray-500 text-center mt-8">
                  Nenhum item selecionado
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
                  {isViewOnlyMode ? "Fechar" : "Cancelar"}
                </button>
                {!isViewOnlyMode && (
                  <button
                    onClick={onSave}
                    disabled={selectedItems.length === 0}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg"
                  >
                    {editingOrder ? "Atualizar" : "Criar"} Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

OrderModal.displayName = "OrderModal";

// Payment Modal Component
const PaymentModal = React.memo(
  ({
    isOpen,
    onClose,
    order,
    paymentMethod,
    onPaymentMethodChange,
    onProcessPayment,
  }: {
    isOpen: boolean;
    onClose: () => void;
    order: Order;
    paymentMethod: string;
    onPaymentMethodChange: (method: string) => void;
    onProcessPayment: () => void;
  }) => {
    if (!isOpen) return null;

    const tableNumbers = order.numeroMesa;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Processar Pagamento
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <p className="text-gray-600">
                Mesa{tableNumbers.length > 1 ? "s" : ""}:{" "}
                {tableNumbers.join(", ")}
              </p>
              <p className="text-gray-600">Pedido: #{order.$id.slice(-6)}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                €{order.total.toFixed(2)}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => onPaymentMethodChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecionar método</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="mbway">MB WAY</option>
                <option value="multibanco">Multibanco</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={onProcessPayment}
                disabled={!paymentMethod}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PaymentModal.displayName = "PaymentModal";

// Bulk Payment Modal Component
const BulkPaymentModal = React.memo(
  ({
    isOpen,
    onClose,
    tableNumber,
    paymentMethod,
    onPaymentMethodChange,
    onProcessPayment,
  }: {
    isOpen: boolean;
    onClose: () => void;
    tableNumber: number | null;
    paymentMethod: string;
    onPaymentMethodChange: (method: string) => void;
    onProcessPayment: () => void;
  }) => {
    if (!isOpen || !tableNumber) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Pagar Todos os Itens - Mesa {tableNumber}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <p className="text-gray-700 mb-4">
                Todos os itens concluídos da mesa {tableNumber} serão marcados
                como pagos.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => onPaymentMethodChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione o método</option>
                <option value="dinheiro">💵 Dinheiro</option>
                <option value="cartao">💳 Cartão</option>
                <option value="mbway">📱 MB Way</option>
                <option value="transferencia">🏦 Transferência</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={onProcessPayment}
                disabled={!paymentMethod}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

BulkPaymentModal.displayName = "BulkPaymentModal";

const RestLayout = React.memo(function RestLayout({
  user,
  onEditRedirect = () => console.log("Navigate to edit page"),
}: RestaurantDashboardLayoutProps) {
  const router = useRouter();

  // State management
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurantSize, setRestaurantSize] = useState<number>(100);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTables, setSelectedTables] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);

  // Order management states
  const [showOrderModal, setShowOrderModal] = useState<boolean>(false);
  const [isViewOnlyMode, setIsViewOnlyMode] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showBulkPaymentModal, setShowBulkPaymentModal] =
    useState<boolean>(false);
  const [bulkPaymentTableNumber, setBulkPaymentTableNumber] = useState<
    number | null
  >(null);
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<any[]>([]);
  const [orderTableNumbers, setOrderTableNumbers] = useState<number[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [menuSearchTerm, setMenuSearchTerm] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>("");
  const [showTableDetails, setShowTableDetails] = useState<Set<number>>(
    new Set()
  );
  const [showPaidOrders, setShowPaidOrders] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // UI states
  const [windowSize, setWindowSize] = useState({
    width: 1200,
    height: 800,
    containerWidth: 0,
    containerHeight: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Memoized calculations to prevent re-computation on every render
  const maxDimensions = useMemo(() => {
    const baseSize = Math.sqrt(restaurantSize) * 60;

    // Get available space from container (accounting for padding)
    let availableWidth = windowSize.width;
    let availableHeight = windowSize.height;

    // Use container dimensions if available (from ResizeObserver)
    if (windowSize.containerWidth > 0 && windowSize.containerHeight > 0) {
      availableWidth = windowSize.containerWidth - 48; // 24px padding on each side
      availableHeight = windowSize.containerHeight - 48; // 24px padding on each side
    } else if (typeof window !== "undefined" && containerRef.current) {
      // Fallback to direct measurement
      const container = containerRef.current;
      availableWidth = container.clientWidth - 48; // 24px padding on each side
      availableHeight = container.clientHeight - 48; // 24px padding on each side
    } else {
      // Fallback calculations when container not available yet
      if (windowSize.width < 640) {
        availableWidth = windowSize.width - 48;
        availableHeight = windowSize.height - 200; // Account for header
      } else if (windowSize.width < 1024) {
        availableWidth = windowSize.width - 48;
        availableHeight = windowSize.height - 180;
      } else {
        // Desktop - account for sidebar in dashboard
        availableWidth = windowSize.width - 320 - 48; // sidebar width + padding
        availableHeight = windowSize.height - 160; // header + some margin
      }
    }

    // Ensure minimum available space but keep it smaller to fit without scrolling
    availableWidth = Math.max(300, availableWidth);
    availableHeight = Math.max(300, availableHeight);

    // Calculate base canvas size (square aspect ratio)
    const baseCanvasSize = baseSize * 1.2;

    // Scale to fit within the available space (never exceed container bounds)
    const heightBasedScale = availableHeight / baseCanvasSize;
    const widthBasedScale = availableWidth / baseCanvasSize;

    // Use the smaller scale to ensure it NEVER exceeds container bounds
    let optimalScale = Math.min(heightBasedScale, widthBasedScale);

    // Add a safety margin to ensure no scrolling (use 90% of optimal scale)
    optimalScale = optimalScale * 0.9;

    // Apply reasonable limits but prioritize fitting in container
    const clampedScale = Math.max(0.2, Math.min(2.5, optimalScale));

    const finalSize = baseCanvasSize * clampedScale;

    return {
      width: finalSize,
      height: finalSize,
      scale: clampedScale,
      availableWidth,
      availableHeight,
    };
  }, [
    restaurantSize,
    windowSize.width,
    windowSize.height,
    windowSize.containerWidth,
    windowSize.containerHeight,
  ]);

  // Memoized table scale
  const tableScale = useMemo(
    () => maxDimensions.scale || 0.8,
    [maxDimensions.scale]
  );

  // Optimized chair position calculation function
  const calculateChairPositions = useCallback(
    (table: Table, scale: number = 1): ChairPosition[] => {
      const chairs: ChairPosition[] = [];
      const { width, height, chairs: chairCount, shape, chairSides } = table;
      const chairDistance = 18 * scale;

      if (shape === "circular") {
        const radius = (width * scale) / 2 + chairDistance;
        for (let i = 0; i < chairCount; i++) {
          const angle = (2 * Math.PI * i) / chairCount - Math.PI / 2;
          chairs.push({
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            rotation: angle * (180 / Math.PI) + 90,
          });
        }
      } else {
        const sides = [
          { key: "top", enabled: chairSides.top },
          { key: "right", enabled: chairSides.right },
          { key: "bottom", enabled: chairSides.bottom },
          { key: "left", enabled: chairSides.left },
        ];

        const enabledSides = sides.filter((side) => side.enabled);
        if (enabledSides.length === 0) return chairs;

        const chairsPerSide = Math.floor(chairCount / enabledSides.length);
        const remainder = chairCount % enabledSides.length;

        enabledSides.forEach((side, sideIndex) => {
          const extraChair = sideIndex < remainder ? 1 : 0;
          const chairsOnThisSide = chairsPerSide + extraChair;

          for (let i = 0; i < chairsOnThisSide; i++) {
            let x: number, y: number, rotation: number;

            switch (side.key) {
              case "top":
                x =
                  ((width * scale) / (chairsOnThisSide + 1)) * (i + 1) -
                  (width * scale) / 2;
                y = -(height * scale) / 2 - chairDistance;
                rotation = 0;
                break;
              case "right":
                x = (width * scale) / 2 + chairDistance;
                y =
                  ((height * scale) / (chairsOnThisSide + 1)) * (i + 1) -
                  (height * scale) / 2;
                rotation = 90;
                break;
              case "bottom":
                x =
                  (width * scale) / 2 -
                  ((width * scale) / (chairsOnThisSide + 1)) * (i + 1);
                y = (height * scale) / 2 + chairDistance;
                rotation = 180;
                break;
              case "left":
                x = -(width * scale) / 2 - chairDistance;
                y =
                  (height * scale) / 2 -
                  ((height * scale) / (chairsOnThisSide + 1)) * (i + 1);
                rotation = -90;
                break;
              default:
                x = 0;
                y = 0;
                rotation = 0;
            }

            chairs.push({ x, y, rotation });
          }
        });
      }

      return chairs;
    },
    []
  );

  // Memoized chair positions to avoid recalculating on every render
  const chairPositionsCache = useMemo(() => {
    const cache = new Map<string, ChairPosition[]>();

    tables.forEach((table) => {
      const cacheKey = `${table.id}-${table.width}-${table.height}-${
        table.chairs
      }-${table.shape}-${JSON.stringify(table.chairSides)}-${tableScale}`;

      if (!cache.has(cacheKey)) {
        const positions = calculateChairPositions(table, tableScale);
        cache.set(cacheKey, positions);
      }
    });

    return cache;
  }, [tables, tableScale, calculateChairPositions]);

  // Throttled window resize handler with container size tracking
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let resizeObserver: ResizeObserver;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize((prev) => ({
          ...prev,
          width: window.innerWidth,
          height: window.innerHeight,
        }));
      }, 150); // Throttle resize events
    };

    // Set up ResizeObserver for the container
    const setupResizeObserver = () => {
      if (containerRef.current && window.ResizeObserver) {
        resizeObserver = new ResizeObserver((entries) => {
          for (let entry of entries) {
            const { width, height } = entry.contentRect;
            // Update window size to trigger maxDimensions recalculation
            setWindowSize((prev) => ({
              ...prev,
              containerWidth: width,
              containerHeight: height,
            }));
          }
        });
        resizeObserver.observe(containerRef.current);
      }
    };

    if (typeof window !== "undefined") {
      setWindowSize((prev) => ({
        ...prev,
        width: window.innerWidth,
        height: window.innerHeight,
      }));
      window.addEventListener("resize", handleResize, { passive: true });

      // Setup resize observer with a small delay
      setTimeout(setupResizeObserver, 100);

      return () => {
        window.removeEventListener("resize", handleResize);
        clearTimeout(timeoutId);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
      };
    }
  }, []);

  // Check user permissions
  useEffect(() => {
    setIsManager(user?.labels?.includes("manager") || false);
  }, [user]);

  // Remove centering logic since we want no scrolling
  useEffect(() => {
    // No centering needed - component should always fit in container
    // This effect is kept for potential future use but doesn't do centering
  }, [
    maxDimensions.width,
    maxDimensions.height,
    windowSize.width,
    windowSize.height,
  ]);

  // Realtime subscription for tables and orders with improved logic
  useEffect(() => {
    if (!client) return;

    let tablesUpdateTimeoutId: NodeJS.Timeout;
    let ordersUpdateTimeoutId: NodeJS.Timeout;

    const fetchTables = async () => {
      try {
        const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
          Query.limit(100),
        ]);
        const tablesData = res.documents.map((doc) => {
          const appwriteDoc = doc as unknown as AppwriteDocument;
          return {
            id: appwriteDoc.$id,
            x: appwriteDoc.posX,
            y: appwriteDoc.posY,
            width: appwriteDoc.width,
            height: appwriteDoc.height,
            chairs: appwriteDoc.chairs,
            rotation: appwriteDoc.rotation,
            tableNumber: appwriteDoc.tableNumber,
            shape: appwriteDoc.shape,
            status: appwriteDoc.status || "free",
            chairSides: {
              top: appwriteDoc.chairTop ?? true,
              right: appwriteDoc.chairRight ?? true,
              bottom: appwriteDoc.chairBottom ?? true,
              left: appwriteDoc.chairLeft ?? true,
            },
          };
        });
        setTables(tablesData);
      } catch (err) {
        console.error("Error fetching tables:", err);
      }
    };

    const fetchOrders = async () => {
      try {
        const query = showPaidOrders
          ? [Query.limit(100)] // Show all orders including paid ones
          : [Query.equal("paid", false), Query.limit(100)]; // Only unpaid orders

        const res = await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          query
        );
        setOrders(res.documents as unknown as Order[]);
      } catch (err) {
        console.error("Error fetching orders:", err);
      }
    };

    const updateTablesStatus = async () => {
      try {
        // Fetch fresh orders to calculate table status
        const ordersRes = await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          [Query.equal("paid", false), Query.limit(100)]
        );
        const currentOrders = ordersRes.documents as unknown as Order[];

        // Update tables with calculated status
        const tablesRes = await databases.listDocuments(
          DATABASE_ID,
          COLLECTION_ID,
          [Query.limit(100)]
        );
        const updatedTables = tablesRes.documents.map((doc) => {
          const appwriteDoc = doc as unknown as AppwriteDocument;
          const tableOrders = currentOrders.filter((order) => {
            // Handle both old single table format and new array format
            const tables = order.numeroMesa;
            return tables.includes(appwriteDoc.tableNumber);
          });
          const calculatedStatus = tableOrders.length > 0 ? "occupied" : "free";

          return {
            id: appwriteDoc.$id,
            x: appwriteDoc.posX,
            y: appwriteDoc.posY,
            width: appwriteDoc.width,
            height: appwriteDoc.height,
            chairs: appwriteDoc.chairs,
            rotation: appwriteDoc.rotation,
            tableNumber: appwriteDoc.tableNumber,
            shape: appwriteDoc.shape,
            status: calculatedStatus,
            chairSides: {
              top: appwriteDoc.chairTop ?? true,
              right: appwriteDoc.chairRight ?? true,
              bottom: appwriteDoc.chairBottom ?? true,
              left: appwriteDoc.chairLeft ?? true,
            },
          };
        });

        setTables(updatedTables);
        setOrders(currentOrders);
      } catch (err) {
        console.error("Error updating tables status:", err);
      }
    };

    // Initial fetch
    updateTablesStatus();

    // Subscribe to tables changes
    const unsubscribeTables = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COLLECTION_ID}.documents`,
      (response) => {
        clearTimeout(tablesUpdateTimeoutId);
        tablesUpdateTimeoutId = setTimeout(fetchTables, 100);
      }
    );

    // Subscribe to orders changes with immediate status update
    const unsubscribeOrders = client.subscribe(
      `databases.${DATABASE_ID}.collections.${ORDERS_COLLECTION_ID}.documents`,
      (response) => {
        clearTimeout(ordersUpdateTimeoutId);
        ordersUpdateTimeoutId = setTimeout(updateTablesStatus, 100);
      }
    );

    return () => {
      clearTimeout(tablesUpdateTimeoutId);
      clearTimeout(ordersUpdateTimeoutId);
      if (unsubscribeTables && typeof unsubscribeTables === "function") {
        unsubscribeTables();
      }
      if (unsubscribeOrders && typeof unsubscribeOrders === "function") {
        unsubscribeOrders();
      }
    };
  }, []);

  // Realtime subscription for settings with throttling
  useEffect(() => {
    if (!client) return;

    let settingsUpdateTimeoutId: NodeJS.Timeout;

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${SETTINGS_COLLECTION_ID}.documents`,
      (response) => {
        if (
          response.events.includes(
            `databases.${DATABASE_ID}.collections.${SETTINGS_COLLECTION_ID}.documents.*.update`
          )
        ) {
          clearTimeout(settingsUpdateTimeoutId);
          settingsUpdateTimeoutId = setTimeout(() => {
            const updatedSettings = response.payload as {
              $id: string;
              size: number;
            };
            if (updatedSettings.$id === SETTINGS_DOCUMENT_ID) {
              setRestaurantSize(updatedSettings.size);
            }
          }, 200); // Less frequent updates for settings
        }
      }
    );

    return () => {
      clearTimeout(settingsUpdateTimeoutId);
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // Fetch restaurant settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const doc = await databases.getDocument(
          DATABASE_ID,
          SETTINGS_COLLECTION_ID,
          SETTINGS_DOCUMENT_ID
        );
        setRestaurantSize(doc.size);
      } catch (err) {
        console.error("Error fetching settings:", err);
        // Try to create default settings if document doesn't exist
        if (isManager) {
          try {
            await databases.createDocument(
              DATABASE_ID,
              SETTINGS_COLLECTION_ID,
              SETTINGS_DOCUMENT_ID,
              { id: SETTINGS_DOCUMENT_ID, size: 100 }
            );
            setRestaurantSize(100);
          } catch (createErr) {
            console.error("Erro ao criar documento de settings:", createErr);
            setRestaurantSize(100);
          }
        } else {
          setRestaurantSize(100);
        }
      }
    };
    fetchSettings();
  }, [isManager]);

  // Fetch tables
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
          Query.limit(100),
        ]);
        const tablesData = res.documents.map((doc) => {
          const appwriteDoc = doc as unknown as AppwriteDocument;
          return {
            id: appwriteDoc.$id,
            x: appwriteDoc.posX,
            y: appwriteDoc.posY,
            width: appwriteDoc.width,
            height: appwriteDoc.height,
            chairs: appwriteDoc.chairs,
            rotation: appwriteDoc.rotation,
            tableNumber: appwriteDoc.tableNumber,
            shape: appwriteDoc.shape,
            status: appwriteDoc.status || "free", // Include status field
            chairSides: {
              top: appwriteDoc.chairTop ?? true,
              right: appwriteDoc.chairRight ?? true,
              bottom: appwriteDoc.chairBottom ?? true,
              left: appwriteDoc.chairLeft ?? true,
            },
          };
        });
        setTables(tablesData);
      } catch (err) {
        console.error("Error fetching tables:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchOrders = async () => {
      try {
        const query = showPaidOrders
          ? [Query.limit(100)] // Show all orders including paid ones
          : [Query.equal("paid", false), Query.limit(100)]; // Only unpaid orders

        const res = await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          query
        );
        const fetchedOrders = res.documents as unknown as Order[];
        setOrders(fetchedOrders);
      } catch (err) {
        console.error("Error fetching orders:", err);
      }
    };

    const fetchMenuItems = async () => {
      try {
        const res = await databases.listDocuments(DBRESTAURANTE, COL_MENU, [
          Query.limit(100),
        ]);
        setMenuItems(res.documents as unknown as MenuItem[]);
      } catch (err) {
        console.error("Error fetching menu items:", err);
      }
    };

    fetchTables();
    fetchOrders();
    fetchMenuItems();
  }, []);

  // Refetch orders when showPaidOrders changes
  useEffect(() => {
    const fetchOrdersWithFilter = async () => {
      try {
        const query = showPaidOrders
          ? [Query.limit(100)] // Show all orders including paid ones
          : [Query.equal("paid", false), Query.limit(100)]; // Only unpaid orders

        const res = await databases.listDocuments(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          query
        );
        setOrders(res.documents as unknown as Order[]);
      } catch (err) {
        console.error("Error fetching orders:", err);
      }
    };

    fetchOrdersWithFilter();
  }, [showPaidOrders]);

  // Memoized table style function
  const getTableStyle = useCallback((table: Table) => {
    return {
      borderRadius: table.shape === "circular" ? "50%" : "2px",
    };
  }, []);

  // Viewport-based rendering for performance
  const visibleTables = useMemo(() => {
    if (typeof window === "undefined" || !containerRef.current) {
      return tables; // Server-side or no container, render all
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const buffer = 200; // Render tables 200px outside viewport

    return tables.filter((table) => {
      const tableX = table.x * tableScale;
      const tableY = table.y * tableScale;
      const tableWidth = table.width * tableScale;
      const tableHeight = table.height * tableScale;

      // Check if table is within expanded viewport
      return (
        tableX + tableWidth + buffer >= 0 &&
        tableX - buffer <= containerRect.width &&
        tableY + tableHeight + buffer >= 0 &&
        tableY - buffer <= containerRect.height
      );
    });
  }, [tables, tableScale, windowSize]);

  // Optimized chair positions getter with caching
  const getChairPositions = useCallback(
    (table: Table): ChairPosition[] => {
      const cacheKey = `${table.id}-${table.width}-${table.height}-${
        table.chairs
      }-${table.shape}-${JSON.stringify(table.chairSides)}-${tableScale}`;

      if (chairPositionsCache.has(cacheKey)) {
        return chairPositionsCache.get(cacheKey)!;
      }

      return calculateChairPositions(table, tableScale);
    },
    [chairPositionsCache, tableScale, calculateChairPositions]
  );

  // Get orders for a specific table
  const getTableOrders = useCallback(
    (tableNumber: number): Order[] => {
      return orders.filter((order) => {
        // numeroMesa is now always an array
        const tables = order.numeroMesa;
        return tables.includes(tableNumber);
      });
    },
    [orders]
  );

  // Check if a table is part of a multi-table order and get related tables
  const getMultiTableInfo = useCallback(
    (tableNumber: number) => {
      const order = orders.find((order) => {
        const tables = order.numeroMesa;
        return tables.includes(tableNumber) && tables.length > 1;
      });

      if (order) {
        const relatedTables = order.numeroMesa;
        return {
          isMultiTable: true,
          relatedTables,
          order,
        };
      }

      return {
        isMultiTable: false,
        relatedTables: [tableNumber],
        order: null,
      };
    },
    [orders]
  );

  // Order management functions
  const openOrderModal = useCallback(
    (tableNumbers: number[], existingOrder?: Order, viewOnly?: boolean) => {
      setOrderTableNumbers(tableNumbers);
      setEditingOrder(existingOrder || null);
      setIsViewOnlyMode(viewOnly || false);
      setSelectedOrderItems(
        existingOrder
          ? (existingOrder.items || existingOrder.itens || []).map((item) =>
              typeof item === "string" ? JSON.parse(item) : item
            )
          : []
      );
      setShowOrderModal(true);
    },
    []
  );

  const closeOrderModal = useCallback(() => {
    setShowOrderModal(false);
    setEditingOrder(null);
    setIsViewOnlyMode(false);
    setSelectedOrderItems([]);
    setOrderTableNumbers([]);
    setMenuSearchTerm("");
  }, []);

  const addItemToOrder = useCallback((menuItem: MenuItem) => {
    const newItem = {
      nome: menuItem.name || menuItem.nome,
      preco: menuItem.price || menuItem.preco,
      quantidade: 1,
      notas: "",
      status: "pendente" as const,
      paid: false,
    };
    setSelectedOrderItems((prev) => [...prev, newItem]);
  }, []);

  const removeItemFromOrder = useCallback((index: number) => {
    setSelectedOrderItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItemQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) return;
    setSelectedOrderItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantidade: quantity } : item
      )
    );
  }, []);

  const updateItemNotes = useCallback((index: number, notes: string) => {
    setSelectedOrderItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, notas: notes } : item))
    );
  }, []);

  const updateItemStatus = useCallback(
    (
      index: number,
      status: "pendente" | "preparando" | "pronto" | "entregue"
    ) => {
      setSelectedOrderItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, status: status } : item
        )
      );
    },
    []
  );

  // Function to cycle through status stages
  const cycleItemStatus = useCallback(
    (index: number, currentStatus?: string) => {
      const statusFlow = [
        "pendente",
        "preparando",
        "pronto",
        "concluido",
        "entregue",
      ];
      const currentIndex = statusFlow.indexOf(currentStatus || "pendente");
      const nextIndex = (currentIndex + 1) % statusFlow.length;
      const nextStatus = statusFlow[nextIndex] as
        | "pendente"
        | "preparando"
        | "pronto"
        | "concluido"
        | "entregue";

      setSelectedOrderItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, status: nextStatus } : item
        )
      );
    },
    []
  );

  // Direct update functions for items in database (no need to save entire order)
  const updateItemStatusDirect = useCallback(
    async (
      orderId: string,
      itemIndex: number,
      status: "pendente" | "preparando" | "pronto" | "concluido" | "entregue"
    ) => {
      try {
        const order = orders.find((o) => o.$id === orderId);
        if (!order) return;

        const items = order.items || order.itens || [];
        const updatedItems = items.map((item, idx) => {
          const parsedItem = typeof item === "string" ? JSON.parse(item) : item;
          if (idx === itemIndex) {
            return JSON.stringify({ ...parsedItem, status });
          }
          return typeof item === "string" ? item : JSON.stringify(item);
        });

        await databases.updateDocument(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          orderId,
          { itens: updatedItems }
        );

        // Update local state
        setOrders((prev) =>
          prev.map((o) =>
            o.$id === orderId
              ? { ...o, itens: updatedItems, items: updatedItems }
              : o
          )
        );
      } catch (error) {
        console.error("Error updating item status:", error);
      }
    },
    [orders]
  );

  // Function to cycle through status stages for direct database updates
  const cycleItemStatusDirect = useCallback(
    async (orderId: string, itemIndex: number, currentStatus?: string) => {
      const statusFlow = [
        "pendente",
        "preparando",
        "pronto",
        "concluido",
        "entregue",
      ];
      const currentIndex = statusFlow.indexOf(currentStatus || "pendente");
      const nextIndex = (currentIndex + 1) % statusFlow.length;
      const nextStatus = statusFlow[nextIndex] as
        | "pendente"
        | "preparando"
        | "pronto"
        | "concluido"
        | "entregue";

      await updateItemStatusDirect(orderId, itemIndex, nextStatus);
    },
    [updateItemStatusDirect]
  );

  const updateItemPaidDirect = useCallback(
    async (orderId: string, itemIndex: number, paid: boolean) => {
      try {
        const order = orders.find((o) => o.$id === orderId);
        if (!order) return;

        const items = order.items || order.itens || [];
        const updatedItems = items.map((item, idx) => {
          const parsedItem = typeof item === "string" ? JSON.parse(item) : item;
          if (idx === itemIndex) {
            return JSON.stringify({
              ...parsedItem,
              paid,
              paymentMethod: paid ? "dinheiro" : undefined, // Default to cash for individual payments
            });
          }
          return typeof item === "string" ? item : JSON.stringify(item);
        });

        // Check if all items are now paid
        const allItemsPaid = updatedItems.every((item) => {
          const parsedItem = typeof item === "string" ? JSON.parse(item) : item;
          return parsedItem.paid === true;
        });

        // Update order with items and paid status
        const updateData: any = { itens: updatedItems };
        if (allItemsPaid) {
          updateData.paid = true;
        }

        await databases.updateDocument(
          DATABASE_ID,
          COL_ORDERS,
          orderId,
          updateData
        );

        // Update local state
        setOrders((prev) =>
          prev.map((o) =>
            o.$id === orderId
              ? {
                  ...o,
                  itens: updatedItems,
                  items: updatedItems,
                  paid: allItemsPaid,
                }
              : o
          )
        );
      } catch (error) {
        console.error("Error updating item payment:", error);
      }
    },
    [orders]
  );

  // Mark all items in an order as paid
  const markAllItemsPaid = useCallback(
    async (orderId: string) => {
      try {
        const order = orders.find((o) => o.$id === orderId);
        if (!order) return;

        const items = order.items || order.itens || [];
        const updatedItems = items.map((item) => {
          const parsedItem = typeof item === "string" ? JSON.parse(item) : item;
          return JSON.stringify({ ...parsedItem, paid: true });
        });

        // Update order with items and mark as paid
        await databases.updateDocument(DATABASE_ID, COL_ORDERS, orderId, {
          itens: updatedItems,
          paid: true,
        });

        // Update local state
        setOrders((prev) =>
          prev.map((o) =>
            o.$id === orderId
              ? { ...o, itens: updatedItems, items: updatedItems, paid: true }
              : o
          )
        );
      } catch (error) {
        console.error("Error marking all items as paid:", error);
      }
    },
    [orders]
  );

  // Check if there are concluded items ready to be paid in a table
  const hasTableItemsReadyToPay = useCallback(
    (tableNumber: number) => {
      const tableOrders = getTableOrders(tableNumber);
      if (tableOrders.length === 0) return false;

      // Check if there are any concluded items that are not paid
      return tableOrders.some((order) => {
        const items = order.items || order.itens || [];
        return items.some((item) => {
          const parsedItem = typeof item === "string" ? JSON.parse(item) : item;
          return parsedItem.status === "concluido" && !parsedItem.paid;
        });
      });
    },
    [getTableOrders]
  );

  // Open bulk payment modal for a table
  const openBulkPaymentModal = useCallback((tableNumber: number) => {
    setBulkPaymentTableNumber(tableNumber);
    setBulkPaymentMethod("");
    setShowBulkPaymentModal(true);
  }, []);

  // Process bulk payment for all concluded items in a table
  const processBulkPayment = useCallback(async () => {
    if (!bulkPaymentTableNumber || !bulkPaymentMethod) return;

    try {
      const tableOrders = getTableOrders(bulkPaymentTableNumber);

      for (const order of tableOrders) {
        const items = order.items || order.itens || [];
        const updatedItems = items.map((item) => {
          const parsedItem = typeof item === "string" ? JSON.parse(item) : item;
          if (parsedItem.status === "concluido" && !parsedItem.paid) {
            return JSON.stringify({
              ...parsedItem,
              paid: true,
              paymentMethod: bulkPaymentMethod,
            });
          }
          return typeof item === "string" ? item : JSON.stringify(item);
        });

        // Check if all items in this order are now paid
        const allItemsPaid = updatedItems.every((item) => {
          const parsedItem = typeof item === "string" ? JSON.parse(item) : item;
          return parsedItem.paid === true;
        });

        // Update order with items and paid status
        const updateData: any = { itens: updatedItems };
        if (allItemsPaid) {
          updateData.paid = true;
        }

        // Update in database
        await databases.updateDocument(
          DATABASE_ID,
          COL_ORDERS,
          order.$id,
          updateData
        );

        // Update local state
        setOrders((prev) =>
          prev.map((o) =>
            o.$id === order.$id
              ? {
                  ...o,
                  itens: updatedItems,
                  items: updatedItems,
                  paid: allItemsPaid,
                }
              : o
          )
        );
      }

      // Close modal and reset states
      setShowBulkPaymentModal(false);
      setBulkPaymentTableNumber(null);
      setBulkPaymentMethod("");
    } catch (error) {
      console.error("Error processing bulk payment:", error);
    }
  }, [bulkPaymentTableNumber, bulkPaymentMethod, getTableOrders, orders]);

  const saveOrder = useCallback(async () => {
    if (selectedOrderItems.length === 0 || orderTableNumbers.length === 0)
      return;

    try {
      const total = selectedOrderItems.reduce(
        (sum, item) => sum + item.preco * item.quantidade,
        0
      );

      const orderData = {
        numeroMesa: orderTableNumbers, // Always use array format
        itens: selectedOrderItems.map((item) => JSON.stringify(item)),
        total,
        paid: false,
        status: "pendente", // Use valid status value
        criadoEm: new Date().toISOString(),
        staffID: user?.$id || "unknown",
      };

      if (editingOrder) {
        await databases.updateDocument(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          editingOrder.$id,
          orderData
        );
      } else {
        await databases.createDocument(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          "unique()",
          orderData
        );
      }

      // Update table status
      for (const tableNum of orderTableNumbers) {
        const table = tables.find((t) => t.tableNumber === tableNum);
        if (table && table.status === "free") {
          await databases.updateDocument(DATABASE_ID, COLLECTION_ID, table.id, {
            status: "occupied",
          });
        }
      }

      closeOrderModal();
    } catch (error) {
      console.error("Error saving order:", error);
    }
  }, [selectedOrderItems, orderTableNumbers, editingOrder, user, tables]);

  const openPaymentModal = useCallback((order: Order) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  }, []);

  const processPayment = useCallback(async () => {
    if (!selectedOrder || !selectedPaymentMethod) return;

    try {
      await databases.updateDocument(
        DATABASE_ID,
        ORDERS_COLLECTION_ID,
        selectedOrder.$id,
        {
          paid: true,
          status: "pago",
          paymentMethod: selectedPaymentMethod,
        }
      );

      // Free tables if no other unpaid orders
      const tableNumbers = selectedOrder.numeroMesa;

      for (const tableNum of tableNumbers) {
        const otherOrders = orders.filter(
          (order) =>
            order.$id !== selectedOrder.$id &&
            !order.paid &&
            order.numeroMesa.includes(tableNum)
        );

        if (otherOrders.length === 0) {
          const table = tables.find((t) => t.tableNumber === tableNum);
          if (table) {
            await databases.updateDocument(
              DATABASE_ID,
              COLLECTION_ID,
              table.id,
              { status: "free" }
            );
          }
        }
      }

      setShowPaymentModal(false);
      setSelectedOrder(null);
      setSelectedPaymentMethod("");
    } catch (error) {
      console.error("Error processing payment:", error);
    }
  }, [selectedOrder, selectedPaymentMethod, orders, tables]);

  const deleteOrder = useCallback(
    async (order: Order) => {
      if (!confirm("Tem certeza que deseja apagar este pedido?")) return;

      try {
        await databases.deleteDocument(
          DATABASE_ID,
          ORDERS_COLLECTION_ID,
          order.$id
        );

        // Free tables if no other orders
        const tableNumbers = order.numeroMesa;
        for (const tableNum of tableNumbers) {
          const otherOrders = orders.filter(
            (o) => o.$id !== order.$id && o.numeroMesa.includes(tableNum)
          );

          if (otherOrders.length === 0) {
            const table = tables.find((t) => t.tableNumber === tableNum);
            if (table) {
              await databases.updateDocument(
                DATABASE_ID,
                COLLECTION_ID,
                table.id,
                { status: "free" }
              );
            }
          }
        }
      } catch (error) {
        console.error("Error deleting order:", error);
      }
    },
    [orders, tables]
  );

  // Toggle table details view
  const toggleTableDetails = useCallback((tableNumber: number) => {
    setShowTableDetails((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tableNumber)) {
        newSet.delete(tableNumber);
      } else {
        newSet.add(tableNumber);
      }
      return newSet;
    });
  }, []);

  // Handle table click to navigate to orders page or toggle selection
  const handleTableClick = useCallback(
    (tableNumber: number) => {
      if (isSelectionMode) {
        // Check if table is part of a multi-table order
        const multiTableInfo = getMultiTableInfo(tableNumber);
        if (multiTableInfo.isMultiTable) {
          // Don't allow selection of tables that are already part of multi-table orders
          alert(
            `Table ${tableNumber} is already part of a multi-table order and cannot be selected.`
          );
          return;
        }

        // Toggle selection
        setSelectedTables((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(tableNumber)) {
            newSet.delete(tableNumber);
          } else {
            newSet.add(tableNumber);
          }
          return newSet;
        });
      } else {
        // Open table details for both single and multi-table orders
        const multiTableInfo = getMultiTableInfo(tableNumber);
        const tableOrders = getTableOrders(tableNumber);

        if (tableOrders.length > 0) {
          // Show table details sidebar for any table with orders (single or multi-table)
          toggleTableDetails(tableNumber);
        } else if (multiTableInfo.isMultiTable) {
          // Table is part of a multi-table order but no orders found - fallback to modal
          openOrderModal(
            multiTableInfo.relatedTables,
            multiTableInfo.order || undefined
          );
        } else {
          // Create new order for empty single table
          openOrderModal([tableNumber]);
        }
      }
    },
    [
      isSelectionMode,
      getMultiTableInfo,
      getTableOrders,
      openOrderModal,
      toggleTableDetails,
    ]
  );

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => !prev);
    setSelectedTables(new Set()); // Clear selections when toggling mode
  }, []);

  // Handle creating order for selected tables
  const handleCreateOrderForSelectedTables = useCallback(() => {
    if (selectedTables.size > 0) {
      const tableNumbers = Array.from(selectedTables).sort((a, b) => a - b);

      // Check if any selected table is already part of a multi-table order
      const conflictingTables = tableNumbers.filter((tableNumber) => {
        const multiTableInfo = getMultiTableInfo(tableNumber);
        return multiTableInfo.isMultiTable;
      });

      if (conflictingTables.length > 0) {
        alert(
          `Cannot create new order: Table(s) ${conflictingTables.join(
            ", "
          )} are already part of a multi-table order.`
        );
        return;
      }

      setIsSelectionMode(false);
      setSelectedTables(new Set());
      openOrderModal(tableNumbers);
    }
  }, [selectedTables, openOrderModal, getMultiTableInfo]);

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedTables(new Set());
  }, []);

  // Calculate table statistics
  const tableStats = useMemo(() => {
    const freeTables = tables.filter((table) => table.status === "free").length;
    const occupiedTables = tables.filter(
      (table) => table.status === "occupied"
    ).length;
    const totalRevenue = orders.reduce(
      (sum, order) => sum + (order.total || 0),
      0
    );
    const totalOrders = orders.length;

    return {
      freeTables,
      occupiedTables,
      totalTables: tables.length,
      totalRevenue,
      totalOrders,
    };
  }, [tables, orders]);

  if (loading) {
    return (
      <div className="rest-layout-container">
        <div className="rest-layout-header">
          <div className="header-stats">
            <div className="stat-item">
              <div className="stat-value">-</div>
              <div className="stat-label">Livres</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">-</div>
              <div className="stat-label">Ocupadas</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">-</div>
              <div className="stat-label">Ocupação</div>
            </div>
          </div>
          <div className="header-actions">
            <button className="edit-button" disabled>
              <Edit size={16} />
              Editar Layout
            </button>
          </div>
        </div>
        <div className="rest-layout-content">
          <div className="loading-state">
            <div className="loading-spinner">
              <div className="spinner-base"></div>
              <div className="spinner-active"></div>
            </div>
            <p className="loading-text">Carregando layout...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rest-layout-container">
      {/* Header with Statistics and Edit Button */}
      <div className="rest-layout-header">
        <div className="header-left">
          <div className="header-title">
            <Grid className="header-icon" size={20} />
            Layout do Restaurante
          </div>
        </div>

        <div className="header-stats">
          <div className="stat-item free">
            <div className="stat-value">{tableStats.freeTables}</div>
            <div className="stat-label">Livres</div>
          </div>
          <div className="stat-item occupied">
            <div className="stat-value">{tableStats.occupiedTables}</div>
            <div className="stat-label">Ocupadas</div>
          </div>
          <div className="stat-item percentage">
            <div className="stat-value">
              {tableStats.totalTables > 0
                ? Math.round(
                    (tableStats.occupiedTables / tableStats.totalTables) * 100
                  )
                : 0}
              %
            </div>
            <div className="stat-label">Ocupação</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{tableStats.totalOrders}</div>
            <div className="stat-label">Pedidos</div>
          </div>
        </div>

        <div
          className="header-actions"
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          {/* Paid Orders Toggle */}
          <button
            onClick={() => setShowPaidOrders(!showPaidOrders)}
            className={`edit-button ${showPaidOrders ? "active" : ""}`}
            style={{
              backgroundColor: showPaidOrders ? "#10b981" : "transparent",
              color: showPaidOrders ? "white" : "inherit",
              fontSize: "14px",
              padding: "8px 12px",
            }}
          >
            {showPaidOrders ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPaidOrders ? "Ocultar Pagos" : "Ver Pagos"}
          </button>

          {/* Selection Mode Toggle */}
          <button
            onClick={toggleSelectionMode}
            className={`edit-button ${isSelectionMode ? "active" : ""}`}
            style={{
              backgroundColor: isSelectionMode ? "#3b82f6" : "transparent",
              color: isSelectionMode ? "white" : "inherit",
              fontSize: "14px",
              padding: "8px 12px",
            }}
          >
            <Grid size={14} />
            Multi
          </button>

          {isManager && (
            <button
              onClick={onEditRedirect}
              className="edit-button"
              style={{ fontSize: "14px", padding: "8px 12px" }}
            >
              <Edit size={14} />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Restaurant Layout - Full height */}
      <div
        ref={containerRef}
        className="rest-layout-content"
        style={{
          WebkitOverflowScrolling: "touch",
          transform: "translateZ(0)", // Force hardware acceleration
          contain: "layout style paint", // Optimize repaints
        }}
      >
        {showPaidOrders ? (
          /* Paid Orders View */
          <div className="paid-orders-container w-full h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Pedidos Pagos
                </h2>
                <p className="text-gray-600">
                  Histórico de pedidos já processados e pagos
                </p>
              </div>

              {orders.filter((order) => order.paid).length === 0 ? (
                <div className="empty-state text-center py-12">
                  <div className="empty-icon mb-4">
                    <CreditCard size={48} className="mx-auto text-gray-400" />
                  </div>
                  <p className="empty-title text-xl font-semibold text-gray-700 mb-2">
                    Nenhum pedido pago encontrado
                  </p>
                  <p className="empty-description text-gray-500">
                    Os pedidos pagos aparecerão aqui quando forem processados.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-6">
                  {orders
                    .filter((order) => order.paid)
                    .map((order) => (
                      <div
                        key={order.$id}
                        className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                      >
                        {/* Order Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              Pedido #{order.$id.slice(-6)}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Mesa{order.numeroMesa.length > 1 ? "s" : ""}:{" "}
                              {order.numeroMesa.join(", ")}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(order.$createdAt).toLocaleDateString(
                                "pt-PT",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-bold text-green-600">
                              €{order.total.toFixed(2)}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              <CheckCircle
                                size={14}
                                className="text-green-600"
                              />
                              <span className="text-xs text-green-600 font-medium">
                                PAGO
                              </span>
                            </div>
                            {order.paymentMethod && (
                              <p className="text-xs text-gray-500 mt-1 capitalize">
                                {order.paymentMethod}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-800 text-sm">
                            Itens:
                          </h4>
                          <div className="max-h-32 overflow-y-auto">
                            {(order.items || order.itens || []).map(
                              (item, idx) => {
                                const parsedItem =
                                  typeof item === "string"
                                    ? JSON.parse(item)
                                    : item;
                                return (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="flex-1">
                                      <span className="text-gray-900">
                                        {parsedItem.nome}
                                      </span>
                                      {parsedItem.notas && (
                                        <p className="text-xs text-gray-500">
                                          {parsedItem.notas}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-gray-600">
                                        {parsedItem.quantidade}x €
                                        {parsedItem.preco.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>

                        {/* Order Actions */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => {
                              const orderTableNumbers = order.numeroMesa;
                              // For paid orders, open in view-only mode
                              openOrderModal(orderTableNumbers, order, true);
                            }}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                          >
                            <Eye size={16} />
                            Ver Detalhes
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Restaurant Layout View */
          <div
            className="table-grid"
            style={{
              width: `${maxDimensions.width}px`,
              height: `${maxDimensions.height}px`,
              contain: "strict", // Strict containment for maximum performance
              willChange: "transform", // Optimize for transforms
              transform: "translateZ(0)", // Force layer
            }}
          >
            {/* Render all tables with multi-table indicators */}
            {tables.map((table) => (
              <TableComponent
                key={table.id}
                table={table}
                tableScale={tableScale}
                chairPositions={getChairPositions(table)}
                tableStyle={getTableStyle(table)}
                tableOrders={getTableOrders(table.tableNumber)}
                onClick={handleTableClick}
                isSelected={selectedTables.has(table.tableNumber)}
                isSelectionMode={isSelectionMode}
                multiTableInfo={getMultiTableInfo(table.tableNumber)}
              />
            ))}

            {/* Empty State */}
            {tables.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  <Grid size={40} />
                </div>
                <p className="empty-title">Nenhuma mesa no layout</p>
                <p className="empty-description">
                  {isManager
                    ? "Clique em 'Editar Layout' para adicionar mesas ao layout"
                    : "Este layout está vazio. Contacte um gestor para adicionar mesas."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Table Details Sidebar - Only show when not viewing paid orders */}
        {!showPaidOrders &&
          Array.from(showTableDetails).map((tableNumber) => {
            const tableOrders = getTableOrders(tableNumber);
            if (tableOrders.length === 0) return null;

            // Get multi-table info for the current table
            const multiTableInfo = getMultiTableInfo(tableNumber);

            return (
              <div
                key={tableNumber}
                className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 z-50 overflow-y-auto"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {multiTableInfo.isMultiTable ? (
                          <>
                            Mesas {multiTableInfo.relatedTables.join(", ")}
                            <span className="text-sm text-purple-600 font-normal block">
                              (Pedido combinado)
                            </span>
                          </>
                        ) : (
                          `Mesa ${tableNumber}`
                        )}
                      </h2>
                    </div>
                    <button
                      onClick={() => toggleTableDetails(tableNumber)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {tableOrders.map((order) => (
                    <div
                      key={order.$id}
                      className="bg-gray-50 rounded-lg p-4 mb-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-gray-900">
                          Pedido #{order.$id.slice(-6)}
                        </span>
                        <span className="text-lg font-bold text-green-600">
                          €{order.total.toFixed(2)}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        {(order.items || order.itens || []).map((item, idx) => {
                          const parsedItem =
                            typeof item === "string" ? JSON.parse(item) : item;
                          return (
                            <div
                              key={idx}
                              className="bg-white border rounded-lg p-3 space-y-2"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <span className="font-medium text-gray-900">
                                    {parsedItem.nome}
                                  </span>
                                  {parsedItem.notas && (
                                    <p className="text-gray-500 text-xs mt-1">
                                      {parsedItem.notas}
                                    </p>
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {parsedItem.quantidade}x €
                                  {parsedItem.preco.toFixed(2)}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Status Toggle Button */}
                                <button
                                  onClick={() =>
                                    cycleItemStatusDirect(
                                      order.$id,
                                      idx,
                                      parsedItem.status
                                    )
                                  }
                                  className={`flex items-center gap-2 px-3 py-2 text-xs rounded font-medium border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all hover:scale-105 ${
                                    parsedItem.status === "entregue"
                                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                                      : parsedItem.status === "concluido"
                                      ? "bg-purple-100 text-purple-800 hover:bg-purple-200"
                                      : parsedItem.status === "pronto"
                                      ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                      : parsedItem.status === "preparando"
                                      ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                  }`}
                                >
                                  {/* Status Icon */}
                                  {parsedItem.status === "entregue" ? (
                                    <UtensilsCrossed size={14} />
                                  ) : parsedItem.status === "concluido" ? (
                                    <Package size={14} />
                                  ) : parsedItem.status === "pronto" ? (
                                    <CheckCircle2 size={14} />
                                  ) : parsedItem.status === "preparando" ? (
                                    <ChefHat size={14} />
                                  ) : (
                                    <RotateCcw size={14} />
                                  )}
                                  <span>
                                    {parsedItem.status === "entregue"
                                      ? "Entregue"
                                      : parsedItem.status === "concluido"
                                      ? "Concluído"
                                      : parsedItem.status === "pronto"
                                      ? "Pronto"
                                      : parsedItem.status === "preparando"
                                      ? "Preparar"
                                      : "Pendente"}
                                  </span>
                                  <ChevronRight
                                    size={12}
                                    className="opacity-50"
                                  />
                                </button>

                                {/* Payment Status - Only for Concluded Items */}
                                {parsedItem.status === "concluido" && (
                                  <button
                                    onClick={() =>
                                      updateItemPaidDirect(
                                        order.$id,
                                        idx,
                                        !parsedItem.paid
                                      )
                                    }
                                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                                      parsedItem.paid
                                        ? "bg-green-600 text-white hover:bg-green-700"
                                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                    }`}
                                  >
                                    {parsedItem.paid ? (
                                      <>
                                        <DollarSign
                                          size={12}
                                          className="inline mr-1"
                                        />
                                        Pago
                                      </>
                                    ) : (
                                      <>
                                        <Wallet
                                          size={12}
                                          className="inline mr-1"
                                        />
                                        Pagar
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Order Actions */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              // Check if this order spans multiple tables
                              const orderTableNumbers = order.numeroMesa;
                              openOrderModal(orderTableNumbers, order);
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2"
                          >
                            <Edit size={16} />
                            Editar
                          </button>
                          <button
                            onClick={() => openPaymentModal(order)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2"
                          >
                            <CreditCard size={16} />
                            Pagar
                          </button>
                          <button
                            onClick={() => deleteOrder(order)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Action Buttons */}
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                    {/* Pay All Button - Only show if there are concluded items ready to pay */}
                    {hasTableItemsReadyToPay(tableNumber) && (
                      <button
                        onClick={() => openBulkPaymentModal(tableNumber)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                      >
                        <DollarSign size={18} />
                        Pagar Tudo Concluído
                      </button>
                    )}

                    {/* Add New Order Button */}
                    <button
                      onClick={() => {
                        // Create new order for this table/tables
                        if (multiTableInfo.isMultiTable) {
                          openOrderModal(multiTableInfo.relatedTables);
                        } else {
                          openOrderModal([tableNumber]);
                        }
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                    >
                      <Plus size={18} />
                      Adicionar Novo Pedido
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

        {/* Floating Action Buttons - Show when tables are selected */}
        {isSelectionMode && selectedTables.size > 0 && (
          <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
            {/* Selected count indicator */}
            <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <span className="font-medium">
                {selectedTables.size} mesa{selectedTables.size > 1 ? "s" : ""}{" "}
                selecionada{selectedTables.size > 1 ? "s" : ""}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={clearSelections}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-full shadow-lg transition-colors flex items-center gap-2"
              >
                <X size={20} />
                Limpar
              </button>

              <button
                onClick={handleCreateOrderForSelectedTables}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full shadow-lg transition-colors flex items-center gap-2 font-medium"
              >
                <ShoppingCart size={20} />
                Criar Pedido
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Modal */}
      {showOrderModal && (
        <OrderModal
          isOpen={showOrderModal}
          onClose={closeOrderModal}
          tableNumbers={orderTableNumbers}
          editingOrder={editingOrder}
          isViewOnlyMode={isViewOnlyMode}
          selectedItems={selectedOrderItems}
          onItemsChange={setSelectedOrderItems}
          menuItems={menuItems}
          menuSearchTerm={menuSearchTerm}
          onMenuSearchChange={setMenuSearchTerm}
          onAddItem={addItemToOrder}
          onRemoveItem={removeItemFromOrder}
          onUpdateQuantity={updateItemQuantity}
          onUpdateNotes={updateItemNotes}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onSave={saveOrder}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          order={selectedOrder}
          paymentMethod={selectedPaymentMethod}
          onPaymentMethodChange={setSelectedPaymentMethod}
          onProcessPayment={processPayment}
        />
      )}

      {/* Bulk Payment Modal */}
      {showBulkPaymentModal && (
        <BulkPaymentModal
          isOpen={showBulkPaymentModal}
          onClose={() => setShowBulkPaymentModal(false)}
          tableNumber={bulkPaymentTableNumber}
          paymentMethod={bulkPaymentMethod}
          onPaymentMethodChange={setBulkPaymentMethod}
          onProcessPayment={processBulkPayment}
        />
      )}
    </div>
  );
});

export default RestLayout;
