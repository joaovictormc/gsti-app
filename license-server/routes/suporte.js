/**
 * Suporte no site: página de abertura, página do chamado e API pública.
 * O cliente acessa um chamado pelo link assinado (?t=...) ou pela sessão da área do cliente.
 */
const express = require("express");
const auth = require("../lib/auth");
const suporte = require("../lib/suporte");
const { LicencaErro } = require("../lib/erros");
const { limitar, rota, csp } = require("../lib/http");
const views = require("../views/suporte");

const r = express.Router();

const html = (res, corpo, status = 200) => res.status(status).type("html").set("Cache-Control", "no-store").send(corpo);
const tokenDe = (req) => String(req.query.t || req.headers["x-chamado-token"] || "");

// Confere o acesso do cliente ao chamado (link assinado ou sessão com o mesmo e-mail).
// Sem acesso responde 404, para não revelar quais chamados existem.
function acessoCliente(req) {
  const id = req.params.id;
  if (tokenDe(req) && /^\d+$/.test(id) && suporte.tokenConfere(id, tokenDe(req))) return suporte.obterChamado(id);
  const s = auth.sessaoCliente(req);
  if (s) {
    const c = /^\d+$/.test(id) ? (() => { try { return suporte.obterChamado(id); } catch { return null; } })() : null;
    if (c && suporte.doCliente(c, s.cliente)) {
      auth.conferirCsrf(req, s.sessao);
      return c;
    }
  }
  throw new LicencaErro("NAO_ENCONTRADO", "Chamado não encontrado.", 404);
}

// --- Páginas ---
r.get("/suporte", csp, (req, res) => {
  const s = auth.sessaoCliente(req);
  html(res, views.abrir({ cliente: s ? { nome: s.cliente.nome || "", email: s.cliente.email } : null }));
});

r.get("/suporte/chamado/:id", csp, (req, res) => html(res, views.chamado({ id: String(req.params.id).replace(/\D/g, "") })));

// --- API ---
r.post("/api/suporte/chamados", limitar(10, 60), limitar(5, 60, (req) => String(req.body?.email || "").toLowerCase()), rota((req) => {
  const b = req.body || {};
  // Campo invisível para robôs: finge sucesso sem gravar nada
  if (b.site) return { success: true, numero: 0 };
  const s = auth.sessaoCliente(req);
  const out = suporte.abrirChamado({
    nome: b.nome, email: b.email, categoria: b.categoria, assunto: b.assunto, mensagem: b.mensagem,
    origem: s && String(b.email || "").trim().toLowerCase() === s.cliente.email ? "portal" : "site",
  });
  return { success: true, ...out };
}));

r.get("/api/suporte/chamados/:id", limitar(120, 5), rota((req) => {
  const c = acessoCliente(req);
  return { success: true, chamado: suporte.detalhe(c.id, { publico: true }) };
}));

r.post("/api/suporte/chamados/:id/mensagens", limitar(30, 15), rota((req) => {
  const c = acessoCliente(req);
  return suporte.responderCliente(c.id, req.body?.texto);
}));

r.post(
  "/api/suporte/chamados/:id/mensagens/:mensagemId/anexos",
  limitar(40, 15),
  express.raw({ type: () => true, limit: suporte.MAX_ANEXO + 1024 }),
  rota((req) => {
    const c = acessoCliente(req);
    const nome = decodeURIComponent(String(req.headers["x-nome-arquivo"] || ""));
    return suporte.anexar(c.id, req.params.mensagemId, req.body, nome, { autor: "cliente" });
  })
);

r.get("/api/suporte/chamados/:id/anexos/:anexoId", limitar(200, 5), rota((req, res) => {
  const c = acessoCliente(req);
  const a = suporte.arquivoDoAnexo(c.id, req.params.anexoId, { publico: true });
  if (!a) throw new LicencaErro("NAO_ENCONTRADO", "Arquivo não encontrado.", 404);
  enviarAnexo(res, a);
}));

// Lista da área do cliente
r.get("/api/cliente/chamados", rota((req) => {
  const s = auth.sessaoCliente(req);
  if (!s) throw new LicencaErro("NAO_AUTENTICADO", "Sua sessão expirou. Entre novamente.", 401);
  return {
    success: true,
    itens: suporte.doEmail(s.cliente.email, s.cliente.id).map(({ link, ...c }) => ({ ...c, url: `/suporte/chamado/${c.id}` })),
  };
}));

// Imagens abrem no navegador; PDF e texto sempre como download
function enviarAnexo(res, a) {
  const inline = a.mime.startsWith("image/");
  res.set({
    "Content-Type": a.mime === "text/plain" ? "text/plain; charset=utf-8" : a.mime,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    "Cache-Control": "private, max-age=3600",
  });
  res.sendFile(a.arquivo);
}

module.exports = r;
module.exports.enviarAnexo = enviarAnexo;
