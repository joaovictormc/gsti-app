/**
 * Gerador de chaves de ativação do GSTI App.
 *
 * Uso:
 *   node generate-license-key.js cliente@exemplo.com
 *
 * A chave gerada é vinculada ao e-mail informado: ela só ativa o sistema
 * quando o cliente digitar exatamente esse e-mail na tela de ativação.
 *
 * IMPORTANTE: o LICENSE_SECRET abaixo precisa ser IDÊNTICO ao definido em
 * main.js. Se alterar um, altere o outro.
 */
const crypto = require("crypto");

const LICENSE_SECRET = "GSTI-APP-LABAPP-2026-#9f3b7a1c";

function normalizeLicenseEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function computeLicenseKey(email) {
  const normalized = normalizeLicenseEmail(email);
  if (!normalized) return "";
  const hex = crypto
    .createHmac("sha256", LICENSE_SECRET)
    .update(normalized)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return hex.match(/.{1,4}/g).join("-");
}

const email = process.argv[2];
if (!email) {
  console.error("Uso: node generate-license-key.js <email-de-contratacao>");
  process.exit(1);
}

const key = computeLicenseKey(email);
console.log("");
console.log("  E-mail de contratação:", normalizeLicenseEmail(email));
console.log("  Chave de ativação:    ", key);
console.log("");
