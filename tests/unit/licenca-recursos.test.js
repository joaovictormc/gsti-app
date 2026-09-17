// Servidor de licenças: recurso "emissorFiscal" só com assinatura anual ativa ou cortesia.
// Usa uma pasta de dados temporária (não mexe em license-server/data).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const dados = fs.mkdtempSync(path.join(os.tmpdir(), "gsti-lic-"));
fs.mkdirSync(path.join(dados, "keys"));
fs.writeFileSync(
  path.join(dados, "keys", "teste.key"),
  crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" })
);
process.env.DATA_DIR = dados;

const LS = path.join(__dirname, "..", "..", "license-server", "lib");
const L = require(path.join(LS, "licencas.js"));
const { abrir } = require(path.join(LS, "db.js"));
const tokens = require(path.join(LS, "tokens.js"));

const maquina = () => crypto.randomBytes(16).toString("hex");
const recursos = (token) => tokens.decodificar(token).recursos;

test("anual avulsa, vitalícia e trial não têm emissor fiscal", () => {
  const avulsa = L.emitirLicenca({ email: "avulsa@teste.local", plano: "anual", dias: 365 });
  const r = L.ativar({ chave: avulsa.chave, maquinaId: maquina() });
  assert.deepEqual(recursos(r.token), []);
  assert.deepEqual(r.detalhes.recursos, []);
  const vitalicia = L.emitirLicenca({ email: "vitalicia@teste.local", plano: "vitalicia" });
  assert.deepEqual(recursos(L.ativar({ chave: vitalicia.chave, maquinaId: maquina() }).token), []);
  assert.deepEqual(recursos(L.iniciarTrial({ email: "trial@teste.local", maquinaId: maquina() }).token), []);
});

test("assinatura anual ativa libera; cancelada perde na revalidação", () => {
  const anual = L.emitirLicenca({ email: "assinante@teste.local", plano: "anual", dias: 365 });
  const db = abrir();
  const agora = new Date().toISOString();
  const cliente = db.prepare("SELECT cliente_id FROM licencas WHERE id = ?").get(anual.id).cliente_id;
  db.prepare("INSERT INTO pedidos (id, cliente_id, oferta_id, plano, modalidade, tipo, valor_centavos, status, licenca_id, criado_em, atualizado_em) VALUES ('p1', ?, 'anual-assinatura', 'anual', 'assinatura', 'nova', 44700, 'pago', ?, ?, ?)").run(cliente, anual.id, agora, agora);
  db.prepare("INSERT INTO assinaturas (id, pedido_id, cliente_id, licenca_id, status, valor_centavos, criado_em, atualizado_em) VALUES ('a1', 'p1', ?, ?, 'authorized', 44700, ?, ?)").run(cliente, anual.id, agora, agora);
  const r = L.ativar({ chave: anual.chave, maquinaId: maquina() });
  assert.ok(recursos(r.token).includes("emissorFiscal"));

  db.prepare("UPDATE assinaturas SET status = 'cancelled' WHERE id = 'a1'").run();
  const v = L.validar({ token: r.token });
  assert.ok(v.valido);
  assert.deepEqual(recursos(v.token), []);
});

test("licença cortesia (emitida pela equipe) libera", () => {
  const cortesia = L.emitirLicenca({ email: "cortesia@teste.local", plano: "cortesia" });
  assert.ok(recursos(L.ativar({ chave: cortesia.chave, maquinaId: maquina() }).token).includes("emissorFiscal"));
});
