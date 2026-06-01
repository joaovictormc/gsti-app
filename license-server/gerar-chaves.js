/**
 * Gera o par de chaves Ed25519 do servidor de licenças.
 *
 * Uso: node gerar-chaves.js
 *
 * - Salva private.key (NUNCA versionar / NUNCA enviar ao cliente).
 * - Salva public.key e imprime a chave pública para você colar em main.js
 *   (constante LICENSE_PUBLIC_KEY do app).
 *
 * ATENÇÃO: ao regenerar as chaves, todas as licenças já emitidas deixam de
 * valer. Faça isso apenas na configuração inicial.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PRIVATE_KEY_PATH = path.join(__dirname, "private.key");
const PUBLIC_KEY_PATH = path.join(__dirname, "public.key");

if (fs.existsSync(PRIVATE_KEY_PATH)) {
  console.error(
    "[ABORTADO] private.key já existe. Apague-o manualmente se realmente quiser regenerar (isso invalida todas as licenças)."
  );
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const pub = publicKey.export({ type: "spki", format: "pem" });
const priv = privateKey.export({ type: "pkcs8", format: "pem" });

fs.writeFileSync(PRIVATE_KEY_PATH, priv);
fs.writeFileSync(PUBLIC_KEY_PATH, pub);

console.log("Chaves geradas com sucesso.");
console.log("\n=== CHAVE PÚBLICA (cole em LICENSE_PUBLIC_KEY no main.js do app) ===\n");
process.stdout.write(pub);
console.log("\nprivate.key salvo apenas no servidor. NÃO versione nem distribua.");
