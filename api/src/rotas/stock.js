const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const pool = require("../../db");
const { autenticarToken, requerGestor } = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");
const { garantirDiretorioUploads } = require("../utilitarios/sistemaFicheiros");

const router = express.Router();

// ============================================
// STOCK ITEMS ENDPOINTS
// ============================================

// Get all stock items
router.get("/items", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        id,
        name,
        category,
        description,
        supplier,
        location,
        cost_price,
        qty,
        min_qty,
        image_id,
        created_at,
        updated_at
      FROM stock
      ORDER BY name ASC
    `);

    // Format response to match Appwrite format
    const documents = resultado.rows.map(row => ({
      $id: row.id.toString(),
      name: row.name,
      category: row.category,
      description: row.description,
      supplier: row.supplier,
      location: row.location,
      cost_price: parseFloat(row.cost_price) || 0,
      qty: row.qty || 0,
      min_qty: row.min_qty || 0,
      image_id: row.image_id,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    }));

    res.json({
      documents: documents,
      total: documents.length
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao listar items:", erro);
    tratarErro(erro, res);
  }
});

// Get single stock item
router.get("/items/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `SELECT * FROM stock WHERE id = $1`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    const row = resultado.rows[0];
    const item = {
      $id: row.id.toString(),
      name: row.name,
      category: row.category,
      description: row.description,
      supplier: row.supplier,
      location: row.location,
      cost_price: parseFloat(row.cost_price) || 0,
      qty: row.qty || 0,
      min_qty: row.min_qty || 0,
      image_id: row.image_id,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    res.json(item);
  } catch (erro) {
    console.error("[STOCK] Erro ao buscar item:", erro);
    tratarErro(erro, res);
  }
});

// Create new stock item
router.post("/items", autenticarToken, requerGestor, async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      supplier,
      location,
      cost_price,
      qty,
      min_qty,
      image_id
    } = req.body;

    console.log("[STOCK] Criar novo item:", name);

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Nome do produto é obrigatório" });
    }

    const resultado = await pool.query(
      `INSERT INTO stock
        (name, category, description, supplier, location, cost_price, qty, min_qty, image_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name.trim(),
        category || null,
        description || null,
        supplier || null,
        location || null,
        parseFloat(cost_price) || 0,
        parseInt(qty) || 0,
        parseInt(min_qty) || 0,
        image_id || null
      ]
    );

    const row = resultado.rows[0];
    const item = {
      $id: row.id.toString(),
      name: row.name,
      category: row.category,
      description: row.description,
      supplier: row.supplier,
      location: row.location,
      cost_price: parseFloat(row.cost_price) || 0,
      qty: row.qty || 0,
      min_qty: row.min_qty || 0,
      image_id: row.image_id,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    console.log("[STOCK] Item criado com sucesso:", item.$id);

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.itemStockCriado(item);

      // Check if item is at alert level and emit alert
      if (item.qty <= item.min_qty) {
        emissores.alertaStockCriado({
          ...item,
          status: "critical",
          message: `Item "${item.name}" está em nível crítico (${item.qty}/${item.min_qty})`
        });
      } else if (item.qty <= item.min_qty + 5) {
        emissores.alertaStockCriado({
          ...item,
          status: "warning",
          message: `Item "${item.name}" está em nível de aviso (${item.qty}/${item.min_qty})`
        });
      }
    }

    res.status(201).json(item);
  } catch (erro) {
    console.error("[STOCK] Erro ao criar item:", erro);
    tratarErro(erro, res);
  }
});

// Update stock item
router.put("/items/:id", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      description,
      supplier,
      location,
      cost_price,
      qty,
      min_qty,
      image_id
    } = req.body;

    console.log("[STOCK] Atualizar item:", id);

    // Check if item exists
    const verificar = await pool.query("SELECT id FROM stock WHERE id = $1", [id]);
    if (verificar.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category || null);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description || null);
    }
    if (supplier !== undefined) {
      updates.push(`supplier = $${paramIndex++}`);
      values.push(supplier || null);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(location || null);
    }
    if (cost_price !== undefined) {
      updates.push(`cost_price = $${paramIndex++}`);
      values.push(parseFloat(cost_price) || 0);
    }
    if (qty !== undefined) {
      updates.push(`qty = $${paramIndex++}`);
      values.push(Math.max(0, parseInt(qty) || 0));
    }
    if (min_qty !== undefined) {
      updates.push(`min_qty = $${paramIndex++}`);
      values.push(Math.max(0, parseInt(min_qty) || 0));
    }
    if (image_id !== undefined) {
      updates.push(`image_id = $${paramIndex++}`);
      values.push(image_id || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    // Always update the updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const query = `
      UPDATE stock
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const resultado = await pool.query(query, values);
    const row = resultado.rows[0];

    const item = {
      $id: row.id.toString(),
      name: row.name,
      category: row.category,
      description: row.description,
      supplier: row.supplier,
      location: row.location,
      cost_price: parseFloat(row.cost_price) || 0,
      qty: row.qty || 0,
      min_qty: row.min_qty || 0,
      image_id: row.image_id,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    console.log("[STOCK] Item atualizado com sucesso");

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.itemStockAtualizado(item);

      // Check if item is at alert level and emit alert
      if (item.qty <= item.min_qty) {
        emissores.alertaStockCriado({
          ...item,
          status: "critical",
          message: `Item "${item.name}" está em nível crítico (${item.qty}/${item.min_qty})`
        });
      } else if (item.qty <= item.min_qty + 5) {
        emissores.alertaStockCriado({
          ...item,
          status: "warning",
          message: `Item "${item.name}" está em nível de aviso (${item.qty}/${item.min_qty})`
        });
      }
    }

    res.json(item);
  } catch (erro) {
    console.error("[STOCK] Erro ao atualizar item:", erro);
    tratarErro(erro, res);
  }
});

// Delete stock item
router.delete("/items/:id", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[STOCK] Eliminar item:", id);

    // Get item to check for image
    const item = await pool.query("SELECT image_id FROM stock WHERE id = $1", [id]);

    if (item.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    const imageId = item.rows[0].image_id;

    // Delete from database
    await pool.query("DELETE FROM stock WHERE id = $1", [id]);

    // Delete image file if exists
    if (imageId) {
      try {
        const caminhoImagem = path.join(
          __dirname,
          "../../uploads",
          "imagens-stock",
          imageId
        );
        await fs.unlink(caminhoImagem);
        console.log("[STOCK] Imagem eliminada:", imageId);
      } catch (erro) {
        console.error("[STOCK] Erro ao eliminar imagem:", erro);
        // Continue even if image deletion fails
      }
    }

    console.log("[STOCK] Item eliminado com sucesso");

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.itemStockEliminado(id);
    }

    res.json({ message: "Item eliminado com sucesso" });
  } catch (erro) {
    console.error("[STOCK] Erro ao eliminar item:", erro);
    tratarErro(erro, res);
  }
});

// ============================================
// CATEGORIES ENDPOINTS
// ============================================

// Get all categories
router.get("/categories", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT id, name, description, created_at, updated_at
      FROM category_stock
      ORDER BY name ASC
    `);

    const documents = resultado.rows.map(row => ({
      $id: row.id.toString(),
      name: row.name,
      category: row.name, // for backwards compatibility
      description: row.description,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    }));

    res.json({
      documents: documents,
      total: documents.length
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao listar categorias:", erro);
    tratarErro(erro, res);
  }
});

// Create category
router.post("/categories", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Nome da categoria é obrigatório" });
    }

    const resultado = await pool.query(
      `INSERT INTO category_stock (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), description || null]
    );

    const row = resultado.rows[0];
    const categoria = {
      $id: row.id.toString(),
      name: row.name,
      category: row.name,
      description: row.description,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.categoriaStockCriada(categoria);
    }

    res.status(201).json(categoria);
  } catch (erro) {
    if (erro.code === "23505") { // Unique violation
      return res.status(400).json({ error: "Categoria já existe" });
    }
    console.error("[STOCK] Erro ao criar categoria:", erro);
    tratarErro(erro, res);
  }
});

// ============================================
// SUPPLIERS ENDPOINTS
// ============================================

// Get all suppliers
router.get("/suppliers", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT id, name, contact_name, email, phone, address, notes, created_at, updated_at
      FROM supplier
      ORDER BY name ASC
    `);

    const documents = resultado.rows.map(row => ({
      $id: row.id.toString(),
      name: row.name,
      supplier: row.name, // for backwards compatibility
      contact_name: row.contact_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    }));

    res.json({
      documents: documents,
      total: documents.length
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao listar fornecedores:", erro);
    tratarErro(erro, res);
  }
});

// Create supplier
router.post("/suppliers", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { name, contact_name, email, phone, address, notes } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Nome do fornecedor é obrigatório" });
    }

    const resultado = await pool.query(
      `INSERT INTO supplier (name, contact_name, email, phone, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.trim(),
        contact_name || null,
        email || null,
        phone || null,
        address || null,
        notes || null
      ]
    );

    const row = resultado.rows[0];
    const fornecedor = {
      $id: row.id.toString(),
      name: row.name,
      supplier: row.name,
      contact_name: row.contact_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.fornecedorCriado(fornecedor);
    }

    res.status(201).json(fornecedor);
  } catch (erro) {
    if (erro.code === "23505") { // Unique violation
      return res.status(400).json({ error: "Fornecedor já existe" });
    }
    console.error("[STOCK] Erro ao criar fornecedor:", erro);
    tratarErro(erro, res);
  }
});

// ============================================
// LOCATIONS ENDPOINTS
// ============================================

// Get all locations
router.get("/locations", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT id, name, description, created_at, updated_at
      FROM location_stock
      ORDER BY name ASC
    `);

    const documents = resultado.rows.map(row => ({
      $id: row.id.toString(),
      name: row.name,
      location: row.name, // for backwards compatibility
      description: row.description,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    }));

    res.json({
      documents: documents,
      total: documents.length
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao listar localizações:", erro);
    tratarErro(erro, res);
  }
});

// Create location
router.post("/locations", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Nome da localização é obrigatório" });
    }

    const resultado = await pool.query(
      `INSERT INTO location_stock (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), description || null]
    );

    const row = resultado.rows[0];
    const localizacao = {
      $id: row.id.toString(),
      name: row.name,
      location: row.name,
      description: row.description,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.localizacaoStockCriada(localizacao);
    }

    res.status(201).json(localizacao);
  } catch (erro) {
    if (erro.code === "23505") { // Unique violation
      return res.status(400).json({ error: "Localização já existe" });
    }
    console.error("[STOCK] Erro ao criar localização:", erro);
    tratarErro(erro, res);
  }
});

// ============================================
// IMAGE UPLOAD ENDPOINT
// ============================================

// Upload stock image
router.post("/upload-image", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { imageData, filename } = req.body;

    console.log("[STOCK] Recebido pedido de upload de imagem de stock");
    console.log("[STOCK] Filename:", filename);
    console.log("[STOCK] ImageData presente:", !!imageData);

    if (!imageData) {
      return res.status(400).json({ error: "Dados da imagem obrigatórios" });
    }

    // Garantir que o diretório uploads existe
    await garantirDiretorioUploads();
    console.log("[STOCK] Diretórios verificados/criados");

    // Remover prefixo de data URL se presente
    const dadosBase64 = imageData.replace(/^data:image\/[^;]+;base64,/, "");
    console.log("[STOCK] Base64 após remover prefixo, length:", dadosBase64.length);

    // Gerar nome de ficheiro único
    const extensaoFicheiro = filename ? path.extname(filename) : ".jpg";
    const nomeFicheiroUnico = `${Date.now()}_stock_${Math.random()
      .toString(36)
      .substr(2, 9)}${extensaoFicheiro}`;
    const caminhoFicheiro = path.join(
      __dirname,
      "../../uploads",
      "imagens-stock",
      nomeFicheiroUnico
    );

    console.log("[STOCK] Caminho do ficheiro:", caminhoFicheiro);

    // Guardar ficheiro
    await fs.writeFile(caminhoFicheiro, dadosBase64, "base64");
    console.log("[STOCK] Ficheiro guardado com sucesso!");

    res.json({
      $id: nomeFicheiroUnico,
      filename: nomeFicheiroUnico,
      url: `/files/imagens-stock/${nomeFicheiroUnico}`,
      message: "Imagem de stock carregada com sucesso"
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao fazer upload:", erro);
    tratarErro(erro, res);
  }
});

// Get stock image (serves file)
router.get("/image/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    const caminhoImagem = path.join(
      __dirname,
      "../../uploads",
      "imagens-stock",
      imageId
    );

    // Check if file exists
    await fs.access(caminhoImagem);

    // Send file
    res.sendFile(caminhoImagem);
  } catch (erro) {
    if (erro.code === "ENOENT") {
      res.status(404).json({ error: "Imagem não encontrada" });
    } else {
      tratarErro(erro, res);
    }
  }
});

// Delete stock image
router.delete("/image/:imageId", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { imageId } = req.params;

    const caminhoImagem = path.join(
      __dirname,
      "../../uploads",
      "imagens-stock",
      imageId
    );

    try {
      await fs.unlink(caminhoImagem);
      res.json({ message: "Imagem eliminada com sucesso" });
    } catch (erro) {
      if (erro.code === "ENOENT") {
        res.status(404).json({ error: "Imagem não encontrada" });
      } else {
        throw erro;
      }
    }
  } catch (erro) {
    console.error("[STOCK] Erro ao eliminar imagem:", erro);
    tratarErro(erro, res);
  }
});

// ============================================
// STATISTICS / ANALYTICS ENDPOINTS
// ============================================

// Get stock statistics
router.get("/stats", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        COUNT(*) as total_items,
        COUNT(*) FILTER (WHERE qty <= min_qty) as critical_stock,
        COUNT(*) FILTER (WHERE qty > min_qty AND qty <= min_qty + 5) as warning_stock,
        COUNT(*) FILTER (WHERE qty > min_qty + 5) as ok_stock,
        SUM(qty * cost_price) as total_stock_value
      FROM stock
    `);

    const stats = resultado.rows[0];

    res.json({
      total_items: parseInt(stats.total_items) || 0,
      critical_stock: parseInt(stats.critical_stock) || 0,
      warning_stock: parseInt(stats.warning_stock) || 0,
      ok_stock: parseInt(stats.ok_stock) || 0,
      total_stock_value: parseFloat(stats.total_stock_value) || 0
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao buscar estatísticas:", erro);
    tratarErro(erro, res);
  }
});

// Get stock alerts (items with critical or warning stock levels)
router.get("/alerts", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        id,
        name,
        category,
        supplier,
        location,
        qty,
        min_qty,
        cost_price,
        image_id,
        created_at,
        updated_at,
        CASE
          WHEN qty <= min_qty THEN 'critical'
          WHEN qty <= min_qty + 5 THEN 'warning'
          ELSE 'ok'
        END AS status
      FROM stock
      WHERE qty <= min_qty + 5
      ORDER BY
        CASE
          WHEN qty <= min_qty THEN 1
          WHEN qty <= min_qty + 5 THEN 2
          ELSE 3
        END,
        name
      LIMIT 50
    `);

    const documents = resultado.rows.map(row => ({
      $id: row.id.toString(),
      name: row.name,
      category: row.category,
      supplier: row.supplier,
      location: row.location,
      qty: row.qty || 0,
      min_qty: row.min_qty || 0,
      status: row.status,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    }));

    res.json({
      documents: documents,
      total: documents.length
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao buscar alertas:", erro);
    tratarErro(erro, res);
  }
});

module.exports = router;
