const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const pool = require("../../db");
const { autenticarToken, requerGestor } = require("../intermediarios/autenticacao");
const tratarErro = require("../intermediarios/tratadorErros");
const { garantirDiretorioUploads } = require("../utilitarios/sistemaFicheiros");
const { removeBackground } = require("@imgly/background-removal-node");

const router = express.Router();

// Upload de imagem de perfil
router.post("/profile-image", autenticarToken, async (req, res) => {
  try {
    const { imageData, filename, userId } = req.body;

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
      return res.status(404).json({ error: "Utilizador autenticado não encontrado" });
    }

    const labelsUtilizador = verificarUtilizador.rows[0].labels || [];
    const eGestor = labelsUtilizador.includes("manager");
    const eProprioUtilizador = req.utilizador.userId === idAlvo;

    // Verificar se pode editar: apenas o próprio utilizador ou gestor
    if (!eGestor && !eProprioUtilizador) {
      return res.status(403).json({
        error: "Acesso negado. Apenas pode alterar a sua própria imagem de perfil ou se for gestor.",
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

    // Garantir que o diretório uploads existe
    await garantirDiretorioUploads();

    // Remover prefixo de data URL se presente
    const dadosBase64 = imageData.replace(/^data:image\/[^;]+;base64,/, "");

    // Gerar nome de ficheiro único
    const extensaoFicheiro = filename ? path.extname(filename) : ".jpg";
    const nomeFicheiroUnico = `${Date.now()}_${idAlvo}${extensaoFicheiro}`;
    const caminhoFicheiro = path.join(
      __dirname,
      "../../uploads",
      "imagens-perfil",
      nomeFicheiroUnico
    );

    // Guardar ficheiro
    await fs.writeFile(caminhoFicheiro, dadosBase64, "base64");

    // Atualizar imagem de perfil do utilizador na base de dados
    await pool.query("UPDATE users SET profile_image = $1 WHERE id = $2", [
      nomeFicheiroUnico,
      idAlvo,
    ]);

    // Eliminar imagem anterior se existir
    if (imagemAnterior) {
      try {
        const caminhoImagemAntiga = path.join(
          __dirname,
          "../../uploads",
          "imagens-perfil",
          imagemAnterior
        );
        await fs.unlink(caminhoImagemAntiga);
      } catch (erro) {
        console.error("Erro ao eliminar imagem anterior:", erro);
        // Continuar mesmo se falhar a eliminação da imagem anterior
      }
    }

    res.json({
      filename: nomeFicheiroUnico,
      url: `/files/imagens-perfil/${nomeFicheiroUnico}`,
      message: "Imagem de perfil carregada com sucesso",
      userId: idAlvo,
    });
  } catch (erro) {
    tratarErro(erro, res);
  }
});

// Upload de imagem de menu
router.post(
  "/menu-image",
  autenticarToken,
  requerGestor,
  async (req, res) => {
    try {
      const { imageData, filename } = req.body;

      console.log("[UPLOAD] Recebido pedido de upload de imagem de menu");
      console.log("[UPLOAD] Filename:", filename);
      console.log("[UPLOAD] ImageData presente:", !!imageData);
      console.log("[UPLOAD] ImageData length:", imageData ? imageData.length : 0);

      if (!imageData) {
        return res.status(400).json({ error: "Dados da imagem obrigatórios" });
      }

      // Garantir que o diretório uploads existe
      await garantirDiretorioUploads();
      console.log("[UPLOAD] Diretórios verificados/criados");

      // Remover prefixo de data URL se presente
      const dadosBase64 = imageData.replace(/^data:image\/[^;]+;base64,/, "");
      console.log("[UPLOAD] Base64 após remover prefixo, length:", dadosBase64.length);

      // Gerar nome de ficheiro único
      const extensaoFicheiro = filename ? path.extname(filename) : ".jpg";
      const nomeFicheiroUnico = `${Date.now()}_menu_${Math.random()
        .toString(36)
        .substr(2, 9)}${extensaoFicheiro}`;
      const caminhoFicheiro = path.join(
        __dirname,
        "../../uploads",
        "imagens-menu",
        nomeFicheiroUnico
      );

      console.log("[UPLOAD] Caminho do ficheiro:", caminhoFicheiro);

      // Guardar ficheiro
      await fs.writeFile(caminhoFicheiro, dadosBase64, "base64");
      console.log("[UPLOAD] Ficheiro guardado com sucesso!");

      res.json({
        $id: nomeFicheiroUnico,
        filename: nomeFicheiroUnico,
        url: `/files/imagens-menu/${nomeFicheiroUnico}`,
        message: "Imagem de menu carregada com sucesso",
      });
    } catch (erro) {
      console.error("[UPLOAD] Erro ao fazer upload:", erro);
      tratarErro(erro, res);
    }
  }
);

// Remover fundo de imagem
router.post("/remove-background", autenticarToken, async (req, res) => {
  let ficheiroTemp = null;

  try {
    const { imageData } = req.body;

    console.log("[REMOVE-BG] Recebido pedido de remoção de fundo");
    console.log("[REMOVE-BG] ImageData presente:", !!imageData);

    if (!imageData) {
      return res.status(400).json({ error: "Dados da imagem obrigatórios" });
    }

    // Garantir que o diretório uploads existe
    await garantirDiretorioUploads();

    // Log do tamanho original
    console.log("[REMOVE-BG] Tamanho total do imageData:", imageData.length);
    console.log("[REMOVE-BG] Primeiros 100 chars:", imageData.substring(0, 100));

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

    console.log("[REMOVE-BG] Tamanho do base64 após remoção do prefixo:", dadosBase64.length);

    const bufferImagem = Buffer.from(dadosBase64, "base64");
    console.log("[REMOVE-BG] Buffer criado, tamanho:", bufferImagem.length);

    // Validar se o buffer tem tamanho razoável
    if (bufferImagem.length < 1000) {
      console.error("[REMOVE-BG] Buffer muito pequeno! Provavelmente dados inválidos.");
      return res.status(400).json({
        error: "Dados da imagem inválidos ou corrompidos",
        details: `Buffer size: ${bufferImagem.length} bytes`
      });
    }

    // Criar ficheiro temporário
    const nomeFicheiroTemp = `temp_${Date.now()}_${req.utilizador.userId}.${tipoImagem}`;
    ficheiroTemp = path.join(__dirname, "../../uploads", nomeFicheiroTemp);

    console.log("[REMOVE-BG] Guardando ficheiro temporário:", ficheiroTemp);
    await fs.writeFile(ficheiroTemp, bufferImagem);

    console.log("[REMOVE-BG] Iniciando remoção de fundo...");

    // Converter caminho do Windows para URL de ficheiro
    const { pathToFileURL } = require("url");
    const urlFicheiro = pathToFileURL(ficheiroTemp).href;
    console.log("[REMOVE-BG] URL do ficheiro:", urlFicheiro);

    // Remover fundo da imagem usando URL de ficheiro
    const blobResultado = await removeBackground(urlFicheiro);

    console.log("[REMOVE-BG] Fundo removido com sucesso!");

    // Converter Blob para Buffer
    const arrayBuffer = await blobResultado.arrayBuffer();
    const bufferResultado = Buffer.from(arrayBuffer);

    console.log("[REMOVE-BG] Buffer de resultado criado, tamanho:", bufferResultado.length);

    // Eliminar ficheiro temporário
    try {
      await fs.unlink(ficheiroTemp);
      console.log("[REMOVE-BG] Ficheiro temporário eliminado");
    } catch (erro) {
      console.error("[REMOVE-BG] Erro ao eliminar ficheiro temporário:", erro);
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

    // Tentar eliminar ficheiro temporário em caso de erro
    if (ficheiroTemp) {
      try {
        await fs.unlink(ficheiroTemp);
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
      if (!["imagens-menu", "imagens-perfil", "menu-images", "profile-images"].includes(pasta)) {
        return res.status(400).json({ error: "Pasta inválida" });
      }

      const caminhoFicheiro = path.join(
        __dirname,
        "../../uploads",
        pasta,
        ficheiro
      );

      try {
        await fs.unlink(caminhoFicheiro);
        res.json({ message: "Ficheiro eliminado com sucesso" });
      } catch (erro) {
        if (erro.code === "ENOENT") {
          res.status(404).json({ error: "Ficheiro não encontrado" });
        } else {
          throw erro;
        }
      }
    } catch (erro) {
      tratarErro(erro, res);
    }
  }
);

module.exports = router;
