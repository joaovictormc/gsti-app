/**
 * Gera um novo par de chaves Ed25519 identificado por "kid".
 *
 * Uso:
 *   node gerar-chaves.js              # kid = data de hoje (ex.: 2026-09-13)
 *   node gerar-chaves.js <kid>        # kid personalizado
 *   node gerar-chaves.js --publicas   # só imprime as chaves públicas existentes
 *
 * A chave privada fica em data/keys/<kid>.key (NUNCA versionar). A mais recente
 * passa a assinar os novos tokens; as anteriores continuam validando tokens já
 * emitidos. Cole o trecho impresso em license-config.js (raiz do app) e gere
 * uma nova build.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { KEYS_DIR } = require("./lib/config");
const { KID_RE } = require("./lib/keys");

function imprimirPublicas() {
  const arquivos = fs.existsSync(KEYS_DIR) ? fs.readdirSync(KEYS_DIR).filter((f) => f.endsWith(".key")).sort() : [];
  if (!arquivos.length) {
    console.log("Nenhuma chave encontrada.");
    return;
  }
  console.log("\n=== Cole em publicKeys no license-config.js do app ===\n");
  for (const arquivo of arquivos) {
    const kid = arquivo.slice(0, -4);
    const pub = crypto
      .createPublicKey(crypto.createPrivateKey(fs.readFileSync(path.join(KEYS_DIR, arquivo), "utf8")))
      .export({ type: "spki", format: "pem" })
      .trim();
    console.log(`    "${kid}": \`${pub}\`,`);
  }
  console.log("");
}

const arg = process.argv[2];
if (arg === "--publicas") {
  imprimirPublicas();
  process.exit(0);
}

const kid = arg || new Date().toISOString().slice(0, 10);
if (!KID_RE.test(kid)) {
  console.error("[ABORTADO] kid inválido (use letras, números, ponto, hífen ou sublinhado).");
  process.exit(1);
}
const destino = path.join(KEYS_DIR, `${kid}.key`);
if (fs.existsSync(destino)) {
  console.error(`[ABORTADO] ${destino} já existe. Escolha outro kid.`);
  process.exit(1);
}

fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
const { privateKey } = crypto.generateKeyPairSync("ed25519");
fs.writeFileSync(destino, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });

console.log(`Chave "${kid}" gerada em ${destino}`);
console.log("Faça BACKUP desse arquivo em local seguro (perdê-lo invalida as licenças assinadas com ele).");
imprimirPublicas();
console.log("Reinicie o servidor para passar a assinar com a chave nova.");
