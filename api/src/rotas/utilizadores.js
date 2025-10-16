const express = require("express");
const pool = require("../../db");
const { autenticarToken, requerGestor } = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");

const router = express.Router();

// Obter todos os utilizadores (para lista de staff)
router.get("/", autenticarToken, async (req, res) => {
  try {
    const resultadoUtilizadores = await pool.query(`
      SELECT id, email, username, name, labels, profile_image, created_at,
             telefone, status, contrato, hrs, "NIF", ferias
      FROM users
      ORDER BY created_at DESC
    `);

    const utilizadores = resultadoUtilizadores.rows.map((utilizador) => ({
      $id: utilizador.id,
      id: utilizador.id,
      email: utilizador.email,
      username: utilizador.username,
      name: utilizador.name,
      labels: utilizador.labels || [],
      profile_image: utilizador.profile_image,
      created_at: utilizador.created_at,
      telefone: utilizador.telefone,
      status: utilizador.status,
      contrato: utilizador.contrato,
      hrs: utilizador.hrs,
      nif: utilizador.NIF,
      ferias: utilizador.ferias,
    }));

    res.json({ users: utilizadores });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Obter utilizador específico
router.get("/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const resultadoUtilizador = await pool.query(
      `SELECT id, email, username, name, labels, profile_image, created_at,
              telefone, status, contrato, hrs, "NIF", ferias
       FROM users WHERE id = $1`,
      [id]
    );

    if (resultadoUtilizador.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    const utilizador = resultadoUtilizador.rows[0];

    res.json({
      $id: utilizador.id,
      ...utilizador,
      nif: utilizador.NIF,
      labels: utilizador.labels || [],
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Atualizar utilizador
router.put("/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      username,
      telefone,
      nif,
      contrato,
      hrs,
      ferias,
    } = req.body;

    // Verificar se o utilizador existe e obter as labels
    const verificarUtilizador = await pool.query(
      "SELECT labels FROM users WHERE id = $1",
      [req.utilizador.userId]
    );

    if (verificarUtilizador.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador autenticado não encontrado" });
    }

    const labelsUtilizador = verificarUtilizador.rows[0].labels || [];
    const eGestor = labelsUtilizador.includes("manager");
    const eProprioUtilizador = req.utilizador.userId === id;

    // Verificar permissões: apenas gestores ou o próprio utilizador podem editar
    if (!eGestor && !eProprioUtilizador) {
      return res.status(403).json({
        error: "Acesso negado. Apenas gestores ou o próprio utilizador podem editar.",
      });
    }

    // Verificar se o utilizador alvo existe
    const utilizadorAlvo = await pool.query(
      "SELECT id FROM users WHERE id = $1",
      [id]
    );

    if (utilizadorAlvo.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    // Campos que qualquer utilizador pode editar (do próprio perfil)
    const camposBasicos = {
      name,
      email,
      username,
      telefone,
      NIF: nif,
    };

    // Campos que apenas gestores podem editar
    const camposGestor = {
      contrato,
      hrs,
      ferias,
    };

    // Construir query de atualização dinamicamente
    let camposAtualizar = [];
    let valoresAtualizar = [];
    let indiceParametro = 1;

    // Se for gestor, pode editar todos os campos
    if (eGestor) {
      // Adicionar campos básicos
      Object.entries(camposBasicos).forEach(([campo, valor]) => {
        if (valor !== undefined) {
          camposAtualizar.push(`"${campo}" = $${indiceParametro}`);
          valoresAtualizar.push(valor);
          indiceParametro++;
        }
      });

      // Adicionar campos exclusivos de gestor
      Object.entries(camposGestor).forEach(([campo, valor]) => {
        if (valor !== undefined) {
          camposAtualizar.push(`${campo} = $${indiceParametro}`);
          valoresAtualizar.push(valor);
          indiceParametro++;
        }
      });
    } else if (eProprioUtilizador) {
      // Se for o próprio utilizador, só pode editar campos básicos
      Object.entries(camposBasicos).forEach(([campo, valor]) => {
        if (valor !== undefined) {
          camposAtualizar.push(`"${campo}" = $${indiceParametro}`);
          valoresAtualizar.push(valor);
          indiceParametro++;
        }
      });

      // Verificar se tentou editar campos de gestor
      const tentouEditarCamposGestor = Object.values(camposGestor).some(
        (valor) => valor !== undefined
      );
      if (tentouEditarCamposGestor) {
        return res.status(403).json({
          error: "Acesso negado. Apenas gestores podem editar contrato, hrs e férias.",
        });
      }
    }

    // Se não há campos para atualizar
    if (camposAtualizar.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    // Adicionar ID como último parâmetro
    valoresAtualizar.push(id);

    // Executar atualização
    const queryAtualizar = `
      UPDATE users
      SET ${camposAtualizar.join(", ")}
      WHERE id = $${indiceParametro}
      RETURNING id, email, username, name, labels, profile_image, created_at,
                telefone, status, contrato, hrs, "NIF", ferias
    `;

    const resultado = await pool.query(queryAtualizar, valoresAtualizar);
    const utilizadorAtualizado = resultado.rows[0];

    res.json({
      $id: utilizadorAtualizado.id,
      ...utilizadorAtualizado,
      nif: utilizadorAtualizado.NIF,
      labels: utilizadorAtualizado.labels || [],
      message: "Utilizador atualizado com sucesso",
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Endpoint para obter bucket de perfil do utilizador
router.get("/:userId/profile-bucket", autenticarToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const resultadoUtilizador = await pool.query(
      "SELECT profile_image FROM users WHERE id = $1",
      [userId]
    );

    if (resultadoUtilizador.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    const imagemPerfil = resultadoUtilizador.rows[0].profile_image;

    if (imagemPerfil) {
      res.json({
        documents: [
          {
            bucket_id: imagemPerfil,
          },
        ],
      });
    } else {
      res.json({ documents: [] });
    }
  } catch (erro) {
    tratarErro(erro, res);
  }
});

module.exports = router;
