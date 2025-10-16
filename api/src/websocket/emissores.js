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
  };
};

module.exports = criarEmissores;
