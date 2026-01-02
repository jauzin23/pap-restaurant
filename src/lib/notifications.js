import { toast } from "sonner";

/**
 * WebSocket notification utilities
 * Using Sonner for toast notifications
 */

export const notifyOrderCreated = (order) => {
  toast.success("Novo pedido recebido", {
    description: `Mesa ${order.table_id?.join(", ") || "N/A"} • ${
      order.items?.length || 0
    } itens`,
    duration: 3000,
  });
};

export const notifyOrderUpdated = (order) => {
  const statusMessages = {
    pendente: "Pedido pendente",
    aceite: "Pedido aceite",
    pronto: "Pedido pronto",
    "a ser entregue": "Pedido a ser entregue",
    entregue: "Pedido entregue",
    completo: "Pedido completo",
  };

  const message = statusMessages[order.status] || "Pedido atualizado";

  toast.info(message, {
    description: `Mesa ${order.table_id?.join(", ") || "N/A"}`,
    duration: 2500,
  });
};

export const notifyOrderDeleted = (orderId) => {
  toast.error("Pedido removido", {
    description: `Pedido #${orderId} foi cancelado`,
    duration: 2500,
  });
};

export const notifyTableUpdated = (table) => {
  toast.info("Mesa atualizada", {
    description: `Mesa ${table.number || table.id} foi modificada`,
    duration: 2000,
  });
};

export const notifyMenuItemCreated = (item) => {
  toast.success("Item adicionado ao menu", {
    description: item.name || "Novo item disponível",
    duration: 2500,
  });
};

export const notifyMenuItemUpdated = (item) => {
  toast.info("Menu atualizado", {
    description: item.name || "Item modificado",
    duration: 2000,
  });
};

export const notifyMenuItemDeleted = (itemName) => {
  toast.error("Item removido do menu", {
    description: itemName || "Item foi removido",
    duration: 2500,
  });
};

export const notifyTaskAssigned = (task) => {
  toast.success("Nova tarefa atribuída", {
    description: task.description || "Verifique suas tarefas",
    duration: 3000,
  });
};

export const notifyConnection = (connected) => {
  if (connected) {
    toast.success("Ligado em tempo real", {
      description: "Atualizações automáticas ativas",
      duration: 2000,
    });
  } else {
    toast.warning("Desconectado", {
      description: "A tentar reconectar...",
      duration: 2000,
    });
  }
};

export const notifyReconnection = () => {
  toast.success("Reconectado", {
    description: "Atualizações automáticas restauradas",
    duration: 2000,
  });
};

export const notifyInsightGenerated = (insight) => {
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const [year, month] = insight.data.split("-");
  const monthName = monthNames[parseInt(month) - 1];

  toast.success("Novo insight de IA gerado", {
    description: `${monthName} ${year} • Análise disponível`,
    duration: 4000,
  });
};

export const notifyInsightDeleted = (insightId) => {
  toast.error("Insight removido", {
    description: `Análise #${insightId} foi eliminada`,
    duration: 3000,
  });
};
