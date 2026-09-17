const test = require("node:test");
const assert = require("node:assert/strict");
const { criarControleAcesso, POLITICAS_IPC, PERMISSOES_PADRAO } = require("../../controle-acesso");

const admin = { id: 1, nome: "Admin", role: "Admin" };
const func = { id: 2, nome: "Func", role: "Funcionario" };
const tec = { id: 3, nome: "Tec", role: "Tecnico" };

function novo(config = { setupComplete: true, permissions: {} }) {
  return criarControleAcesso({ obterConfig: () => config });
}

test("Admin pode tudo; padrões mantêm o Funcionário e restringem o Técnico", () => {
  const acesso = novo();
  for (const nivel of ["admin", "financeiro", "relatorios", "excluir", "custo", "produtos", "estoque", "cadastros", "notas"]) {
    assert.ok(acesso.pode(admin, nivel), `admin: ${nivel}`);
  }
  assert.ok(acesso.pode(func, "excluir") && acesso.pode(func, "custo") && !acesso.pode(func, "financeiro"));
  assert.ok(!acesso.pode(tec, "excluir") && !acesso.pode(tec, "cadastros") && acesso.pode(tec, "sessao"));
  assert.equal(acesso.permissoesDe(tec).somenteOSAtribuidas, true);
  assert.ok(!acesso.pode(null, "sessao") && acesso.pode(null, "publico"));
});

test("permissões salvas em Configurações sobrepõem os padrões do perfil", () => {
  const config = { setupComplete: true, permissions: { tecnico: { canSeeReports: true }, funcionario: { podeExcluir: false } } };
  const acesso = novo(config);
  assert.ok(acesso.pode(tec, "relatorios"));
  assert.ok(!acesso.pode(func, "excluir"));
  assert.equal(acesso.permissoesDe(func).verCusto, PERMISSOES_PADRAO.funcionario.verCusto);
});

test("nível setup só é público antes da configuração inicial", () => {
  const config = { setupComplete: false };
  const acesso = novo(config);
  assert.ok(acesso.pode(null, "setup"));
  config.setupComplete = true;
  assert.ok(!acesso.pode(null, "setup") && !acesso.pode(func, "setup") && acesso.pode(admin, "setup"));
});

test("protegerIpc recusa canal sem política e nega chamadas sem permissão", async () => {
  const acesso = novo();
  const registrados = new Map();
  const ipcMain = { handle: (canal, fn) => registrados.set(canal, fn) };
  acesso.protegerIpc(ipcMain);
  assert.throws(() => ipcMain.handle("canal-sem-politica", () => {}), /sem política/);

  ipcMain.handle("get-users", async () => ({ success: true }));
  const evento = (id) => ({ sender: { id, once() {} } });
  assert.equal((await registrados.get("get-users")(evento(10))).sessaoExpirada, true);
  acesso.iniciarSessao(evento(11), func);
  assert.equal((await registrados.get("get-users")(evento(11))).acessoNegado, true);
  acesso.iniciarSessao(evento(12), admin);
  assert.deepEqual(await registrados.get("get-users")(evento(12)), { success: true });
});

test("toda política usa um nível conhecido", () => {
  assert.doesNotThrow(() => novo());
  assert.ok(Object.keys(POLITICAS_IPC).length > 90);
});
