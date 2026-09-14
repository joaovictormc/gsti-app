/**
 * Webhook do Mercado Pago.
 * Configure no painel do Mercado Pago (Suas integrações → Webhooks):
 *   URL: <PUBLIC_URL>/webhooks/mercadopago
 *   Eventos: Pagamentos, Planos e assinaturas
 * e copie a "assinatura secreta" para MP_WEBHOOK_SECRET.
 */
const express = require("express");
const cfg = require("../lib/config");
const mp = require("../lib/mercadopago");
const vendas = require("../lib/vendas");
const { limitar } = require("../lib/http");

const r = express.Router();

r.post("/mercadopago", limitar(300, 1), (req, res) => {
  const corpo = req.body || {};
  // Formato atual: ?type=payment&data.id=123 e corpo { type, action, data: { id } }.
  // Formato legado (IPN): ?topic=payment&id=123.
  const tipo = corpo.type || req.query.type || req.query.topic || corpo.topic;
  const recursoId = corpo.data?.id || req.query["data.id"] || req.query.id;

  if (cfg.MP_WEBHOOK_SECRET) {
    const ok = mp.validarAssinaturaWebhook({
      xSignature: req.headers["x-signature"],
      xRequestId: req.headers["x-request-id"],
      dataId: req.query["data.id"] || corpo.data?.id,
    });
    if (!ok) {
      console.warn(`[webhook] assinatura inválida (${tipo} ${recursoId}) de ${req.ip}`);
      return res.status(401).json({ ok: false });
    }
  }

  const eventoId = vendas.registrarEvento({ tipo, acao: corpo.action, recursoId, payload: corpo });
  res.status(200).json({ ok: true });
  // Processa depois de responder (o Mercado Pago espera resposta rápida).
  setImmediate(() => vendas.processarEvento(eventoId).catch(() => {}));
});

module.exports = r;
