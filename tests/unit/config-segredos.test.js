const test = require("node:test");
const assert = require("node:assert/strict");
const { protegerSegredos, abrirSegredos } = require("../../config-segredos");

// Cofre falso: "cifra" com prefixo e base64
const cofre = (disponivel = true) => ({
  disponivel: () => disponivel,
  cifrar: (t) => Buffer.from("X" + t).toString("base64"),
  decifrar: (b) => {
    const t = Buffer.from(b, "base64").toString();
    if (!t.startsWith("X")) throw new Error("chave errada");
    return t.slice(1);
  },
});

test("grava senhas e credenciais cifradas e abre de volta", () => {
  const config = {
    database: { host: "h", password: "senha-db" },
    email: { pass: "" },
    fiscal: { emissor: "notaas", certificadoSenha: "1234", credenciais: { notaas: { apiKey: "ntaas_x" } } },
  };
  const disco = JSON.parse(JSON.stringify(protegerSegredos(config, cofre())));
  const texto = JSON.stringify(disco);
  assert.ok(!/senha-db|1234|ntaas_x/.test(texto), "nenhum segredo em texto puro");
  assert.equal(config.database.password, "senha-db", "a config em memória não é alterada");

  const r = abrirSegredos(disco, cofre());
  assert.deepEqual(r, { falhas: [], precisaRegravar: false });
  assert.equal(disco.database.password, "senha-db");
  assert.equal(disco.fiscal.certificadoSenha, "1234");
  assert.deepEqual(disco.fiscal.credenciais, { notaas: { apiKey: "ntaas_x" } });
  assert.equal(disco.fiscal.emissor, "notaas");
});

test("config antiga em texto puro pede regravação", () => {
  const antiga = { database: { password: "db" }, email: { pass: "p" } };
  assert.deepEqual(abrirSegredos(antiga, cofre()), { falhas: [], precisaRegravar: true });
  assert.equal(antiga.database.password, "db");
});

test("segredo de outro computador vira falha, sem quebrar", () => {
  const disco = { database: { passwordCifrada: "lixo" }, fiscal: { credenciaisCifradaJson: "lixo" } };
  const r = abrirSegredos(disco, cofre());
  assert.deepEqual(r.falhas.sort(), ["database", "fiscal"]);
  assert.equal(disco.database.password, "");
  assert.deepEqual(disco.fiscal.credenciais, {});
});

test("sem cofre disponível, mantém texto puro ao gravar", () => {
  const disco = protegerSegredos({ database: { password: "db" } }, cofre(false));
  assert.equal(disco.database.password, "db");
  assert.equal(disco.database.passwordCifrada, undefined);
});
