const express = require("express");
const pool = require("../../db");
const { validateUUID } = require("../../uuid-validation");
const {
  autenticarToken,
  requerGestor,
} = require("../intermediarios/autenticacao");
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
        m.category as menu_category,
        u_aceite.name as aceite_por_nome,
        u_aceite.profile_image as aceite_por_imagem,
        u_preparado.name as preparado_por_nome,
        u_preparado.profile_image as preparado_por_imagem,
        u_a_ser_entregue.name as a_ser_entregue_por_nome,
        u_a_ser_entregue.profile_image as a_ser_entregue_por_imagem,
        u_entregue.name as entregue_por_nome,
        u_entregue.profile_image as entregue_por_imagem
      FROM order_items o
      LEFT JOIN menu m ON o.menu_item_id = m.id
      LEFT JOIN users u_aceite ON o.aceite_por = u_aceite.id
      LEFT JOIN users u_preparado ON o.preparado_por = u_preparado.id
      LEFT JOIN users u_a_ser_entregue ON o.a_ser_entregue_por = u_a_ser_entregue.id
      LEFT JOIN users u_entregue ON o.entregue_por = u_entregue.id
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
      aceite_por: pedido.aceite_por,
      aceite_a: pedido.aceite_a,
      preparado_por: pedido.preparado_por,
      preparado_a: pedido.preparado_a,
      a_ser_entregue_por: pedido.a_ser_entregue_por,
      a_ser_entregue_a: pedido.a_ser_entregue_a,
      entregue_por: pedido.entregue_por,
      entregue_a: pedido.entregue_a,
      // Informação do item de menu para exibição
      menu_info: {
        nome: pedido.menu_nome,
        preco: pedido.menu_preco,
        category: pedido.menu_category,
      },
      // Informação dos utilizadores que processaram o pedido
      aceite_por_user: pedido.aceite_por
        ? {
            nome: pedido.aceite_por_nome,
            profile_image: pedido.aceite_por_imagem,
          }
        : null,
      preparado_por_user: pedido.preparado_por
        ? {
            nome: pedido.preparado_por_nome,
            profile_image: pedido.preparado_por_imagem,
          }
        : null,
      a_ser_entregue_por_user: pedido.a_ser_entregue_por
        ? {
            nome: pedido.a_ser_entregue_por_nome,
            profile_image: pedido.a_ser_entregue_por_imagem,
          }
        : null,
      entregue_por_user: pedido.entregue_por
        ? {
            nome: pedido.entregue_por_nome,
            profile_image: pedido.entregue_por_imagem,
          }
        : null,
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
        m.category as menu_category,
        u_aceite.name as aceite_por_nome,
        u_aceite.profile_image as aceite_por_imagem,
        u_preparado.name as preparado_por_nome,
        u_preparado.profile_image as preparado_por_imagem,
        u_a_ser_entregue.name as a_ser_entregue_por_nome,
        u_a_ser_entregue.profile_image as a_ser_entregue_por_imagem,
        u_entregue.name as entregue_por_nome,
        u_entregue.profile_image as entregue_por_imagem
      FROM order_items o
      LEFT JOIN menu m ON o.menu_item_id = m.id
      LEFT JOIN users u_aceite ON o.aceite_por = u_aceite.id
      LEFT JOIN users u_preparado ON o.preparado_por = u_preparado.id
      LEFT JOIN users u_a_ser_entregue ON o.a_ser_entregue_por = u_a_ser_entregue.id
      LEFT JOIN users u_entregue ON o.entregue_por = u_entregue.id
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
      aceite_por: pedido.aceite_por,
      aceite_a: pedido.aceite_a,
      preparado_por: pedido.preparado_por,
      preparado_a: pedido.preparado_a,
      a_ser_entregue_por: pedido.a_ser_entregue_por,
      a_ser_entregue_a: pedido.a_ser_entregue_a,
      entregue_por: pedido.entregue_por,
      entregue_a: pedido.entregue_a,
      menu_info: {
        nome: pedido.menu_nome,
        preco: pedido.menu_preco,
        category: pedido.menu_category,
      },
      // Informação dos utilizadores que processaram o pedido
      aceite_por_user: pedido.aceite_por
        ? {
            nome: pedido.aceite_por_nome,
            profile_image: pedido.aceite_por_imagem,
          }
        : null,
      preparado_por_user: pedido.preparado_por
        ? {
            nome: pedido.preparado_por_nome,
            profile_image: pedido.preparado_por_imagem,
          }
        : null,
      a_ser_entregue_por_user: pedido.a_ser_entregue_por
        ? {
            nome: pedido.a_ser_entregue_por_nome,
            profile_image: pedido.a_ser_entregue_por_imagem,
          }
        : null,
      entregue_por_user: pedido.entregue_por
        ? {
            nome: pedido.entregue_por_nome,
            profile_image: pedido.entregue_por_imagem,
          }
        : null,
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
       RETURNING id`,
      [table_id, menu_item_id, notas || null, parseFloat(price)]
    );

    const novoPedidoId = resultado.rows[0].id;

    // Fetch the complete order with user info
    const pedidoCompleto = await pool.query(
      `SELECT
        o.*,
        u_aceite.name as aceite_por_nome,
        u_aceite.profile_image as aceite_por_imagem,
        u_preparado.name as preparado_por_nome,
        u_preparado.profile_image as preparado_por_imagem,
        u_a_ser_entregue.name as a_ser_entregue_por_nome,
        u_a_ser_entregue.profile_image as a_ser_entregue_por_imagem,
        u_entregue.name as entregue_por_nome,
        u_entregue.profile_image as entregue_por_imagem
      FROM order_items o
      LEFT JOIN users u_aceite ON o.aceite_por = u_aceite.id
      LEFT JOIN users u_preparado ON o.preparado_por = u_preparado.id
      LEFT JOIN users u_a_ser_entregue ON o.a_ser_entregue_por = u_a_ser_entregue.id
      LEFT JOIN users u_entregue ON o.entregue_por = u_entregue.id
      WHERE o.id = $1`,
      [novoPedidoId]
    );

    const novoPedido = pedidoCompleto.rows[0];

    const respostaPedido = {
      $id: novoPedido.id,
      id: novoPedido.id,
      table_id: novoPedido.table_id,
      menu_item_id: novoPedido.menu_item_id,
      status: novoPedido.status,
      notas: novoPedido.notas,
      price: novoPedido.price,
      created_at: novoPedido.created_at,
      aceite_por: novoPedido.aceite_por,
      aceite_a: novoPedido.aceite_a,
      preparado_por: novoPedido.preparado_por,
      preparado_a: novoPedido.preparado_a,
      a_ser_entregue_por: novoPedido.a_ser_entregue_por,
      a_ser_entregue_a: novoPedido.a_ser_entregue_a,
      entregue_por: novoPedido.entregue_por,
      entregue_a: novoPedido.entregue_a,
      aceite_por_user: novoPedido.aceite_por
        ? {
            nome: novoPedido.aceite_por_nome,
            profile_image: novoPedido.aceite_por_imagem,
          }
        : null,
      preparado_por_user: novoPedido.preparado_por
        ? {
            nome: novoPedido.preparado_por_nome,
            profile_image: novoPedido.preparado_por_imagem,
          }
        : null,
      a_ser_entregue_por_user: novoPedido.a_ser_entregue_por
        ? {
            nome: novoPedido.a_ser_entregue_por_nome,
            profile_image: novoPedido.a_ser_entregue_por_imagem,
          }
        : null,
      entregue_por_user: novoPedido.entregue_por
        ? {
            nome: novoPedido.entregue_por_nome,
            profile_image: novoPedido.entregue_por_imagem,
          }
        : null,
    };

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").pedidoCriado(respostaPedido);

    // Emitir estatísticas atualizadas
    const io = req.app.get("io");
    if (io) {
      const {
        emitirEstatisticasLive,
      } = require("../utilitarios/emitirEstatisticas");
      emitirEstatisticasLive(io).catch((err) =>
        console.error("Erro ao emitir estatísticas:", err)
      );
    }

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
           RETURNING id`,
          [
            pedido.table_id,
            pedido.menu_item_id,
            pedido.notas || null,
            parseFloat(pedido.price),
          ]
        );

        const novoPedidoId = resultado.rows[0].id;

        // Fetch the complete order with user info
        const pedidoCompleto = await pool.query(
          `SELECT
            o.*,
            u_aceite.name as aceite_por_nome,
            u_aceite.profile_image as aceite_por_imagem,
            u_preparado.name as preparado_por_nome,
            u_preparado.profile_image as preparado_por_imagem,
            u_a_ser_entregue.name as a_ser_entregue_por_nome,
            u_a_ser_entregue.profile_image as a_ser_entregue_por_imagem,
            u_entregue.name as entregue_por_nome,
            u_entregue.profile_image as entregue_por_imagem
          FROM order_items o
          LEFT JOIN users u_aceite ON o.aceite_por = u_aceite.id
          LEFT JOIN users u_preparado ON o.preparado_por = u_preparado.id
          LEFT JOIN users u_a_ser_entregue ON o.a_ser_entregue_por = u_a_ser_entregue.id
          LEFT JOIN users u_entregue ON o.entregue_por = u_entregue.id
          WHERE o.id = $1`,
          [novoPedidoId]
        );

        const novoPedido = pedidoCompleto.rows[0];

        pedidosCriados.push({
          $id: novoPedido.id,
          id: novoPedido.id,
          table_id: novoPedido.table_id,
          menu_item_id: novoPedido.menu_item_id,
          status: novoPedido.status,
          notas: novoPedido.notas,
          price: novoPedido.price,
          created_at: novoPedido.created_at,
          aceite_por: novoPedido.aceite_por,
          aceite_a: novoPedido.aceite_a,
          preparado_por: novoPedido.preparado_por,
          preparado_a: novoPedido.preparado_a,
          a_ser_entregue_por: novoPedido.a_ser_entregue_por,
          a_ser_entregue_a: novoPedido.a_ser_entregue_a,
          entregue_por: novoPedido.entregue_por,
          entregue_a: novoPedido.entregue_a,
          aceite_por_user: novoPedido.aceite_por
            ? {
                nome: novoPedido.aceite_por_nome,
                profile_image: novoPedido.aceite_por_imagem,
              }
            : null,
          preparado_por_user: novoPedido.preparado_por
            ? {
                nome: novoPedido.preparado_por_nome,
                profile_image: novoPedido.preparado_por_imagem,
              }
            : null,
          a_ser_entregue_por_user: novoPedido.a_ser_entregue_por
            ? {
                nome: novoPedido.a_ser_entregue_por_nome,
                profile_image: novoPedido.a_ser_entregue_por_imagem,
              }
            : null,
          entregue_por_user: novoPedido.entregue_por
            ? {
                nome: novoPedido.entregue_por_nome,
                profile_image: novoPedido.entregue_por_imagem,
              }
            : null,
        });
      }

      await pool.query("COMMIT");

      // Emitir eventos WebSocket para cada pedido criado
      const emissoresClientes = req.app.get("emissoresClientes");
      pedidosCriados.forEach((pedido) =>
        emissoresClientes.pedidoCriado(pedido)
      );

      // Emitir estatísticas atualizadas
      const io = req.app.get("io");
      if (io) {
        const {
          emitirEstatisticasLive,
        } = require("../utilitarios/emitirEstatisticas");
        emitirEstatisticasLive(io).catch((err) =>
          console.error("Erro ao emitir estatísticas:", err)
        );
      }

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
roteador.put("/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    let {
      status,
      notas,
      price,
      aceite_por,
      aceite_a,
      preparado_por,
      preparado_a,
      a_ser_entregue_por,
      a_ser_entregue_a,
      entregue_por,
      entregue_a,
    } = req.body;

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
      "pago",
    ];
    if (status && !estadosValidos.includes(status)) {
      return res.status(400).json({
        error: `Estado inválido. Deve ser um de: ${estadosValidos.join(", ")}`,
      });
    }

    // Ao mudar de estado, limpar campos que não são mais válidos
    // Se voltar para um estado anterior, os campos dos estados seguintes devem ser null
    if (status) {
      const estadoIndex = estadosValidos.indexOf(status);

      // Se mudou para "pendente", limpar tudo
      if (estadoIndex === 0) {
        aceite_por = null;
        aceite_a = null;
        preparado_por = null;
        preparado_a = null;
        a_ser_entregue_por = null;
        a_ser_entregue_a = null;
        entregue_por = null;
        entregue_a = null;
      }
      // Se mudou para "aceite", limpar apenas preparado, a ser entregue e entregue
      else if (estadoIndex === 1) {
        preparado_por = null;
        preparado_a = null;
        a_ser_entregue_por = null;
        a_ser_entregue_a = null;
        entregue_por = null;
        entregue_a = null;
      }
      // Se mudou para "pronto", limpar apenas a ser entregue e entregue
      else if (estadoIndex === 2) {
        a_ser_entregue_por = null;
        a_ser_entregue_a = null;
        entregue_por = null;
        entregue_a = null;
      }
      // Se mudou para "a ser entregue", limpar apenas entregue
      else if (estadoIndex === 3) {
        entregue_por = null;
        entregue_a = null;
      }
      // Se mudou para "entregue" ou "pago", manter tudo
    }

    // Validar preço se fornecido
    if (price !== undefined && isNaN(parseFloat(price))) {
      return res.status(400).json({
        error: "price deve ser um número válido",
      });
    }

    // Validar UUIDs de utilizador se fornecidos
    if (aceite_por) {
      const validacaoAceite = validateUUID(aceite_por, "aceite_por");
      if (!validacaoAceite.isValid) {
        return res.status(400).json(validacaoAceite.error);
      }
    }

    if (preparado_por) {
      const validacaoPreparado = validateUUID(preparado_por, "preparado_por");
      if (!validacaoPreparado.isValid) {
        return res.status(400).json(validacaoPreparado.error);
      }
    }

    if (a_ser_entregue_por) {
      const validacaoASerEntregue = validateUUID(
        a_ser_entregue_por,
        "a_ser_entregue_por"
      );
      if (!validacaoASerEntregue.isValid) {
        return res.status(400).json(validacaoASerEntregue.error);
      }
    }

    if (entregue_por) {
      const validacaoEntregue = validateUUID(entregue_por, "entregue_por");
      if (!validacaoEntregue.isValid) {
        return res.status(400).json(validacaoEntregue.error);
      }
    }

    // Build dynamic update query based on what fields are being updated
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (notas !== undefined) {
      updates.push(`notas = $${paramIndex}`);
      values.push(notas);
      paramIndex++;
    }

    if (price !== undefined) {
      updates.push(`price = $${paramIndex}`);
      values.push(parseFloat(price));
      paramIndex++;
    }

    // For user tracking fields, explicitly set to value or NULL (don't use COALESCE)
    if (aceite_por !== undefined) {
      updates.push(`aceite_por = $${paramIndex}::uuid`);
      values.push(aceite_por);
      paramIndex++;
    }

    if (aceite_a !== undefined) {
      updates.push(`aceite_a = $${paramIndex}::timestamptz`);
      values.push(aceite_a);
      paramIndex++;
    }

    if (preparado_por !== undefined) {
      updates.push(`preparado_por = $${paramIndex}::uuid`);
      values.push(preparado_por);
      paramIndex++;
    }

    if (preparado_a !== undefined) {
      updates.push(`preparado_a = $${paramIndex}::timestamptz`);
      values.push(preparado_a);
      paramIndex++;
    }

    if (a_ser_entregue_por !== undefined) {
      updates.push(`a_ser_entregue_por = $${paramIndex}::uuid`);
      values.push(a_ser_entregue_por);
      paramIndex++;
    }

    if (a_ser_entregue_a !== undefined) {
      updates.push(`a_ser_entregue_a = $${paramIndex}::timestamptz`);
      values.push(a_ser_entregue_a);
      paramIndex++;
    }

    if (entregue_por !== undefined) {
      updates.push(`entregue_por = $${paramIndex}::uuid`);
      values.push(entregue_por);
      paramIndex++;
    }

    if (entregue_a !== undefined) {
      updates.push(`entregue_a = $${paramIndex}::timestamptz`);
      values.push(entregue_a);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    // Buscar estado anterior do pedido para comparação
    const pedidoAnterior = await pool.query(
      `SELECT aceite_por, preparado_por, entregue_por, status FROM order_items WHERE id = $1`,
      [id]
    );

    const estadoAnterior = pedidoAnterior.rows[0];

    // Add WHERE clause parameter
    values.push(id);

    const resultado = await pool.query(
      `UPDATE order_items
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}::uuid
       RETURNING id`,
      values
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    // 🎯 SISTEMA DE PONTOS - Atribuir pontos por ações
    const {
      atribuirPontos,
      verificarBonusVelocidade,
      verificarBonusMilestones,
      penalizarCancelamento,
    } = require("../utilitarios/sistemaPontos");

    // Aceitar pedido (primeira vez)
    if (aceite_por && !estadoAnterior.aceite_por) {
      await atribuirPontos(aceite_por, "accept_order", id);
      await verificarBonusMilestones(aceite_por);
    }

    // Preparar pedido (primeira vez)
    if (preparado_por && !estadoAnterior.preparado_por) {
      await atribuirPontos(preparado_por, "prepare_order", id);
      await verificarBonusMilestones(preparado_por);
    }

    // Entregar pedido (primeira vez)
    if (entregue_por && !estadoAnterior.entregue_por) {
      await atribuirPontos(entregue_por, "deliver_order", id);
      await verificarBonusVelocidade(id, entregue_por);
      await verificarBonusMilestones(entregue_por);
    }

    // Cancelamento de pedido (penalização)
    if (
      status === "cancelado" &&
      estadoAnterior.status !== "cancelado" &&
      estadoAnterior.aceite_por
    ) {
      await penalizarCancelamento(estadoAnterior.aceite_por, id);
    }

    // Fetch the complete order with user info
    const pedidoCompleto = await pool.query(
      `SELECT
        o.*,
        u_aceite.name as aceite_por_nome,
        u_aceite.profile_image as aceite_por_imagem,
        u_preparado.name as preparado_por_nome,
        u_preparado.profile_image as preparado_por_imagem,
        u_a_ser_entregue.name as a_ser_entregue_por_nome,
        u_a_ser_entregue.profile_image as a_ser_entregue_por_imagem,
        u_entregue.name as entregue_por_nome,
        u_entregue.profile_image as entregue_por_imagem
      FROM order_items o
      LEFT JOIN users u_aceite ON o.aceite_por = u_aceite.id
      LEFT JOIN users u_preparado ON o.preparado_por = u_preparado.id
      LEFT JOIN users u_a_ser_entregue ON o.a_ser_entregue_por = u_a_ser_entregue.id
      LEFT JOIN users u_entregue ON o.entregue_por = u_entregue.id
      WHERE o.id = $1`,
      [id]
    );

    const pedidoAtualizado = pedidoCompleto.rows[0];

    const respostaPedido = {
      $id: pedidoAtualizado.id,
      id: pedidoAtualizado.id,
      table_id: pedidoAtualizado.table_id,
      menu_item_id: pedidoAtualizado.menu_item_id,
      status: pedidoAtualizado.status,
      notas: pedidoAtualizado.notas,
      price: pedidoAtualizado.price,
      created_at: pedidoAtualizado.created_at,
      aceite_por: pedidoAtualizado.aceite_por,
      aceite_a: pedidoAtualizado.aceite_a,
      preparado_por: pedidoAtualizado.preparado_por,
      preparado_a: pedidoAtualizado.preparado_a,
      a_ser_entregue_por: pedidoAtualizado.a_ser_entregue_por,
      a_ser_entregue_a: pedidoAtualizado.a_ser_entregue_a,
      entregue_por: pedidoAtualizado.entregue_por,
      entregue_a: pedidoAtualizado.entregue_a,
      aceite_por_user: pedidoAtualizado.aceite_por
        ? {
            nome: pedidoAtualizado.aceite_por_nome,
            profile_image: pedidoAtualizado.aceite_por_imagem,
          }
        : null,
      preparado_por_user: pedidoAtualizado.preparado_por
        ? {
            nome: pedidoAtualizado.preparado_por_nome,
            profile_image: pedidoAtualizado.preparado_por_imagem,
          }
        : null,
      a_ser_entregue_por_user: pedidoAtualizado.a_ser_entregue_por
        ? {
            nome: pedidoAtualizado.a_ser_entregue_por_nome,
            profile_image: pedidoAtualizado.a_ser_entregue_por_imagem,
          }
        : null,
      entregue_por_user: pedidoAtualizado.entregue_por
        ? {
            nome: pedidoAtualizado.entregue_por_nome,
            profile_image: pedidoAtualizado.entregue_por_imagem,
          }
        : null,
    };

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").pedidoAtualizado(respostaPedido);

    // Emitir estatísticas atualizadas
    const io = req.app.get("io");
    if (io) {
      const {
        emitirEstatisticasLive,
        emitirEstatisticasStaff,
        emitirTempoMedioResposta,
      } = require("../utilitarios/emitirEstatisticas");

      // Emitir em paralelo - staff stats também porque o utilizador processou o pedido
      // Emitir tempo médio se o pedido foi entregue (afeta kitchen efficiency)
      const promises = [
        emitirEstatisticasLive(io),
        emitirEstatisticasStaff(io),
      ];

      if (pedidoAtualizado.entregue_a) {
        promises.push(emitirTempoMedioResposta(io));
      }

      Promise.all(promises).catch((err) =>
        console.error("Erro ao emitir estatísticas:", err)
      );
    }

    res.json(respostaPedido);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Eliminar pedido
roteador.delete("/:id", autenticarToken, async (req, res) => {
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
