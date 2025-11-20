const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
require("dotenv").config(); // Carregar variáveis de ambiente

// Importar configuração
const { PORTA } = require("./src/configuracao/constantes");

// Importar intermediários
const intermediarioCors = require("./src/intermediarios/cors");

// Importar configuração WebSocket
const intermediarioAutenticacaoSocket = require("./src/websocket/autenticacaoSocket");
const configurarManipuladoresSocket = require("./src/websocket/manipuladoresSocket");
const criarEmissores = require("./src/websocket/emissores");

// Importar rotas
const rotasAutenticacao = require("./src/rotas/autenticacao");
const rotasUtilizadores = require("./src/rotas/utilizadores");
const rotasUploads = require("./src/rotas/uploads");
const rotasMenu = require("./src/rotas/menu");
const rotasLayoutsMesas = require("./src/rotas/layoutsMesas");
const rotasMesas = require("./src/rotas/mesas");
const rotasPedidos = require("./src/rotas/pedidos");
const rotasStock = require("./src/rotas/stock");
const rotasPagamentos = require("./src/rotas/pagamentos");
const rotasEstatisticas = require("./src/rotas/estatisticas");
const rotasEstatisticasUtilizador = require("./src/rotas/estatisticas-utilizador");
const rotasPontos = require("./src/rotas/pontos");

// Inicializar aplicação Express
const app = express();
const servidorHttp = createServer(app);

// Inicializar Socket.IO
const io = new Server(servidorHttp, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Aplicar intermediário CORS
app.use(intermediarioCors);

// Aplicar intermediário de parser de body com limites aumentados
app.use(
  express.json({
    limit: "50mb",
    parameterLimit: 50000,
    extended: true,
  })
);
app.use(
  express.urlencoded({
    limit: "50mb",
    parameterLimit: 50000,
    extended: true,
  })
);

// Intermediário de autenticação WebSocket
io.use(intermediarioAutenticacaoSocket);

// Configurar manipuladores de eventos WebSocket
configurarManipuladoresSocket(io);

// Criar e armazenar emissores WebSocket
const emissoresClientes = criarEmissores(io);
app.set("io", io);
app.set("emissoresClientes", emissoresClientes);

// Tornar io globalmente acessível para sistemaPontos
global.io = io;

// Endpoint raiz - verificar se API está funcional
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "PAP Backend API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      auth: "/auth",
      users: "/users",
      upload: "/upload",
      menu: "/menu",
      tableLayouts: "/table-layouts",
      tables: "/tables",
      orders: "/orders",
      stock: "/stock",
      payments: "/payments",
      stats: "/stats",
      points: "/api/points",
    },
  });
});

// Endpoint de verificação de saúde
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Montar rotas
app.use("/auth", rotasAutenticacao);
app.use("/users", rotasUtilizadores);
app.use("/upload", rotasUploads);
app.use("/menu", rotasMenu);
app.use("/table-layouts", rotasLayoutsMesas);
app.use("/tables", rotasMesas);
app.use("/orders", rotasPedidos);
app.use("/stock", rotasStock);
app.use("/payments", rotasPagamentos);
app.use("/stats", rotasEstatisticas);
app.use("/stats", rotasEstatisticasUtilizador);
app.use("/api/points", rotasPontos);

// Iniciar servidor
servidorHttp.listen(PORTA, () => {
  console.log(`🚀 Servidor a correr na porta ${PORTA}`);
  console.log(`🔗 URL Base da API: http://localhost:${PORTA}`);
  console.log(`🔌 WebSocket ativo em ws://localhost:${PORTA}`);
  console.log(
    `☁️  Imagens armazenadas em: AWS S3 (${
      process.env.AWS_S3_BUCKET_NAME || "não configurado"
    })`
  );
});

module.exports = { app, servidorHttp, io };
