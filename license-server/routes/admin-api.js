/**
 * API da área administrativa (/admin/api). Todas as rotas, exceto login, exigem
 * sessão de equipe + token CSRF (cabeçalho X-CSRF-Token) e permissão do papel.
 */
const express = require("express");
const QRCode = require("qrcode");
const auth = require("../lib/auth");
const L = require("../lib/licencas");
const { MODULOS } = require("../lib/modulos");
const vendas = require("../lib/vendas");
const conteudo = require("../lib/conteudo");
const uploads = require("../lib/uploads");
const suporte = require("../lib/suporte");
const emissores = require("../lib/emissores");
const { enviarAnexo } = require("./suporte");
const email = require("../lib/email");
const mp = require("../lib/mercadopago");
const keys = require("../lib/keys");
const segredos = require("../lib/segredos");
const cfg = require("../lib/config");
const { abrir } = require("../lib/db");
const { LicencaErro } = require("../lib/erros");
const { limitar, rota } = require("../lib/http");
const { version } = require("../package.json");
const views = require("../views/paginas");
const { renderLanding } = require("../views/landing");

const r = express.Router();
const eq = auth.exigirEquipe;
const ator = (req) => req.equipe.email;

const pagina = (req, porPagina = 50) => {
  const p = Math.max(1, Number(req.query.pagina) || 1);
  return { limite: porPagina, offset: (p - 1) * porPagina, pagina: p };
};
const like = (v) => `%${String(v || "").trim().toLowerCase()}%`;
const exigirQualquer = (...perms) => (req, res, next) =>
  perms.some((p) => auth.tem(req.equipe, p))
    ? next()
    : res.status(403).json({ success: false, codigo: "SEM_PERMISSAO", error: "Você não tem permissão para esta ação." });

// ============================================================================
// Autenticação
// ============================================================================

r.post("/login", limitar(20, 15), rota((req, res) => auth.login(req, res, req.body || {})));
r.post("/login/2fa", limitar(20, 15), rota((req, res) => auth.login2fa(req, res, req.body || {})));

r.post("/logout", (req, res) => {
  auth.encerrarSessao(req, res, "admin");
  res.json({ success: true });
});

r.get("/me", eq(), rota((req) => ({
  success: true,
  usuario: auth.usuarioPublico(auth.obterUsuario(req.equipe.id)),
  csrf: req.equipe.sessao.csrf,
  papeis: auth.PAPEIS,
})));

r.post("/me/senha", eq(), rota((req) => auth.alterarPropriaSenha(req.equipe.id, req.body?.senhaAtual, req.body?.novaSenha)));

r.post("/me/2fa/iniciar", eq(), rota(async (req) => {
  const { segredo, uri } = auth.iniciar2fa(req.equipe.id);
  const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 220 });
  return { success: true, segredo, uri, qrSvg };
}));
r.post("/me/2fa/confirmar", eq(), rota((req) => auth.confirmar2fa(req.equipe.id, req.body?.codigo)));
r.post("/me/2fa/desativar", eq(), rota((req) => auth.desativar2fa(req.equipe.id, req.body?.senha, req.body?.codigo)));

// ============================================================================
// Painel
// ============================================================================

r.get("/painel", eq("painel.ver"), rota((req) => {
  const db = abrir();
  const out = { success: true };
  const agora = new Date();
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString();

  if (auth.tem(req.equipe, "licencas.ver")) {
    out.licencas = {
      porPlano: db.prepare("SELECT plano, COUNT(*) n FROM licencas WHERE status = 'ativa' AND (valida_ate IS NULL OR valida_ate > ?) GROUP BY plano").all(agora.toISOString()),
      vencendo30: db.prepare("SELECT COUNT(*) n FROM licencas WHERE status = 'ativa' AND valida_ate > ? AND valida_ate <= ?").get(agora.toISOString(), em30).n,
      suspensas: db.prepare("SELECT COUNT(*) n FROM licencas WHERE status = 'suspensa'").get().n,
      trials30: db.prepare("SELECT COUNT(*) n FROM trials WHERE emitido_em > ?").get(new Date(Date.now() - 30 * 86400000).toISOString()).n,
      maquinasAtivas: db.prepare("SELECT COUNT(*) n FROM ativacoes WHERE desativado_em IS NULL").get().n,
    };
  }
  if (auth.tem(req.equipe, "pedidos.ver")) {
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    out.vendas = {
      mes: db.prepare("SELECT COUNT(*) n, COALESCE(SUM(valor_centavos), 0) total FROM pedidos WHERE status = 'pago' AND pago_em >= ?").get(inicioMes),
      pendentes: db.prepare("SELECT COUNT(*) n FROM pedidos WHERE status = 'pendente'").get().n,
      assinaturasAtivas: db.prepare("SELECT COUNT(*) n FROM assinaturas WHERE status = 'authorized'").get().n,
      // Receita por mês (pagamentos aplicados e não estornados), últimos 12 meses
      porMes: db.prepare(
        `SELECT substr(aplicado_em, 1, 7) mes, SUM(valor_centavos) total, COUNT(*) n
           FROM pagamentos WHERE aplicado_em IS NOT NULL AND estornado_em IS NULL AND aplicado_em >= ?
          GROUP BY mes ORDER BY mes`
      ).all(new Date(agora.getFullYear() - 1, agora.getMonth() + 1, 1).toISOString()),
      recentes: db.prepare(
        `SELECT p.id, p.status, p.valor_centavos, p.plano, p.modalidade, p.tipo, p.criado_em, c.email, c.nome
           FROM pedidos p JOIN clientes c ON c.id = p.cliente_id ORDER BY p.criado_em DESC LIMIT 8`
      ).all(),
    };
  }
  if (auth.tem(req.equipe, "suporte.ver")) {
    const { porStatus, semResposta } = suporte.contagens();
    out.suporte = { ...porStatus, semResposta };
  }
  if (auth.tem(req.equipe, "sistema.ver")) {
    out.sistema = {
      mercadoPago: mp.configurado(),
      simulador: cfg.MP_API_BASE !== cfg.MP_API_OFICIAL,
      smtp: email.smtpConfigurado(),
      eventosComErro: db.prepare("SELECT COUNT(*) n FROM eventos_webhook WHERE processado_em IS NULL AND tentativas > 0").get().n,
    };
  }
  return out;
}));

// ============================================================================
// Licenças
// ============================================================================

r.get("/licencas", eq("licencas.ver"), rota((req) => {
  const { limite, offset, pagina: p } = pagina(req);
  const filtros = [];
  const args = [];
  if (req.query.busca) {
    filtros.push("(lower(c.email) LIKE ? OR lower(c.nome) LIKE ? OR l.id LIKE ? OR l.chave_final = ?)");
    const b = String(req.query.busca).trim();
    args.push(like(b), like(b), `${b}%`, b.toUpperCase().slice(-4));
  }
  if (req.query.status) { filtros.push("l.status = ?"); args.push(String(req.query.status)); }
  if (req.query.plano) { filtros.push("l.plano = ?"); args.push(String(req.query.plano)); }
  if (req.query.vencendo) {
    filtros.push("l.valida_ate > ? AND l.valida_ate <= ?");
    args.push(new Date().toISOString(), new Date(Date.now() + Number(req.query.vencendo) * 86400000).toISOString());
  }
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const db = abrir();
  const total = db.prepare(`SELECT COUNT(*) n FROM licencas l JOIN clientes c ON c.id = l.cliente_id ${where}`).get(...args).n;
  const itens = db.prepare(
    `SELECT l.id, l.plano, l.status, l.chave_final, l.valida_ate, l.max_maquinas, l.criado_em, c.id cliente_id, c.email, c.nome,
            (SELECT COUNT(*) FROM ativacoes a WHERE a.licenca_id = l.id AND a.desativado_em IS NULL) maquinas
       FROM licencas l JOIN clientes c ON c.id = l.cliente_id ${where}
      ORDER BY l.criado_em DESC LIMIT ? OFFSET ?`
  ).all(...args, limite, offset);
  return { success: true, total, pagina: p, porPagina: limite, itens };
}));

r.get("/licencas/:id", eq("licencas.ver"), rota((req) => {
  const lic = L.licencaComCliente(req.params.id);
  if (!lic) throw new LicencaErro("NAO_ENCONTRADO", "Licença não encontrada.", 404);
  const db = abrir();
  const { chave_hash, ...seguro } = lic;
  return {
    success: true,
    licenca: { ...seguro, modulos: L.modulosDaLicenca(lic), modulosTodos: lic.modulos == null },
    catalogoModulos: MODULOS,
    cliente: db.prepare("SELECT * FROM clientes WHERE id = ?").get(lic.cliente_id),
    ativacoes: db.prepare("SELECT * FROM ativacoes WHERE licenca_id = ? ORDER BY ativado_em DESC").all(lic.id),
    pedidos: db.prepare("SELECT * FROM pedidos WHERE licenca_id = ? ORDER BY criado_em DESC").all(lic.id),
    assinaturas: db.prepare("SELECT * FROM assinaturas WHERE licenca_id = ? ORDER BY criado_em DESC").all(lic.id),
    historico: db.prepare("SELECT * FROM auditoria WHERE alvo = ? ORDER BY id DESC LIMIT 100").all(lic.id),
  };
}));

r.post("/licencas", eq("licencas.editar"), rota(async (req) => {
  const b = req.body || {};
  const out = L.emitirLicenca({
    email: b.email, nome: b.nome, documento: b.documento, plano: b.plano,
    dias: b.dias || undefined, ate: b.ate || undefined, maxMaquinas: b.maxMaquinas, observacao: b.observacao,
    modulos: Array.isArray(b.modulos) ? b.modulos : undefined, ator: ator(req),
  });
  if (b.enviarEmail) {
    await email.enviar("licenca_emitida", out.email, {
      nome: b.nome || "", chave: out.chave, plano: vendas.NOME_PLANO[out.plano] || out.plano, validade: vendas.dataBR(out.validaAte),
      download: conteudo.obter("site.geral").linkDownload || cfg.PUBLIC_URL,
    });
  }
  return { success: true, ...out };
}));

r.post("/licencas/:id/status", eq("licencas.editar"), rota((req) => {
  const status = String(req.body?.status || "");
  if (!["ativa", "suspensa", "revogada"].includes(status)) throw new LicencaErro("STATUS", "Status inválido.");
  return { success: true, licenca: L.alterarStatus(req.params.id, status, req.body?.motivo, ator(req)) };
}));

r.post("/licencas/:id/estender", eq("licencas.editar"), rota((req) => ({
  success: true,
  licenca: L.estender(req.params.id, { dias: req.body?.dias, ate: req.body?.ate, vitalicia: !!req.body?.vitalicia }, ator(req)),
})));

r.post("/licencas/:id/modulos", eq("licencas.editar"), rota((req) => {
  if (!Array.isArray(req.body?.modulos)) throw new LicencaErro("MODULOS", "Informe a lista de módulos.");
  return { success: true, licenca: L.definirModulos(req.params.id, req.body.modulos, ator(req)) };
}));

r.post("/licencas/:id/maquinas", eq("licencas.editar"), rota((req) => ({
  success: true,
  licenca: L.definirMaxMaquinas(req.params.id, req.body?.max, ator(req)),
})));

r.post("/licencas/:id/regenerar-chave", eq("licencas.editar"), rota(async (req) => {
  if (req.body?.enviarEmail) return { success: true, ...(await vendas.reenviarChave(req.params.id, ator(req))) };
  return { success: true, ...L.regenerarChave(req.params.id, ator(req)) };
}));

r.post("/ativacoes/:id/desativar", eq("licencas.editar"), rota((req) => L.desativarAtivacao(req.params.id, ator(req))));

r.get("/trials", eq("licencas.ver"), rota((req) => ({ success: true, itens: L.listarTrials({ email: req.query.busca }) })));
r.post("/trials/liberar", eq("licencas.editar"), rota((req) => ({
  success: true, ...L.liberarTrial({ email: req.body?.email, maquina: req.body?.maquina }, ator(req)),
})));

// ============================================================================
// Clientes
// ============================================================================

r.get("/clientes", eq("clientes.ver"), rota((req) => {
  const { limite, offset, pagina: p } = pagina(req);
  const db = abrir();
  const where = req.query.busca ? "WHERE lower(email) LIKE ? OR lower(nome) LIKE ? OR documento LIKE ?" : "";
  const args = req.query.busca ? [like(req.query.busca), like(req.query.busca), `%${String(req.query.busca).replace(/\D/g, "") || "~"}%`] : [];
  const total = db.prepare(`SELECT COUNT(*) n FROM clientes ${where}`).get(...args).n;
  const itens = db.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM licencas l WHERE l.cliente_id = c.id) licencas,
            (SELECT COALESCE(SUM(valor_centavos), 0) FROM pedidos p WHERE p.cliente_id = c.id AND p.status = 'pago') total_pago
       FROM clientes c ${where} ORDER BY c.criado_em DESC LIMIT ? OFFSET ?`
  ).all(...args, limite, offset);
  return { success: true, total, pagina: p, porPagina: limite, itens };
}));

r.get("/clientes/:id", eq("clientes.ver"), rota((req) => {
  const db = abrir();
  const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(Number(req.params.id));
  if (!cliente) throw new LicencaErro("NAO_ENCONTRADO", "Cliente não encontrado.", 404);
  return {
    success: true,
    cliente,
    licencas: db.prepare(
      `SELECT id, plano, status, chave_final, valida_ate, max_maquinas, criado_em,
              (SELECT COUNT(*) FROM ativacoes a WHERE a.licenca_id = licencas.id AND a.desativado_em IS NULL) maquinas
         FROM licencas WHERE cliente_id = ? ORDER BY criado_em DESC`
    ).all(cliente.id),
    pedidos: db.prepare("SELECT * FROM pedidos WHERE cliente_id = ? ORDER BY criado_em DESC").all(cliente.id),
  };
}));

r.put("/clientes/:id", eq("clientes.editar"), rota((req) => {
  const db = abrir();
  const c = db.prepare("SELECT * FROM clientes WHERE id = ?").get(Number(req.params.id));
  if (!c) throw new LicencaErro("NAO_ENCONTRADO", "Cliente não encontrado.", 404);
  const b = req.body || {};
  const doc = b.documento !== undefined ? String(b.documento).replace(/\D/g, "") || null : c.documento;
  db.prepare("UPDATE clientes SET nome = ?, documento = ?, telefone = ? WHERE id = ?").run(
    b.nome !== undefined ? String(b.nome).slice(0, 120) : c.nome, doc,
    b.telefone !== undefined ? String(b.telefone).replace(/\D/g, "").slice(0, 15) || null : c.telefone, c.id
  );
  L.auditar(ator(req), "cliente_atualizar", String(c.id));
  return { success: true, cliente: db.prepare("SELECT * FROM clientes WHERE id = ?").get(c.id) };
}));

r.post("/clientes/:id/link-acesso", eq("clientes.editar"), rota(async (req) => {
  const c = abrir().prepare("SELECT * FROM clientes WHERE id = ?").get(Number(req.params.id));
  if (!c) throw new LicencaErro("NAO_ENCONTRADO", "Cliente não encontrado.", 404);
  const link = auth.criarLinkMagico(c.email);
  await email.enviar("link_acesso", c.email, { nome: c.nome || "", link: link.url, minutos: cfg.LINK_MAGICO_MINUTOS });
  L.auditar(ator(req), "cliente_link_acesso", String(c.id));
  return { success: true };
}));

// ============================================================================
// Pedidos, pagamentos e assinaturas
// ============================================================================

r.get("/pedidos", eq("pedidos.ver"), rota((req) => {
  const { limite, offset, pagina: p } = pagina(req);
  const filtros = [];
  const args = [];
  if (req.query.status) { filtros.push("p.status = ?"); args.push(String(req.query.status)); }
  if (req.query.modalidade) { filtros.push("p.modalidade = ?"); args.push(String(req.query.modalidade)); }
  if (req.query.busca) {
    filtros.push("(lower(c.email) LIKE ? OR lower(c.nome) LIKE ? OR p.id LIKE ?)");
    args.push(like(req.query.busca), like(req.query.busca), `${String(req.query.busca).trim()}%`);
  }
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const db = abrir();
  const total = db.prepare(`SELECT COUNT(*) n FROM pedidos p JOIN clientes c ON c.id = p.cliente_id ${where}`).get(...args).n;
  const itens = db.prepare(
    `SELECT p.*, c.email, c.nome FROM pedidos p JOIN clientes c ON c.id = p.cliente_id ${where}
      ORDER BY p.criado_em DESC LIMIT ? OFFSET ?`
  ).all(...args, limite, offset);
  return { success: true, total, pagina: p, porPagina: limite, itens };
}));

r.get("/pedidos/:id", eq("pedidos.ver"), rota((req) => {
  const db = abrir();
  const pedido = vendas.obterPedido(req.params.id);
  if (!pedido) throw new LicencaErro("NAO_ENCONTRADO", "Pedido não encontrado.", 404);
  return {
    success: true,
    pedido,
    cliente: db.prepare("SELECT * FROM clientes WHERE id = ?").get(pedido.cliente_id),
    pagamentos: db.prepare("SELECT * FROM pagamentos WHERE pedido_id = ? ORDER BY criado_em").all(pedido.id),
    assinatura: db.prepare("SELECT * FROM assinaturas WHERE pedido_id = ?").get(pedido.id) || null,
    historico: db.prepare("SELECT * FROM auditoria WHERE alvo = ? ORDER BY id DESC LIMIT 100").all(pedido.id),
  };
}));

r.post("/pedidos/:id/reconciliar", eq("pedidos.editar"), rota(async (req) => {
  L.auditar(ator(req), "pedido_reconciliar", req.params.id);
  return { success: true, pedido: await vendas.reconciliarPedido(req.params.id) };
}));

r.post("/pagamentos/:mpId/reembolsar", eq("pagamentos.reembolsar"), rota(async (req) => ({
  success: true,
  pagamento: await vendas.reembolsarPagamento(req.params.mpId, ator(req)),
})));

r.get("/assinaturas", eq("pedidos.ver"), rota((req) => {
  const args = req.query.status ? [String(req.query.status)] : [];
  return {
    success: true,
    itens: abrir().prepare(
      `SELECT a.*, c.email, c.nome FROM assinaturas a JOIN clientes c ON c.id = a.cliente_id
       ${req.query.status ? "WHERE a.status = ?" : ""} ORDER BY a.criado_em DESC LIMIT 500`
    ).all(...args),
  };
}));

r.post("/assinaturas/:id/cancelar", eq("pedidos.editar"), rota(async (req) => ({
  success: true,
  assinatura: await vendas.cancelarAssinaturaMp(req.params.id, ator(req)),
})));

// ============================================================================
// Planos e preços
// ============================================================================

r.get("/ofertas", eq(), exigirQualquer("pedidos.ver", "ofertas.editar", "conteudo.editar"), rota(() => ({
  success: true, itens: vendas.listarOfertas(), catalogoModulos: MODULOS, modulosTrial: L.modulosDoTrial(),
})));

r.put("/ofertas-trial/modulos", eq("ofertas.editar"), rota((req) => {
  if (!Array.isArray(req.body?.modulos)) throw new LicencaErro("MODULOS", "Informe a lista de módulos.");
  return { success: true, modulos: L.definirModulosDoTrial(req.body.modulos, ator(req)) };
}));

r.put("/ofertas/:id", eq("ofertas.editar"), rota((req) => ({
  success: true, oferta: vendas.atualizarOferta(req.params.id, req.body || {}, ator(req)),
})));

// ============================================================================
// Conteúdo do site e e-mails
// ============================================================================

const permConteudo = (chave) => (String(chave).startsWith("email.") ? "emails.editar" : "conteudo.editar");
const exigirConteudo = (req, res, next) => auth.exigirPermissao(permConteudo(req.params.chave))(req, res, next);

r.get("/conteudo", eq(), exigirQualquer("conteudo.editar", "emails.editar"), rota((req) => ({
  success: true,
  itens: conteudo.listarSecoes().filter((s) => auth.tem(req.equipe, permConteudo(s.chave))),
})));

r.get("/conteudo/:chave", eq(), exigirConteudo, rota((req) => ({ success: true, ...conteudo.detalheSecao(req.params.chave) })));

r.put("/conteudo/:chave", eq(), exigirConteudo, rota((req) => ({
  success: true, valor: conteudo.salvar(req.params.chave, req.body?.valor, ator(req)),
})));

r.get("/conteudo/:chave/historico", eq(), exigirConteudo, rota((req) => ({ success: true, itens: conteudo.historico(req.params.chave) })));

r.post("/conteudo/:chave/restaurar", eq(), exigirConteudo, rota((req) => ({
  success: true, valor: conteudo.restaurar(req.params.chave, req.body?.historicoId, ator(req)),
})));

r.post("/conteudo/:chave/email-teste", eq(), exigirConteudo, limitar(10, 10), rota(async (req) => {
  const chave = req.params.chave;
  if (!chave.startsWith("email.")) throw new LicencaErro("NAO_EMAIL", "Esta seção não é um e-mail.");
  const exemplo = { ...email.VARS_EXEMPLO, nome: req.equipe.nome, download: conteudo.obter("site.geral").linkDownload || cfg.PUBLIC_URL };
  return await email.enviar(chave.slice(6), req.equipe.email, exemplo);
}));

// Pré-visualização do site com alterações ainda NÃO salvas.
const PAGINAS_PREVIA = {
  inicio: () => renderLanding({ ofertas: vendas.listarOfertas({ apenasAtivas: true }), pagamentosAtivos: mp.configurado() }),
  "teste-gratis": () => views.testeGratis(),
  termos: () => views.legal(conteudo.obter("pagina.termos")),
  privacidade: () => views.legal(conteudo.obter("pagina.privacidade")),
  cliente: () => views.portal({ logado: false }),
  checkout: () =>
    views.retornoCheckout({
      pedido: { id: "00000000-0000-0000-0000-000000000000", status: "pendente", modalidade: "avulso" },
      falha: false,
    }),
};

r.post("/site/previa", eq(), exigirQualquer("conteudo.editar", "emails.editar"), rota((req, res) => {
const pedida = String(req.body?.pagina || "inicio");
  const chaveEmail = String(req.body?.chave || "");
  const gerar = pedida === "email" && chaveEmail.startsWith("email.")
    ? () => {
        const m = email.previa(chaveEmail.slice(6));
        return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>body{margin:0;background:#eef1f5}.assunto{font:600 14px/1.4 system-ui;padding:12px 16px;background:#fff;border-bottom:1px solid #e5e7eb;color:#1f2937}.assunto span{color:#6b7280;font-weight:400}</style></head><body><p class="assunto"><span>Assunto:</span> ${m.assunto.replace(/[<>&]/g, "")}</p>${m.html}</body></html>`;
      }
    : PAGINAS_PREVIA[pedida];
  if (!gerar) throw new LicencaErro("PAGINA", "Página desconhecida.", 404);
  const alteracoes = {};
  for (const [chave, valor] of Object.entries(req.body?.alteracoes || {})) {
    if (/^(site|pagina|email)\./.test(chave)) alteracoes[chave] = valor;
  }
  const html = conteudo.comSobreposicao(alteracoes, gerar);
  res.type("html").set("Cache-Control", "no-store").send(html);
}));

r.post(
  "/uploads",
  eq("conteudo.editar"),
  express.raw({ type: () => true, limit: uploads.MAX_BYTES + 1024 }),
  rota((req) => ({
    success: true,
    ...uploads.salvar(req.body, decodeURIComponent(String(req.headers["x-nome-arquivo"] || "")), ator(req)),
  }))
);

r.get("/uploads", eq("conteudo.editar"), rota(() => ({ success: true, itens: uploads.listar() })));

// ============================================================================
// Suporte
// ============================================================================

r.get("/suporte/chamados", eq("suporte.ver"), rota((req) => {
  const { limite, offset, pagina: p } = pagina(req);
  const { total, itens } = suporte.listar({
    status: req.query.status, categoria: req.query.categoria, atribuido: req.query.atribuido, busca: req.query.busca,
    limite, offset, usuarioId: req.equipe.id,
  });
  return {
    success: true, total, itens, pagina: p, porPagina: limite, contagens: suporte.contagens(),
    categorias: suporte.CATEGORIAS, status: suporte.STATUS, prioridades: suporte.PRIORIDADES, origens: suporte.ORIGENS,
  };
}));

r.get("/suporte/chamados/:id", eq("suporte.ver"), rota((req) => {
  const chamado = suporte.detalhe(req.params.id, { publico: false });
  const db = abrir();
  const cliente = chamado.clienteId ? db.prepare("SELECT id, nome, email FROM clientes WHERE id = ?").get(chamado.clienteId) : null;
  const licencas = cliente
    ? db.prepare("SELECT id, plano, status, valida_ate, chave_final FROM licencas WHERE cliente_id = ? ORDER BY criado_em DESC").all(cliente.id)
    : [];
  const equipe = db.prepare("SELECT id, nome, papeis FROM admin_usuarios WHERE ativo = 1 ORDER BY nome").all()
    .filter((u) => auth.tem({ papeis: JSON.parse(u.papeis || "[]") }, "suporte.responder"))
    .map(({ id, nome }) => ({ id, nome }));
  return {
    success: true, chamado, cliente, licencas, equipe, link: suporte.linkDoChamado(chamado.id),
    categorias: suporte.CATEGORIAS, status: suporte.STATUS, prioridades: suporte.PRIORIDADES, origens: suporte.ORIGENS,
  };
}));

r.post("/suporte/chamados/:id/mensagens", eq("suporte.responder"), rota((req) =>
  suporte.responderEquipe(req.params.id, { texto: req.body?.texto, interna: !!req.body?.interna, status: req.body?.status }, req.equipe)
));

r.put("/suporte/chamados/:id", eq("suporte.responder"), rota((req) =>
  suporte.atualizarChamado(req.params.id, { status: req.body?.status, prioridade: req.body?.prioridade, atribuidoA: req.body?.atribuidoA }, req.equipe)
));

r.post(
  "/suporte/chamados/:id/mensagens/:mensagemId/anexos",
  eq("suporte.responder"),
  express.raw({ type: () => true, limit: suporte.MAX_ANEXO + 1024 }),
  rota((req) => suporte.anexar(req.params.id, req.params.mensagemId, req.body, decodeURIComponent(String(req.headers["x-nome-arquivo"] || "")), { autor: "equipe" }))
);

r.get("/suporte/chamados/:id/anexos/:anexoId", eq("suporte.ver"), rota((req, res) => {
  const a = suporte.arquivoDoAnexo(req.params.id, req.params.anexoId, { publico: false });
  if (!a) throw new LicencaErro("NAO_ENCONTRADO", "Arquivo não encontrado.", 404);
  enviarAnexo(res, a);
}));

// ============================================================================
// Pedidos de emissores de nota fiscal
// ============================================================================

r.get("/emissores", eq("emissores.ver"), rota((req) => ({
  success: true,
  itens: emissores.ranking({ status: req.query.status || undefined }),
  status: emissores.STATUS,
  catalogo: emissores.catalogo().map(({ id, nome, status }) => ({ id, nome, status })),
})));

r.get("/emissores/:chave", eq("emissores.ver"), rota((req) => ({ success: true, ...emissores.detalheDoEmissor(req.params.chave), status: emissores.STATUS })));

r.put("/emissores/:chave", eq("emissores.gerenciar"), rota((req) =>
  emissores.avaliar(req.params.chave, { nome: req.body?.nome, status: req.body?.status, nota: req.body?.nota, notaPublica: req.body?.notaPublica }, ator(req))
));

r.post("/emissores/:chave/avisar", eq("emissores.gerenciar"), rota((req) => emissores.avisarDisponivel(req.params.chave, ator(req))));

// ============================================================================
// Equipe
// ============================================================================

r.get("/usuarios", eq("usuarios.gerenciar"), rota(() => ({ success: true, itens: auth.listarUsuarios(), papeis: auth.PAPEIS })));

r.post("/usuarios", eq("usuarios.gerenciar"), rota((req) => ({ success: true, ...auth.criarUsuario(req.body || {}, ator(req)) })));

r.put("/usuarios/:id", eq("usuarios.gerenciar"), rota((req) => {
  if (Number(req.params.id) === req.equipe.id && req.body?.ativo === false) {
    throw new LicencaErro("PROPRIO_USUARIO", "Você não pode desativar o próprio usuário.");
  }
  return { success: true, usuario: auth.atualizarUsuario(req.params.id, req.body || {}, ator(req)) };
}));

r.post("/usuarios/:id/redefinir-senha", eq("usuarios.gerenciar"), rota((req) => ({ success: true, ...auth.redefinirSenha(req.params.id, ator(req)) })));
r.post("/usuarios/:id/resetar-2fa", eq("usuarios.gerenciar"), rota((req) => auth.resetar2fa(req.params.id, ator(req))));

// ============================================================================
// Sistema e auditoria
// ============================================================================

r.get("/sistema", eq("sistema.ver"), rota((req) => {
  const db = abrir();
  return {
    success: true,
    versao: version,
    publicUrl: cfg.PUBLIC_URL,
    webhookUrl: `${cfg.PUBLIC_URL}/webhooks/mercadopago`,
    mercadoPago: {
      configurado: mp.configurado(), sandbox: segredos.obterBool("MP_SANDBOX"), assinaturaWebhook: !!segredos.obter("MP_WEBHOOK_SECRET"),
      simulador: cfg.MP_API_BASE !== cfg.MP_API_OFICIAL ? cfg.MP_API_BASE : null,
    },
    smtp: { configurado: email.smtpConfigurado(), remetente: email.remetente() },
    podeConfigurar: auth.tem(req.equipe, "sistema.configurar"),
    chaves: keys.kids(),
    chaveAtiva: keys.kidAtivo(),
    atualizacao: require("../lib/atualizacoes").publicada(),
    agenteDiagnostico: require("../lib/agente-diagnostico").publicado(),
    eventos: db.prepare("SELECT id, tipo, acao, recurso_id, recebido_em, processado_em, tentativas, erro FROM eventos_webhook ORDER BY id DESC LIMIT 50").all(),
    emails: db.prepare("SELECT * FROM emails_log ORDER BY id DESC LIMIT 50").all(),
  };
}));

// --- Credenciais (Mercado Pago, SMTP) — somente Administrador ---
r.get("/sistema/config", eq("sistema.configurar"), rota(() => ({ success: true, grupos: segredos.estado() })));

r.put("/sistema/config", eq("sistema.configurar"), limitar(20, 15), rota((req) => {
  const u = auth.obterUsuario(req.equipe.id);
  if (!auth.conferirSenha(req.body?.senha || "", u.senha_hash)) {
    throw new LicencaErro("SENHA_ATUAL", "Senha incorreta.", 403);
  }
  const alterados = segredos.salvar(req.body?.valores, ator(req));
  email.reiniciarTransporte();
  return { success: true, alterados, grupos: segredos.estado() };
}));

r.post("/sistema/email-teste", eq("sistema.configurar"), limitar(10, 10), rota(async (req) => {
  const r2 = await email.enviarTeste(req.equipe.email);
  if (!r2.success) throw new LicencaErro("SMTP", r2.error || "Falha ao enviar.", 400);
  return { success: true, para: req.equipe.email };
}));

r.post("/sistema/eventos/:id/reprocessar", eq("sistema.ver"), rota(async (req) => {
  const db = abrir();
  db.prepare("UPDATE eventos_webhook SET processado_em = NULL, tentativas = 0, erro = NULL WHERE id = ?").run(Number(req.params.id));
  await vendas.processarEvento(Number(req.params.id));
  return { success: true, evento: db.prepare("SELECT * FROM eventos_webhook WHERE id = ?").get(Number(req.params.id)) };
}));

r.get("/auditoria", eq("auditoria.ver"), rota((req) => {
  const { limite, offset, pagina: p } = pagina(req, 100);
  const filtros = [];
  const args = [];
  for (const campo of ["ator", "acao", "alvo"]) {
    if (req.query[campo]) { filtros.push(`${campo} LIKE ?`); args.push(`%${req.query[campo]}%`); }
  }
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const db = abrir();
  return {
    success: true,
    total: db.prepare(`SELECT COUNT(*) n FROM auditoria ${where}`).get(...args).n,
    pagina: p,
    porPagina: limite,
    itens: db.prepare(`SELECT * FROM auditoria ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, limite, offset),
  };
}));

module.exports = r;
