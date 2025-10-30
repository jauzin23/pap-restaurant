const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Importar configuração
const { PORTA } = require("./src/configuracao/constantes");

// Importar intermediários
const intermediarioCors = require("./src/intermediarios/cors");

// Importar utilitários
const { garantirDiretorioUploads } = require("./src/utilitarios/sistemaFicheiros");

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

// Servir ficheiros estáticos
app.use("/files", express.static(path.join(__dirname, "uploads")));

// Intermediário de autenticação WebSocket
io.use(intermediarioAutenticacaoSocket);

// Configurar manipuladores de eventos WebSocket
configurarManipuladoresSocket(io);

// Criar e armazenar emissores WebSocket
const emissoresClientes = criarEmissores(io);
app.set("io", io);
app.set("emissoresClientes", emissoresClientes);

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

// Também montar rota de preview de ficheiros ao nível raiz para compatibilidade
app.get("/v1/storage/buckets/:bucketId/files/:fileId/preview", (req, res) => {
  try {
    const { fileId } = req.params;

    const caminhospossiveis = [
      path.join(__dirname, "uploads", "imagens-menu", fileId),
      path.join(__dirname, "uploads", "imagens-perfil", fileId),
      path.join(__dirname, "uploads", "imagens-stock", fileId),
      path.join(__dirname, "uploads", "menu-images", fileId),
      path.join(__dirname, "uploads", "profile-images", fileId),
      path.join(__dirname, "uploads", fileId),
    ];

    let caminhoEncontrado = null;
    for (const caminhoFicheiro of caminhospossiveis) {
      if (require("fs").existsSync(caminhoFicheiro)) {
        caminhoEncontrado = caminhoFicheiro;
        break;
      }
    }

    if (caminhoEncontrado) {
      res.sendFile(caminhoEncontrado);
    } else {
      res.status(404).json({ error: "Ficheiro não encontrado" });
    }
  } catch (erro) {
    res.status(500).json({ error: "Erro ao servir ficheiro" });
  }
});

// Iniciar servidor
servidorHttp.listen(PORTA, async () => {
  await garantirDiretorioUploads();
  console.log(`🚀 Servidor a correr na porta ${PORTA}`);
  console.log(`📁 Ficheiros estáticos servidos de /files`);
  console.log(`🔗 URL Base da API: http://localhost:${PORTA}`);
  console.log(`🔌 WebSocket ativo em ws://localhost:${PORTA}`);
});

module.exports = { app, servidorHttp, io };
