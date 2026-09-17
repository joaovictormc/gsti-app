/**
 * /atualizacoes/win/* — arquivos da atualização automática do app (electron-updater).
 * Exige o token da licença no cabeçalho "x-gsti-licenca".
 */
const express = require("express");
const atualizacoes = require("../lib/atualizacoes");
const { LicencaErro } = require("../lib/erros");

const r = express.Router();

r.get("/win/:arquivo", (req, res) => {
  try {
    atualizacoes.autorizar(req.get("x-gsti-licenca"));
  } catch (e) {
    const status = e instanceof LicencaErro ? e.status || 401 : 401;
    return res.status(status).json({ success: false, error: e.message, code: e.codigo });
  }
  const arquivo = atualizacoes.caminhoSeguro(req.params.arquivo);
  if (!arquivo) return res.status(404).json({ success: false, error: "Nenhuma atualização publicada." });
  // latest.yml sempre atual; instaladores são imutáveis (nome inclui a versão)
  const yml = arquivo.endsWith(".yml");
  res.set("Cache-Control", yml ? "no-store" : "private, max-age=86400");
  res.sendFile(arquivo, { acceptRanges: true, dotfiles: "deny" });
});

module.exports = r;
