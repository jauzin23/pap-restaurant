const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../db");
const { SEGREDO_JWT } = require("../configuracao/constantes");
const { autenticarToken } = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");

const router = express.Router();

// Endpoint de login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e password obrigatórios" });
    }

    // Procurar utilizador por email ou username
    const resultadoUtilizador = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR username = $1",
      [email]
    );

    if (resultadoUtilizador.rows.length === 0) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const utilizador = resultadoUtilizador.rows[0];

    // Verificar password
    const passwordValida = await bcrypt.compare(password, utilizador.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    // Gerar token JWT
    const token = jwt.sign(
      {
        userId: utilizador.id,
        email: utilizador.email,
        username: utilizador.username,
        labels: utilizador.labels || [],
      },
      SEGREDO_JWT,
      { expiresIn: "72h" }
    );

    // Retornar dados do utilizador (excluindo password)
    const { password_hash, ...utilizadorSemPassword } = utilizador;
    res.json({
      user: {
        ...utilizadorSemPassword,
        labels: utilizador.labels || [],
      },
      token,
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Endpoint para obter utilizador atual
router.get("/me", autenticarToken, async (req, res) => {
  try {
    const resultadoUtilizador = await pool.query(
      "SELECT id, email, username, name, labels, profile_image, created_at FROM users WHERE id = $1",
      [req.utilizador.userId]
    );

    if (resultadoUtilizador.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    const utilizador = resultadoUtilizador.rows[0];

    res.json({
      $id: utilizador.id,
      id: utilizador.id,
      email: utilizador.email,
      username: utilizador.username,
      name: utilizador.name,
      labels: utilizador.labels || [],
      profile_image: utilizador.profile_image,
      created_at: utilizador.created_at,
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Endpoint de logout (invalidação de token no lado do cliente)
router.post("/logout", autenticarToken, (req, res) => {
  res.json({ message: "Sessão terminada com sucesso" });
});

module.exports = router;
