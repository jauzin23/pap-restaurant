const { validateUUID } = require("../../uuid-validation");

// Configurar handlers de eventos do WebSocket
const configurarManipuladoresSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`✅ Cliente conectado: ${socket.utilizador.username} (${socket.id})`);

    // Juntar rooms automáticas baseadas em permissões
    socket.join("pedidos"); // Todos recebem updates de pedidos
    socket.join("mesas"); // Todos recebem updates de mesas
    socket.join("menu"); // Todos recebem updates de menu
    socket.join("stock"); // Todos recebem updates de stock
    socket.join("utilizadores"); // Todos recebem updates de utilizadores

    if (socket.eGestor) {
      socket.join("gestores"); // Room exclusiva para gestores
    }

    // Evento: Cliente subscreve a mesas específicas
    socket.on("subscribe:table", (idMesa) => {
      if (validateUUID(idMesa).isValid) {
        socket.join(`mesa:${idMesa}`);
        console.log(`📍 ${socket.utilizador.username} subscreveu à mesa ${idMesa}`);
      }
    });

    // Evento: Cliente dessubscreve de mesas específicas
    socket.on("unsubscribe:table", (idMesa) => {
      socket.leave(`mesa:${idMesa}`);
      console.log(
        `📍 ${socket.utilizador.username} dessubscreveu da mesa ${idMesa}`
      );
    });

    // Evento: Cliente subscreve a layout específico
    socket.on("subscribe:layout", (idLayout) => {
      if (validateUUID(idLayout).isValid) {
        socket.join(`layout:${idLayout}`);
        console.log(
          `🗺️  ${socket.utilizador.username} subscreveu ao layout ${idLayout}`
        );
      }
    });

    // Evento: Cliente dessubscreve de layout específico
    socket.on("unsubscribe:layout", (idLayout) => {
      socket.leave(`layout:${idLayout}`);
      console.log(
        `🗺️  ${socket.utilizador.username} dessubscreveu do layout ${idLayout}`
      );
    });

    // Ping/Pong para manter conexão ativa
    socket.on("ping", () => {
      socket.emit("pong");
    });

    // Desconexão
    socket.on("disconnect", (razao) => {
      console.log(
        `❌ Cliente desconectado: ${socket.utilizador.username} - Razão: ${razao}`
      );
    });
  });
};

module.exports = configurarManipuladoresSocket;
