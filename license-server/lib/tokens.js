/**
 * Token de licença v2: base64url(JSON payload) + "." + base64url(assinatura Ed25519).
 * O payload carrega "kid" para o app escolher a chave pública correta.
 */
const keys = require("./keys");

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlDecode = (str) => Buffer.from(String(str).replace(/-/g, "+").replace(/_/g, "/"), "base64");

function emitir(dados) {
  const kid = keys.kidAtivo();
  const payload = { v: 2, kid, ...dados };
  const payloadB64 = b64url(JSON.stringify(payload));
  const { assinatura } = keys.assinar(Buffer.from(payloadB64));
  return { token: `${payloadB64}.${b64url(assinatura)}`, payload };
}

// Retorna o payload se a assinatura for válida; senão null.
function decodificar(token) {
  const [payloadB64, sigB64] = String(token || "").split(".");
  if (!payloadB64 || !sigB64) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch (_) {
    return null;
  }
  if (!payload || payload.v !== 2 || !payload.kid) return null;
  if (!keys.verificar(payload.kid, Buffer.from(payloadB64), b64urlDecode(sigB64))) return null;
  return payload;
}

module.exports = { emitir, decodificar };
