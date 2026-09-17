const test = require("node:test");
const assert = require("node:assert/strict");
const { criarClienteNotaas, NotaasErro } = require("../../fiscal-notaas");
const { iniciarSimulador } = require("../lib/notaas-simulado");

let sim;
test.before(async () => {
  sim = await iniciarSimulador();
});
test.after(() => sim.fechar());

const payload = {
  tomador: { nome: "Maria", cpf: "52998224725" },
  servico: { descricao: "Formatação", codigo: "140101" },
  valores: { total: 180, aliquotaIss: 2 },
};

test("chave inválida vira mensagem em português", async () => {
  const cliente = criarClienteNotaas({ apiKey: "ntaas_errada", baseUrl: sim.url });
  await assert.rejects(cliente.validarChave(), (e) => e instanceof NotaasErro && e.status === 401 && /inválida/.test(e.message));
});

test("sem chave cadastrada, nem cria o cliente", () => {
  assert.throws(() => criarClienteNotaas({ apiKey: "" }), /Cadastre a chave/);
});

test("emite, acompanha a situação e baixa PDF/XML sem repassar a chave à CDN", async () => {
  const cliente = criarClienteNotaas({ apiKey: sim.chave, baseUrl: sim.url });
  const r = await cliente.emitirNFSe(payload, "gsti-nota-1");
  assert.equal(r.status, "queued");
  assert.equal((await cliente.consultar(r.invoiceId)).status, "processing");
  const emitida = await cliente.consultar(r.invoiceId);
  assert.equal(emitida.status, "issued");
  assert.equal(emitida.numeroNfe, "1001");
  const pdf = await cliente.baixarDocumento(r.invoiceId, "pdf");
  assert.ok(pdf.toString().startsWith("%PDF-"));
  const xml = await cliente.baixarDocumento(r.invoiceId, "xml");
  assert.ok(xml.toString().includes("<NFSe>"));
  assert.equal(sim.registro.chaveNaCdn, 0);
});

test("mesma chave de idempotência não duplica a nota", async () => {
  const cliente = criarClienteNotaas({ apiKey: sim.chave, baseUrl: sim.url });
  const a = await cliente.emitirNFSe(payload, "gsti-nota-99");
  const b = await cliente.emitirNFSe(payload, "gsti-nota-99");
  assert.equal(a.invoiceId, b.invoiceId);
});

test("payload incompleto e nota inexistente trazem o motivo", async () => {
  const cliente = criarClienteNotaas({ apiKey: sim.chave, baseUrl: sim.url });
  await assert.rejects(cliente.emitirNFSe({}), (e) => e.status === 400 && /tomador\.nome/.test(e.message));
  await assert.rejects(cliente.consultar("00000000-0000-0000-0000-000000000000"), (e) => e.status === 404);
});

test("sem conexão, mensagem amigável", async () => {
  const cliente = criarClienteNotaas({ apiKey: sim.chave, baseUrl: "http://127.0.0.1:9/api/v1" });
  await assert.rejects(cliente.validarChave(), /Não foi possível conectar/);
});
