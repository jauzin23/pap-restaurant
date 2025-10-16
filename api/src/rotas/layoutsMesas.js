const express = require("express");
const pool = require("../../db");
const { validateUUID } = require("../../uuid-validation");
const { autenticarToken, requerGestor } = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");

const roteador = express.Router();

// Obter todos os layouts de mesas
roteador.get("/", autenticarToken, async (req, res) => {
  try {
    const layouts = await pool.query(`
      SELECT * FROM table_layouts
      ORDER BY created_at DESC
    `);

    // Adicionar mesas a cada layout
    for (let layout of layouts.rows) {
      const mesas = await pool.query(
        `
        SELECT * FROM tables
        WHERE layout_id = $1::uuid
        ORDER BY table_number ASC
      `,
        [layout.id]
      );

      layout.tables = mesas.rows;
    }

    res.json(layouts.rows);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Obter layout de mesas específico
roteador.get("/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar formato UUID
    const validacao = validateUUID(id);
    if (!validacao.isValid) {
      return res.status(400).json(validacao.error);
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
    const mesas = await pool.query(
      `
      SELECT * FROM tables
      WHERE layout_id = $1::uuid
      ORDER BY table_number ASC
    `,
      [id]
    );

    const layoutComMesas = layout.rows[0];
    layoutComMesas.tables = mesas.rows;

    res.json(layoutComMesas);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Criar novo layout de mesas
roteador.post("/", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { name, width, height } = req.body;

    if (!name || !width || !height) {
      return res
        .status(400)
        .json({ error: "Nome, largura e altura obrigatórios" });
    }

    const resultado = await pool.query(
      `
      INSERT INTO table_layouts (name, width, height, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `,
      [name, width, height]
    );

    const novoLayout = resultado.rows[0];

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").layoutCriado(novoLayout);

    res.json(novoLayout);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Atualizar layout de mesas
roteador.put("/:id", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar formato UUID
    const validacao = validateUUID(id);
    if (!validacao.isValid) {
      return res.status(400).json(validacao.error);
    }

    const { name, width, height } = req.body;

    if (!name || !width || !height) {
      return res
        .status(400)
        .json({ error: "Nome, largura e altura obrigatórios" });
    }

    const resultado = await pool.query(
      `
      UPDATE table_layouts
      SET name = $1, width = $2, height = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4::uuid
      RETURNING *
    `,
      [name, width, height, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Layout não encontrado" });
    }

    const layoutAtualizado = resultado.rows[0];

    // Obter mesas para este layout
    const resultadoMesas = await pool.query(
      `
      SELECT * FROM tables
      WHERE layout_id = $1::uuid
      ORDER BY table_number ASC
    `,
      [id]
    );

    const mesas = resultadoMesas.rows.map((mesa) => ({
      id: mesa.id.toString(),
      number: mesa.table_number,
      x: mesa.x,
      y: mesa.y,
      width: mesa.width,
      height: mesa.height,
      shape: mesa.shape,
      chairs: mesa.chairs_count,
      chairsConfig: {
        top: mesa.chairs_top,
        bottom: mesa.chairs_bottom,
        left: mesa.chairs_left,
        right: mesa.chairs_right,
      },
    }));

    const respostaLayout = {
      id: layoutAtualizado.id.toString(),
      name: layoutAtualizado.name,
      width: layoutAtualizado.width,
      height: layoutAtualizado.height,
      tables: mesas,
    };

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").layoutAtualizado(respostaLayout);

    res.json(respostaLayout);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Eliminar layout de mesas
roteador.delete("/:id", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar formato UUID
    const validacao = validateUUID(id);
    if (!validacao.isValid) {
      return res.status(400).json(validacao.error);
    }

    // Iniciar transação
    await pool.query("BEGIN");

    try {
      // Eliminar todas as mesas neste layout primeiro
      await pool.query("DELETE FROM tables WHERE layout_id = $1::uuid", [id]);

      // Eliminar o layout
      const resultado = await pool.query(
        "DELETE FROM table_layouts WHERE id = $1::uuid RETURNING *",
        [id]
      );

      if (resultado.rows.length === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ error: "Layout não encontrado" });
      }

      await pool.query("COMMIT");

      // Emitir evento WebSocket
      req.app.get("emissoresClientes").layoutEliminado(id);

      res.json({
        message: "Layout e todas as suas mesas eliminados com sucesso",
      });
    } catch (erro) {
      await pool.query("ROLLBACK");
      throw erro;
    }
  } catch (erro) {
    tratarErro(erro, res);
  }
});

module.exports = roteador;
