const express = require("express");
const pool = require("../../db");
const { validateUUID } = require("../../uuid-validation");
const { autenticarToken, requerGestor } = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");

const roteador = express.Router();

// Obter todos os pedidos
roteador.get("/", autenticarToken, async (req, res) => {
  try {
    const pedidos = await pool.query(`
      SELECT
        o.*,
        m.nome as menu_nome,
        m.preco as menu_preco,
        m.category as menu_category
      FROM order_items o
      LEFT JOIN menu m ON o.menu_item_id = m.id
      ORDER BY o.created_at DESC
    `);

    const pedidosComInfoMenu = pedidos.rows.map((pedido) => ({
      $id: pedido.id,
      id: pedido.id,
      table_id: pedido.table_id,
      menu_item_id: pedido.menu_item_id,
      status: pedido.status,
      notas: pedido.notas,
      price: pedido.price,
      created_at: pedido.created_at,
      // Informação do item de menu para exibição
      menu_info: {
        nome: pedido.menu_nome,
        preco: pedido.menu_preco,
        category: pedido.menu_category,
      },
    }));

    res.json({ documents: pedidosComInfoMenu });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Obter pedidos por mesa(s)
roteador.get("/table/:table_ids", autenticarToken, async (req, res) => {
  try {
    const { table_ids } = req.params;

    // Processar IDs de mesa (podem ser separados por vírgula)
    const arrayIdsMesas = table_ids.split(",").map((id) => id.trim());

    // Validar UUIDs
    for (const idMesa of arrayIdsMesas) {
      const validacao = validateUUID(idMesa, "table_id");
      if (!validacao.isValid) {
        return res.status(400).json(validacao.error);
      }
    }

    const pedidos = await pool.query(
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
      [arrayIdsMesas]
    );

    const pedidosComInfoMenu = pedidos.rows.map((pedido) => ({
      $id: pedido.id,
      id: pedido.id,
      table_id: pedido.table_id,
      menu_item_id: pedido.menu_item_id,
      status: pedido.status,
      notas: pedido.notas,
      price: pedido.price,
      created_at: pedido.created_at,
      menu_info: {
        nome: pedido.menu_nome,
        preco: pedido.menu_preco,
        category: pedido.menu_category,
      },
    }));

    res.json({ documents: pedidosComInfoMenu });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Criar novo pedido (item único)
roteador.post("/", autenticarToken, async (req, res) => {
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

    for (const idMesa of table_id) {
      const validacao = validateUUID(idMesa, "table_id");
      if (!validacao.isValid) {
        return res.status(400).json(validacao.error);
      }
    }

    // Validar que menu_item_id é um UUID válido
    const validacaoMenu = validateUUID(menu_item_id, "menu_item_id");
    if (!validacaoMenu.isValid) {
      return res.status(400).json(validacaoMenu.error);
    }

    const resultado = await pool.query(
      `INSERT INTO order_items (table_id, menu_item_id, status, notas, price, created_at)
       VALUES ($1, $2::uuid, 'pendente', $3, $4, CURRENT_TIMESTAMP)
       RETURNING *`,
      [table_id, menu_item_id, notas || null, parseFloat(price)]
    );

    const novoPedido = resultado.rows[0];

    const respostaPedido = {
      $id: novoPedido.id,
      id: novoPedido.id,
      table_id: novoPedido.table_id,
      menu_item_id: novoPedido.menu_item_id,
      status: novoPedido.status,
      notas: novoPedido.notas,
      price: novoPedido.price,
      created_at: novoPedido.created_at,
    };

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").pedidoCriado(respostaPedido);

    res.json(respostaPedido);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Criar múltiplos pedidos (para finalização do carrinho)
roteador.post("/batch", autenticarToken, async (req, res) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        error: "Array de pedidos obrigatório e não pode estar vazio",
      });
    }

    // Validar todos os pedidos primeiro
    for (const pedido of orders) {
      if (!pedido.table_id || !pedido.menu_item_id) {
        return res.status(400).json({
          error: "Cada pedido deve ter table_id e menu_item_id",
        });
      }

      if (!pedido.price || isNaN(parseFloat(pedido.price))) {
        return res.status(400).json({
          error: "Cada pedido deve ter um price válido",
        });
      }

      if (!Array.isArray(pedido.table_id)) {
        return res.status(400).json({
          error: "table_id deve ser um array de UUIDs de mesa",
        });
      }

      for (const idMesa of pedido.table_id) {
        const validacao = validateUUID(idMesa, "table_id");
        if (!validacao.isValid) {
          return res.status(400).json(validacao.error);
        }
      }

      const validacaoMenu = validateUUID(pedido.menu_item_id, "menu_item_id");
      if (!validacaoMenu.isValid) {
        return res.status(400).json(validacaoMenu.error);
      }
    }

    // Iniciar transação
    await pool.query("BEGIN");

    try {
      const pedidosCriados = [];

      for (const pedido of orders) {
        const resultado = await pool.query(
          `INSERT INTO order_items (table_id, menu_item_id, status, notas, price, created_at)
           VALUES ($1, $2::uuid, 'pendente', $3, $4, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            pedido.table_id,
            pedido.menu_item_id,
            pedido.notas || null,
            parseFloat(pedido.price),
          ]
        );

        const novoPedido = resultado.rows[0];
        pedidosCriados.push({
          $id: novoPedido.id,
          id: novoPedido.id,
          table_id: novoPedido.table_id,
          menu_item_id: novoPedido.menu_item_id,
          status: novoPedido.status,
          notas: novoPedido.notas,
          price: novoPedido.price,
          created_at: novoPedido.created_at,
        });
      }

      await pool.query("COMMIT");

      // Emitir eventos WebSocket para cada pedido criado
      const emissoresClientes = req.app.get("emissoresClientes");
      pedidosCriados.forEach((pedido) => emissoresClientes.pedidoCriado(pedido));

      res.json({
        message: `${pedidosCriados.length} pedidos criados com sucesso`,
        orders: pedidosCriados,
      });
    } catch (erro) {
      await pool.query("ROLLBACK");
      throw erro;
    }
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Atualizar estado do pedido
roteador.put("/:id", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notas, price } = req.body;

    // Validar UUID
    const validacao = validateUUID(id);
    if (!validacao.isValid) {
      return res.status(400).json(validacao.error);
    }

    // Validar estado se fornecido
    const estadosValidos = [
      "pendente",
      "aceite",
      "pronto",
      "a ser entregue",
      "entregue",
      "completo",
      "cancelado",
    ];
    if (status && !estadosValidos.includes(status)) {
      return res.status(400).json({
        error: `Estado inválido. Deve ser um de: ${estadosValidos.join(", ")}`,
      });
    }

    // Validar preço se fornecido
    if (price !== undefined && isNaN(parseFloat(price))) {
      return res.status(400).json({
        error: "price deve ser um número válido",
      });
    }

    const resultado = await pool.query(
      `UPDATE order_items
       SET status = COALESCE($1, status),
           notas = COALESCE($2, notas),
           price = COALESCE($3, price)
       WHERE id = $4::uuid
       RETURNING *`,
      [status, notas, price !== undefined ? parseFloat(price) : null, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const pedidoAtualizado = resultado.rows[0];

    const respostaPedido = {
      $id: pedidoAtualizado.id,
      id: pedidoAtualizado.id,
      table_id: pedidoAtualizado.table_id,
      menu_item_id: pedidoAtualizado.menu_item_id,
      status: pedidoAtualizado.status,
      notas: pedidoAtualizado.notas,
      price: pedidoAtualizado.price,
      created_at: pedidoAtualizado.created_at,
    };

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").pedidoAtualizado(respostaPedido);

    res.json(respostaPedido);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Eliminar pedido
roteador.delete("/:id", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const validacao = validateUUID(id);
    if (!validacao.isValid) {
      return res.status(400).json(validacao.error);
    }

    const resultado = await pool.query(
      "DELETE FROM order_items WHERE id = $1::uuid RETURNING *",
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const idEliminado = resultado.rows[0].id;

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").pedidoEliminado(idEliminado);

    res.json({
      message: "Pedido eliminado com sucesso",
      deletedOrder: {
        $id: idEliminado,
        id: idEliminado,
      },
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

module.exports = roteador;
