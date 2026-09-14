/**
 * Utilitários HTTP: rate limit, cookies, cabeçalhos de segurança e tratamento de erros.
 */
const { LicencaErro } = require("./erros");

// --- Rate limit simples em memória (janela fixa por chave) ---
const janelas = new Map();
setInterval(() => {
  const agora = Date.now();
  for (const [k, j] of janelas) if (j.reinicia <= agora) janelas.delete(k);
}, 60000).unref();

function limitar(max, janelaMin, chaveFn = (req) => req.ip) {
  const janelaMs = janelaMin * 60000;
  return (req, res, next) => {
    const chave = `${req.baseUrl}${req.path}|${chaveFn(req)}`;
    const agora = Date.now();
    let j = janelas.get(chave);
    if (!j || j.reinicia <= agora) {
      j = { n: 0, reinicia: agora + janelaMs };
      janelas.set(chave, j);
    }
    if (++j.n > max) {
      res.set("Retry-After", String(Math.ceil((j.reinicia - agora) / 1000)));
      return res.status(429).json({
        success: false,
        valido: false,
        error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      });
    }
    next();
  };
}

// --- Cookies ---
function lerCookies(req) {
  const out = {};
  for (const parte of String(req.headers.cookie || "").split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const k = parte.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(parte.slice(i + 1).trim());
    } catch {
      /* ignora cookie malformado */
    }
  }
  return out;
}

function definirCookie(req, res, nome, valor, { maxAgeSeg, sameSite = "Lax", path = "/" } = {}) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, `Path=${path}`, "HttpOnly", `SameSite=${sameSite}`];
  if (maxAgeSeg != null) partes.push(`Max-Age=${Math.floor(maxAgeSeg)}`);
  if (req.secure) partes.push("Secure");
  res.append("Set-Cookie", partes.join("; "));
}

function limparCookie(req, res, nome, path = "/") {
  definirCookie(req, res, nome, "", { maxAgeSeg: 0, path });
}

// --- Cabeçalhos de segurança ---
function cabecalhosSeguranca(req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  if (req.secure) res.set("Strict-Transport-Security", "max-age=31536000");
  next();
}

// CSP para páginas HTML (landing, portal e admin).
function csp(req, res, next) {
  res.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "script-src 'self'",
      "connect-src 'self'",
      "form-action 'self' https://www.mercadopago.com.br https://sandbox.mercadopago.com.br",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; ")
  );
  next();
}

// Envolve handlers (sync ou async) convertendo erros de negócio em JSON.
const rota = (fn) => async (req, res, next) => {
  try {
    const r = await fn(req, res);
    if (r !== undefined && !res.headersSent) res.json(r);
  } catch (e) {
    if (e instanceof LicencaErro) {
      return res.status(e.status).json({ success: false, codigo: e.codigo, error: e.message });
    }
    next(e);
  }
};

function tratadorErros(err, req, res, _next) {
  if (err.type === "entity.too.large") return res.status(413).json({ success: false, error: "Requisição grande demais." });
  if (err.type === "entity.parse.failed") return res.status(400).json({ success: false, error: "JSON inválido." });
  console.error(`[erro] ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return;
  res.status(500).json({ success: false, error: "Erro interno no servidor." });
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

module.exports = { limitar, lerCookies, definirCookie, limparCookie, cabecalhosSeguranca, csp, rota, tratadorErros, escapeHtml };
