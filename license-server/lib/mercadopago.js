/**
 * Cliente mínimo da API do Mercado Pago (fetch nativo).
 * Docs: https://www.mercadopago.com.br/developers/pt/reference
 */
const crypto = require("crypto");
const cfg = require("./config");
const segredos = require("./segredos");
const { LicencaErro } = require("./erros");

const configurado = () => !!segredos.obter("MP_ACCESS_TOKEN");

async function chamar(metodo, caminho, corpo, { idempotencia } = {}) {
  if (!configurado()) throw new LicencaErro("MP_NAO_CONFIGURADO", "Pagamentos indisponíveis no momento.", 503);
  const headers = { Authorization: `Bearer ${segredos.obter("MP_ACCESS_TOKEN")}`, "Content-Type": "application/json" };
  if (idempotencia) headers["X-Idempotency-Key"] = idempotencia;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let resp;
  try {
    resp = await fetch(`${cfg.MP_API_BASE}${caminho}`, {
      method: metodo,
      headers,
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new LicencaErro("MP_INDISPONIVEL", `Mercado Pago indisponível (${e.name === "AbortError" ? "tempo esgotado" : e.message}).`, 502);
  } finally {
    clearTimeout(timer);
  }
  const texto = await resp.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = { bruto: texto };
  }
  if (!resp.ok) {
    const msg = dados?.message || dados?.error || `HTTP ${resp.status}`;
    const erro = new LicencaErro("MP_ERRO", `Mercado Pago: ${msg}`, resp.status === 404 ? 404 : 502);
    erro.mpStatus = resp.status;
    erro.mpDados = dados;
    throw erro;
  }
  return dados;
}

const reais = (centavos) => Math.round(centavos) / 100;

// Checkout Pro (pagamento único: Pix, boleto, cartão)
async function criarPreferencia({ pedidoId, titulo, valorCentavos, parcelasMax, comprador, urls }) {
  const pref = await chamar(
    "POST",
    "/checkout/preferences",
    {
      items: [{ id: pedidoId, title: titulo, quantity: 1, unit_price: reais(valorCentavos), currency_id: "BRL" }],
      payer: { name: comprador.nome || undefined, email: comprador.email },
      external_reference: pedidoId,
      notification_url: urls.notificacao || undefined,
      back_urls: { success: urls.sucesso, pending: urls.pendente, failure: urls.falha },
      auto_return: "approved",
      payment_methods: { installments: Math.max(1, parcelasMax || 1) },
      statement_descriptor: segredos.obter("MP_STATEMENT_DESCRIPTOR") || "GSTI APP",
      expiration_date_to: new Date(Date.now() + 3 * 86400000).toISOString(),
    },
    { idempotencia: `pref-${pedidoId}` }
  );
  return { id: pref.id, url: segredos.obterBool("MP_SANDBOX") ? pref.sandbox_init_point || pref.init_point : pref.init_point };
}

// Assinatura sem plano associado (renovação automática anual no cartão)
async function criarAssinatura({ pedidoId, titulo, valorCentavos, comprador, urls }) {
  const pre = await chamar(
    "POST",
    "/preapproval",
    {
      reason: titulo,
      external_reference: pedidoId,
      payer_email: comprador.email,
      back_url: urls.sucesso,
      notification_url: urls.notificacao || undefined,
      auto_recurring: { frequency: 12, frequency_type: "months", transaction_amount: reais(valorCentavos), currency_id: "BRL" },
      status: "pending",
    },
    { idempotencia: `pre-${pedidoId}` }
  );
  return { id: pre.id, url: pre.init_point };
}

const obterPagamento = (id) => chamar("GET", `/v1/payments/${encodeURIComponent(id)}`);
const buscarPagamentos = (externalReference) =>
  chamar("GET", `/v1/payments/search?sort=date_created&criteria=desc&external_reference=${encodeURIComponent(externalReference)}`);
const obterAssinatura = (id) => chamar("GET", `/preapproval/${encodeURIComponent(id)}`);
const cancelarAssinatura = (id) => chamar("PUT", `/preapproval/${encodeURIComponent(id)}`, { status: "cancelled" });
const obterPagamentoAutorizado = (id) => chamar("GET", `/authorized_payments/${encodeURIComponent(id)}`);
const reembolsar = (paymentId, chave) =>
  chamar("POST", `/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {}, { idempotencia: chave });

/**
 * Valida o cabeçalho x-signature do webhook.
 * Manifesto: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (partes ausentes são omitidas),
 * HMAC-SHA256 com a "assinatura secreta" configurada no painel do Mercado Pago.
 */
function validarAssinaturaWebhook({ xSignature, xRequestId, dataId }) {
  const segredo = segredos.obter("MP_WEBHOOK_SECRET");
  if (!segredo) return false;
  const partes = Object.fromEntries(
    String(xSignature || "")
      .split(",")
      .map((p) => p.split("=").map((s) => s.trim()))
      .filter((kv) => kv.length === 2)
  );
  if (!partes.ts || !partes.v1) return false;
  let manifesto = "";
  if (dataId) manifesto += `id:${/^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : dataId};`;
  if (xRequestId) manifesto += `request-id:${xRequestId};`;
  manifesto += `ts:${partes.ts};`;
  const esperado = crypto.createHmac("sha256", segredo).update(manifesto).digest("hex");
  return esperado.length === partes.v1.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
}

module.exports = {
  configurado,
  criarPreferencia,
  criarAssinatura,
  obterPagamento,
  buscarPagamentos,
  obterAssinatura,
  cancelarAssinatura,
  obterPagamentoAutorizado,
  reembolsar,
  validarAssinaturaWebhook,
};
