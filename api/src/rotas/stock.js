const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const pool = require("../../db");
const { autenticarToken, requerGestor } = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");
const {
  uploadToS3,
  deleteFromS3,
  getContentType,
  getPublicUrl,
} = require("../utilitarios/s3");

const router = express.Router();

// ============================================
// WAREHOUSE ENDPOINTS
// ============================================

// Get all warehouses
router.get("/warehouses", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        id,
        name,
        description,
        address,
        is_active,
        created_at,
        updated_at
      FROM warehouses
      ORDER BY name ASC
    `);

    const documents = resultado.rows.map(row => ({
      $id: row.id.toString(),
      name: row.name,
      description: row.description,
      address: row.address,
      is_active: row.is_active,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    }));

    res.json({
      documents: documents,
      total: documents.length
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao listar warehouses:", erro);
    tratarErro(erro, res);
  }
});

// Get single warehouse
router.get("/warehouses/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `SELECT * FROM warehouses WHERE id = $1`,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Warehouse não encontrado" });
    }

    const row = resultado.rows[0];
    const warehouse = {
      $id: row.id.toString(),
      name: row.name,
      description: row.description,
      address: row.address,
      is_active: row.is_active,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    res.json(warehouse);
  } catch (erro) {
    console.error("[STOCK] Erro ao buscar warehouse:", erro);
    tratarErro(erro, res);
  }
});

// Create warehouse
router.post("/warehouses", autenticarToken, async (req, res) => {
  try {
    const { name, description, address, is_active } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Nome do warehouse é obrigatório" });
    }

    const resultado = await pool.query(
      `INSERT INTO warehouses (name, description, address, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), description || null, address || null, is_active !== undefined ? is_active : true]
    );

    const row = resultado.rows[0];
    const warehouse = {
      $id: row.id.toString(),
      name: row.name,
      description: row.description,
      address: row.address,
      is_active: row.is_active,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.warehouseCriado(warehouse);
    }

    res.status(201).json(warehouse);
  } catch (erro) {
    if (erro.code === "23505") {
      return res.status(400).json({ error: "Warehouse com esse nome já existe" });
    }
    console.error("[STOCK] Erro ao criar warehouse:", erro);
    tratarErro(erro, res);
  }
});

// Update warehouse
router.put("/warehouses/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, address, is_active } = req.body;

    const verificar = await pool.query("SELECT id FROM warehouses WHERE id = $1", [id]);
    if (verificar.rows.length === 0) {
      return res.status(404).json({ error: "Warehouse não encontrado" });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description || null);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(address || null);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE warehouses
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const resultado = await pool.query(query, values);
    const row = resultado.rows[0];

    const warehouse = {
      $id: row.id.toString(),
      name: row.name,
      description: row.description,
      address: row.address,
      is_active: row.is_active,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.warehouseAtualizado(warehouse);
    }

    res.json(warehouse);
  } catch (erro) {
    console.error("[STOCK] Erro ao atualizar warehouse:", erro);
    tratarErro(erro, res);
  }
});

// Delete warehouse
router.delete("/warehouses/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if warehouse has inventory
    const inventoryCheck = await pool.query(
      "SELECT COUNT(*) as count FROM stock_inventory WHERE warehouse_id = $1",
      [id]
    );

    if (parseInt(inventoryCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: "Não é possível eliminar warehouse com inventário. Transfira ou remova os items primeiro."
      });
    }

    const resultado = await pool.query("DELETE FROM warehouses WHERE id = $1 RETURNING id", [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Warehouse não encontrado" });
    }

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.warehouseEliminado(id);
    }

    res.json({ message: "Warehouse eliminado com sucesso" });
  } catch (erro) {
    console.error("[STOCK] Erro ao eliminar warehouse:", erro);
    tratarErro(erro, res);
  }
});

// ============================================
// STOCK ITEMS ENDPOINTS
// ============================================

// Get all stock items (with aggregated quantities)
router.get("/items", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        si.id,
        si.name,
        si.category,
        si.description,
        si.supplier_id,
        s.name as supplier_name,
        si.cost_price,
        si.image_id,
        si.created_at,
        si.updated_at,
        COALESCE(SUM(inv.qty), 0) as total_qty,
        COUNT(DISTINCT inv.warehouse_id) as num_warehouses
      FROM stock_items si
      LEFT JOIN supplier s ON si.supplier_id = s.id
      LEFT JOIN stock_inventory inv ON si.id = inv.stock_item_id
      GROUP BY si.id, si.name, si.category, si.description, si.supplier_id, s.name, si.cost_price, si.image_id, si.created_at, si.updated_at
      ORDER BY si.name ASC
    `);

    const documents = resultado.rows.map(row => ({
      $id: row.id.toString(),
      name: row.name,
      category: row.category,
      description: row.description,
      supplier_id: row.supplier_id,
      supplier_name: row.supplier_name,
      cost_price: parseFloat(row.cost_price) || 0,
      qty: parseInt(row.total_qty) || 0,
      num_warehouses: parseInt(row.num_warehouses) || 0,
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

// Get single stock item (with warehouse breakdown)
router.get("/items/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get item details
    const itemResult = await pool.query(
      `SELECT
        si.*,
        s.name as supplier_name
      FROM stock_items si
      LEFT JOIN supplier s ON si.supplier_id = s.id
      WHERE si.id = $1`,
      [id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    // Get inventory breakdown by warehouse
    const inventoryResult = await pool.query(
      `SELECT
        inv.id,
        inv.warehouse_id,
        w.name as warehouse_name,
        inv.qty,
        inv.min_qty,
        inv.position,
        inv.created_at,
        inv.updated_at
      FROM stock_inventory inv
      JOIN warehouses w ON inv.warehouse_id = w.id
      WHERE inv.stock_item_id = $1
      ORDER BY w.name ASC`,
      [id]
    );

    const row = itemResult.rows[0];
    const totalQty = inventoryResult.rows.reduce((sum, inv) => sum + inv.qty, 0);

    const item = {
      $id: row.id.toString(),
      name: row.name,
      category: row.category,
      description: row.description,
      supplier_id: row.supplier_id,
      supplier_name: row.supplier_name,
      cost_price: parseFloat(row.cost_price) || 0,
      qty: totalQty,
      image_id: row.image_id,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at,
      warehouses: inventoryResult.rows.map(inv => ({
        inventory_id: inv.id.toString(),
        warehouse_id: inv.warehouse_id.toString(),
        warehouse_name: inv.warehouse_name,
        qty: inv.qty,
        min_qty: inv.min_qty || 0,
        position: inv.position,
        created_at: inv.created_at,
        updated_at: inv.updated_at
      }))
    };

    res.json(item);
  } catch (erro) {
    console.error("[STOCK] Erro ao buscar item:", erro);
    tratarErro(erro, res);
  }
});

// Create new stock item
router.post("/items", autenticarToken, async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      supplier_id,
      cost_price,
      image_id,
      inventory // Array: [{ warehouse_id, qty, min_qty, position }]
    } = req.body;

    console.log("[STOCK] Criar novo item:", name);

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Nome do produto é obrigatório" });
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert stock item
      const itemResult = await client.query(
        `INSERT INTO stock_items
          (name, category, description, supplier_id, cost_price, image_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          name.trim(),
          category || null,
          description || null,
          supplier_id || null,
          parseFloat(cost_price) || 0,
          image_id || null
        ]
      );

      const itemRow = itemResult.rows[0];
      const itemId = itemRow.id;

      // Insert inventory if provided
      let totalQty = 0;
      const warehouseData = [];

      if (inventory && Array.isArray(inventory) && inventory.length > 0) {
        for (const inv of inventory) {
          if (inv.warehouse_id && inv.qty > 0) {
            const invResult = await client.query(
              `INSERT INTO stock_inventory (stock_item_id, warehouse_id, qty, min_qty, position)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *`,
              [itemId, inv.warehouse_id, parseInt(inv.qty) || 0, parseInt(inv.min_qty) || 0, inv.position || null]
            );

            totalQty += parseInt(inv.qty) || 0;

            const warehouseInfo = await client.query(
              `SELECT name FROM warehouses WHERE id = $1`,
              [inv.warehouse_id]
            );

            warehouseData.push({
              inventory_id: invResult.rows[0].id.toString(),
              warehouse_id: inv.warehouse_id.toString(),
              warehouse_name: warehouseInfo.rows[0]?.name || '',
              qty: parseInt(inv.qty) || 0,
              min_qty: parseInt(inv.min_qty) || 0,
              position: inv.position || null
            });
          }
        }
      }

      await client.query('COMMIT');

      // Get supplier name
      let supplierName = null;
      if (supplier_id) {
        const supplierResult = await pool.query(
          `SELECT name FROM supplier WHERE id = $1`,
          [supplier_id]
        );
        supplierName = supplierResult.rows[0]?.name || null;
      }

      const item = {
        $id: itemRow.id.toString(),
        name: itemRow.name,
        category: itemRow.category,
        description: itemRow.description,
        supplier_id: itemRow.supplier_id,
        supplier_name: supplierName,
        cost_price: parseFloat(itemRow.cost_price) || 0,
        qty: totalQty,
        image_id: itemRow.image_id,
        $createdAt: itemRow.created_at,
        $updatedAt: itemRow.updated_at,
        warehouses: warehouseData
      };

      console.log("[STOCK] Item criado com sucesso:", item.$id);

      // Emit WebSocket event
      const emissores = req.app.get("emissoresClientes");
      if (emissores) {
        emissores.itemStockCriado(item);

        // Check if any warehouse is at alert level
        for (const wh of warehouseData) {
          if (wh.qty <= wh.min_qty) {
            emissores.alertaStockCriado({
              ...item,
              warehouse_id: wh.warehouse_id,
              warehouse_name: wh.warehouse_name,
              status: "critical",
              message: `Item "${item.name}" em ${wh.warehouse_name} está em nível crítico (${wh.qty}/${wh.min_qty})`
            });
          } else if (wh.qty <= wh.min_qty + 5) {
            emissores.alertaStockCriado({
              ...item,
              warehouse_id: wh.warehouse_id,
              warehouse_name: wh.warehouse_name,
              status: "warning",
              message: `Item "${item.name}" em ${wh.warehouse_name} está em nível de aviso (${wh.qty}/${wh.min_qty})`
            });
          }
        }
      }

      res.status(201).json(item);
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    } finally {
      client.release();
    }
  } catch (erro) {
    console.error("[STOCK] Erro ao criar item:", erro);
    tratarErro(erro, res);
  }
});

// Update stock item (basic info only, not inventory)
router.put("/items/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      description,
      supplier_id,
      cost_price,
      image_id
    } = req.body;

    console.log("[STOCK] Atualizar item:", id);

    // Check if item exists
    const verificar = await pool.query("SELECT id FROM stock_items WHERE id = $1", [id]);
    if (verificar.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    // Build dynamic update query
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
    if (supplier_id !== undefined) {
      updates.push(`supplier_id = $${paramIndex++}`);
      values.push(supplier_id || null);
    }
    if (cost_price !== undefined) {
      updates.push(`cost_price = $${paramIndex++}`);
      values.push(parseFloat(cost_price) || 0);
    }
    if (image_id !== undefined) {
      updates.push(`image_id = $${paramIndex++}`);
      values.push(image_id || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE stock_items
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const resultado = await pool.query(query, values);
    const row = resultado.rows[0];

    // Get total quantity and supplier name
    const totalsResult = await pool.query(
      `SELECT COALESCE(SUM(qty), 0) as total_qty FROM stock_inventory WHERE stock_item_id = $1`,
      [id]
    );

    let supplierName = null;
    if (row.supplier_id) {
      const supplierResult = await pool.query(
        `SELECT name FROM supplier WHERE id = $1`,
        [row.supplier_id]
      );
      supplierName = supplierResult.rows[0]?.name || null;
    }

    const item = {
      $id: row.id.toString(),
      name: row.name,
      category: row.category,
      description: row.description,
      supplier_id: row.supplier_id,
      supplier_name: supplierName,
      cost_price: parseFloat(row.cost_price) || 0,
      qty: parseInt(totalsResult.rows[0].total_qty) || 0,
      image_id: row.image_id,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    console.log("[STOCK] Item atualizado com sucesso");

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.itemStockAtualizado(item);
    }

    res.json(item);
  } catch (erro) {
    console.error("[STOCK] Erro ao atualizar item:", erro);
    tratarErro(erro, res);
  }
});

// Delete stock item (cascades to inventory)
router.delete("/items/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[STOCK] Eliminar item:", id);

    // Get item to check for image
    const item = await pool.query("SELECT image_id FROM stock_items WHERE id = $1", [id]);

    if (item.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    const imageId = item.rows[0].image_id;

    // Delete from database (cascades to stock_inventory)
    await pool.query("DELETE FROM stock_items WHERE id = $1", [id]);

    // Delete image from S3 if exists
    if (imageId) {
      try {
        const s3Key = `imagens-stock/${imageId}`;
        await deleteFromS3(s3Key);
        console.log("[STOCK] Imagem eliminada do S3:", imageId);
      } catch (erro) {
        console.error("[STOCK] Erro ao eliminar imagem do S3:", erro);
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
// INVENTORY MANAGEMENT ENDPOINTS
// ============================================

// Get inventory breakdown for an item
router.get("/items/:id/inventory", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if item exists
    const itemCheck = await pool.query("SELECT id FROM stock_items WHERE id = $1", [id]);
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    const resultado = await pool.query(
      `SELECT
        inv.id,
        inv.warehouse_id,
        w.name as warehouse_name,
        w.description as warehouse_description,
        inv.qty,
        inv.min_qty,
        inv.position,
        inv.created_at,
        inv.updated_at
      FROM stock_inventory inv
      JOIN warehouses w ON inv.warehouse_id = w.id
      WHERE inv.stock_item_id = $1
      ORDER BY w.name ASC`,
      [id]
    );

    const documents = resultado.rows.map(row => ({
      $id: row.id.toString(),
      warehouse_id: row.warehouse_id.toString(),
      warehouse_name: row.warehouse_name,
      warehouse_description: row.warehouse_description,
      qty: row.qty,
      min_qty: row.min_qty || 0,
      position: row.position,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    }));

    res.json({
      documents: documents,
      total: documents.length
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao buscar inventory:", erro);
    tratarErro(erro, res);
  }
});

// Add or update inventory for an item at a warehouse
router.post("/items/:id/inventory", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { warehouse_id, qty, min_qty, position, operation } = req.body;

    if (!warehouse_id) {
      return res.status(400).json({ error: "warehouse_id é obrigatório" });
    }

    if (qty === undefined || qty < 0) {
      return res.status(400).json({ error: "qty inválida" });
    }

    // Check if item exists
    const itemCheck = await pool.query("SELECT id FROM stock_items WHERE id = $1", [id]);
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    // Check if warehouse exists
    const warehouseCheck = await pool.query("SELECT id FROM warehouses WHERE id = $1", [warehouse_id]);
    if (warehouseCheck.rows.length === 0) {
      return res.status(404).json({ error: "Warehouse não encontrado" });
    }

    let resultado;

    if (operation === "add") {
      // Add to existing quantity
      resultado = await pool.query(
        `INSERT INTO stock_inventory (stock_item_id, warehouse_id, qty, min_qty, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (stock_item_id, warehouse_id)
         DO UPDATE SET
           qty = stock_inventory.qty + EXCLUDED.qty,
           min_qty = COALESCE(EXCLUDED.min_qty, stock_inventory.min_qty),
           position = COALESCE(EXCLUDED.position, stock_inventory.position),
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [id, warehouse_id, parseInt(qty), parseInt(min_qty) || 0, position || null]
      );
    } else {
      // Set quantity (default)
      resultado = await pool.query(
        `INSERT INTO stock_inventory (stock_item_id, warehouse_id, qty, min_qty, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (stock_item_id, warehouse_id)
         DO UPDATE SET
           qty = EXCLUDED.qty,
           min_qty = COALESCE(EXCLUDED.min_qty, stock_inventory.min_qty),
           position = COALESCE(EXCLUDED.position, stock_inventory.position),
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [id, warehouse_id, parseInt(qty), parseInt(min_qty) || 0, position || null]
      );
    }

    const row = resultado.rows[0];

    // Get warehouse name
    const warehouseInfo = await pool.query(
      `SELECT name FROM warehouses WHERE id = $1`,
      [warehouse_id]
    );

    const inventory = {
      $id: row.id.toString(),
      stock_item_id: row.stock_item_id.toString(),
      warehouse_id: row.warehouse_id.toString(),
      warehouse_name: warehouseInfo.rows[0].name,
      qty: row.qty,
      min_qty: row.min_qty || 0,
      position: row.position,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.inventoryAtualizado(inventory);
    }

    res.status(201).json(inventory);
  } catch (erro) {
    console.error("[STOCK] Erro ao adicionar/atualizar inventory:", erro);
    tratarErro(erro, res);
  }
});

// Update inventory at specific warehouse
router.put("/items/:id/inventory/:warehouse_id", autenticarToken, async (req, res) => {
  try {
    const { id, warehouse_id } = req.params;
    const { qty, min_qty, position } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (qty !== undefined) {
      if (qty < 0) {
        return res.status(400).json({ error: "Quantidade não pode ser negativa" });
      }
      updates.push(`qty = $${paramIndex++}`);
      values.push(parseInt(qty));
    }

    if (min_qty !== undefined) {
      updates.push(`min_qty = $${paramIndex++}`);
      values.push(Math.max(0, parseInt(min_qty) || 0));
    }

    if (position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      values.push(position || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, warehouse_id);

    const query = `
      UPDATE stock_inventory
      SET ${updates.join(", ")}
      WHERE stock_item_id = $${paramIndex} AND warehouse_id = $${paramIndex + 1}
      RETURNING *
    `;

    const resultado = await pool.query(query, values);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Inventory não encontrado neste warehouse" });
    }

    const row = resultado.rows[0];

    // Get warehouse name
    const warehouseInfo = await pool.query(
      `SELECT name FROM warehouses WHERE id = $1`,
      [warehouse_id]
    );

    const inventory = {
      $id: row.id.toString(),
      stock_item_id: row.stock_item_id.toString(),
      warehouse_id: row.warehouse_id.toString(),
      warehouse_name: warehouseInfo.rows[0].name,
      qty: row.qty,
      min_qty: row.min_qty || 0,
      position: row.position,
      $createdAt: row.created_at,
      $updatedAt: row.updated_at
    };

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.inventoryAtualizado(inventory);
    }

    res.json(inventory);
  } catch (erro) {
    console.error("[STOCK] Erro ao atualizar inventory:", erro);
    tratarErro(erro, res);
  }
});

// Remove inventory from warehouse
router.delete("/items/:id/inventory/:warehouse_id", autenticarToken, async (req, res) => {
  try {
    const { id, warehouse_id } = req.params;

    const resultado = await pool.query(
      "DELETE FROM stock_inventory WHERE stock_item_id = $1 AND warehouse_id = $2 RETURNING *",
      [id, warehouse_id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Inventory não encontrado neste warehouse" });
    }

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.inventoryEliminado({ stock_item_id: id, warehouse_id });
    }

    res.json({ message: "Inventory removido com sucesso" });
  } catch (erro) {
    console.error("[STOCK] Erro ao remover inventory:", erro);
    tratarErro(erro, res);
  }
});

// Transfer stock between warehouses
router.post("/items/:id/transfer", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_warehouse_id, to_warehouse_id, qty } = req.body;

    if (!from_warehouse_id || !to_warehouse_id) {
      return res.status(400).json({ error: "from_warehouse_id e to_warehouse_id são obrigatórios" });
    }

    if (!qty || qty <= 0) {
      return res.status(400).json({ error: "Quantidade deve ser maior que zero" });
    }

    if (from_warehouse_id === to_warehouse_id) {
      return res.status(400).json({ error: "Warehouses de origem e destino devem ser diferentes" });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check source inventory
      const sourceCheck = await client.query(
        `SELECT qty FROM stock_inventory WHERE stock_item_id = $1 AND warehouse_id = $2`,
        [id, from_warehouse_id]
      );

      if (sourceCheck.rows.length === 0) {
        throw new Error("Item não existe no warehouse de origem");
      }

      if (sourceCheck.rows[0].qty < qty) {
        throw new Error(`Quantidade insuficiente no warehouse de origem (disponível: ${sourceCheck.rows[0].qty})`);
      }

      // Decrease from source
      const newSourceQty = sourceCheck.rows[0].qty - qty;
      if (newSourceQty === 0) {
        // Remove completely if zero
        await client.query(
          `DELETE FROM stock_inventory WHERE stock_item_id = $1 AND warehouse_id = $2`,
          [id, from_warehouse_id]
        );
      } else {
        await client.query(
          `UPDATE stock_inventory SET qty = $1, updated_at = CURRENT_TIMESTAMP
           WHERE stock_item_id = $2 AND warehouse_id = $3`,
          [newSourceQty, id, from_warehouse_id]
        );
      }

      // Increase at destination (or create new record)
      await client.query(
        `INSERT INTO stock_inventory (stock_item_id, warehouse_id, qty)
         VALUES ($1, $2, $3)
         ON CONFLICT (stock_item_id, warehouse_id)
         DO UPDATE SET
           qty = stock_inventory.qty + EXCLUDED.qty,
           updated_at = CURRENT_TIMESTAMP`,
        [id, to_warehouse_id, qty]
      );

      await client.query('COMMIT');

      // Get warehouse names for response
      const warehouseNames = await pool.query(
        `SELECT id, name FROM warehouses WHERE id IN ($1, $2)`,
        [from_warehouse_id, to_warehouse_id]
      );

      const fromWarehouse = warehouseNames.rows.find(w => w.id == from_warehouse_id);
      const toWarehouse = warehouseNames.rows.find(w => w.id == to_warehouse_id);

      const transfer = {
        stock_item_id: id,
        from_warehouse_id: from_warehouse_id.toString(),
        from_warehouse_name: fromWarehouse?.name || '',
        to_warehouse_id: to_warehouse_id.toString(),
        to_warehouse_name: toWarehouse?.name || '',
        qty: qty,
        timestamp: new Date().toISOString()
      };

      // Emit WebSocket event
      const emissores = req.app.get("emissoresClientes");
      if (emissores) {
        emissores.stockTransferido(transfer);
      }

      res.json({
        message: "Transferência realizada com sucesso",
        transfer: transfer
      });
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    } finally {
      client.release();
    }
  } catch (erro) {
    console.error("[STOCK] Erro ao transferir stock:", erro);
    if (erro.message.includes("não existe") || erro.message.includes("insuficiente")) {
      return res.status(400).json({ error: erro.message });
    }
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
router.post("/categories", autenticarToken, async (req, res) => {
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
router.post("/suppliers", autenticarToken, async (req, res) => {
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

// Update supplier
router.put("/suppliers/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_name, email, phone, address, notes } = req.body;

    const verificar = await pool.query("SELECT id FROM supplier WHERE id = $1", [id]);
    if (verificar.rows.length === 0) {
      return res.status(404).json({ error: "Fornecedor não encontrado" });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (contact_name !== undefined) {
      updates.push(`contact_name = $${paramIndex++}`);
      values.push(contact_name || null);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email || null);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone || null);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(address || null);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE supplier
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const resultado = await pool.query(query, values);
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
      emissores.fornecedorAtualizado(fornecedor);
    }

    res.json(fornecedor);
  } catch (erro) {
    console.error("[STOCK] Erro ao atualizar fornecedor:", erro);
    tratarErro(erro, res);
  }
});

// Delete supplier
router.delete("/suppliers/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier has stock items
    const itemsCheck = await pool.query(
      "SELECT COUNT(*) as count FROM stock_items WHERE supplier_id = $1",
      [id]
    );

    if (parseInt(itemsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: "Não é possível eliminar fornecedor com items associados. Atualize ou remova os items primeiro."
      });
    }

    const resultado = await pool.query("DELETE FROM supplier WHERE id = $1 RETURNING id", [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Fornecedor não encontrado" });
    }

    // Emit WebSocket event
    const emissores = req.app.get("emissoresClientes");
    if (emissores) {
      emissores.fornecedorEliminado(id);
    }

    res.json({ message: "Fornecedor eliminado com sucesso" });
  } catch (erro) {
    console.error("[STOCK] Erro ao eliminar fornecedor:", erro);
    tratarErro(erro, res);
  }
});

// ============================================
// IMAGE UPLOAD ENDPOINT
// ============================================

// Upload stock image
router.post("/upload-image", autenticarToken, async (req, res) => {
  try {
    const { imageData, filename } = req.body;

    console.log("[STOCK] Recebido pedido de upload de imagem de stock");
    console.log("[STOCK] Filename:", filename);
    console.log("[STOCK] ImageData presente:", !!imageData);

    if (!imageData) {
      return res.status(400).json({ error: "Dados da imagem obrigatórios" });
    }

    // Remover prefixo de data URL se presente
    const dadosBase64 = imageData.replace(/^data:image\/[^;]+;base64,/, "");
    console.log("[STOCK] Base64 após remover prefixo, length:", dadosBase64.length);

    // Detectar tipo de imagem
    let extensaoFicheiro = filename ? path.extname(filename) : ".jpg";
    let contentType = "image/jpeg"; // Default
    const matchTipo = imageData.match(/^data:image\/([^;]+);base64,/);
    if (matchTipo) {
      const tipoImagem = matchTipo[1];
      contentType = `image/${tipoImagem}`;
    }

    // Gerar nome de ficheiro único
    const nomeFicheiroUnico = `${Date.now()}_stock_${Math.random()
      .toString(36)
      .substr(2, 9)}${extensaoFicheiro}`;
    
    // Chave S3 (caminho no bucket)
    const s3Key = `imagens-stock/${nomeFicheiroUnico}`;

    // Converter base64 para buffer
    const bufferImagem = Buffer.from(dadosBase64, "base64");

    console.log("[STOCK] Fazendo upload para S3:", s3Key);

    // Upload para S3
    const { url } = await uploadToS3(bufferImagem, s3Key, contentType);
    console.log("[STOCK] Upload para S3 concluído com sucesso!");

    res.json({
      $id: nomeFicheiroUnico,
      filename: nomeFicheiroUnico,
      url: url,
      message: "Imagem de stock carregada com sucesso"
    });
  } catch (erro) {
    console.error("[STOCK] Erro ao fazer upload:", erro);
    tratarErro(erro, res);
  }
});

// Get stock image (serves file)
// Nota: Este endpoint pode ser removido se usar URLs S3 diretos no frontend
router.get("/image/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;
    const s3Key = `imagens-stock/${imageId}`;

    console.log("[STOCK] Redirecionando para imagem S3:", s3Key);
    
    // Opção 1: Redirecionar para URL público do S3
    const publicUrl = getPublicUrl(s3Key);
    res.redirect(publicUrl);
    
    // Opção 2 (alternativa): Fazer stream do S3 através do servidor
    // const stream = await streamFromS3(s3Key);
    // stream.pipe(res);
  } catch (erro) {
    console.error("[STOCK] Erro ao obter imagem:", erro);
    res.status(404).json({ error: "Imagem não encontrada" });
  }
});

// Delete stock image
router.delete("/image/:imageId", autenticarToken, async (req, res) => {
  try {
    const { imageId } = req.params;
    const s3Key = `imagens-stock/${imageId}`;

    console.log("[STOCK] Eliminando imagem do S3:", s3Key);

    try {
      await deleteFromS3(s3Key);
      res.json({ message: "Imagem eliminada com sucesso" });
    } catch (erro) {
      console.error("[STOCK] Erro ao eliminar do S3:", erro);
      res.status(404).json({ error: "Imagem não encontrada" });
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
        COUNT(DISTINCT si.id) as total_items,
        COUNT(DISTINCT inv.id) FILTER (WHERE inv.qty <= inv.min_qty) as critical_stock,
        COUNT(DISTINCT inv.id) FILTER (WHERE inv.qty > inv.min_qty AND inv.qty <= inv.min_qty + 5) as warning_stock,
        COUNT(DISTINCT inv.id) FILTER (WHERE inv.qty > inv.min_qty + 5) as ok_stock,
        SUM(inv.qty * si.cost_price) as total_stock_value
      FROM stock_items si
      LEFT JOIN stock_inventory inv ON si.id = inv.stock_item_id
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
        si.id,
        si.name,
        si.category,
        s.name as supplier_name,
        inv.warehouse_id,
        w.name as warehouse_name,
        inv.min_qty,
        inv.qty,
        si.cost_price,
        si.image_id,
        si.created_at,
        si.updated_at,
        CASE
          WHEN inv.qty <= inv.min_qty THEN 'critical'
          WHEN inv.qty <= inv.min_qty + 5 THEN 'warning'
          ELSE 'ok'
        END AS status
      FROM stock_items si
      LEFT JOIN supplier s ON si.supplier_id = s.id
      INNER JOIN stock_inventory inv ON si.id = inv.stock_item_id
      INNER JOIN warehouses w ON inv.warehouse_id = w.id
      WHERE inv.qty <= inv.min_qty + 5
      ORDER BY
        CASE
          WHEN inv.qty <= inv.min_qty THEN 1
          WHEN inv.qty <= inv.min_qty + 5 THEN 2
          ELSE 3
        END,
        si.name,
        w.name
      LIMIT 50
    `);

    const documents = resultado.rows.map(row => ({
      $id: `${row.id}_${row.warehouse_id}`,
      item_id: row.id.toString(),
      name: row.name,
      category: row.category,
      supplier_name: row.supplier_name,
      warehouse_id: row.warehouse_id.toString(),
      warehouse_name: row.warehouse_name,
      qty: parseInt(row.qty) || 0,
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
