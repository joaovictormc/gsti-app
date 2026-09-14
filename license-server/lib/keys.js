/**
 * Chaveiro Ed25519. Cada chave privada fica em data/keys/<kid>.key.
 * - A chave ativa assina os novos tokens.
 * - Chaves antigas continuam validando tokens já emitidos (rotação sem quebra).
 * - Para aposentar uma chave VAZADA, apague o arquivo dela.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { KEYS_DIR, ACTIVE_KID } = require("./config");

const KID_RE = /^[A-Za-z0-9._-]{1,40}$/;

let chaves = null; // Map kid -> { privateKey, publicKey }

function carregar() {
  if (chaves) return chaves;
  chaves = new Map();
  if (fs.existsSync(KEYS_DIR)) {
    for (const arquivo of fs.readdirSync(KEYS_DIR).sort()) {
      if (!arquivo.endsWith(".key")) continue;
      const kid = arquivo.slice(0, -4);
      if (!KID_RE.test(kid)) continue;
      const privateKey = crypto.createPrivateKey(
        fs.readFileSync(path.join(KEYS_DIR, arquivo), "utf8")
      );
      chaves.set(kid, { privateKey, publicKey: crypto.createPublicKey(privateKey) });
    }
  }
  return chaves;
}

function kids() {
  return [...carregar().keys()];
}

function kidAtivo() {
  const lista = kids();
  if (ACTIVE_KID) {
    if (!carregar().has(ACTIVE_KID)) throw new Error(`ACTIVE_KID "${ACTIVE_KID}" não encontrado em ${KEYS_DIR}`);
    return ACTIVE_KID;
  }
  if (!lista.length) throw new Error(`Nenhuma chave em ${KEYS_DIR}. Rode: node gerar-chaves.js`);
  return lista[lista.length - 1]; // nomes ordenáveis (data) → o mais recente
}

function assinar(dados) {
  const kid = kidAtivo();
  return { kid, assinatura: crypto.sign(null, dados, carregar().get(kid).privateKey) };
}

function verificar(kid, dados, assinatura) {
  const par = carregar().get(kid);
  if (!par) return false;
  return crypto.verify(null, dados, par.publicKey, assinatura);
}

function publicaPem(kid) {
  return carregar().get(kid).publicKey.export({ type: "spki", format: "pem" });
}

module.exports = { KID_RE, kids, kidAtivo, assinar, verificar, publicaPem };
