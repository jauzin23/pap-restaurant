import React from "react";
import {
  UtensilsCrossed,
  Package,
  Calendar,
  Clock,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Brain,
  Sparkles,
} from "lucide-react";

/**
 * Format currency to Euro
 */
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "€0.00";
  return `€${parseFloat(amount).toFixed(2)}`;
};

/**
 * Format date/time
 */
const formatDateTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Get notification template based on event type and data
 */
export const getNotificationTemplate = (eventType, data) => {
  const template = (() => {
    switch (eventType) {
      case "stock:transfer":
        return {
          type: "stock",
          icon: <Package size={24} color="#0ea5e9" />,
          color: "#0ea5e9",
          title: "Transferência de Stock",
          message: `${data.qty || 0} unidade${data.qty === 1 ? "" : "s"} de ${
            data.from_warehouse_name || "Origem"
          } para ${data.to_warehouse_name || "Destino"}`,
        };
      case "order:created":
        // Use table_number if available, otherwise fall back to table_id
        let tableDisplay = data.table_number || "N/A";
        if (!data.table_number && data.table_id) {
          if (Array.isArray(data.table_id)) {
            tableDisplay = data.table_id.join(", ");
          } else {
            tableDisplay = data.table_id;
          }
        }

        // For single order items, show item price
        const itemCount = data.items?.length || 1;
        const totalAmount = data.total_amount || data.total || data.price || 0;

        return {
          type: "order",
          icon: <UtensilsCrossed size={24} color="#64748b" />,
          color: "#64748b",
          title: "Novo Pedido",
          message: `Mesa ${tableDisplay} - ${itemCount} ${
            itemCount === 1 ? "item" : "itens"
          } - ${formatCurrency(totalAmount)}`,
        };

      case "takeaway:created":
        return {
          type: "takeaway",
          icon: <Package size={24} color="#64748b" />,
          color: "#64748b",
          title: "Novo Takeaway",
          message: `${data.customer_name || data.name || "Cliente"} - ${
            data.items?.length || 0
          } ${data.items?.length === 1 ? "item" : "itens"} - ${formatCurrency(
            data.total_amount || data.total
          )}`,
        };

      case "reservation:created":
        // Try to get the number of people from various possible field names
        const numPeople =
          data.party_size ||
          data.guest_count ||
          data.num_pessoas ||
          data.guests ||
          data.partySize ||
          data.num_people ||
          data.number_of_people ||
          data.guests_count ||
          data.people ||
          data.count ||
          0;

        return {
          type: "reservation",
          icon: <Calendar size={24} color="#64748b" />,
          color: "#64748b",
          title: "Nova Reserva",
          message: `${
            data.customer_name || data.name || "Cliente"
          } - ${numPeople} ${
            numPeople === 1 ? "pessoa" : "pessoas"
          } - ${formatDateTime(
            data.reservation_time || data.reservation_date || data.data
          )}`,
        };

      case "menu:created":
        return {
          type: "menu",
          icon: <UtensilsCrossed size={24} color="#64748b" />,
          color: "#64748b",
          title: "Novo Item no Menu",
          message: `${data.name || data.item_name} - ${formatCurrency(
            data.price || data.preco
          )}`,
        };

      case "presenca:registada":
        const isClockIn = data.tipo_acao === "entrada" || data.action === "in";
        return {
          type: "attendance",
          icon: <Clock size={24} color="#64748b" />,
          color: "#64748b",
          title: isClockIn ? "Entrada Registada" : "Saída Registada",
          message: `${data.name || data.user_name || "Funcionário"} - ${
            data.timestamp
              ? new Date(data.timestamp).toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : new Date().toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
          }`,
        };

      case "stock:alert:created":
        return {
          type: "stock",
          icon: <ShoppingCart size={24} color="#64748b" />,
          color: "#64748b",
          title: "Alerta de Stock",
          message: `${data.item_name || data.name} - ${
            data.alert_type === "critical" ? "Nível Crítico" : "Nível Baixo"
          }`,
        };

      case "stock:inventory:updated":
        return {
          type: "stock",
          icon: <Package size={24} color="#64748b" />,
          color: "#64748b",
          title: "Stock Atualizado",
          message: `${data.item_name || data.name || "Item"} - ${
            data.warehouse_name || "Armazém"
          }: ${data.qty} unidades`,
        };

      case "order:updated":
        // Only show for important status changes
        const orderStatus = data.status || data.order_status;
        if (orderStatus === "preparing" || orderStatus === "ready") {
          return {
            type: "order",
            icon: <UtensilsCrossed size={24} color="#64748b" />,
            color: "#64748b",
            title:
              orderStatus === "preparing"
                ? "Pedido em Preparação"
                : "Pedido Pronto",
            message: `Mesa ${
              Array.isArray(data.table_id)
                ? data.table_id.join(", ")
                : data.table_id || "N/A"
            }`,
          };
        }
        return null;

      case "takeaway:updated":
        const takeawayStatus = data.status || data.order_status;
        if (takeawayStatus === "ready") {
          return {
            type: "takeaway",
            icon: <CheckCircle size={24} color="#64748b" />,
            color: "#64748b",
            title: "Takeaway Pronto",
            message: `${data.customer_name || data.name || "Cliente"}`,
          };
        }
        return null;

      case "payment:created":
        return {
          type: "payment",
          icon: <DollarSign size={24} color="#64748b" />,
          color: "#64748b",
          title: "Pagamento Registado",
          message: `Mesa ${
            Array.isArray(data.table_ids)
              ? data.table_ids.join(", ")
              : data.table_id || "N/A"
          } - ${formatCurrency(data.total_amount || data.amount)}`,
        };

      case "reservation:updated":
        // Only show for important changes (status or time)
        if (data.status === "confirmed" || data.status === "cancelled") {
          return {
            type: "reservation",
            icon:
              data.status === "confirmed" ? (
                <CheckCircle size={24} color="#64748b" />
              ) : (
                <XCircle size={24} color="#64748b" />
              ),
            color: "#64748b",
            title:
              data.status === "confirmed"
                ? "Reserva Confirmada"
                : "Reserva Cancelada",
            message: `${data.customer_name || data.name || "Cliente"}`,
          };
        }
        return null;

      case "ai:insight:generated":
        return {
          type: "ai",
          icon: <Sparkles size={24} color="#8b5cf6" />,
          color: "#8b5cf6",
          title: "Nova Análise IA",
          message: `Análise ${
            data.title || data.insight_title || "gerada"
          } disponível`,
        };

      case "ai:insight:deleted":
        return {
          type: "ai",
          icon: <Brain size={24} color="#ef4444" />,
          color: "#ef4444",
          title: "Análise Removida",
          message: `Análise ${data.title || data.insight_title || "removida"}`,
        };

      case "table:updated":
        // Only show for status changes (occupied/available)
        if (data.status || data.table_status) {
          const status = data.status || data.table_status;
          return {
            type: "table",
            icon: <AlertTriangle size={24} color="#64748b" />,
            color: "#64748b",
            title:
              status === "occupied"
                ? "Mesa Ocupada"
                : status === "available"
                ? "Mesa Disponível"
                : "Estado da Mesa Alterado",
            message: `Mesa ${data.table_number || data.id}`,
          };
        }
        return null;

      case "stock:supplier:created":
        return {
          type: "stock",
          icon: <Package size={24} color="#0ea5e9" />,
          color: "#0ea5e9",
          title: "Novo Fornecedor",
          message: `Fornecedor "${data.name}" criado com sucesso.`,
        };
      case "stock:supplier:updated":
        return {
          type: "stock",
          icon: <CheckCircle size={24} color="#22c55e" />,
          color: "#22c55e",
          title: "Fornecedor Atualizado",
          message: `Fornecedor "${data.name}" atualizado.`,
        };
      case "stock:supplier:deleted":
        return {
          type: "stock",
          icon: <XCircle size={24} color="#ef4444" />,
          color: "#ef4444",
          title: "Fornecedor Removido",
          message: `Fornecedor "${
            data.name || data.supplier || data.supplier_name || ""
          }" removido.`,
        };
      default:
        return {
          type: "default",
          icon: <UtensilsCrossed size={24} color="#64748b" />,
          color: "#64748b",
          title: "Notificação",
          message: data.message || "Nova atualização disponível",
        };
    }
  })();

  // Add data to template for priority determination
  return template ? { ...template, data } : null;
};
