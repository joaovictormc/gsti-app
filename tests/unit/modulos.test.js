const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { criarControleAcesso } = require("../../controle-acesso");
const app = require("../../modulos");
const servidor = require("../../license-server/lib/modulos");

test("catálogo de módulos igual no app, na interface e no servidor de licenças", () => {
  assert.deepEqual(app.MODULOS, servidor.MODULOS);
  const fonte = fs.readFileSync(path.join(__dirname, "..", "..", "renderer", "src", "constants", "modulos.js"), "utf8");
  const chavesInterface = [...fonte.matchAll(/chave: "(\w+)", nome: "([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(chavesInterface, app.MODULOS.map((m) => [m.chave, m.nome]));
});

test("servidor: normaliza, lê e une listas de módulos", () => {
  assert.deepEqual(servidor.normalizarModulos(["relatorios", "x", "financeiro", "relatorios"]), ["financeiro", "relatorios"]);
  assert.equal(servidor.lerModulos(null), null);
  assert.deepEqual(servidor.lerModulos("lixo"), []);
  assert.deepEqual(servidor.unirModulos(["estoque"], ["financeiro"]), ["financeiro", "estoque"]);
});

const admin = { id: 1, nome: "Admin", role: "Admin" };
const func = { id: 2, nome: "Func", role: "Funcionario" };
const tec = { id: 3, nome: "Tec", role: "Tecnico" };

function novo(modulos, permissions = {}) {
  const estado = { modulos };
  const acesso = criarControleAcesso({ obterConfig: () => ({ setupComplete: true, permissions }), obterModulos: () => estado.modulos });
  return { acesso, estado };
}

test("sem o módulo, nem o Admin acessa financeiro/relatórios/estoque", () => {
  const { acesso, estado } = novo([]);
  for (const nivel of ["financeiro", "relatorios", "estoque"]) assert.equal(acesso.pode(admin, nivel), false, nivel);
  assert.equal(acesso.pode(admin, "admin"), true);
  assert.equal(acesso.permissoesDe(admin).canSeeFinancial, false);
  estado.modulos = ["financeiro"];
  assert.equal(acesso.pode(admin, "financeiro"), true);
  assert.equal(acesso.pode(admin, "relatorios"), false);
});

test("lista ausente (token antigo) libera todos os módulos", () => {
  const { acesso } = novo(null);
  assert.ok(acesso.pode(admin, "relatorios") && acesso.moduloLiberado("marca"));
  assert.equal(acesso.modulosLiberados(), null);
});

test("sem o módulo perfis, a tabela de permissões não se aplica", () => {
  const permissions = { funcionario: { canSeeFinancial: true, podeExcluir: false }, tecnico: { somenteOSAtribuidas: false } };
  const semPerfis = novo(["financeiro"], permissions).acesso;
  assert.equal(semPerfis.permissoesDe(func).canSeeFinancial, false, "padrão do funcionário");
  assert.equal(semPerfis.permissoesDe(func).podeExcluir, true, "padrão do funcionário");
  assert.equal(semPerfis.permissoesDe(tec).somenteOSAtribuidas, true, "padrão do técnico");
  const comPerfis = novo(["financeiro", "perfis"], permissions).acesso;
  assert.equal(comPerfis.permissoesDe(func).canSeeFinancial, true);
  assert.equal(comPerfis.permissoesDe(func).podeExcluir, false);
});

test("canal de módulo não contratado responde moduloBloqueado, antes da permissão", async () => {
  const { acesso, estado } = novo([]);
  const registrados = new Map();
  const ipcMain = { handle: (canal, fn) => registrados.set(canal, fn) };
  acesso.protegerIpc(ipcMain);
  ipcMain.handle("get-expenses", async () => ["ok"]);
  ipcMain.handle("select-logo-file", async () => ({ success: true }));
  ipcMain.handle("get-stock", async () => ({ success: true }));
  ipcMain.handle("get-customers", async () => ["clientes"]);
  const evento = { sender: { id: 1, once() {} } };
  acesso.iniciarSessao(evento, admin);

  const r = await registrados.get("get-expenses")(evento);
  assert.equal(r.moduloBloqueado, true);
  assert.equal(r.modulo, "financeiro");
  assert.match(r.error, /Financeiro completo/);
  assert.equal((await registrados.get("select-logo-file")(evento)).modulo, "marca");
  assert.equal((await registrados.get("get-stock")(evento)).modulo, "estoque");
  assert.deepEqual(await registrados.get("get-customers")(evento), ["clientes"], "base continua liberada");

  estado.modulos = ["financeiro", "marca", "estoque"];
  assert.deepEqual(await registrados.get("get-expenses")(evento), ["ok"]);
});
