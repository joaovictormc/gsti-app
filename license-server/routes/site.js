/**
 * Site público: landing, páginas legais, checkout, renovação e portal do cliente.
 * HTML renderizado no servidor (views/) com o conteúdo editável do painel;
 * JavaScript do navegador em public/site (CSP sem scripts inline).
 */
const path = require("path");
const express = require("express");
const auth = require("../lib/auth");
const L = require("../lib/licencas");
const vendas = require("../lib/vendas");
const conteudo = require("../lib/conteudo");
const uploads = require("../lib/uploads");
const email = require("../lib/email");
const mp = require("../lib/mercadopago");
const cfg = require("../lib/config");
const { abrir } = require("../lib/db");
const { LicencaErro } = require("../lib/erros");
const { limitar, rota, csp } = require("../lib/http");
const views = require("../views/paginas");
const { renderLanding } = require("../views/landing");

const r = express.Router();

const html = (res, corpo, status = 200) => res.status(status).type("html").set("Cache-Control", "no-store").send(corpo);
const mascararEmail = (e) => String(e).replace(/^(.{2}).*(@.*)$/, (_m, a, b) => `${a}***${b}`);

r.use("/site", express.static(path.join(__dirname, "..", "public", "site"), { maxAge: "1d" }));

r.get("/uploads/:id", (req, res) => {
  const u = uploads.caminho(req.params.id);
  if (!u) return res.status(404).end();
  res.set({ "Content-Type": u.mime, "Cache-Control": "public, max-age=604800", "Content-Security-Policy": "default-src 'none'" });
  res.sendFile(u.arquivo);
});

// --- Páginas ---
r.get("/", csp, (req, res) => {
  const ofertas = vendas.listarOfertas({ apenasAtivas: true });
  html(res, renderLanding({ ofertas, pagamentosAtivos: mp.configurado() }));
});

r.get(["/termos", "/privacidade"], csp, (req, res) => {
  const chave = req.path === "/termos" ? "pagina.termos" : "pagina.privacidade";
  html(res, views.legal(conteudo.obter(chave)));
});

r.get("/checkout/retorno", csp, (req, res) => {
  const pedido = req.query.pedido ? vendas.obterPedido(String(req.query.pedido)) : null;
  if (!pedido) return html(res, views.naoEncontrada(), 404);
  html(res, views.retornoCheckout({ pedido, falha: !!req.query.falha }));
});

r.get("/teste-gratis", csp, (req, res) => html(res, views.testeGratis()));

r.get("/renovar/:licencaId", csp, (req, res) => {
  const lic = L.licencaComCliente(String(req.params.licencaId));
  if (!lic || lic.plano !== "anual" || lic.status === "revogada") return html(res, views.naoEncontrada(), 404);
  const ofertas = vendas.listarOfertas({ apenasAtivas: true }).filter((o) => o.plano === "anual");
  const renovacaoAutomatica = !!abrir().prepare("SELECT 1 FROM assinaturas WHERE licenca_id = ? AND status = 'authorized'").get(lic.id);
  html(res, views.renovar({
    licenca: { id: lic.id, validade: lic.valida_ate, emailMascarado: mascararEmail(lic.email), nome: lic.nome || "" },
    ofertas, renovacaoAutomatica, pagamentosAtivos: mp.configurado(),
  }));
});

r.get("/cliente", csp, (req, res) => html(res, views.portal({ logado: !!auth.sessaoCliente(req) })));

r.get("/cliente/entrar", csp, (req, res) => {
  const ok = auth.consumirLinkMagico(req, res, req.query.token);
  if (!ok) return html(res, views.linkInvalido(), 400);
  res.redirect(303, "/cliente");
});

// --- API pública ---
r.get("/api/ofertas", rota(() => ({
  success: true,
  itens: vendas.listarOfertas({ apenasAtivas: true }).map((o) => ({
    id: o.id, plano: o.plano, modalidade: o.modalidade, nome: o.nome, descricao: o.descricao,
    precoCentavos: o.preco_centavos, parcelasMax: o.parcelas_max, destaque: !!o.destaque,
  })),
})));

r.post("/api/checkout", limitar(10, 15), rota(async (req) => {
  const b = req.body || {};
  if (!b.aceite) throw new LicencaErro("ACEITE", "É preciso aceitar os termos de uso e a política de privacidade.");
  return { success: true, ...(await vendas.iniciarCheckout(b)) };
}));

r.get("/api/pedidos/:id/status", limitar(120, 5), rota((req) => {
  const p = vendas.obterPedido(req.params.id);
  if (!p) throw new LicencaErro("NAO_ENCONTRADO", "Pedido não encontrado.", 404);
  const cliente = abrir().prepare("SELECT email FROM clientes WHERE id = ?").get(p.cliente_id);
  return { success: true, status: p.status, tipo: p.tipo, modalidade: p.modalidade, email: mascararEmail(cliente.email) };
}));

// --- Portal do cliente ---
r.post("/api/cliente/link", limitar(5, 15), limitar(3, 15, (req) => String(req.body?.email || "").toLowerCase()), rota(async (req) => {
  const e = L.normEmail(req.body?.email);
  if (!L.emailValido(e)) throw new LicencaErro("EMAIL_INVALIDO", "Informe um e-mail válido.");
  const link = auth.criarLinkMagico(e);
  if (link) {
    await email.enviar("link_acesso", e, { nome: link.cliente.nome || "", link: link.url, minutos: cfg.LINK_MAGICO_MINUTOS });
  }
  // Resposta igual exista ou não o cliente (não revela quem é cliente).
  return { success: true };
}));

function exigirCliente(req, res, next) {
  const s = auth.sessaoCliente(req);
  if (!s) return res.status(401).json({ success: false, codigo: "NAO_AUTENTICADO", error: "Sua sessão expirou. Entre novamente." });
  try {
    auth.conferirCsrf(req, s.sessao);
  } catch (e) {
    return res.status(e.status).json({ success: false, codigo: e.codigo, error: e.message });
  }
  req.cliente = s.cliente;
  req.sessaoCliente = s.sessao;
  next();
}

function licencaDoCliente(req, licencaId) {
  const lic = L.licencaComCliente(String(licencaId));
  if (!lic || lic.cliente_id !== req.cliente.id) throw new LicencaErro("NAO_ENCONTRADO", "Licença não encontrada.", 404);
  return lic;
}

r.post("/api/cliente/sair", (req, res) => {
  auth.encerrarSessao(req, res, "cliente");
  res.json({ success: true });
});

r.get("/api/cliente/me", exigirCliente, rota((req) => {
  const db = abrir();
  const c = req.cliente;
  const licencas = db.prepare("SELECT * FROM licencas WHERE cliente_id = ? ORDER BY criado_em DESC").all(c.id).map((l) => ({
    id: l.id, plano: l.plano, status: l.status, motivo: l.motivo_status, chaveFinal: l.chave_final, validade: l.valida_ate,
    maxMaquinas: l.max_maquinas,
    ativacoes: db.prepare("SELECT id, nome_maquina, app_versao, ativado_em, ultimo_contato FROM ativacoes WHERE licenca_id = ? AND desativado_em IS NULL ORDER BY ativado_em").all(l.id),
    assinatura: db.prepare("SELECT id, status, proxima_cobranca, valor_centavos FROM assinaturas WHERE licenca_id = ? ORDER BY criado_em DESC LIMIT 1").get(l.id) || null,
  }));
  const pedidos = db.prepare(
    "SELECT id, plano, modalidade, tipo, valor_centavos, status, criado_em, pago_em FROM pedidos WHERE cliente_id = ? AND status <> 'cancelado' ORDER BY criado_em DESC LIMIT 50"
  ).all(c.id);
  return { success: true, csrf: req.sessaoCliente.csrf, cliente: { nome: c.nome, email: c.email }, licencas, pedidos };
}));

r.post("/api/cliente/ativacoes/:id/desativar", exigirCliente, rota((req) => {
  const at = abrir().prepare("SELECT * FROM ativacoes WHERE id = ?").get(Number(req.params.id));
  if (!at) throw new LicencaErro("NAO_ENCONTRADO", "Computador não encontrado.", 404);
  licencaDoCliente(req, at.licenca_id);
  return L.desativarAtivacao(at.id, `cliente:${req.cliente.email}`);
}));

r.post("/api/cliente/licencas/:id/nova-chave", exigirCliente, limitar(5, 60), rota(async (req) => {
  const lic = licencaDoCliente(req, req.params.id);
  if (lic.status === "revogada") throw new LicencaErro("LICENCA_REVOGADA", "Esta licença foi revogada.");
  const out = await vendas.reenviarChave(lic.id, `cliente:${req.cliente.email}`);
  return { success: true, chave: out.chave };
}));

r.post("/api/cliente/assinaturas/:id/cancelar", exigirCliente, rota(async (req) => {
  const a = abrir().prepare("SELECT * FROM assinaturas WHERE id = ?").get(String(req.params.id));
  if (!a || a.cliente_id !== req.cliente.id) throw new LicencaErro("NAO_ENCONTRADO", "Assinatura não encontrada.", 404);
  const out = await vendas.cancelarAssinaturaMp(a.id, `cliente:${req.cliente.email}`);
  return { success: true, status: out.status };
}));

module.exports = r;
