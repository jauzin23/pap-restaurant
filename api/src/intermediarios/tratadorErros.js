// Middleware de tratamento de erros
const tratarErro = (erro, res) => {
  console.error("Erro de base de dados:", erro);
  res.status(500).json({ error: "Erro interno do servidor" });
};

module.exports = tratarErro;
