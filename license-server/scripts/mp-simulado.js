#!/usr/bin/env node
/**
 * SIMULADOR DO MERCADO PAGO — somente para HOMOLOGAÇÃO.
 *
 * Imita as rotas da API usadas pela plataforma e oferece páginas de "pagamento"
 * onde você escolhe o resultado (aprovar, deixar pendente, recusar). Envia os
 * webhooks assinados para a plataforma, como o Mercado Pago real faria.
 *
 * Uso (com a plataforma configurada com MP_API_BASE=http://127.0.0.1:3099):
 *   node scripts/mp-simulado.js
 *   Painel do simulador: http://localhost:3099  (estornos, chargeback, cobranças da assinatura)
 *
 * Nunca use em produção: não há dinheiro, cartão nem segurança aqui.
 */
const http = require("http");
const crypto = require("crypto");
const cfg = require("../lib/config");

const PORTA = Number(process.env.SIMULADOR_PORTA || 3099);
// Onde a plataforma escuta (webhooks são enviados direto, mesmo sem HTTPS público).
const PLATAFORMA = String(process.env.PLATAFORMA_URL || `http://127.0.0.1:${cfg.PORT}`).replace(/\/+$/, "");
// Endereço do simulador visto pelo navegador (troque ao testar de outro computador, ex.: http://joaosrv:3099).
const PUBLICO = String(process.env.SIMULADOR_URL || `http://localhost:${PORTA}`).replace(/\/+$/, "");

const preferencias = new Map();
const assinaturas = new Map();
const pagamentos = new Map();
const autorizados = new Map();
let seq = 7000000;
const novoId = () => String(++seq);
const agora = () => new Date().toISOString();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function html(res, corpo, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mercado Pago (SIMULADO)</title>
<style>
body{margin:0;font:16px/1.5 system-ui,Segoe UI,sans-serif;background:#eef1f5;color:#1f2937}
.faixa{background:#b91c1c;color:#fff;text-align:center;padding:8px;font-weight:700;letter-spacing:.04em}
.caixa{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 8px 30px rgba(0,0,0,.08)}
h1{font-size:22px;margin:0 0 4px} .valor{font-size:34px;font-weight:800;margin:12px 0}
.muted{color:#6b7280;font-size:14px} button{font:600 15px system-ui;border:0;border-radius:8px;padding:12px 16px;cursor:pointer;width:100%;margin-top:10px}
.ok{background:#009ee3;color:#fff}.pend{background:#f59e0b;color:#1f2937}.rec{background:#e5e7eb}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left}
form.inline{display:inline} form.inline button{width:auto;padding:6px 10px;margin:0 4px 0 0;font-size:13px}
</style></head><body><div class="faixa">SIMULADOR DE HOMOLOGAÇÃO — NENHUM PAGAMENTO REAL</div>${corpo}</body></html>`);
}

function redirecionar(res, url) {
  res.writeHead(303, { Location: url });
  res.end();
}

async function lerCorpo(req) {
  let bruto = "";
  for await (const parte of req) bruto += parte;
  if (!bruto) return {};
  if ((req.headers["content-type"] || "").includes("application/json")) return JSON.parse(bruto);
  return Object.fromEntries(new URLSearchParams(bruto));
}

// Envia a notificação assinada (mesmo formato do Mercado Pago).
async function notificar(tipo, id) {
  const ts = Math.floor(Date.now() / 1000);
  const requestId = crypto.randomUUID();
  const headers = { "Content-Type": "application/json", "x-request-id": requestId };
  if (cfg.MP_WEBHOOK_SECRET) {
    const manifesto = `id:${String(id).toLowerCase()};request-id:${requestId};ts:${ts};`;
    headers["x-signature"] = `ts=${ts},v1=${crypto.createHmac("sha256", cfg.MP_WEBHOOK_SECRET).update(manifesto).digest("hex")}`;
  }
  try {
    const r = await fetch(`${PLATAFORMA}/webhooks/mercadopago?type=${tipo}&data.id=${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: tipo, action: `${tipo}.updated`, data: { id: String(id) }, live_mode: false }),
    });
    console.log(`[webhook] ${tipo} ${id} -> ${r.status}`);
  } catch (e) {
    console.error(`[webhook] falhou (${PLATAFORMA}):`, e.message);
  }
}

function criarPagamento({ referencia, valor, status, tipo = "bank_transfer", parcelas = 1 }) {
  const id = novoId();
  const p = {
    id: Number(id), status, status_detail: status === "approved" ? "accredited" : status,
    external_reference: referencia, transaction_amount: valor, payment_type_id: tipo, installments: parcelas,
    date_created: agora(), date_approved: status === "approved" ? agora() : null,
  };
  pagamentos.set(id, p);
  return p;
}

function cobrarAssinatura(pre) {
  const pag = criarPagamento({ referencia: pre.external_reference, valor: pre.auto_recurring.transaction_amount, status: "approved", tipo: "credit_card" });
  const ap = { id: Number(novoId()), preapproval_id: pre.id, status: "processed", payment: { id: pag.id, status: "approved" }, transaction_amount: pag.transaction_amount, date_created: agora() };
  autorizados.set(String(ap.id), ap);
  const proxima = new Date();
  proxima.setFullYear(proxima.getFullYear() + 1);
  pre.next_payment_date = proxima.toISOString();
  return ap;
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLICO);
  const p = url.pathname;
  let m;
  try {
    // ---------------- API (chamada pela plataforma) ----------------
    if (req.method === "POST" && p === "/checkout/preferences") {
      const b = await lerCorpo(req);
      const id = `pref-${novoId()}`;
      preferencias.set(id, { id, ...b });
      return json(res, 201, { id, init_point: `${PUBLICO}/pagar/${id}`, sandbox_init_point: `${PUBLICO}/pagar/${id}` });
    }
    if (req.method === "POST" && p === "/preapproval") {
      const b = await lerCorpo(req);
      const id = `sim${novoId()}`;
      assinaturas.set(id, { id, status: "pending", reason: b.reason, payer_email: b.payer_email, external_reference: b.external_reference, auto_recurring: b.auto_recurring, back_url: b.back_url, next_payment_date: null, date_created: agora() });
      return json(res, 201, { id, init_point: `${PUBLICO}/assinar/${id}` });
    }
    if (req.method === "GET" && (m = p.match(/^\/v1\/payments\/(\d+)$/))) {
      return pagamentos.has(m[1]) ? json(res, 200, pagamentos.get(m[1])) : json(res, 404, { message: "Payment not found" });
    }
    if (req.method === "GET" && p === "/v1/payments/search") {
      const ref = url.searchParams.get("external_reference");
      return json(res, 200, { results: [...pagamentos.values()].filter((x) => x.external_reference === ref).reverse() });
    }
    if (req.method === "POST" && (m = p.match(/^\/v1\/payments\/(\d+)\/refunds$/))) {
      const pg = pagamentos.get(m[1]);
      if (!pg) return json(res, 404, { message: "Payment not found" });
      pg.status = "refunded";
      return json(res, 201, { id: Number(novoId()), payment_id: pg.id, status: "approved" });
    }
    if (req.method === "GET" && (m = p.match(/^\/preapproval\/([\w-]+)$/))) {
      return assinaturas.has(m[1]) ? json(res, 200, assinaturas.get(m[1])) : json(res, 404, { message: "not found" });
    }
    if (req.method === "PUT" && (m = p.match(/^\/preapproval\/([\w-]+)$/))) {
      const a = assinaturas.get(m[1]);
      if (!a) return json(res, 404, { message: "not found" });
      Object.assign(a, await lerCorpo(req));
      return json(res, 200, a);
    }
    if (req.method === "GET" && (m = p.match(/^\/authorized_payments\/(\d+)$/))) {
      return autorizados.has(m[1]) ? json(res, 200, autorizados.get(m[1])) : json(res, 404, { message: "not found" });
    }

    // ---------------- Páginas de pagamento (navegador) ----------------
    if (req.method === "GET" && (m = p.match(/^\/pagar\/([\w-]+)$/))) {
      const pref = preferencias.get(m[1]);
      if (!pref) return html(res, `<div class="caixa"><h1>Checkout não encontrado</h1><p class="muted">O simulador foi reiniciado? Os dados ficam só na memória.</p></div>`, 404);
      const item = pref.items?.[0] || {};
      return html(res, `<div class="caixa">
        <p class="muted">Checkout Pro · parcelamento em até ${esc(pref.payment_methods?.installments || 1)}x</p>
        <h1>${esc(item.title)}</h1>
        <p class="muted">Comprador: ${esc(pref.payer?.name)} &lt;${esc(pref.payer?.email)}&gt;</p>
        <p class="valor">${brl(item.unit_price)}</p>
        <form method="post" action="/pagar/${esc(pref.id)}"><input type="hidden" name="acao" value="aprovar"><button class="ok">Pagar com Pix (aprovado na hora)</button></form>
        <form method="post" action="/pagar/${esc(pref.id)}"><input type="hidden" name="acao" value="cartao"><button class="ok">Pagar com cartão em 3x (aprovado)</button></form>
        <form method="post" action="/pagar/${esc(pref.id)}"><input type="hidden" name="acao" value="pendente"><button class="pend">Gerar boleto (fica pendente)</button></form>
        <form method="post" action="/pagar/${esc(pref.id)}"><input type="hidden" name="acao" value="recusar"><button class="rec">Cartão recusado</button></form>
        <p class="muted" style="margin-top:16px">Boleto pendente pode ser aprovado depois no <a href="/">painel do simulador</a>.</p>
      </div>`);
    }
    if (req.method === "POST" && (m = p.match(/^\/pagar\/([\w-]+)$/))) {
      const pref = preferencias.get(m[1]);
      if (!pref) return redirecionar(res, "/");
      const { acao } = await lerCorpo(req);
      const valor = pref.items?.[0]?.unit_price;
      const volta = pref.back_urls || {};
      if (acao === "recusar") {
        const pg = criarPagamento({ referencia: pref.external_reference, valor, status: "rejected", tipo: "credit_card" });
        await notificar("payment", pg.id);
        return redirecionar(res, `${volta.failure}&payment_id=${pg.id}&status=rejected`);
      }
      const status = acao === "pendente" ? "pending" : "approved";
      const pg = criarPagamento({ referencia: pref.external_reference, valor, status, tipo: acao === "cartao" ? "credit_card" : acao === "pendente" ? "ticket" : "bank_transfer", parcelas: acao === "cartao" ? 3 : 1 });
      await notificar("payment", pg.id);
      return redirecionar(res, `${status === "approved" ? volta.success : volta.pending}&payment_id=${pg.id}&status=${status}`);
    }
    if (req.method === "GET" && (m = p.match(/^\/assinar\/([\w-]+)$/))) {
      const a = assinaturas.get(m[1]);
      if (!a) return html(res, `<div class="caixa"><h1>Assinatura não encontrada</h1></div>`, 404);
      return html(res, `<div class="caixa">
        <p class="muted">Assinatura · cobrança a cada 12 meses no cartão</p>
        <h1>${esc(a.reason)}</h1>
        <p class="muted">Assinante: ${esc(a.payer_email)}</p>
        <p class="valor">${brl(a.auto_recurring.transaction_amount)} <span class="muted">/ano</span></p>
        <form method="post" action="/assinar/${esc(a.id)}"><input type="hidden" name="acao" value="autorizar"><button class="ok">Autorizar e cobrar o 1º ano</button></form>
        <form method="post" action="/assinar/${esc(a.id)}"><input type="hidden" name="acao" value="desistir"><button class="rec">Desistir</button></form>
      </div>`);
    }
    if (req.method === "POST" && (m = p.match(/^\/assinar\/([\w-]+)$/))) {
      const a = assinaturas.get(m[1]);
      if (!a) return redirecionar(res, "/");
      const { acao } = await lerCorpo(req);
      if (acao === "desistir") return redirecionar(res, `${a.back_url}&falha=1`);
      a.status = "authorized";
      await notificar("subscription_preapproval", a.id);
      const ap = cobrarAssinatura(a);
      await notificar("subscription_authorized_payment", ap.id);
      return redirecionar(res, `${a.back_url}&preapproval_id=${a.id}`);
    }

    // ---------------- Painel do simulador ----------------
    if (req.method === "POST" && p === "/acao") {
      const b = await lerCorpo(req);
      const pg = pagamentos.get(String(b.id));
      const a = assinaturas.get(String(b.id));
      if (b.acao === "aprovar" && pg) { pg.status = "approved"; pg.date_approved = agora(); await notificar("payment", pg.id); }
      if (b.acao === "estornar" && pg) { pg.status = "refunded"; await notificar("payment", pg.id); }
      if (b.acao === "chargeback" && pg) { pg.status = "charged_back"; await notificar("payment", pg.id); }
      if (b.acao === "cobrar" && a) { const ap = cobrarAssinatura(a); await notificar("subscription_authorized_payment", ap.id); }
      if (b.acao === "cancelar" && a) { a.status = "cancelled"; await notificar("subscription_preapproval", a.id); }
      if (b.acao === "pausar" && a) { a.status = "paused"; await notificar("subscription_preapproval", a.id); }
      return redirecionar(res, "/");
    }
    if (req.method === "GET" && p === "/") {
      const botao = (id, acao, rotulo) => `<form class="inline" method="post" action="/acao"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="acao" value="${acao}"><button>${rotulo}</button></form>`;
      const linhasPag = [...pagamentos.values()].reverse().map((x) => `<tr><td>${x.id}</td><td>${brl(x.transaction_amount)}</td><td>${esc(x.payment_type_id)}</td><td><b>${esc(x.status)}</b></td><td>
        ${x.status === "pending" ? botao(x.id, "aprovar", "Aprovar") : ""}
        ${x.status === "approved" ? botao(x.id, "estornar", "Estornar") + botao(x.id, "chargeback", "Chargeback") : ""}</td></tr>`).join("");
      const linhasAss = [...assinaturas.values()].reverse().map((a) => `<tr><td>${esc(a.id)}</td><td>${esc(a.payer_email)}</td><td>${brl(a.auto_recurring.transaction_amount)}</td><td><b>${esc(a.status)}</b></td><td>
        ${a.status === "authorized" ? botao(a.id, "cobrar", "Cobrar próximo ano") + botao(a.id, "pausar", "Pausar") + botao(a.id, "cancelar", "Cancelar") : ""}</td></tr>`).join("");
      return html(res, `<div class="caixa" style="max-width:900px">
        <h1>Painel do simulador</h1>
        <p class="muted">Enviando webhooks para ${esc(PLATAFORMA)}. Dados só em memória (somem ao reiniciar).</p>
        <h2 style="font-size:17px;margin-top:24px">Pagamentos</h2>
        <table><tr><th>ID</th><th>Valor</th><th>Tipo</th><th>Situação</th><th>Ações</th></tr>${linhasPag || `<tr><td colspan="5" class="muted">Nenhum ainda.</td></tr>`}</table>
        <h2 style="font-size:17px;margin-top:24px">Assinaturas</h2>
        <table><tr><th>ID</th><th>Assinante</th><th>Valor/ano</th><th>Situação</th><th>Ações</th></tr>${linhasAss || `<tr><td colspan="5" class="muted">Nenhuma ainda.</td></tr>`}</table>
      </div>`);
    }

    json(res, 404, { message: `simulador: rota não suportada ${req.method} ${p}` });
  } catch (e) {
    console.error("[simulador]", e);
    json(res, 500, { message: e.message });
  }
});

servidor.listen(PORTA, () => {
  console.log("\n  SIMULADOR DO MERCADO PAGO (homologação)");
  console.log(`  Painel:     ${PUBLICO}`);
  console.log(`  Webhooks -> ${PLATAFORMA}/webhooks/mercadopago`);
  console.log(`  Na plataforma use: MP_ACCESS_TOKEN=simulado  MP_API_BASE=http://127.0.0.1:${PORTA}\n`);
});
