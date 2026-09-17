/**
 * /atualizacoes/win/* — arquivos da atualização automática do app (electron-updater).
 * Exige o token da licença no cabeçalho "x-gsti-licenca".
 */
const express = require("express");
const atualizacoes = require("../lib/atualizacoes");
const { LicencaErro } = require("../lib/erros");

const r = express.Router();

// --- Agente GSTI Diagnóstico (módulo "diagnostico") ---
const agente = require("../lib/agente-diagnostico");

function autorizarAgente(req, res) {
  try {
    agente.autorizarApp(req.get("x-gsti-licenca"));
    return true;
  } catch (e) {
    const status = e instanceof LicencaErro ? e.status || 401 : 401;
    res.status(status).json({ success: false, error: e.message, code: e.codigo });
    return false;
  }
}

r.get("/diagnostico/info", (req, res) => {
  if (!autorizarAgente(req, res)) return;
  const info = agente.publicado();
  if (!info || !info.presente) return res.status(404).json({ success: false, error: "O GSTI Diagnóstico ainda não foi publicado." });
  res.set("Cache-Control", "no-store").json({ success: true, versao: info.versao, arquivo: info.arquivo, tamanho: info.tamanho, sha512: info.sha512 });
});

r.get("/diagnostico/baixar", (req, res) => {
  if (!autorizarAgente(req, res)) return;
  try {
    const { info, arquivo } = agente.caminhoPublicado();
    res.download(arquivo, info.arquivo, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    res.status(e.status || 404).json({ success: false, error: e.message });
  }
});

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
