const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const pool = require("../../db");
const {
  autenticarToken,
  requerGestor,
} = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");

const router = express.Router();

// Obter menu completo
router.get("/", autenticarToken, async (req, res) => {
  try {
    const categoria = await pool.query("SELECT * from category");
    const menu = await pool.query(
      "SELECT * from menu ORDER BY created_at DESC"
    );
    const etiquetas = await pool.query("SELECT * from menu_tags");
    res.json({
      documents: menu.rows.map((item) => ({
        $id: item.id,
        $createdAt: item.created_at,
        ...item,
      })),
      category: categoria.rows,
      menu: menu.rows,
      tags: etiquetas.rows,
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Obter item de menu específico
router.get("/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query("SELECT * FROM menu WHERE id = $1", [
      id,
    ]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Item de menu não encontrado" });
    }

    const item = resultado.rows[0];

    res.json({
      $id: item.id,
      $createdAt: item.created_at,
      ...item,
      tags: item.tags || [],
      ingredientes: item.ingredientes || [],
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Criar item de menu
router.post("/", autenticarToken, async (req, res) => {
  try {
    const { nome, preco, description, category, tags, ingredientes, image_id } =
      req.body;

    if (!nome || !preco) {
      return res.status(400).json({ error: "Nome e preço obrigatórios" });
    }

    const resultado = await pool.query(
      `INSERT INTO menu (nome, preco, description, category, tags, ingredientes, image_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        nome,
        parseFloat(preco),
        description || null,
        category || null,
        tags && tags.length > 0 ? tags : null,
        ingredientes && ingredientes.length > 0 ? ingredientes : null,
        image_id || null,
      ]
    );

    const novoItem = resultado.rows[0];

    const respostaItem = {
      $id: novoItem.id,
      $createdAt: novoItem.created_at,
      ...novoItem,
      tags: novoItem.tags || [],
      ingredientes: novoItem.ingredientes || [],
    };

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").itemMenuCriado(respostaItem);

    res.json(respostaItem);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Atualizar item de menu
router.put("/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, preco, description, category, tags, ingredientes, image_id } =
      req.body;

    if (!nome || !preco) {
      return res.status(400).json({ error: "Nome e preço obrigatórios" });
    }

    // Buscar o item atual para comparar image_id
    const resultadoAntigo = await pool.query(
      "SELECT image_id FROM menu WHERE id = $1",
      [id]
    );
    if (resultadoAntigo.rows.length === 0) {
      return res.status(404).json({ error: "Item de menu não encontrado" });
    }
    const imageIdAntigo = resultadoAntigo.rows[0].image_id;

    // Atualizar o item
    const resultado = await pool.query(
      `UPDATE menu
       SET nome = $1, preco = $2, description = $3, category = $4, tags = $5, ingredientes = $6, image_id = $7
       WHERE id = $8
       RETURNING *`,
      [
        nome,
        parseFloat(preco),
        description || null,
        category || null,
        tags && tags.length > 0 ? tags : null,
        ingredientes && ingredientes.length > 0 ? ingredientes : null,
        image_id || null,
        id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Item de menu não encontrado" });
    }

    // Se o image_id mudou, eliminar a imagem antiga
    if (imageIdAntigo && imageIdAntigo !== image_id) {
      try {
        const caminhoImagemAntiga = path.join(
          __dirname,
          "../../uploads",
          "imagens-menu",
          imageIdAntigo
        );
        await fs.unlink(caminhoImagemAntiga);
      } catch (erro) {
        console.error("Erro ao eliminar imagem antiga:", erro);
      }
    }

    const itemAtualizado = resultado.rows[0];
    const respostaItem = {
      $id: itemAtualizado.id,
      $createdAt: itemAtualizado.created_at,
      ...itemAtualizado,
      tags: itemAtualizado.tags || [],
      ingredientes: itemAtualizado.ingredientes || [],
    };

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").itemMenuAtualizado(respostaItem);

    res.json(respostaItem);
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Eliminar item de menu
router.delete("/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Primeiro, obter o item para verificar se tem imagem
    const resultadoItem = await pool.query(
      "SELECT image_id FROM menu WHERE id = $1",
      [id]
    );

    if (resultadoItem.rows.length === 0) {
      return res.status(404).json({ error: "Item de menu não encontrado" });
    }

    const item = resultadoItem.rows[0];

    // Eliminar o ficheiro de imagem se existir
    if (item.image_id) {
      try {
        const caminhoImagem = path.join(
          __dirname,
          "../../uploads",
          "imagens-menu",
          item.image_id
        );
        await fs.unlink(caminhoImagem);
      } catch (erro) {
        console.error("Erro ao eliminar ficheiro de imagem:", erro);
        // Continuar com eliminação mesmo se a eliminação do ficheiro de imagem falhar
      }
    }

    // Eliminar o item de menu da base de dados
    await pool.query("DELETE FROM menu WHERE id = $1", [id]);

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").itemMenuEliminado(id);

    res.json({ message: "Item de menu eliminado com sucesso" });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

module.exports = router;
