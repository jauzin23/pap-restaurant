// Helper functions para emitir eventos WebSocket
const criarEmissores = (io) => {
  return {
    // Pedidos
    pedidoCriado: (pedido) => {
      io.to("pedidos").emit("order:created", pedido);
      // Emitir também para mesas específicas se aplicável
      if (pedido.table_id && Array.isArray(pedido.table_id)) {
        pedido.table_id.forEach((idMesa) => {
          io.to(`mesa:${idMesa}`).emit("order:created", pedido);
        });
      }
    },
    pedidoAtualizado: (pedido) => {
      io.to("pedidos").emit("order:updated", pedido);
      if (pedido.table_id && Array.isArray(pedido.table_id)) {
        pedido.table_id.forEach((idMesa) => {
          io.to(`mesa:${idMesa}`).emit("order:updated", pedido);
        });
      }
    },
    pedidoEliminado: (idPedido) => {
      io.to("pedidos").emit("order:deleted", { id: idPedido });
    },

    // Mesas
    mesaCriada: (mesa) => {
      io.to("mesas").emit("table:created", mesa);
      if (mesa.layout_id) {
        io.to(`layout:${mesa.layout_id}`).emit("table:created", mesa);
      }
    },
    mesaAtualizada: (mesa) => {
      io.to("mesas").emit("table:updated", mesa);
      io.to(`mesa:${mesa.id}`).emit("table:updated", mesa);
      if (mesa.layout_id) {
        io.to(`layout:${mesa.layout_id}`).emit("table:updated", mesa);
      }
    },
    mesaEliminada: (idMesa, idLayout) => {
      io.to("mesas").emit("table:deleted", { id: idMesa });
      if (idLayout) {
        io.to(`layout:${idLayout}`).emit("table:deleted", { id: idMesa });
      }
    },

    // Layouts
    layoutCriado: (layout) => {
      io.to("gestores").emit("layout:created", layout);
    },
    layoutAtualizado: (layout) => {
      io.to("mesas").emit("layout:updated", layout);
      io.to(`layout:${layout.id}`).emit("layout:updated", layout);
    },
    layoutEliminado: (idLayout) => {
      io.to("mesas").emit("layout:deleted", { id: idLayout });
    },

    // Menu
    itemMenuCriado: (item) => {
      io.to("menu").emit("menu:created", item);
    },
    itemMenuAtualizado: (item) => {
      io.to("menu").emit("menu:updated", item);
    },
    itemMenuEliminado: (idItem) => {
      io.to("menu").emit("menu:deleted", { id: idItem });
    },

    // Stock - Items
    itemStockCriado: (item) => {
      io.to("stock").emit("stock:item:created", item);
    },
    itemStockAtualizado: (item) => {
      io.to("stock").emit("stock:item:updated", item);
    },
    itemStockEliminado: (idItem) => {
      io.to("stock").emit("stock:item:deleted", { id: idItem });
    },

    // Stock - Categories
    categoriaStockCriada: (categoria) => {
      io.to("stock").emit("stock:category:created", categoria);
    },
    categoriaStockAtualizada: (categoria) => {
      io.to("stock").emit("stock:category:updated", categoria);
    },
    categoriaStockEliminada: (idCategoria) => {
      io.to("stock").emit("stock:category:deleted", { id: idCategoria });
    },

    // Stock - Suppliers
    fornecedorCriado: (fornecedor) => {
      io.to("stock").emit("stock:supplier:created", fornecedor);
    },
    fornecedorAtualizado: (fornecedor) => {
      io.to("stock").emit("stock:supplier:updated", fornecedor);
    },
    fornecedorEliminado: (idFornecedor) => {
      io.to("stock").emit("stock:supplier:deleted", { id: idFornecedor });
    },

    // Stock - Locations (deprecated, kept for backwards compatibility)
    localizacaoStockCriada: (localizacao) => {
      io.to("stock").emit("stock:location:created", localizacao);
    },
    localizacaoStockAtualizada: (localizacao) => {
      io.to("stock").emit("stock:location:updated", localizacao);
    },
    localizacaoStockEliminada: (idLocalizacao) => {
      io.to("stock").emit("stock:location:deleted", { id: idLocalizacao });
    },

    // Stock - Warehouses
    warehouseCriado: (warehouse) => {
      io.to("stock").emit("stock:warehouse:created", warehouse);
    },
    warehouseAtualizado: (warehouse) => {
      io.to("stock").emit("stock:warehouse:updated", warehouse);
    },
    warehouseEliminado: (idWarehouse) => {
      io.to("stock").emit("stock:warehouse:deleted", { id: idWarehouse });
    },

    // Stock - Inventory
    inventoryAtualizado: (inventory) => {
      io.to("stock").emit("stock:inventory:updated", inventory);
    },
    inventoryEliminado: (data) => {
      io.to("stock").emit("stock:inventory:deleted", data);
    },
    stockTransferido: (transfer) => {
      io.to("stock").emit("stock:transfer", transfer);
    },

    // Stock - Alerts (quando item atinge nível crítico/warning)
    alertaStockCriado: (alerta) => {
      io.to("stock").emit("stock:alert:created", alerta);
      io.to("gestores").emit("stock:alert:created", alerta);
    },

    // Utilizadores
    utilizadorCriado: (utilizador) => {
      io.to("gestores").emit("user:created", utilizador);
      io.to("utilizadores").emit("user:created", utilizador);
    },
    utilizadorAtualizado: (utilizador) => {
      io.to("gestores").emit("user:updated", utilizador);
      io.to("utilizadores").emit("user:updated", utilizador);
      io.to(`user:${utilizador.id}`).emit("user:updated", utilizador);
    },
    utilizadorEliminado: (idUtilizador) => {
      io.to("gestores").emit("user:deleted", { id: idUtilizador });
      io.to("utilizadores").emit("user:deleted", { id: idUtilizador });
    },

    // Pagamentos
    pagamentoCriado: (pagamento) => {
      io.to("pagamentos").emit("payment:created", {
        payment_id: pagamento.payment.id,
        payment_number: pagamento.payment.payment_number,
        table_ids: pagamento.payment.table_ids,
        total_amount: pagamento.payment.total_amount,
        status: pagamento.payment.status,
        processed_by: pagamento.payment.processed_by_user,
      });
      // Emitir para mesas específicas
      if (
        pagamento.payment.table_ids &&
        Array.isArray(pagamento.payment.table_ids)
      ) {
        pagamento.payment.table_ids.forEach((idMesa) => {
          io.to(`mesa:${idMesa}`).emit("payment:created", pagamento);
        });
      }
    },
    pedidosPagos: (data) => {
      io.to("pedidos").emit("order:paid", data);
      // Emitir para mesas específicas
      if (data.table_ids && Array.isArray(data.table_ids)) {
        data.table_ids.forEach((idMesa) => {
          io.to(`mesa:${idMesa}`).emit("order:paid", data);
        });
      }
    },
    pagamentoReembolsado: (data) => {
      io.to("pagamentos").emit("payment:refunded", data);
      io.to("gestores").emit("payment:refunded", data);
    },

    // Estatísticas - Real-time updates
    estatisticasAtualizadas: (stats) => {
      io.to("gestores").emit("stats:updated", stats);
    },
    estatisticasLiveAtualizadas: (liveStats) => {
      io.to("gestores").emit("stats:live:updated", liveStats);
    },
    estatisticasStaffAtualizadas: (staffStats) => {
      io.to("gestores").emit("stats:staff:updated", staffStats);
    },
    estatisticasTopItensAtualizadas: (topItems) => {
      io.to("gestores").emit("stats:topitems:updated", topItems);
    },
    estatisticasUserAtualizadas: (userId, userStats) => {
      io.to(`user:${userId}`).emit("stats:user:updated", userStats);
    },

    // Reservations
    reservaCriada: (reserva) => {
      io.to("reservas").emit("reservation:created", reserva);
      io.to("gestores").emit("reservation:created", reserva);
    },
    reservaAtualizada: (reserva) => {
      io.to("reservas").emit("reservation:updated", reserva);
      io.to("gestores").emit("reservation:updated", reserva);
    },
    reservaEliminada: (idReserva) => {
      io.to("reservas").emit("reservation:deleted", { id: idReserva });
      io.to("gestores").emit("reservation:deleted", { id: idReserva });
    },
  };
};

module.exports = criarEmissores;
