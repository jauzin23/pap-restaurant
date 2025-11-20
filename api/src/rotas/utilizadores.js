const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../../db");
const {
  autenticarToken,
  requerGestor,
} = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");

const router = express.Router();

// Criar novo utilizador (apenas gestores)
router.post("/", autenticarToken, requerGestor, async (req, res) => {
  try {
    const {
      email,
      username,
      password,
      name,
      telefone,
      nif,
      contrato,
      hrs,
      ferias,
      labels,
      profile_image,
    } = req.body;

    // Validar campos obrigatórios
    if (!email || !username || !password || !name) {
      return res.status(400).json({
        error: "Email, username, password e name são obrigatórios",
      });
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Formato de email inválido" });
    }

    // Validar comprimento da password
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password deve ter pelo menos 6 caracteres",
      });
    }

    // Verificar se email ou username já existem
    const verificarExistente = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (verificarExistente.rows.length > 0) {
      return res.status(409).json({
        error: "Email ou username já estão em uso",
      });
    }

    // Hash da password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Inserir novo utilizador
    const resultado = await pool.query(
      `INSERT INTO users (
        email, username, password_hash, name, telefone, "NIF",
        contrato, hrs, ferias, labels, profile_image
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, email, username, name, labels, profile_image, created_at,
                telefone, status, contrato, hrs, "NIF", ferias`,
      [
        email,
        username,
        passwordHash,
        name,
        telefone || null,
        nif || null,
        contrato || null,
        hrs || null,
        ferias || null,
        labels || [],
        profile_image || null,
      ]
    );

    const novoUtilizador = resultado.rows[0];

    const respostaUtilizador = {
      $id: novoUtilizador.id,
      ...novoUtilizador,
      nif: novoUtilizador.NIF,
      labels: novoUtilizador.labels || [],
    };

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").utilizadorCriado(respostaUtilizador);

    res.status(201).json({
      ...respostaUtilizador,
      message: "Utilizador criado com sucesso",
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

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
      labels,
      profile_image,
    } = req.body;

    // Verificar se o utilizador existe e obter as labels
    const verificarUtilizador = await pool.query(
      "SELECT labels FROM users WHERE id = $1",
      [req.utilizador.userId]
    );

    if (verificarUtilizador.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Utilizador autenticado não encontrado" });
    }

    const labelsUtilizador = verificarUtilizador.rows[0].labels || [];
    const eGestor = labelsUtilizador.includes("manager");
    const eProprioUtilizador = req.utilizador.userId === id;

    // Verificar permissões: apenas gestores ou o próprio utilizador podem editar
    if (!eGestor && !eProprioUtilizador) {
      return res.status(403).json({
        error:
          "Acesso negado. Apenas gestores ou o próprio utilizador podem editar.",
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
      profile_image,
    };

    // Campos que apenas gestores podem editar
    const camposGestor = {
      contrato,
      hrs,
      ferias,
      labels,
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
          // Only quote NIF, other fields don't need quotes
          const campoSQL = campo === "NIF" ? `"${campo}"` : campo;
          camposAtualizar.push(`${campoSQL} = $${indiceParametro}`);
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
          // Only quote NIF, other fields don't need quotes
          const campoSQL = campo === "NIF" ? `"${campo}"` : campo;
          camposAtualizar.push(`${campoSQL} = $${indiceParametro}`);
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
          error:
            "Acesso negado. Apenas gestores podem editar contrato, hrs, férias e labels.",
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

    const respostaUtilizador = {
      $id: utilizadorAtualizado.id,
      ...utilizadorAtualizado,
      nif: utilizadorAtualizado.NIF,
      labels: utilizadorAtualizado.labels || [],
    };

    // Emitir evento WebSocket
    req.app.get("emissoresClientes").utilizadorAtualizado(respostaUtilizador);

    res.json({
      ...respostaUtilizador,
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

// Eliminar utilizador (apenas gestores)
router.delete("/:id", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o utilizador existe
    const verificarUtilizador = await pool.query(
      "SELECT id, email, username FROM users WHERE id = $1",
      [id]
    );

    if (verificarUtilizador.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    // Impedir que o gestor se elimine a si próprio
    if (req.utilizador.userId === id) {
      return res.status(403).json({
        error: "Não pode eliminar a sua própria conta",
      });
    }

    // Usar uma transação para garantir que todas as operações são executadas
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Atualizar referências em vez de eliminar (SET NULL onde permitido)
      // Payments - processed_by
      try {
        await client.query(
          "UPDATE payments SET processed_by = NULL WHERE processed_by = $1",
          [id]
        );
      } catch (e) {
        console.log("Payments update skipped:", e.message);
      }

      // Order items - aceite_por, preparado_por, entregue_por, a_ser_entregue_por
      try {
        await client.query(
          "UPDATE order_items SET aceite_por = NULL WHERE aceite_por = $1",
          [id]
        );
      } catch (e) {
        console.log("Order items aceite_por update skipped:", e.message);
      }

      try {
        await client.query(
          "UPDATE order_items SET preparado_por = NULL WHERE preparado_por = $1",
          [id]
        );
      } catch (e) {
        console.log("Order items preparado_por update skipped:", e.message);
      }

      try {
        await client.query(
          "UPDATE order_items SET entregue_por = NULL WHERE entregue_por = $1",
          [id]
        );
      } catch (e) {
        console.log("Order items entregue_por update skipped:", e.message);
      }

      try {
        await client.query(
          "UPDATE order_items SET a_ser_entregue_por = NULL WHERE a_ser_entregue_por = $1",
          [id]
        );
      } catch (e) {
        console.log(
          "Order items a_ser_entregue_por update skipped:",
          e.message
        );
      }

      // Paid order items - aceite_por, preparado_por, entregue_por, a_ser_entregue_por
      try {
        await client.query(
          "UPDATE paid_order_items SET aceite_por = NULL WHERE aceite_por = $1",
          [id]
        );
      } catch (e) {
        console.log("Paid order items aceite_por update skipped:", e.message);
      }

      try {
        await client.query(
          "UPDATE paid_order_items SET preparado_por = NULL WHERE preparado_por = $1",
          [id]
        );
      } catch (e) {
        console.log(
          "Paid order items preparado_por update skipped:",
          e.message
        );
      }

      try {
        await client.query(
          "UPDATE paid_order_items SET entregue_por = NULL WHERE entregue_por = $1",
          [id]
        );
      } catch (e) {
        console.log("Paid order items entregue_por update skipped:", e.message);
      }

      try {
        await client.query(
          "UPDATE paid_order_items SET a_ser_entregue_por = NULL WHERE a_ser_entregue_por = $1",
          [id]
        );
      } catch (e) {
        console.log(
          "Paid order items a_ser_entregue_por update skipped:",
          e.message
        );
      }

      // Points history
      try {
        await client.query(
          "DELETE FROM user_points_history WHERE user_id = $1",
          [id]
        );
      } catch (e) {
        console.log("Points history delete skipped:", e.message);
      }

      // Attendance records (se existir)
      try {
        await client.query("DELETE FROM attendance WHERE user_id = $1", [id]);
      } catch (e) {
        console.log("Attendance delete skipped:", e.message);
      }

      // Eliminar o utilizador
      await client.query("DELETE FROM users WHERE id = $1", [id]);

      await client.query("COMMIT");
      client.release();

      // Emitir evento WebSocket
      req.app.get("emissoresClientes").utilizadorEliminado(id);

      res.json({
        message: "Utilizador eliminado com sucesso",
        userId: id,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      client.release();
      throw error;
    }
  } catch (erro) {
    tratarErro(erro, res);
  }
});

module.exports = router;
