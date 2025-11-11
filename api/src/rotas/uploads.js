const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const pool = require("../../db");
const {
  autenticarToken,
  requerGestor,
} = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");
const { removeBackground } = require("@imgly/background-removal-node");
const {
  uploadToS3,
  deleteFromS3,
  getContentType,
  getPublicUrl,
  getPresignedUrl,
  streamFromS3,
} = require("../utilitarios/s3");

const router = express.Router();

// Servir imagem do S3
router.get("/files/:pasta/:ficheiro", async (req, res) => {
  try {
    const { pasta, ficheiro } = req.params;

    // Validar pasta
    const pastasValidas = ["imagens-menu", "imagens-perfil", "imagens-stock"];
    if (!pastasValidas.includes(pasta)) {
      return res.status(400).json({ error: "Pasta inválida" });
    }

    const s3Key = `${pasta}/${ficheiro}`;

    // Obter URL pública do S3
    const url = getPublicUrl(s3Key);

    // Redirecionar para a URL do S3
    res.redirect(url);
  } catch (erro) {
    console.error("[UPLOAD] Erro ao servir ficheiro:", erro);
    res.status(500).json({ error: "Erro ao servir ficheiro" });
  }
});

// Upload de imagem de perfil
router.post("/profile-image", autenticarToken, async (req, res) => {
  try {
    const { imageData, userId } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: "Dados da imagem obrigatórios" });
    }

    // Determinar qual utilizador vai ter a imagem atualizada
    const idAlvo = userId || req.utilizador.userId;

    // Verificar permissões
    // Obter labels do utilizador autenticado
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
    const eProprioUtilizador = req.utilizador.userId === idAlvo;

    // Verificar se pode editar: apenas o próprio utilizador ou gestor
    if (!eGestor && !eProprioUtilizador) {
      return res.status(403).json({
        error:
          "Acesso negado. Apenas pode alterar a sua própria imagem de perfil ou se for gestor.",
      });
    }

    // Verificar se o utilizador alvo existe
    const utilizadorAlvo = await pool.query(
      "SELECT id, profile_image FROM users WHERE id = $1",
      [idAlvo]
    );

    if (utilizadorAlvo.rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    const imagemAnterior = utilizadorAlvo.rows[0].profile_image;

    // Remover prefixo de data URL se presente
    const dadosBase64 = imageData.replace(/^data:image\/[^;]+;base64,/, "");

    // Criar hash do conteúdo da imagem para garantir unicidade
    const hashImagem = crypto
      .createHash("sha256")
      .update(dadosBase64)
      .digest("hex")
      .substring(0, 16);

    // Gerar componente aleatório adicional
    const randomString = crypto.randomBytes(8).toString("hex");

    // Detectar tipo de imagem do data URL (se presente)
    let extensaoFicheiro = ".jpg"; // Default
    let contentType = "image/jpeg"; // Default
    const matchTipo = imageData.match(/^data:image\/([^;]+);base64,/);
    if (matchTipo) {
      const tipoImagem = matchTipo[1];
      // Mapear tipos MIME para extensões
      const extensoes = {
        jpeg: ".jpg",
        jpg: ".jpg",
        png: ".png",
        gif: ".gif",
        webp: ".webp",
      };
      extensaoFicheiro = extensoes[tipoImagem] || ".jpg";
      contentType = `image/${tipoImagem}`;
    }

    // Gerar nome de ficheiro único com timestamp, hash e random
    const nomeFicheiroUnico = `${Date.now()}_${hashImagem}_${randomString}${extensaoFicheiro}`;

    // Chave S3 (caminho no bucket)
    const s3Key = `imagens-perfil/${nomeFicheiroUnico}`;

    // Converter base64 para buffer
    const bufferImagem = Buffer.from(dadosBase64, "base64");

    // Upload para S3
    const { url } = await uploadToS3(bufferImagem, s3Key, contentType);

    // Atualizar imagem de perfil do utilizador na base de dados
    await pool.query("UPDATE users SET profile_image = $1 WHERE id = $2", [
      nomeFicheiroUnico,
      idAlvo,
    ]);

    // Eliminar imagem anterior do S3 se existir
    if (imagemAnterior) {
      try {
        const s3KeyAnterior = `imagens-perfil/${imagemAnterior}`;
        await deleteFromS3(s3KeyAnterior);
        console.log(
          `[UPLOAD] Imagem anterior eliminada do S3: ${s3KeyAnterior}`
        );
      } catch (erro) {
        console.error("Erro ao eliminar imagem anterior do S3:", erro);
        // Continuar mesmo se falhar a eliminação da imagem anterior
      }
    }

    res.json({
      filename: nomeFicheiroUnico,
      url: url,
      message: "Imagem de perfil carregada com sucesso",
      userId: idAlvo,
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Upload de imagem de menu
router.post("/menu-image", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { imageData, filename } = req.body;

    console.log("[UPLOAD] Recebido pedido de upload de imagem de menu");
    console.log("[UPLOAD] Filename:", filename);
    console.log("[UPLOAD] ImageData presente:", !!imageData);
    console.log("[UPLOAD] ImageData length:", imageData ? imageData.length : 0);

    if (!imageData) {
      return res.status(400).json({ error: "Dados da imagem obrigatórios" });
    }

    // Remover prefixo de data URL se presente
    const dadosBase64 = imageData.replace(/^data:image\/[^;]+;base64,/, "");
    console.log(
      "[UPLOAD] Base64 após remover prefixo, length:",
      dadosBase64.length
    );

    // Criar hash do conteúdo da imagem para garantir unicidade
    const hashImagem = crypto
      .createHash("sha256")
      .update(dadosBase64)
      .digest("hex")
      .substring(0, 16);

    // Gerar componente aleatório adicional
    const randomString = crypto.randomBytes(8).toString("hex");

    // Detectar tipo de imagem
    let extensaoFicheiro = filename ? path.extname(filename) : ".jpg";
    let contentType = "image/jpeg"; // Default
    const matchTipo = imageData.match(/^data:image\/([^;]+);base64,/);
    if (matchTipo) {
      const tipoImagem = matchTipo[1];
      contentType = `image/${tipoImagem}`;
    }

    // Gerar nome de ficheiro único com timestamp, hash e random
    const nomeFicheiroUnico = `${Date.now()}_${hashImagem}_${randomString}${extensaoFicheiro}`;

    // Chave S3 (caminho no bucket)
    const s3Key = `imagens-menu/${nomeFicheiroUnico}`;

    // Converter base64 para buffer
    const bufferImagem = Buffer.from(dadosBase64, "base64");

    console.log("[UPLOAD] Fazendo upload para S3:", s3Key);

    // Upload para S3
    const { url } = await uploadToS3(bufferImagem, s3Key, contentType);
    console.log("[UPLOAD] Upload para S3 concluído com sucesso!");

    res.json({
      $id: nomeFicheiroUnico,
      filename: nomeFicheiroUnico,
      url: url,
      message: "Imagem de menu carregada com sucesso",
    });
  } catch (erro) {
    console.error("[UPLOAD] Erro ao fazer upload:", erro);
    tratarErro(erro, res);
  }
});

// Upload de imagem de stock
router.post("/stock-image", autenticarToken, requerGestor, async (req, res) => {
  try {
    const { imageData, filename } = req.body;

    console.log("[UPLOAD] Recebido pedido de upload de imagem de stock");
    console.log("[UPLOAD] Filename:", filename);
    console.log("[UPLOAD] ImageData presente:", !!imageData);

    if (!imageData) {
      return res.status(400).json({ error: "Dados da imagem obrigatórios" });
    }

    // Remover prefixo de data URL se presente
    const dadosBase64 = imageData.replace(/^data:image\/[^;]+;base64,/, "");

    // Criar hash do conteúdo da imagem
    const hashImagem = crypto
      .createHash("sha256")
      .update(dadosBase64)
      .digest("hex")
      .substring(0, 16);

    // Gerar componente aleatório
    const randomString = crypto.randomBytes(8).toString("hex");

    // Detectar tipo de imagem
    let extensaoFicheiro = filename ? path.extname(filename) : ".jpg";
    let contentType = "image/jpeg";
    const matchTipo = imageData.match(/^data:image\/([^;]+);base64,/);
    if (matchTipo) {
      const tipoImagem = matchTipo[1];
      contentType = `image/${tipoImagem}`;
    }

    // Gerar nome de ficheiro único
    const nomeFicheiroUnico = `${Date.now()}_${hashImagem}_${randomString}${extensaoFicheiro}`;

    // Chave S3
    const s3Key = `imagens-stock/${nomeFicheiroUnico}`;

    // Converter base64 para buffer
    const bufferImagem = Buffer.from(dadosBase64, "base64");

    console.log("[UPLOAD] Fazendo upload para S3:", s3Key);

    // Upload para S3
    const { url } = await uploadToS3(bufferImagem, s3Key, contentType);
    console.log("[UPLOAD] Upload para S3 concluído com sucesso!");

    res.json({
      $id: nomeFicheiroUnico,
      filename: nomeFicheiroUnico,
      url: url,
      message: "Imagem de stock carregada com sucesso",
    });
  } catch (erro) {
    console.error("[UPLOAD] Erro ao fazer upload:", erro);
    tratarErro(erro, res);
  }
});

// Remover fundo de imagem
router.post("/remove-background", autenticarToken, async (req, res) => {
  let s3KeyTemp = null;
  let ficheiroTempLocal = null;

  try {
    const { imageData } = req.body;

    console.log("[REMOVE-BG] Recebido pedido de remoção de fundo");
    console.log("[REMOVE-BG] ImageData presente:", !!imageData);

    if (!imageData) {
      return res.status(400).json({ error: "Dados da imagem obrigatórios" });
    }

    // Log do tamanho original
    console.log("[REMOVE-BG] Tamanho total do imageData:", imageData.length);
    console.log(
      "[REMOVE-BG] Primeiros 100 chars:",
      imageData.substring(0, 100)
    );

    // Extrair tipo de imagem e dados base64
    let tipoImagem = "png";
    let dadosBase64;

    if (imageData.startsWith("data:image")) {
      // Extrair tipo de imagem do data URL
      const match = imageData.match(/^data:image\/([^;]+);base64,/);
      if (match) {
        tipoImagem = match[1];
        console.log("[REMOVE-BG] Tipo de imagem detectado:", tipoImagem);
      }
      // Remover prefixo de data URL
      dadosBase64 = imageData.replace(/^data:image\/[^;]+;base64,/, "");
    } else {
      // Já é base64 puro
      dadosBase64 = imageData;
    }

    console.log(
      "[REMOVE-BG] Tamanho do base64 após remoção do prefixo:",
      dadosBase64.length
    );

    const bufferImagem = Buffer.from(dadosBase64, "base64");
    console.log("[REMOVE-BG] Buffer criado, tamanho:", bufferImagem.length);

    // Validar se o buffer tem tamanho razoável
    if (bufferImagem.length < 1000) {
      console.error(
        "[REMOVE-BG] Buffer muito pequeno! Provavelmente dados inválidos."
      );
      return res.status(400).json({
        error: "Dados da imagem inválidos ou corrompidos",
        details: `Buffer size: ${bufferImagem.length} bytes`,
      });
    }

    // Upload temporário para S3
    const nomeFicheiroTemp = `temp_${Date.now()}_${
      req.utilizador.userId
    }.${tipoImagem}`;
    s3KeyTemp = `temp/${nomeFicheiroTemp}`;

    console.log("[REMOVE-BG] Fazendo upload temporário para S3:", s3KeyTemp);
    await uploadToS3(bufferImagem, s3KeyTemp, `image/${tipoImagem}`);

    // Criar ficheiro temporário local para o background-removal-node
    // (A biblioteca precisa de um ficheiro local)
    const os = require("os");
    const tempDir = os.tmpdir();
    ficheiroTempLocal = path.join(tempDir, nomeFicheiroTemp);

    console.log(
      "[REMOVE-BG] Criando ficheiro temporário local:",
      ficheiroTempLocal
    );
    await fs.writeFile(ficheiroTempLocal, bufferImagem);

    console.log("[REMOVE-BG] Iniciando remoção de fundo...");

    // Converter caminho do Windows para URL de ficheiro
    const { pathToFileURL } = require("url");
    const urlFicheiro = pathToFileURL(ficheiroTempLocal).href;
    console.log("[REMOVE-BG] URL do ficheiro:", urlFicheiro);

    // Remover fundo da imagem usando URL de ficheiro
    const blobResultado = await removeBackground(urlFicheiro);

    console.log("[REMOVE-BG] Fundo removido com sucesso!");

    // Converter Blob para Buffer
    const arrayBuffer = await blobResultado.arrayBuffer();
    const bufferResultado = Buffer.from(arrayBuffer);

    console.log(
      "[REMOVE-BG] Buffer de resultado criado, tamanho:",
      bufferResultado.length
    );

    // Eliminar ficheiro temporário local
    try {
      await fs.unlink(ficheiroTempLocal);
      console.log("[REMOVE-BG] Ficheiro temporário local eliminado");
    } catch (erro) {
      console.error(
        "[REMOVE-BG] Erro ao eliminar ficheiro temporário local:",
        erro
      );
    }

    // Eliminar ficheiro temporário do S3
    if (s3KeyTemp) {
      try {
        await deleteFromS3(s3KeyTemp);
        console.log("[REMOVE-BG] Ficheiro temporário eliminado do S3");
      } catch (erro) {
        console.error(
          "[REMOVE-BG] Erro ao eliminar ficheiro temporário do S3:",
          erro
        );
      }
    }

    // Converter para base64
    const imagemBase64 = bufferResultado.toString("base64");
    const dataUrl = `data:image/png;base64,${imagemBase64}`;

    console.log("[REMOVE-BG] Conversão para base64 concluída");

    res.json({
      imageData: dataUrl,
      message: "Fundo removido com sucesso",
    });
  } catch (erro) {
    console.error("[REMOVE-BG] Erro ao remover fundo:", erro);

    // Tentar eliminar ficheiro temporário local em caso de erro
    if (ficheiroTempLocal) {
      try {
        await fs.unlink(ficheiroTempLocal);
      } catch (e) {
        // Ignorar erro na eliminação
      }
    }

    // Tentar eliminar ficheiro temporário do S3 em caso de erro
    if (s3KeyTemp) {
      try {
        await deleteFromS3(s3KeyTemp);
      } catch (e) {
        // Ignorar erro na eliminação
      }
    }

    tratarErro(erro, res);
  }
});

// Eliminar ficheiro
router.delete(
  "/:pasta/:ficheiro",
  autenticarToken,
  requerGestor,
  async (req, res) => {
    try {
      const { pasta, ficheiro } = req.params;

      // Apenas permitir eliminação de pastas autorizadas
      if (
        ![
          "imagens-menu",
          "imagens-perfil",
          "menu-images",
          "profile-images",
        ].includes(pasta)
      ) {
        return res.status(400).json({ error: "Pasta inválida" });
      }

      // Normalizar nome da pasta para o padrão usado no S3
      const pastaNormalizada = pasta
        .replace("menu-images", "imagens-menu")
        .replace("profile-images", "imagens-perfil");
      const s3Key = `${pastaNormalizada}/${ficheiro}`;

      console.log(`[UPLOAD] Eliminando ficheiro do S3: ${s3Key}`);

      try {
        await deleteFromS3(s3Key);
        res.json({ message: "Ficheiro eliminado com sucesso" });
      } catch (erro) {
        console.error("[UPLOAD] Erro ao eliminar do S3:", erro);
        res.status(404).json({ error: "Ficheiro não encontrado" });
      }
    } catch (erro) {
      tratarErro(erro, res);
    }
  }
);

module.exports = router;
