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

    // Stock - Locations
    localizacaoStockCriada: (localizacao) => {
      io.to("stock").emit("stock:location:created", localizacao);
    },
    localizacaoStockAtualizada: (localizacao) => {
      io.to("stock").emit("stock:location:updated", localizacao);
    },
    localizacaoStockEliminada: (idLocalizacao) => {
      io.to("stock").emit("stock:location:deleted", { id: idLocalizacao });
    },

    // Stock - Alerts (quando item atinge nível crítico/warning)
    alertaStockCriado: (alerta) => {
      io.to("stock").emit("stock:alert:created", alerta);
      io.to("gestores").emit("stock:alert:created", alerta);
    },
  };
};

module.exports = criarEmissores;
