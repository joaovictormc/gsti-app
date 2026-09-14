/**
 * Envio de e-mails transacionais via SMTP (nodemailer), com modelos editáveis
 * (lib/conteudo.js, chaves "email.*"). Sem SMTP configurado, o e-mail é apenas
 * registrado (status "simulado") e impresso no console — útil em desenvolvimento.
 */
const nodemailer = require("nodemailer");
const cfg = require("./config");
const conteudo = require("./conteudo");
const { abrir } = require("./db");
const { markdown, textoPuro } = require("./markdown");
const { escapeHtml } = require("./http");

let transporte = null;
const smtpConfigurado = () => !!(cfg.SMTP_HOST && cfg.SMTP_USER && cfg.SMTP_PASS);

function obterTransporte() {
  if (!transporte && smtpConfigurado()) {
    transporte = nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT,
      secure: cfg.SMTP_SECURE,
      auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
    });
  }
  return transporte;
}

function preencher(modelo, vars, escapar) {
  return String(modelo).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k] ?? "";
    return escapar ? escapeHtml(v) : String(v);
  });
}

function layoutHtml(corpoHtml, produto) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px" cellpadding="0" cellspacing="0">
<tr><td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:18px;color:#1e3a8a">${escapeHtml(produto)}</td></tr>
<tr><td style="padding:24px 32px;font-size:15px;line-height:1.6">${corpoHtml}</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">Mensagem automática. Suporte: ${escapeHtml(cfg.EMAIL_SUPORTE)}</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Envia um e-mail a partir de um modelo.
 * @param {string} modelo  ex.: "licenca_emitida"
 * @param {string} para
 * @param {object} vars    variáveis do modelo (nome, chave, validade...)
 */
async function enviar(modelo, para, vars = {}) {
  const { nomeProduto } = conteudo.obter("site.geral");
  const m = conteudo.obter(`email.${modelo}`);
  // Valores vindos de clientes (nome etc.) não podem injetar links/formatação no markdown.
  const LINKS = ["portal", "download", "link", "link_renovacao"];
  const seguros = Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k, LINKS.includes(k) ? String(v ?? "") : String(v ?? "").replace(/[[\]()*#_`<>]/g, "")])
  );
  const todas = {
    produto: nomeProduto,
    suporte: cfg.EMAIL_SUPORTE,
    portal: `${cfg.PUBLIC_URL}/cliente`,
    email: para,
    ...seguros,
  };
  const assunto = preencher(m.assunto, todas, false).slice(0, 200);
  const fonte = preencher(m.texto, todas, false);
  // Markdown escapa o texto; variáveis entram como texto (links são validados pelo parser).
  const html = layoutHtml(markdown(fonte), nomeProduto);
  const texto = textoPuro(fonte);

  const log = (status, erro = null) =>
    abrir()
      .prepare("INSERT INTO emails_log (para, assunto, modelo, status, erro, criado_em) VALUES (?, ?, ?, ?, ?, ?)")
      .run(para, assunto, modelo, status, erro, new Date().toISOString());

  const t = obterTransporte();
  if (!t) {
    console.log(`\n[email simulado] Para: ${para}\nAssunto: ${assunto}\n${texto}\n`);
    log("simulado");
    return { success: true, simulado: true };
  }
  try {
    await t.sendMail({ from: cfg.EMAIL_FROM, to: para, replyTo: cfg.EMAIL_SUPORTE, subject: assunto, text: texto, html });
    log("enviado");
    return { success: true };
  } catch (e) {
    console.error(`[email] falha ao enviar "${modelo}" para ${para}:`, e.message);
    log("erro", e.message.slice(0, 500));
    return { success: false, error: e.message };
  }
}

module.exports = { enviar, smtpConfigurado };
