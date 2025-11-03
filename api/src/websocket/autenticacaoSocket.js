const jwt = require("jsonwebtoken");
const pool = require("../../db");
const { SEGREDO_JWT } = require("../configuracao/constantes");
const { validateUUID } = require("../../uuid-validation");

// Middleware de autenticação WebSocket
const intermediarioAutenticacaoSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Token de autenticação obrigatório"));
    }

    // Verificar token JWT
    jwt.verify(token, SEGREDO_JWT, async (err, descodificado) => {
      if (err) {
        return next(new Error("Token inválido ou expirado"));
      }

      // Validar UUID do utilizador
      const validacao = validateUUID(descodificado.userId, "userId");
      if (!validacao.isValid) {
        return next(new Error("ID de utilizador inválido no token"));
      }

      // Obter dados atualizados do utilizador
      const resultadoUtilizador = await pool.query(
        "SELECT id, email, username, name, labels FROM users WHERE id = $1::uuid",
        [descodificado.userId]
      );

      if (resultadoUtilizador.rows.length === 0) {
        return next(new Error("Utilizador não encontrado"));
      }

      socket.utilizador = resultadoUtilizador.rows[0];
      socket.eGestor = (socket.utilizador.labels || []).includes("manager");
      next();
    });
  } catch (erro) {
    console.error("Erro de autenticação WebSocket:", erro);
    next(new Error("Erro de autenticação"));
  }
};

module.exports = intermediarioAutenticacaoSocket;
