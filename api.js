const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const path = require("path");
const fs = require("fs").promises;
const { validateUUID } = require("./uuid-validation");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";

// Middleware CORS (deve estar antes de outros middlewares)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Max-Age", "86400"); // 24 horas

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

// Middleware com limites de payload aumentados
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

const ensureUploadsDir = async () => {
  try {
    await fs.access("./uploads");
  } catch {
    await fs.mkdir("./uploads", { recursive: true });
  }

  // Garantir que os subdiretórios existem
  try {
    await fs.access("./uploads/imagens-perfil");
  } catch {
    await fs.mkdir("./uploads/imagens-perfil", { recursive: true });
  }

  try {
    await fs.access("./uploads/menu-images");
  } catch {
    await fs.mkdir("./uploads/menu-images", { recursive: true });
  }
};

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token de acesso obrigatório" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido ou expirado" });
    }
    req.user = user;
    next();
  });
};

// Middleware de autorização de gestor
const requireManager = async (req, res, next) => {
  try {
    // Obter dados atualizados do utilizador da base de dados para garantir que as etiquetas estão atuais
    const userResult = await pool.query(
      "SELECT labels FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    const user = userResult.rows[0];
    const labels = user.labels || [];

    // Verificar se o utilizador tem a etiqueta "manager"
    if (!labels.includes("manager")) {
      return res.status(403).json({
        error: "Acesso negado. Privilégios de gestor obrigatórios.",
      });
    }

    next();
  } catch (error) {
    console.error("Erro de autorização de gestor:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Middleware de tratamento de erros
const handleError = (error, res) => {
  console.error("Erro de base de dados:", error);
  res.status(500).json({ error: "Erro interno do servidor" });
};

// ===== WEBSOCKET CONFIGURATION =====

// Middleware de autenticação WebSocket
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Token de autenticação obrigatório"));
    }

    // Verificar token JWT
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return next(new Error("Token inválido ou expirado"));
      }

      // Obter dados atualizados do utilizador
      const userResult = await pool.query(
        "SELECT id, email, username, name, labels FROM users WHERE id = $1",
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return next(new Error("Utilizador não encontrado"));
      }

      socket.user = userResult.rows[0];
      socket.isManager = (socket.user.labels || []).includes("manager");
      next();
    });
  } catch (error) {
    console.error("Erro de autenticação WebSocket:", error);
    next(new Error("Erro de autenticação"));
  }
});

// Gestão de conexões WebSocket
io.on("connection", (socket) => {
  console.log(`✅ Cliente conectado: ${socket.user.username} (${socket.id})`);

  // Juntar rooms automáticas baseadas em permissões
  socket.join("orders"); // Todos recebem updates de pedidos
  socket.join("tables"); // Todos recebem updates de mesas
  socket.join("menu"); // Todos recebem updates de menu

  if (socket.isManager) {
    socket.join("managers"); // Room exclusiva para gestores
  }

  // Evento: Cliente subscreve a mesas específicas
  socket.on("subscribe:table", (tableId) => {
    if (validateUUID(tableId).isValid) {
      socket.join(`table:${tableId}`);
      console.log(`📍 ${socket.user.username} subscreveu à mesa ${tableId}`);
    }
  });

  // Evento: Cliente desssubscreve de mesas específicas
  socket.on("unsubscribe:table", (tableId) => {
    socket.leave(`table:${tableId}`);
    console.log(`📍 ${socket.user.username} dessubscreveu da mesa ${tableId}`);
  });

  // Evento: Cliente subscreve a layout específico
  socket.on("subscribe:layout", (layoutId) => {
    if (validateUUID(layoutId).isValid) {
      socket.join(`layout:${layoutId}`);
      console.log(
        `🗺️  ${socket.user.username} subscreveu ao layout ${layoutId}`
      );
    }
  });

  // Evento: Cliente dessusscreve de layout específico
  socket.on("unsubscribe:layout", (layoutId) => {
    socket.leave(`layout:${layoutId}`);
    console.log(
      `🗺️  ${socket.user.username} dessubscreveu do layout ${layoutId}`
    );
  });

  // Ping/Pong para manter conexão ativa
  socket.on("ping", () => {
    socket.emit("pong");
  });

  // Desconexão
  socket.on("disconnect", (reason) => {
    console.log(
      `❌ Cliente desconectado: ${socket.user.username} - Razão: ${reason}`
    );
  });
});

// Helper function para emitir eventos (será usado nas rotas)
const emitToClients = {
  // Pedidos
  orderCreated: (order) => {
    io.to("orders").emit("order:created", order);
    // Emitir também para mesas específicas se aplicável
    if (order.table_id && Array.isArray(order.table_id)) {
      order.table_id.forEach((tableId) => {
        io.to(`table:${tableId}`).emit("order:created", order);
      });
    }
  },
  orderUpdated: (order) => {
    io.to("orders").emit("order:updated", order);
    if (order.table_id && Array.isArray(order.table_id)) {
      order.table_id.forEach((tableId) => {
        io.to(`table:${tableId}`).emit("order:updated", order);
      });
    }
  },
  orderDeleted: (orderId) => {
    io.to("orders").emit("order:deleted", { id: orderId });
  },

  // Mesas
  tableCreated: (table) => {
    io.to("tables").emit("table:created", table);
    if (table.layout_id) {
      io.to(`layout:${table.layout_id}`).emit("table:created", table);
    }
  },
  tableUpdated: (table) => {
    io.to("tables").emit("table:updated", table);
    io.to(`table:${table.id}`).emit("table:updated", table);
    if (table.layout_id) {
      io.to(`layout:${table.layout_id}`).emit("table:updated", table);
    }
  },
  tableDeleted: (tableId, layoutId) => {
    io.to("tables").emit("table:deleted", { id: tableId });
    if (layoutId) {
      io.to(`layout:${layoutId}`).emit("table:deleted", { id: tableId });
    }
  },

  // Layouts
  layoutCreated: (layout) => {
    io.to("managers").emit("layout:created", layout);
  },
  layoutUpdated: (layout) => {
    io.to("tables").emit("layout:updated", layout);
    io.to(`layout:${layout.id}`).emit("layout:updated", layout);
  },
  layoutDeleted: (layoutId) => {
    io.to("tables").emit("layout:deleted", { id: layoutId });
  },

  // Menu
  menuItemCreated: (item) => {
    io.to("menu").emit("menu:created", item);
  },
  menuItemUpdated: (item) => {
    io.to("menu").emit("menu:updated", item);
  },
  menuItemDeleted: (itemId) => {
    io.to("menu").emit("menu:deleted", { id: itemId });
  },
};

// Tornar io e emitToClients disponíveis globalmente no app
app.set("io", io);
app.set("emitToClients", emitToClients);

// ===== ROTAS DE AUTENTICAÇÃO =====

// Endpoint de login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e password obrigatórios" });
    }

    // Procurar utilizador por email ou username
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR username = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const user = userResult.rows[0];

    // Verificar password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Gerar token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        labels: user.labels || [],
      },
      JWT_SECRET,
      { expiresIn: "72h" }
    );

    // Retornar dados do utilizador (excluindo password)
    const { password_hash, ...userWithoutPassword } = user;
    res.json({
      user: {
        ...userWithoutPassword,
        labels: user.labels || [],
      },
      token,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Endpoint para obter utilizador atual
app.get("/auth/me", authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT id, email, username, name, labels, profile_image, created_at FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    const user = userResult.rows[0];

    res.json({
      $id: user.id,
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      labels: user.labels || [],
      profile_image: user.profile_image,
      created_at: user.created_at,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Endpoint de logout (invalidação de token no lado do cliente)
app.post("/auth/logout", authenticateToken, (req, res) => {
  res.json({ message: "Sessão terminada com sucesso" });
});

// ===== ROTAS DE GESTÃO DE UTILIZADORES =====

// Obter todos os utilizadores (para lista de staff)
app.get("/users", authenticateToken, async (req, res) => {
  try {
    const usersResult = await pool.query(`
      SELECT id, email, username, name, labels, profile_image, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    const users = usersResult.rows.map((user) => ({
      $id: user.id,
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      labels: user.labels || [],
      profile_image: user.profile_image,
      created_at: user.created_at,
    }));

    res.json({ users });
  } catch (error) {
    handleError(error, res);
  }
});

// Obter utilizador específico
app.get("/users/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await pool.query(
      "SELECT id, email, username, name, labels, profile_image, created_at FROM users WHERE id = $1",
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    const user = userResult.rows[0];

    res.json({
      $id: user.id,
      ...user,
      labels: user.labels || [],
    });
  } catch (error) {
    handleError(error, res);
  }
});

app.use("/files", express.static(path.join(__dirname, "uploads")));

app.get("/v1/storage/buckets/:bucketId/files/:fileId/preview", (req, res) => {
  try {
    const { fileId } = req.params;
    const { width, height, quality } = req.query;

    // Tentar ambas as pastas menu-images e imagens-perfil
    const possiblePaths = [
      path.join(__dirname, "uploads", "menu-images", fileId),
      path.join(__dirname, "uploads", "imagens-perfil", fileId),
      path.join(__dirname, "uploads", fileId), // Caminho legado para retrocompatibilidade
    ];

    let foundPath = null;
    for (const filepath of possiblePaths) {
      if (require("fs").existsSync(filepath)) {
        foundPath = filepath;
        break;
      }
    }

    if (foundPath) {
      res.sendFile(foundPath);
    } else {
      res.status(404).json({ error: "Ficheiro não encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erro ao servir ficheiro" });
  }
});

// Fazer upload de imagem de perfil
app.post("/upload/profile-image", authenticateToken, async (req, res) => {
  try {
    const { imageData, filename } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: "Dados da imagem obrigatórios" });
    }

    // Garantir que o diretório uploads existe
    await ensureUploadsDir();

    // Remover prefixo de data URL se presente
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "");

    // Gerar nome de ficheiro único
    const fileExtension = filename ? path.extname(filename) : ".jpg";
    const uniqueFilename = `${Date.now()}_${req.user.userId}${fileExtension}`;
    const filepath = path.join(
      __dirname,
      "uploads",
      "imagens-perfil",
      uniqueFilename
    );

    // Guardar ficheiro
    await fs.writeFile(filepath, base64Data, "base64");

    // Atualizar imagem de perfil do utilizador na base de dados
    await pool.query("UPDATE users SET profile_image = $1 WHERE id = $2", [
      uniqueFilename,
      req.user.userId,
    ]);

    res.json({
      filename: uniqueFilename,
      url: `/files/imagens-perfil/${uniqueFilename}`,
      message: "Imagem de perfil carregada com sucesso",
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Fazer upload de imagem de menu
app.post(
  "/upload/menu-image",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { imageData, filename } = req.body;

      if (!imageData) {
        return res.status(400).json({ error: "Dados da imagem obrigatórios" });
      }

      // Garantir que o diretório uploads existe
      await ensureUploadsDir();

      // Remover prefixo de data URL se presente
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, "");

      // Gerar nome de ficheiro único
      const fileExtension = filename ? path.extname(filename) : ".jpg";
      const uniqueFilename = `${Date.now()}_menu_${Math.random()
        .toString(36)
        .substr(2, 9)}${fileExtension}`;
      const filepath = path.join(
        __dirname,
        "uploads",
        "menu-images",
        uniqueFilename
      );

      // Guardar ficheiro
      await fs.writeFile(filepath, base64Data, "base64");

      res.json({
        $id: uniqueFilename,
        filename: uniqueFilename,
        url: `/files/menu-images/${uniqueFilename}`,
        message: "Imagem de menu carregada com sucesso",
      });
    } catch (error) {
      handleError(error, res);
    }
  }
);

app.get(
  "/users/:userId/profile-bucket",
  authenticateToken,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Por agora, criamos um simples mapeamento para imagens de perfil
      // Isto substitui a consulta DB_ATTENDANCE/PFP document
      // Pode criar uma tabela 'user_profile_images' se necessário, ou apenas usar o campo profile_image
      const userResult = await pool.query(
        "SELECT profile_image FROM users WHERE id = $1",
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "Utilizador não encontrado" });
      }

      const profileImage = userResult.rows[0].profile_image;

      if (profileImage) {
        // Retornar o nome do ficheiro como bucket_id para compatibilidade
        res.json({
          documents: [
            {
              bucket_id: profileImage,
            },
          ],
        });
      } else {
        res.json({ documents: [] });
      }
    } catch (error) {
      handleError(error, res);
    }
  }
);

// Endpoint de verificação de saúde
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/menu", authenticateToken, async (req, res) => {
  try {
    const category = await pool.query("SELECT * from category");
    const menu = await pool.query(
      "SELECT * from menu ORDER BY created_at DESC"
    );
    const tags = await pool.query("SELECT * from menu_tags");
    res.json({
      documents: menu.rows.map((item) => ({
        $id: item.id,
        $createdAt: item.created_at,
        ...item,
      })),
      category: category.rows,
      menu: menu.rows,
      tags: tags.rows,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Criar item de menu
app.post("/menu", authenticateToken, requireManager, async (req, res) => {
  try {
    const { nome, preco, description, category, tags, ingredientes, image_id } =
      req.body;

    if (!nome || !preco) {
      return res.status(400).json({ error: "Nome e preço obrigatórios" });
    }

    const result = await pool.query(
      `INSERT INTO menu (nome, preco, description, category, tags, ingredientes, image_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        nome,
        parseFloat(preco),
        description || null,
        category || null,
        tags && tags.length > 0 ? tags : null, // Enviar array diretamente, não string JSON
        ingredientes && ingredientes.length > 0 ? ingredientes : null, // Enviar array diretamente
        image_id || null,
      ]
    );

    const newItem = result.rows[0];

    const itemResponse = {
      $id: newItem.id,
      $createdAt: newItem.created_at,
      ...newItem,
      tags: newItem.tags || [], // Arrays do PostgreSQL retornam como arrays
      ingredientes: newItem.ingredientes || [],
    };

    // Emitir evento WebSocket
    app.get("emitToClients").menuItemCreated(itemResponse);

    res.json(itemResponse);
  } catch (error) {
    handleError(error, res);
  }
});

// Atualizar item de menu
app.put("/menu/:id", authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, preco, description, category, tags, ingredientes, image_id } =
      req.body;

    if (!nome || !preco) {
      return res.status(400).json({ error: "Nome e preço obrigatórios" });
    }

    const result = await pool.query(
      `UPDATE menu
       SET nome = $1, preco = $2, description = $3, category = $4, tags = $5, ingredientes = $6, image_id = $7
       WHERE id = $8
       RETURNING *`,
      [
        nome,
        parseFloat(preco),
        description || null,
        category || null,
        tags && tags.length > 0 ? tags : null, // Enviar array diretamente
        ingredientes && ingredientes.length > 0 ? ingredientes : null, // Enviar array diretamente
        image_id || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item de menu não encontrado" });
    }

    const updatedItem = result.rows[0];

    const itemResponse = {
      $id: updatedItem.id,
      $createdAt: updatedItem.created_at,
      ...updatedItem,
      tags: updatedItem.tags || [], // Arrays do PostgreSQL retornam como arrays
      ingredientes: updatedItem.ingredientes || [],
    };

    // Emitir evento WebSocket
    app.get("emitToClients").menuItemUpdated(itemResponse);

    res.json(itemResponse);
  } catch (error) {
    handleError(error, res);
  }
});

// Eliminar item de menu
app.delete("/menu/:id", authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    // Primeiro, obter o item para verificar se tem imagem
    const itemResult = await pool.query(
      "SELECT image_id FROM menu WHERE id = $1",
      [id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: "Item de menu não encontrado" });
    }

    const item = itemResult.rows[0];

    // Eliminar o ficheiro de imagem se existir
    if (item.image_id) {
      try {
        const imagePath = path.join(
          __dirname,
          "uploads",
          "menu-images",
          item.image_id
        );
        await fs.unlink(imagePath);
      } catch (error) {
        console.error("Erro ao eliminar ficheiro de imagem:", error);
        // Continuar com eliminação mesmo se a eliminação do ficheiro de imagem falhar
      }
    }

    // Eliminar o item de menu da base de dados
    await pool.query("DELETE FROM menu WHERE id = $1", [id]);

    // Emitir evento WebSocket
    app.get("emitToClients").menuItemDeleted(id);

    res.json({ message: "Item de menu eliminado com sucesso" });
  } catch (error) {
    handleError(error, res);
  }
});

// Obter item de menu específico
app.get("/menu/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("SELECT * FROM menu WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item de menu não encontrado" });
    }

    const item = result.rows[0];

    res.json({
      $id: item.id,
      $createdAt: item.created_at,
      ...item,
      tags: item.tags || [], // Arrays do PostgreSQL retornam como arrays
      ingredientes: item.ingredientes || [],
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Endpoint para eliminar ficheiro (para imagens de menu)
app.delete(
  "/files/:folder/:filename",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { folder, filename } = req.params;

      // Apenas permitir eliminação de pastas autorizadas
      if (!["menu-images", "imagens-perfil"].includes(folder)) {
        return res.status(400).json({ error: "Pasta inválida" });
      }

      const filepath = path.join(__dirname, "uploads", folder, filename);

      try {
        await fs.unlink(filepath);
        res.json({ message: "Ficheiro eliminado com sucesso" });
      } catch (error) {
        if (error.code === "ENOENT") {
          res.status(404).json({ error: "Ficheiro não encontrado" });
        } else {
          throw error;
        }
      }
    } catch (error) {
      handleError(error, res);
    }
  }
);

// ===== ROTAS DE GESTÃO DE LAYOUTS DE MESAS =====

// Obter todos os layouts de mesas
app.get("/table-layouts", authenticateToken, async (req, res) => {
  try {
    const layouts = await pool.query(`
      SELECT * FROM table_layouts
      ORDER BY created_at DESC
    `);

    // Adicionar mesas a cada layout
    for (let layout of layouts.rows) {
      const tables = await pool.query(
        `
        SELECT * FROM tables
        WHERE layout_id = $1::uuid
        ORDER BY table_number ASC
      `,
        [layout.id]
      );

      layout.tables = tables.rows;
    }

    res.json(layouts.rows);
  } catch (error) {
    handleError(error, res);
  }
});

// Obter layout de mesas específico
app.get("/table-layouts/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar formato UUID
    const validation = validateUUID(id);
    if (!validation.isValid) {
      return res.status(400).json(validation.error);
    }

    const layout = await pool.query(
      `
      SELECT * FROM table_layouts WHERE id = $1::uuid
    `,
      [id]
    );

    if (layout.rows.length === 0) {
      return res.status(404).json({ error: "Layout não encontrado" });
    }

    // Adicionar mesas ao layout
    const tables = await pool.query(
      `
      SELECT * FROM tables
      WHERE layout_id = $1::uuid
      ORDER BY table_number ASC
    `,
      [id]
    );

    const layoutWithTables = layout.rows[0];
    layoutWithTables.tables = tables.rows;

    res.json(layoutWithTables);
  } catch (error) {
    handleError(error, res);
  }
});

// Criar novo layout de mesas
app.post(
  "/table-layouts",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { name, width, height } = req.body;

      if (!name || !width || !height) {
        return res
          .status(400)
          .json({ error: "Nome, largura e altura obrigatórios" });
      }

      const result = await pool.query(
        `
      INSERT INTO table_layouts (name, width, height, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `,
        [name, width, height]
      );

      const newLayout = result.rows[0];

      // Emitir evento WebSocket
      app.get("emitToClients").layoutCreated(newLayout);

      res.json(newLayout);
    } catch (error) {
      handleError(error, res);
    }
  }
);

// Atualizar layout de mesas
app.put(
  "/table-layouts/:id",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Validar formato UUID
      const validation = validateUUID(id);
      if (!validation.isValid) {
        return res.status(400).json(validation.error);
      }

      const { name, width, height } = req.body;

      if (!name || !width || !height) {
        return res
          .status(400)
          .json({ error: "Nome, largura e altura obrigatórios" });
      }

      const result = await pool.query(
        `
      UPDATE table_layouts
      SET name = $1, width = $2, height = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4::uuid
      RETURNING *
    `,
        [name, width, height, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Layout não encontrado" });
      }

      const updatedLayout = result.rows[0];

      // Obter mesas para este layout
      const tablesResult = await pool.query(
        `
      SELECT * FROM tables
      WHERE layout_id = $1::uuid
      ORDER BY table_number ASC
    `,
        [id]
      );

      const tables = tablesResult.rows.map((table) => ({
        id: table.id.toString(),
        number: table.table_number,
        x: table.x,
        y: table.y,
        width: table.width,
        height: table.height,
        shape: table.shape,
        chairs: table.chairs_count,
        chairsConfig: {
          top: table.chairs_top,
          bottom: table.chairs_bottom,
          left: table.chairs_left,
          right: table.chairs_right,
        },
      }));

      const layoutResponse = {
        id: updatedLayout.id.toString(),
        name: updatedLayout.name,
        width: updatedLayout.width,
        height: updatedLayout.height,
        tables: tables,
      };

      // Emitir evento WebSocket
      app.get("emitToClients").layoutUpdated(layoutResponse);

      res.json(layoutResponse);
    } catch (error) {
      handleError(error, res);
    }
  }
);

// Eliminar layout de mesas
app.delete(
  "/table-layouts/:id",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Validar formato UUID
      const validation = validateUUID(id);
      if (!validation.isValid) {
        return res.status(400).json(validation.error);
      }

      // Iniciar transação
      await pool.query("BEGIN");

      try {
        // Eliminar todas as mesas neste layout primeiro
        await pool.query("DELETE FROM tables WHERE layout_id = $1::uuid", [id]);

        // Eliminar o layout
        const result = await pool.query(
          "DELETE FROM table_layouts WHERE id = $1::uuid RETURNING *",
          [id]
        );

        if (result.rows.length === 0) {
          await pool.query("ROLLBACK");
          return res.status(404).json({ error: "Layout não encontrado" });
        }

        await pool.query("COMMIT");

        // Emitir evento WebSocket
        app.get("emitToClients").layoutDeleted(id);

        res.json({
          message: "Layout e todas as suas mesas eliminados com sucesso",
        });
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
    } catch (error) {
      handleError(error, res);
    }
  }
);

// ===== ROTAS DE GESTÃO DE MESAS =====

// Obter mesas de um layout
app.get("/tables/layout/:layout_id", authenticateToken, async (req, res) => {
  try {
    const { layout_id } = req.params;

    // Validar formato UUID para layout_id
    const validation = validateUUID(layout_id, "layout_id");
    if (!validation.isValid) {
      return res.status(400).json(validation.error);
    }

    const tables = await pool.query(
      `
      SELECT * FROM tables
      WHERE layout_id = $1::uuid
      ORDER BY table_number ASC
    `,
      [layout_id]
    );

    res.json(tables.rows);
  } catch (error) {
    handleError(error, res);
  }
});

// Criar nova mesa
app.post("/tables", authenticateToken, requireManager, async (req, res) => {
  try {
    const {
      layout_id,
      table_number,
      x,
      y,
      width,
      height,
      shape,
      chairs_top,
      chairs_bottom,
      chairs_left,
      chairs_right,
      chairs_count,
    } = req.body;

    if (
      !layout_id ||
      !table_number ||
      x === undefined ||
      y === undefined ||
      !width ||
      !height ||
      !shape
    ) {
      return res.status(400).json({ error: "Campos obrigatórios em falta" });
    }

    // Validar formato UUID para layout_id
    const validation = validateUUID(layout_id, "layout_id");
    if (!validation.isValid) {
      return res.status(400).json(validation.error);
    }

    // Verificar se o número da mesa é único dentro do layout
    const existingTable = await pool.query(
      `
      SELECT id, table_number FROM tables 
      WHERE layout_id = $1::uuid 
      AND table_number = $2
    `,
      [layout_id, table_number]
    );

    if (existingTable.rows.length > 0) {
      console.log(
        `[TABLE CREATE] Duplicate table found: layout_id=${layout_id}, table_number=${table_number}, existing_id=${existingTable.rows[0].id}`
      );
      return res.status(400).json({
        error: "Número de mesa já existe neste layout",
        existing_table_id: existingTable.rows[0].id,
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tables (
        layout_id, table_number, x, y, width, height, shape,
        chairs_top, chairs_bottom, chairs_left, chairs_right, chairs_count,
        created_at, updated_at
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `,
      [
        layout_id,
        table_number,
        x,
        y,
        width,
        height,
        shape,
        chairs_top || false,
        chairs_bottom || false,
        chairs_left || false,
        chairs_right || false,
        chairs_count || 0,
      ]
    );

    const newTable = result.rows[0];

    // Emitir evento WebSocket
    app.get("emitToClients").tableCreated(newTable);

    res.json(newTable);
  } catch (error) {
    handleError(error, res);
  }
});

// Atualizar mesa
app.put("/tables/:id", authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar formato UUID
    const validation = validateUUID(id);
    if (!validation.isValid) {
      return res.status(400).json(validation.error);
    }

    const {
      table_number,
      x,
      y,
      width,
      height,
      shape,
      chairs_top,
      chairs_bottom,
      chairs_left,
      chairs_right,
      chairs_count,
    } = req.body;

    // Verificar se o número da mesa é único dentro do layout (se table_number está a ser atualizado)
    if (table_number !== undefined) {
      const tableInfo = await pool.query(
        "SELECT layout_id FROM tables WHERE id = $1::uuid",
        [id]
      );
      if (tableInfo.rows.length === 0) {
        return res.status(404).json({ error: "Mesa não encontrada" });
      }

      const existingTable = await pool.query(
        `
        SELECT id FROM tables WHERE layout_id = $1::uuid AND table_number = $2 AND id != $3::uuid
      `,
        [tableInfo.rows[0].layout_id, table_number, id]
      );

      if (existingTable.rows.length > 0) {
        return res
          .status(400)
          .json({ error: "Número de mesa já existe neste layout" });
      }
    }

    const result = await pool.query(
      `
      UPDATE tables SET 
        table_number = COALESCE($1, table_number),
        x = COALESCE($2, x),
        y = COALESCE($3, y),
        width = COALESCE($4, width),
        height = COALESCE($5, height),
        shape = COALESCE($6, shape),
        chairs_top = COALESCE($7, chairs_top),
        chairs_bottom = COALESCE($8, chairs_bottom),
        chairs_left = COALESCE($9, chairs_left),
        chairs_right = COALESCE($10, chairs_right),
        chairs_count = COALESCE($11, chairs_count),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12::uuid
      RETURNING *
    `,
      [
        table_number,
        x,
        y,
        width,
        height,
        shape,
        chairs_top,
        chairs_bottom,
        chairs_left,
        chairs_right,
        chairs_count,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Mesa não encontrada" });
    }

    const updatedTable = result.rows[0];

    // Emitir evento WebSocket
    app.get("emitToClients").tableUpdated(updatedTable);

    res.json(updatedTable);
  } catch (error) {
    handleError(error, res);
  }
});

// Eliminar mesa
app.delete(
  "/tables/:id",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Validar formato UUID
      const validation = validateUUID(id);
      if (!validation.isValid) {
        return res.status(400).json(validation.error);
      }

      const result = await pool.query(
        "DELETE FROM tables WHERE id = $1::uuid RETURNING *",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Mesa não encontrada" });
      }

      const deletedTable = result.rows[0];
      console.log(
        `[TABLE DELETE] Successfully deleted table: id=${deletedTable.id}, table_number=${deletedTable.table_number}, layout_id=${deletedTable.layout_id}`
      );

      // Emitir evento WebSocket
      app
        .get("emitToClients")
        .tableDeleted(deletedTable.id, deletedTable.layout_id);

      res.json({ message: "Mesa eliminada com sucesso" });
    } catch (error) {
      handleError(error, res);
    }
  }
);

// ===== ROTAS DE GESTÃO DE PEDIDOS =====

// Obter todos os pedidos
app.get("/orders", authenticateToken, async (req, res) => {
  try {
    const orders = await pool.query(`
      SELECT
        o.*,
        m.nome as menu_nome,
        m.preco as menu_preco,
        m.category as menu_category
      FROM order_items o
      LEFT JOIN menu m ON o.menu_item_id = m.id
      ORDER BY o.created_at DESC
    `);

    const ordersWithMenuInfo = orders.rows.map((order) => ({
      $id: order.id,
      id: order.id,
      table_id: order.table_id,
      menu_item_id: order.menu_item_id,
      status: order.status,
      notas: order.notas,
      price: order.price,
      created_at: order.created_at,
      item_name: order.menu_nome,
      menu_info: {
        nome: order.menu_nome,
        preco: order.menu_preco,
        category: order.menu_category,
      },
    }));

    res.json({ documents: ordersWithMenuInfo });
  } catch (error) {
    handleError(error, res);
  }
});

// Criar novo pedido (item único)
app.post("/orders", authenticateToken, async (req, res) => {
  try {
    const { table_id, menu_item_id, notas, price } = req.body;

    if (!table_id || !menu_item_id) {
      return res.status(400).json({
        error: "table_id e menu_item_id obrigatórios",
      });
    }

    if (!price || isNaN(parseFloat(price))) {
      return res.status(400).json({
        error: "price é obrigatório e deve ser um número válido",
      });
    }

    // Validar que o array table_id contém UUIDs válidos
    if (!Array.isArray(table_id)) {
      return res.status(400).json({
        error: "table_id deve ser um array de UUIDs de mesa",
      });
    }

    for (const tableId of table_id) {
      const validation = validateUUID(tableId, "table_id");
      if (!validation.isValid) {
        return res.status(400).json(validation.error);
      }
    }

    // Validar que menu_item_id é um UUID válido
    const menuValidation = validateUUID(menu_item_id, "menu_item_id");
    if (!menuValidation.isValid) {
      return res.status(400).json(menuValidation.error);
    }

    const result = await pool.query(
      `INSERT INTO order_items (table_id, menu_item_id, status, notas, price, created_at)
       VALUES ($1, $2::uuid, 'pendente', $3, $4, CURRENT_TIMESTAMP)
       RETURNING *`,
      [table_id, menu_item_id, notas || null, parseFloat(price)]
    );

    const newOrder = result.rows[0];

    const orderResponse = {
      $id: newOrder.id,
      id: newOrder.id,
      table_id: newOrder.table_id,
      menu_item_id: newOrder.menu_item_id,
      status: newOrder.status,
      notas: newOrder.notas,
      price: newOrder.price,
      created_at: newOrder.created_at,
    };

    // Emitir evento WebSocket
    app.get("emitToClients").orderCreated(orderResponse);

    res.json(orderResponse);
  } catch (error) {
    handleError(error, res);
  }
});

// Criar múltiplos pedidos (para finalização do carrinho) - Dine-in only
app.post("/orders/batch", authenticateToken, async (req, res) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        error: "Array de pedidos obrigatório e não pode estar vazio",
      });
    }

    // Validar todos os pedidos primeiro
    for (const order of orders) {
      if (!order.menu_item_id) {
        return res.status(400).json({
          error: "Cada pedido deve ter menu_item_id",
        });
      }

      if (
        !order.table_id ||
        !Array.isArray(order.table_id) ||
        order.table_id.length === 0
      ) {
        return res.status(400).json({
          error: "Cada pedido deve ter table_id com pelo menos uma mesa",
        });
      }

      if (!order.price || isNaN(parseFloat(order.price))) {
        return res.status(400).json({
          error: "Cada pedido deve ter um price válido",
        });
      }

      for (const tableId of order.table_id) {
        const validation = validateUUID(tableId, "table_id");
        if (!validation.isValid) {
          return res.status(400).json(validation.error);
        }
      }

      const menuValidation = validateUUID(order.menu_item_id, "menu_item_id");
      if (!menuValidation.isValid) {
        return res.status(400).json(menuValidation.error);
      }
    }

    // Iniciar transação
    await pool.query("BEGIN");

    try {
      const createdOrders = [];

      for (const order of orders) {
        const result = await pool.query(
          `INSERT INTO order_items (table_id, menu_item_id, status, notas, price, created_at)
           VALUES ($1, $2::uuid, 'pendente', $3, $4, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            order.table_id,
            order.menu_item_id,
            order.notas || null,
            parseFloat(order.price),
          ]
        );

        const newOrder = result.rows[0];
        createdOrders.push({
          $id: newOrder.id,
          id: newOrder.id,
          table_id: newOrder.table_id,
          menu_item_id: newOrder.menu_item_id,
          status: newOrder.status,
          notas: newOrder.notas,
          price: newOrder.price,
          created_at: newOrder.created_at,
        });
      }

      await pool.query("COMMIT");

      // Emitir eventos WebSocket para cada pedido criado
      const emitToClients = app.get("emitToClients");
      createdOrders.forEach((order) => emitToClients.orderCreated(order));

      res.json({
        message: `${createdOrders.length} pedidos criados com sucesso`,
        orders: createdOrders,
      });
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    handleError(error, res);
  }
});

// Obter pedidos por mesa(s)
app.get("/orders/table/:table_ids", authenticateToken, async (req, res) => {
  try {
    const { table_ids } = req.params;

    // Processar IDs de mesa (podem ser separados por vírgula)
    const tableIdArray = table_ids.split(",").map((id) => id.trim());

    // Validar UUIDs
    for (const tableId of tableIdArray) {
      const validation = validateUUID(tableId, "table_id");
      if (!validation.isValid) {
        return res.status(400).json(validation.error);
      }
    }

    const orders = await pool.query(
      `
      SELECT
        o.*,
        m.nome as menu_nome,
        m.preco as menu_preco,
        m.category as menu_category
      FROM order_items o
      LEFT JOIN menu m ON o.menu_item_id = m.id
      WHERE o.table_id && $1::uuid[]
      ORDER BY o.created_at DESC
    `,
      [tableIdArray]
    );

    const ordersWithMenuInfo = orders.rows.map((order) => ({
      $id: order.id,
      id: order.id,
      table_id: order.table_id,
      menu_item_id: order.menu_item_id,
      status: order.status,
      notas: order.notas,
      price: order.price,
      created_at: order.created_at,
      menu_info: {
        nome: order.menu_nome,
        preco: order.menu_preco,
        category: order.menu_category,
      },
    }));

    res.json({ documents: ordersWithMenuInfo });
  } catch (error) {
    handleError(error, res);
  }
});

// Atualizar estado do pedido
app.put("/orders/:id", authenticateToken, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notas, price } = req.body;

    // Validar UUID
    const validation = validateUUID(id);
    if (!validation.isValid) {
      return res.status(400).json(validation.error);
    }

    // Validar estado se fornecido
    const validStatuses = [
      "pendente",
      "aceite",
      "pronto",
      "a ser entregue",
      "entregue",
      "completo",
      "cancelado",
    ];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Estado inválido. Deve ser um de: ${validStatuses.join(", ")}`,
      });
    }

    // Validar preço se fornecido
    if (price !== undefined && isNaN(parseFloat(price))) {
      return res.status(400).json({
        error: "price deve ser um número válido",
      });
    }

    const result = await pool.query(
      `UPDATE order_items
       SET status = COALESCE($1, status),
           notas = COALESCE($2, notas),
           price = COALESCE($3, price)
       WHERE id = $4::uuid
       RETURNING *`,
      [status, notas, price !== undefined ? parseFloat(price) : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const updatedOrder = result.rows[0];

    const orderResponse = {
      $id: updatedOrder.id,
      id: updatedOrder.id,
      table_id: updatedOrder.table_id,
      menu_item_id: updatedOrder.menu_item_id,
      status: updatedOrder.status,
      notas: updatedOrder.notas,
      price: updatedOrder.price,
      created_at: updatedOrder.created_at,
    };

    // Emitir evento WebSocket
    app.get("emitToClients").orderUpdated(orderResponse);

    res.json(orderResponse);
  } catch (error) {
    handleError(error, res);
  }
});

// Eliminar pedido
app.delete(
  "/orders/:id",
  authenticateToken,
  requireManager,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Validar UUID
      const validation = validateUUID(id);
      if (!validation.isValid) {
        return res.status(400).json(validation.error);
      }

      const result = await pool.query(
        "DELETE FROM order_items WHERE id = $1::uuid RETURNING *",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      const deletedId = result.rows[0].id;

      // Emitir evento WebSocket
      app.get("emitToClients").orderDeleted(deletedId);

      res.json({
        message: "Pedido eliminado com sucesso",
        deletedOrder: {
          $id: deletedId,
          id: deletedId,
        },
      });
    } catch (error) {
      handleError(error, res);
    }
  }
);

// ===== ROTAS DE MESAS SIMPLIFICADAS (para compatibilidade com frontend) =====

// Obter todas as mesas (simplificado para página de pedidos)
app.get("/tables", authenticateToken, async (req, res) => {
  try {
    // Obter todas as mesas de todos os layouts para o sistema de pedidos
    const tables = await pool.query(`
      SELECT
        t.id as "$id",
        t.id,
        t.table_number as "tableNumber",
        tl.name as layout_name
      FROM tables t
      LEFT JOIN table_layouts tl ON t.layout_id = tl.id
      ORDER BY t.table_number ASC
    `);

    res.json({ documents: tables.rows });
  } catch (error) {
    handleError(error, res);
  }
});

// Iniciar servidor
httpServer.listen(PORT, async () => {
  await ensureUploadsDir();
  console.log(`🚀 Servidor a correr na porta ${PORT}`);
  console.log(`📁 Ficheiros estáticos servidos de /files`);
  console.log(`🔗 URL Base da API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket ativo em ws://localhost:${PORT}`);
});

module.exports = { app, httpServer, io };
