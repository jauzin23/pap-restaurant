const express = require("express");
const pool = require("../../db");
const { validateUUID } = require("../../uuid-validation");
const { autenticarToken, requerGestor } = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");

const roteador = express.Router();

// Obter todas as mesas (simplificado para página de pedidos)
roteador.get("/", autenticarToken, async (req, res) => {
  try {
    // Obter todas as mesas de todos os layouts para o sistema de pedidos
    const mesas = await pool.query(`
      SELECT
        t.id as "$id",
        t.id,
        t.table_number as "tableNumber",
        tl.name as layout_name
      FROM tables t
      LEFT JOIN table_layouts tl ON t.layout_id = tl.id
      ORDER BY t.table_number ASC
    `);

    res.json({ documents: mesas.rows });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Obter mesas de um layout
roteador.get("/layout/:layout_id", autenticarToken, async (req, res) => {
  try {
    const { layout_id } = req.params;

    // Validar formato UUID para layout_id
    const validacao = validateUUID(layout_id, "layout_id");
    if (!validacao.isValid) {
      return res.status(400).json(validacao.error);
    }

    const mesas = await pool.query(
      `
      SELECT * FROM tables
      WHERE layout_id = $1::uuid
      ORDER BY table_number ASC
    `,
      [layout_id]
    );

    res.json(mesas.rows);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Criar nova mesa
roteador.post("/", autenticarToken, requerGestor, async (req, res) => {
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
    const validacao = validateUUID(layout_id, "layout_id");
    if (!validacao.isValid) {
      return res.status(400).json(validacao.error);
    }

    // Verificar se o número da mesa é único dentro do layout
    const mesaExistente = await pool.query(
      `
      SELECT id FROM tables WHERE layout_id = $1::uuid AND table_number = $2
    `,
      [layout_id, table_number]
    );

    if (mesaExistente.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Número de mesa já existe neste layout" });
    }

    const resultado = await pool.query(
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

    const novaMesa = resultado.rows[0];

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").mesaCriada(novaMesa);

    res.json(novaMesa);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Atualizar mesa
roteador.put("/:id", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar formato UUID
    const validacao = validateUUID(id);
    if (!validacao.isValid) {
      return res.status(400).json(validacao.error);
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
      const infoMesa = await pool.query(
        "SELECT layout_id FROM tables WHERE id = $1::uuid",
        [id]
      );
      if (infoMesa.rows.length === 0) {
        return res.status(404).json({ error: "Mesa não encontrada" });
      }

      const mesaExistente = await pool.query(
        `
        SELECT id FROM tables WHERE layout_id = $1::uuid AND table_number = $2 AND id != $3::uuid
      `,
        [infoMesa.rows[0].layout_id, table_number, id]
      );

      if (mesaExistente.rows.length > 0) {
        return res
          .status(400)
          .json({ error: "Número de mesa já existe neste layout" });
      }
    }

    const resultado = await pool.query(
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

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Mesa não encontrada" });
    }

    const mesaAtualizada = resultado.rows[0];

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").mesaAtualizada(mesaAtualizada);

    res.json(mesaAtualizada);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Eliminar mesa
roteador.delete("/:id", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar formato UUID
    const validacao = validateUUID(id);
    if (!validacao.isValid) {
      return res.status(400).json(validacao.error);
    }

    const resultado = await pool.query(
      "DELETE FROM tables WHERE id = $1::uuid RETURNING *",
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Mesa não encontrada" });
    }

    const mesaEliminada = resultado.rows[0];

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").mesaEliminada(mesaEliminada.id, mesaEliminada.layout_id);

    res.json({ message: "Mesa eliminada com sucesso" });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

module.exports = roteador;
