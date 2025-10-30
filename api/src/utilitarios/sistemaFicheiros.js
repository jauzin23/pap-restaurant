const fs = require("fs").promises;

const garantirDiretorioUploads = async () => {
  try {
    await fs.access("./uploads");
  } catch {
    await fs.mkdir("./uploads", { recursive: true });
  }

  // Garantir que os subdiretórios existem
  try {
    await fs.access("./uploads/imagens-perfil");
  } catch {
    await fs.mkdir("./uploads/imagens-perfil", { recursive: true });
  }

  try {
    await fs.access("./uploads/imagens-menu");
  } catch {
    await fs.mkdir("./uploads/imagens-menu", { recursive: true });
  }

  try {
    await fs.access("./uploads/imagens-stock");
  } catch {
    await fs.mkdir("./uploads/imagens-stock", { recursive: true });
  }
};

module.exports = { garantirDiretorioUploads };
