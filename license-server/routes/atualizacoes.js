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

// ?plataforma=windows-x64 | macos-arm64 | macos-x64 | linux-x64 (padrão: Windows)
r.get("/diagnostico/info", (req, res) => {
  if (!autorizarAgente(req, res)) return;
  try {
    const { info } = agente.caminhoPublicado(String(req.query.plataforma || ""));
    const disponiveis = (agente.publicado()?.plataformas || []).filter((p) => p.presente).map((p) => ({ plataforma: p.plataforma, nome: p.nome, versao: p.versao, tamanho: p.tamanho }));
    res.set("Cache-Control", "no-store").json({ success: true, plataforma: info.plataforma, versao: info.versao, arquivo: info.arquivo, tamanho: info.tamanho, sha512: info.sha512, disponiveis });
  } catch (e) {
    res.status(e.status || 404).json({ success: false, error: e.message });
  }
});

r.get("/diagnostico/baixar", (req, res) => {
  if (!autorizarAgente(req, res)) return;
  try {
    const { info, arquivo } = agente.caminhoPublicado(String(req.query.plataforma || ""));
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
