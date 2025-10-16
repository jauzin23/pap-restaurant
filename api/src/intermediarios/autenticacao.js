const jwt = require("jsonwebtoken");
const pool = require("../../db");
const { SEGREDO_JWT } = require("../configuracao/constantes");

// Middleware de autenticação
const autenticarToken = (req, res, next) => {
  const cabecalhoAuth = req.headers["authorization"];
  const token = cabecalhoAuth && cabecalhoAuth.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token de acesso obrigatório" });
  }

  jwt.verify(token, SEGREDO_JWT, (err, utilizador) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido ou expirado" });
    }
    req.utilizador = utilizador;
    next();
  });
};

// Middleware de autorização de gestor
const requerGestor = async (req, res, next) => {
  try {
    // Obter dados atualizados do utilizador da base de dados para garantir que as etiquetas estão atuais
    const resultadoUtilizador = await pool.query(
      "SELECT labels FROM users WHERE id = $1",
      [req.utilizador.userId]
    );

    if (resultadoUtilizador.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    const utilizador = resultadoUtilizador.rows[0];
    const etiquetas = utilizador.labels || [];

    // Verificar se o utilizador tem a etiqueta "manager"
    if (!etiquetas.includes("manager")) {
      return res.status(403).json({
        error: "Acesso negado. Privilégios de gestor obrigatórios.",
      });
    }

    next();
  } catch (erro) {
    console.error("Erro de autorização de gestor:", erro);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

module.exports = {
  autenticarToken,
  requerGestor,
};
