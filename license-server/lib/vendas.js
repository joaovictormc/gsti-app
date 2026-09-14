/**
 * Vendas: ofertas, checkout (Mercado Pago), aplicação de pagamentos em licenças,
 * assinaturas, estornos, webhooks e conciliação.
 *
 * Regras principais
 * - Todo pagamento aprovado vinculado a um pedido é aplicado UMA vez (idempotente por mp_payment_id):
 *   pedido sem licença → emite; pedido com licença → estende DIAS_ANUAL (anual).
 * - Estorno/contestação: se o pagamento emitiu a licença → revoga; se foi renovação → devolve os dias.
 * - Webhooks só servem de gatilho: o estado é sempre buscado na API do Mercado Pago.
 */
const crypto = require("crypto");
const { abrir, transacao } = require("./db");
const cfg = require("./config");
const mp = require("./mercadopago");
const L = require("./licencas");
const email = require("./email");
const conteudo = require("./conteudo");
const { LicencaErro } = require("./erros");

const agoraIso = () => new Date().toISOString();
const DIA_MS = 86400000;
const PEDIDO_EXPIRA_DIAS = 3;
const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem expiração");
const NOME_PLANO = { anual: "Anual", vitalicia: "Vitalícia", cortesia: "Cortesia", mensal: "Mensal" };

// ============================================================================
// Ofertas
// ============================================================================

const OFERTAS_PADRAO = [
  { id: "anual-avulso", plano: "anual", modalidade: "avulso", nome: "Anual", descricao: "12 meses de uso\nPix, boleto ou cartão em até 12x\nRenove quando quiser", preco_centavos: 49700, parcelas_max: 12, destaque: 0, ordem: 1 },
  { id: "anual-assinatura", plano: "anual", modalidade: "assinatura", nome: "Anual com renovação automática", descricao: "12 meses de uso\nRenovação automática no cartão\nCancele quando quiser", preco_centavos: 44700, parcelas_max: 1, destaque: 1, ordem: 2 },
  { id: "vitalicia-avulso", plano: "vitalicia", modalidade: "avulso", nome: "Vitalícia", descricao: "Pague uma vez, use para sempre\nPix, boleto ou cartão em até 12x", preco_centavos: 129700, parcelas_max: 12, destaque: 0, ordem: 3 },
];

// Cria as ofertas padrão (INATIVAS — revise os preços no painel antes de ativar).
function semearOfertas() {
  const db = abrir();
  if (db.prepare("SELECT COUNT(*) n FROM ofertas").get().n) return;
  const ins = db.prepare(
    `INSERT INTO ofertas (id, plano, modalidade, nome, descricao, preco_centavos, parcelas_max, destaque, ativo, ordem, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  );
  for (const o of OFERTAS_PADRAO) {
    ins.run(o.id, o.plano, o.modalidade, o.nome, o.descricao, o.preco_centavos, o.parcelas_max, o.destaque, o.ordem, agoraIso());
  }
}

function listarOfertas({ apenasAtivas = false } = {}) {
  return abrir()
    .prepare(`SELECT * FROM ofertas ${apenasAtivas ? "WHERE ativo = 1" : ""} ORDER BY ordem, id`)
    .all();
}

function obterOferta(id) {
  const o = abrir().prepare("SELECT * FROM ofertas WHERE id = ?").get(String(id));
  if (!o) throw new LicencaErro("OFERTA_INEXISTENTE", "Plano não encontrado.", 404);
  return o;
}

function atualizarOferta(id, dados, ator) {
  const o = obterOferta(id);
  const int = (v, min, max, atual) => {
    if (v === undefined) return atual;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new LicencaErro("VALOR_INVALIDO", `Valor inválido (${min}–${max}).`);
    return n;
  };
  const novo = {
    nome: dados.nome !== undefined ? String(dados.nome).trim().slice(0, 80) || o.nome : o.nome,
    descricao: dados.descricao !== undefined ? String(dados.descricao).slice(0, 1000) : o.descricao,
    preco_centavos: int(dados.precoCentavos, 100, 100000000, o.preco_centavos),
    parcelas_max: int(dados.parcelasMax, 1, 12, o.parcelas_max),
    max_maquinas: int(dados.maxMaquinas, 1, 100, o.max_maquinas),
    destaque: dados.destaque !== undefined ? (dados.destaque ? 1 : 0) : o.destaque,
    ativo: dados.ativo !== undefined ? (dados.ativo ? 1 : 0) : o.ativo,
    ordem: int(dados.ordem, 0, 100, o.ordem),
  };
  if (o.modalidade === "assinatura") novo.parcelas_max = 1;
  abrir()
    .prepare(
      `UPDATE ofertas SET nome = ?, descricao = ?, preco_centavos = ?, parcelas_max = ?, max_maquinas = ?,
              destaque = ?, ativo = ?, ordem = ?, atualizado_em = ? WHERE id = ?`
    )
    .run(novo.nome, novo.descricao, novo.preco_centavos, novo.parcelas_max, novo.max_maquinas, novo.destaque, novo.ativo, novo.ordem, agoraIso(), o.id);
  L.auditar(ator, "oferta_atualizar", o.id, { de: { preco: o.preco_centavos, ativo: o.ativo }, para: { preco: novo.preco_centavos, ativo: novo.ativo } });
  return obterOferta(o.id);
}

// ============================================================================
// Checkout
// ============================================================================

const urlsRetorno = (pedidoId) => ({
  sucesso: `${cfg.PUBLIC_URL}/checkout/retorno?pedido=${pedidoId}`,
  pendente: `${cfg.PUBLIC_URL}/checkout/retorno?pedido=${pedidoId}`,
  falha: `${cfg.PUBLIC_URL}/checkout/retorno?pedido=${pedidoId}&falha=1`,
  // Mercado Pago só aceita notification_url pública (https).
  notificacao: /^https:\/\//.test(cfg.PUBLIC_URL) ? `${cfg.PUBLIC_URL}/webhooks/mercadopago` : null,
});

function limparDocumento(doc) {
  const d = String(doc || "").replace(/\D/g, "");
  if (d && d.length !== 11 && d.length !== 14) throw new LicencaErro("DOCUMENTO_INVALIDO", "CPF ou CNPJ inválido.");
  return d || null;
}

async function iniciarCheckout({ ofertaId, nome, email: emailBruto, documento, telefone, renovarLicencaId }) {
  const oferta = obterOferta(ofertaId);
  if (!oferta.ativo) throw new LicencaErro("OFERTA_INATIVA", "Este plano não está disponível no momento.");
  const e = L.normEmail(emailBruto);
  if (!L.emailValido(e)) throw new LicencaErro("EMAIL_INVALIDO", "Informe um e-mail válido.");
  const nomeLimpo = String(nome || "").replace(/[<>[\]()*#_`]/g, "").trim().slice(0, 120);
  if (nomeLimpo.length < 3) throw new LicencaErro("NOME", "Informe seu nome completo.");
  const doc = limparDocumento(documento);
  const tel = String(telefone || "").replace(/\D/g, "").slice(0, 15) || null;
  if (!mp.configurado()) throw new LicencaErro("MP_NAO_CONFIGURADO", "Pagamentos indisponíveis no momento. Fale com o suporte.", 503);

  const db = abrir();
  let licencaRenovar = null;
  if (renovarLicencaId) {
    licencaRenovar = L.licencaComCliente(String(renovarLicencaId));
    if (!licencaRenovar) throw new LicencaErro("LICENCA_INEXISTENTE", "Licença não encontrada.", 404);
    if (licencaRenovar.plano !== "anual" || oferta.plano !== "anual") {
      throw new LicencaErro("RENOVACAO_INVALIDA", "Apenas licenças anuais podem ser renovadas.");
    }
    if (licencaRenovar.status === "revogada") throw new LicencaErro("RENOVACAO_INVALIDA", "Esta licença foi revogada. Fale com o suporte.");
    const assinaturaAtiva = db
      .prepare("SELECT 1 FROM assinaturas WHERE licenca_id = ? AND status = 'authorized'")
      .get(licencaRenovar.id);
    if (assinaturaAtiva) throw new LicencaErro("RENOVACAO_AUTOMATICA", "Esta licença já tem renovação automática ativa.");
  }

  const pedidoId = crypto.randomUUID();
  const agora = agoraIso();
  const clienteEmail = licencaRenovar ? licencaRenovar.email : e;

  transacao(() => {
    db.prepare(
      `INSERT INTO clientes (email, nome, documento, telefone, criado_em) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET nome = COALESCE(excluded.nome, nome),
         documento = COALESCE(excluded.documento, documento), telefone = COALESCE(excluded.telefone, telefone)`
    ).run(clienteEmail, nomeLimpo, doc, tel, agora);
    const cliente = db.prepare("SELECT id FROM clientes WHERE email = ?").get(clienteEmail);
    db.prepare(
      `INSERT INTO pedidos (id, cliente_id, oferta_id, plano, modalidade, tipo, valor_centavos, status, licenca_id, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?)`
    ).run(pedidoId, cliente.id, oferta.id, oferta.plano, oferta.modalidade, licencaRenovar ? "renovacao" : "nova",
      oferta.preco_centavos, licencaRenovar ? licencaRenovar.id : null, agora, agora);
  });

  const { nomeProduto } = conteudo.obter("site.geral");
  const titulo = `${nomeProduto} — ${licencaRenovar ? "Renovação " : "Licença "}${oferta.nome}`;
  try {
    const comprador = { nome: nomeLimpo, email: e };
    const urls = urlsRetorno(pedidoId);
    if (oferta.modalidade === "assinatura") {
      const a = await mp.criarAssinatura({ pedidoId, titulo, valorCentavos: oferta.preco_centavos, comprador, urls });
      db.prepare("UPDATE pedidos SET mp_preapproval_id = ?, checkout_url = ?, atualizado_em = ? WHERE id = ?").run(a.id, a.url, agoraIso(), pedidoId);
      return { pedidoId, url: a.url };
    }
    const p = await mp.criarPreferencia({ pedidoId, titulo, valorCentavos: oferta.preco_centavos, parcelasMax: oferta.parcelas_max, comprador, urls });
    db.prepare("UPDATE pedidos SET mp_preference_id = ?, checkout_url = ?, atualizado_em = ? WHERE id = ?").run(p.id, p.url, agoraIso(), pedidoId);
    return { pedidoId, url: p.url };
  } catch (err) {
    db.prepare("UPDATE pedidos SET status = 'cancelado', atualizado_em = ? WHERE id = ?").run(agoraIso(), pedidoId);
    console.error("[checkout] falha ao criar checkout:", err.message, err.mpDados || "");
    throw new LicencaErro("CHECKOUT_FALHOU", "Não foi possível iniciar o pagamento. Tente novamente em instantes.", 502);
  }
}

// ============================================================================
// Aplicação de pagamentos
// ============================================================================

const obterPedido = (id) => abrir().prepare("SELECT * FROM pedidos WHERE id = ?").get(String(id));
const clienteDo = (pedido) => abrir().prepare("SELECT * FROM clientes WHERE id = ?").get(pedido.cliente_id);

/**
 * Registra/atualiza um pagamento do Mercado Pago e aplica efeitos na licença.
 * Retorna uma lista de e-mails a enviar (fora da transação).
 */
function aplicarPagamento(pedido, pagamentoMp, origem) {
  const db = abrir();
  const mpId = String(pagamentoMp.id);
  const status = pagamentoMp.status;
  const valorCentavos = Math.round(Number(pagamentoMp.transaction_amount || 0) * 100);
  const emails = [];

  transacao(() => {
    const agora = agoraIso();
    db.prepare(
      `INSERT INTO pagamentos (pedido_id, mp_payment_id, origem, status, status_detail, valor_centavos, metodo, parcelas, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(mp_payment_id) DO UPDATE SET status = excluded.status, status_detail = excluded.status_detail,
         valor_centavos = excluded.valor_centavos, metodo = excluded.metodo, parcelas = excluded.parcelas, atualizado_em = excluded.atualizado_em`
    ).run(pedido.id, mpId, origem, status, pagamentoMp.status_detail || null, valorCentavos,
      pagamentoMp.payment_type_id || pagamentoMp.payment_method_id || null, pagamentoMp.installments || null, agora, agora);
    const pag = db.prepare("SELECT * FROM pagamentos WHERE mp_payment_id = ?").get(mpId);
    const ped = obterPedido(pedido.id); // estado atual dentro da transação

    // --- Aprovado: aplica uma única vez ---
    if (status === "approved" && !pag.aplicado_em && !pag.estornado_em) {
      if (valorCentavos + 1 < ped.valor_centavos) {
        L.auditar("mercadopago", "pagamento_valor_divergente", ped.id, { mpId, valorCentavos, esperado: ped.valor_centavos });
        return;
      }
      const cliente = clienteDo(ped);
      const oferta = db.prepare("SELECT * FROM ofertas WHERE id = ?").get(ped.oferta_id);
      let emitiu = 0;

      if (!ped.licenca_id) {
        const r = L.emitirLicenca({
          email: cliente.email,
          nome: cliente.nome,
          plano: ped.plano,
          dias: ped.plano === "anual" ? cfg.DIAS_ANUAL : undefined,
          maxMaquinas: oferta?.max_maquinas || cfg.MAX_MAQUINAS_PADRAO,
          observacao: `Pedido ${ped.id}`,
          ator: "mercadopago",
        });
        db.prepare("UPDATE pedidos SET licenca_id = ? WHERE id = ?").run(r.id, ped.id);
        db.prepare("UPDATE assinaturas SET licenca_id = ? WHERE pedido_id = ?").run(r.id, ped.id);
        emitiu = 1;
        emails.push(["licenca_emitida", cliente.email, {
          nome: cliente.nome || "", chave: r.chave, plano: NOME_PLANO[ped.plano] || ped.plano, validade: dataBR(r.validaAte),
          download: conteudo.obter("site.geral").linkDownload || cfg.PUBLIC_URL,
        }]);
      } else {
        const lic = L.estender(ped.licenca_id, { dias: cfg.DIAS_ANUAL }, "mercadopago");
        if (lic.status === "suspensa") L.alterarStatus(lic.id, "ativa", null, "mercadopago");
        emails.push(["renovacao_confirmada", cliente.email, {
          nome: cliente.nome || "", plano: NOME_PLANO[lic.plano] || lic.plano, validade: dataBR(lic.valida_ate),
        }]);
      }
      db.prepare("UPDATE pagamentos SET aplicado_em = ?, emitiu_licenca = ? WHERE id = ?").run(agora, emitiu, pag.id);
      db.prepare("UPDATE pedidos SET status = 'pago', pago_em = COALESCE(pago_em, ?), atualizado_em = ? WHERE id = ?").run(agora, agora, ped.id);
      L.auditar("mercadopago", "pagamento_aplicado", ped.id, { mpId, origem, valorCentavos });
      return;
    }

    // --- Estorno / contestação de um pagamento já aplicado ---
    if (["refunded", "charged_back"].includes(status) && pag.aplicado_em && !pag.estornado_em) {
      const cliente = clienteDo(ped);
      const lic = ped.licenca_id ? L.licencaComCliente(ped.licenca_id) : null;
      if (lic) {
        if (pag.emitiu_licenca) {
          L.alterarStatus(lic.id, "revogada", status === "charged_back" ? "Pagamento contestado." : "Pagamento estornado.", "mercadopago");
          emails.push(["pagamento_estornado", cliente.email, { nome: cliente.nome || "" }]);
        } else if (lic.valida_ate) {
          const nova = new Date(new Date(lic.valida_ate).getTime() - cfg.DIAS_ANUAL * DIA_MS).toISOString();
          L.estender(lic.id, { ate: nova }, "mercadopago");
        }
      }
      db.prepare("UPDATE pagamentos SET estornado_em = ? WHERE id = ?").run(agora, pag.id);
      db.prepare("UPDATE pedidos SET status = ?, atualizado_em = ? WHERE id = ?")
        .run(status === "charged_back" ? "contestado" : "reembolsado", agora, ped.id);
      L.auditar("mercadopago", "pagamento_estornado", ped.id, { mpId, status });
    }
  });

  return emails;
}

async function enviarEmails(lista) {
  for (const [modelo, para, vars] of lista) await email.enviar(modelo, para, vars);
}

function processarAssinaturaMp(pre) {
  const db = abrir();
  const pedido = obterPedido(pre.external_reference) ||
    db.prepare("SELECT * FROM pedidos WHERE mp_preapproval_id = ?").get(String(pre.id));
  if (!pedido) return { ignorado: true, emails: [] };
  const emails = [];

  transacao(() => {
    const agora = agoraIso();
    const anterior = db.prepare("SELECT * FROM assinaturas WHERE id = ?").get(String(pre.id));
    const valor = Math.round(Number(pre.auto_recurring?.transaction_amount || pedido.valor_centavos / 100) * 100);
    db.prepare(
      `INSERT INTO assinaturas (id, pedido_id, cliente_id, licenca_id, status, valor_centavos, proxima_cobranca, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, valor_centavos = excluded.valor_centavos,
         proxima_cobranca = excluded.proxima_cobranca, licenca_id = COALESCE(assinaturas.licenca_id, excluded.licenca_id),
         atualizado_em = excluded.atualizado_em`
    ).run(String(pre.id), pedido.id, pedido.cliente_id, pedido.licenca_id, pre.status, valor, pre.next_payment_date || null, agora, agora);
    db.prepare("UPDATE pedidos SET mp_preapproval_id = ?, atualizado_em = ? WHERE id = ?").run(String(pre.id), agora, pedido.id);

    if (anterior && anterior.status !== pre.status) {
      L.auditar("mercadopago", `assinatura_${pre.status}`, pedido.id, { preapproval: pre.id });
      if (pre.status === "cancelled" && anterior.status === "authorized") {
        const cliente = clienteDo(pedido);
        const lic = pedido.licenca_id ? L.licencaComCliente(pedido.licenca_id) : null;
        emails.push(["assinatura_cancelada", cliente.email, { nome: cliente.nome || "", validade: dataBR(lic?.valida_ate) }]);
      }
    }
  });
  return { pedido: obterPedido(pedido.id), emails };
}

// ============================================================================
// Webhooks
// ============================================================================

function registrarEvento({ tipo, acao, recursoId, payload }) {
  const r = abrir()
    .prepare("INSERT INTO eventos_webhook (origem, tipo, acao, recurso_id, payload, recebido_em) VALUES ('mercadopago', ?, ?, ?, ?, ?)")
    .run(tipo || null, acao || null, recursoId ? String(recursoId) : null, JSON.stringify(payload || {}).slice(0, 10000), agoraIso());
  return Number(r.lastInsertRowid);
}

async function processarEvento(eventoId) {
  const db = abrir();
  const ev = db.prepare("SELECT * FROM eventos_webhook WHERE id = ?").get(eventoId);
  if (!ev || ev.processado_em) return;
  try {
    let emails = [];
    if (ev.tipo === "payment" && ev.recurso_id) {
      const pag = await mp.obterPagamento(ev.recurso_id);
      const conhecido = db.prepare("SELECT pedido_id, origem FROM pagamentos WHERE mp_payment_id = ?").get(String(pag.id));
      const pedido = (conhecido && obterPedido(conhecido.pedido_id)) || (pag.external_reference && obterPedido(pag.external_reference));
      if (pedido) emails = aplicarPagamento(pedido, pag, conhecido?.origem || (pedido.modalidade === "assinatura" ? "assinatura" : "checkout"));
    } else if (ev.tipo === "subscription_preapproval" && ev.recurso_id) {
      emails = processarAssinaturaMp(await mp.obterAssinatura(ev.recurso_id)).emails;
    } else if (ev.tipo === "subscription_authorized_payment" && ev.recurso_id) {
      const ap = await mp.obterPagamentoAutorizado(ev.recurso_id);
      let assinatura = db.prepare("SELECT * FROM assinaturas WHERE id = ?").get(String(ap.preapproval_id));
      if (!assinatura && ap.preapproval_id) {
        const r = processarAssinaturaMp(await mp.obterAssinatura(ap.preapproval_id));
        emails.push(...r.emails);
        assinatura = db.prepare("SELECT * FROM assinaturas WHERE id = ?").get(String(ap.preapproval_id));
      }
      const paymentId = ap.payment?.id;
      if (assinatura && paymentId) {
        const pag = await mp.obterPagamento(paymentId);
        emails.push(...aplicarPagamento(obterPedido(assinatura.pedido_id), pag, "assinatura"));
      }
    }
    db.prepare("UPDATE eventos_webhook SET processado_em = ?, tentativas = tentativas + 1, erro = NULL WHERE id = ?").run(agoraIso(), ev.id);
    await enviarEmails(emails);
  } catch (e) {
    // 404 do Mercado Pago = recurso inexistente (ex.: notificação de teste) — não adianta repetir.
    const definitivo = e.mpStatus === 404;
    db.prepare("UPDATE eventos_webhook SET tentativas = tentativas + 1, erro = ?, processado_em = ? WHERE id = ?")
      .run(String(e.message).slice(0, 500), definitivo ? agoraIso() : null, ev.id);
    console.error(`[webhook] evento ${ev.id} (${ev.tipo} ${ev.recurso_id}) falhou:`, e.message);
  }
}

async function reprocessarEventosPendentes() {
  const pendentes = abrir()
    .prepare("SELECT id FROM eventos_webhook WHERE processado_em IS NULL AND tentativas < 8 ORDER BY id LIMIT 50")
    .all();
  for (const { id } of pendentes) await processarEvento(id);
}

// ============================================================================
// Conciliação (não depende de webhook)
// ============================================================================

async function reconciliarPedido(pedidoId) {
  const pedido = obterPedido(pedidoId);
  if (!pedido) throw new LicencaErro("NAO_ENCONTRADO", "Pedido não encontrado.", 404);
  const emails = [];
  if (pedido.mp_preapproval_id) {
    emails.push(...processarAssinaturaMp(await mp.obterAssinatura(pedido.mp_preapproval_id)).emails);
  }
  const busca = await mp.buscarPagamentos(pedido.id);
  const origem = pedido.modalidade === "assinatura" ? "assinatura" : "checkout";
  for (const pag of (busca?.results || []).slice().reverse()) {
    emails.push(...aplicarPagamento(obterPedido(pedido.id), pag, origem));
  }
  // Atualiza também pagamentos já conhecidos (captura estornos).
  const conhecidos = abrir().prepare("SELECT mp_payment_id FROM pagamentos WHERE pedido_id = ?").all(pedido.id);
  const vistos = new Set((busca?.results || []).map((p) => String(p.id)));
  for (const { mp_payment_id } of conhecidos) {
    if (vistos.has(mp_payment_id)) continue;
    emails.push(...aplicarPagamento(obterPedido(pedido.id), await mp.obterPagamento(mp_payment_id), origem));
  }
  await enviarEmails(emails);
  return obterPedido(pedido.id);
}

async function reconciliarPendentes() {
  if (!mp.configurado()) return;
  const db = abrir();
  const limite = new Date(Date.now() - PEDIDO_EXPIRA_DIAS * DIA_MS).toISOString();
  db.prepare("UPDATE pedidos SET status = 'expirado', atualizado_em = ? WHERE status = 'pendente' AND criado_em < ?").run(agoraIso(), limite);
  const pendentes = db
    .prepare(
      `SELECT id FROM pedidos WHERE status = 'pendente' AND (mp_preference_id IS NOT NULL OR mp_preapproval_id IS NOT NULL)
       UNION SELECT pedido_id FROM assinaturas WHERE status IN ('authorized', 'paused')`
    )
    .all();
  for (const { id } of pendentes) {
    try {
      await reconciliarPedido(id);
    } catch (e) {
      console.error(`[conciliação] pedido ${id}:`, e.message);
    }
  }
}

// ============================================================================
// Ações administrativas e do portal
// ============================================================================

async function reembolsarPagamento(mpPaymentId, ator) {
  const pag = abrir().prepare("SELECT * FROM pagamentos WHERE mp_payment_id = ?").get(String(mpPaymentId));
  if (!pag) throw new LicencaErro("NAO_ENCONTRADO", "Pagamento não encontrado.", 404);
  if (pag.status !== "approved") throw new LicencaErro("NAO_REEMBOLSAVEL", "Somente pagamentos aprovados podem ser reembolsados.");
  await mp.reembolsar(pag.mp_payment_id, `refund-${pag.mp_payment_id}`);
  L.auditar(ator, "pagamento_reembolsar", pag.pedido_id, { mpId: pag.mp_payment_id });
  const atualizado = await mp.obterPagamento(pag.mp_payment_id);
  await enviarEmails(aplicarPagamento(obterPedido(pag.pedido_id), atualizado, pag.origem));
  return abrir().prepare("SELECT * FROM pagamentos WHERE id = ?").get(pag.id);
}

async function cancelarAssinaturaMp(assinaturaId, ator) {
  const a = abrir().prepare("SELECT * FROM assinaturas WHERE id = ?").get(String(assinaturaId));
  if (!a) throw new LicencaErro("NAO_ENCONTRADO", "Assinatura não encontrada.", 404);
  await mp.cancelarAssinatura(a.id);
  L.auditar(ator, "assinatura_cancelar", a.pedido_id, { preapproval: a.id });
  const r = processarAssinaturaMp(await mp.obterAssinatura(a.id));
  await enviarEmails(r.emails);
  return abrir().prepare("SELECT * FROM assinaturas WHERE id = ?").get(a.id);
}

// Gera nova chave e envia por e-mail (a chave original não é recuperável).
async function reenviarChave(licencaId, ator) {
  const lic = L.licencaComCliente(String(licencaId));
  if (!lic) throw new LicencaErro("NAO_ENCONTRADO", "Licença não encontrada.", 404);
  const { chave } = L.regenerarChave(lic.id, ator);
  await email.enviar("chave_regenerada", lic.email, { nome: lic.nome || "", chave });
  return { chave };
}

// --- Lembretes de renovação (30, 7 e 1 dia antes) ---
const MARCOS = [30, 7, 1];

async function enviarLembretesRenovacao() {
  const db = abrir();
  const agora = Date.now();
  const ate = new Date(agora + 30 * DIA_MS).toISOString();
  const lics = db
    .prepare(
      `SELECT l.id, l.valida_ate, c.email, c.nome FROM licencas l JOIN clientes c ON c.id = l.cliente_id
        WHERE l.plano = 'anual' AND l.status = 'ativa' AND l.valida_ate IS NOT NULL
          AND l.valida_ate > ? AND l.valida_ate <= ?
          AND NOT EXISTS (SELECT 1 FROM assinaturas a WHERE a.licenca_id = l.id AND a.status = 'authorized')`
    )
    .all(new Date(agora).toISOString(), ate);

  for (const lic of lics) {
    const dias = Math.ceil((new Date(lic.valida_ate).getTime() - agora) / DIA_MS);
    const devidos = MARCOS.filter((m) => dias <= m);
    if (!devidos.length) continue;
    const jaEnviados = new Set(
      db.prepare("SELECT marco FROM avisos_renovacao WHERE licenca_id = ? AND valida_ate = ?").all(lic.id, lic.valida_ate).map((r) => r.marco)
    );
    const menor = Math.min(...devidos);
    if (jaEnviados.has(menor)) continue;
    // Marca o marco atual e os maiores (evita enviar vários lembretes de uma vez).
    for (const m of devidos) {
      db.prepare("INSERT OR IGNORE INTO avisos_renovacao (licenca_id, valida_ate, marco, enviado_em) VALUES (?, ?, ?, ?)")
        .run(lic.id, lic.valida_ate, m, agoraIso());
    }
    await email.enviar("lembrete_renovacao", lic.email, {
      nome: lic.nome || "", validade: dataBR(lic.valida_ate), dias,
      link_renovacao: `${cfg.PUBLIC_URL}/renovar/${lic.id}`,
    });
  }
}

module.exports = {
  NOME_PLANO,
  dataBR,
  semearOfertas,
  listarOfertas,
  obterOferta,
  atualizarOferta,
  iniciarCheckout,
  obterPedido,
  aplicarPagamento,
  processarAssinaturaMp,
  registrarEvento,
  processarEvento,
  reprocessarEventosPendentes,
  reconciliarPedido,
  reconciliarPendentes,
  reembolsarPagamento,
  cancelarAssinaturaMp,
  reenviarChave,
  enviarLembretesRenovacao,
};
