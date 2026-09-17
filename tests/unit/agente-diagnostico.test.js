// Distribuição do agente GSTI Diagnóstico: publicação, liberação por módulo (licença e
// teste), download pelo app com conferência do sha512 e área do cliente.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const dados = fs.mkdtempSync(path.join(os.tmpdir(), "gsti-agente-"));
fs.mkdirSync(path.join(dados, "keys"));
fs.writeFileSync(
  path.join(dados, "keys", "teste.key"),
  crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" })
);
process.env.DATA_DIR = dados;

const RAIZ = path.join(__dirname, "..", "..");
const LS = path.join(RAIZ, "license-server");
const L = require(path.join(LS, "lib", "licencas.js"));
const A = require(path.join(LS, "lib", "agente-diagnostico.js"));
const { baixarAgente } = require(path.join(RAIZ, "laudos-os.js"));

const maquina = () => crypto.randomBytes(16).toString("hex");
const exe = path.join(dados, "GSTI-Diagnostico-1.2.3.exe");
fs.writeFileSync(exe, crypto.randomBytes(300 * 1024));

async function servidor() {
  const express = require(path.join(LS, "node_modules", "express"));
  const app = express();
  app.use("/atualizacoes", require(path.join(LS, "routes", "atualizacoes.js")));
  const s = app.listen(0);
  await new Promise((r) => s.once("listening", r));
  return { base: `http://127.0.0.1:${s.address().port}`, fechar: () => s.close() };
}

test("publicação exige a versão no nome e guarda sha512", async () => {
  assert.equal(A.publicado(), null);
  const semVersao = path.join(dados, "agente.exe");
  fs.writeFileSync(semVersao, "x");
  await assert.rejects(A.publicar(semVersao), /Nome inválido/);
  const info = await A.publicar(exe);
  assert.equal(info.versao, "1.2.3");
  assert.equal(info.arquivo, "GSTI-Diagnostico-1.2.3-windows-x64.exe", "nome antigo do .exe vira Windows x64");
  assert.equal(info.plataforma, "windows-x64");
  assert.equal(info.sha512, crypto.createHash("sha512").update(fs.readFileSync(exe)).digest("base64"));
  assert.ok(A.publicado().presente);
});

test("várias plataformas: nome do arquivo define a plataforma; cada uma mantém só a versão atual", async () => {
  const gerar = (nome) => { const p = path.join(dados, nome); fs.writeFileSync(p, crypto.randomBytes(1024)); return p; };
  await assert.rejects(A.publicar(gerar("GSTI-Diagnostico-1.2.3-macos-arm64.exe")), /Nome inválido/);
  await assert.rejects(A.publicar(gerar("GSTI-Diagnostico-1.2.3-solaris-x64.zip")), /Nome inválido/);
  await A.publicar(gerar("GSTI-Diagnostico-1.2.0-macos-arm64.zip"));
  await A.publicar(gerar("GSTI-Diagnostico-1.2.4-macos-arm64.zip"));
  await A.publicar(gerar("GSTI-Diagnostico-1.2.3-linux-x64.AppImage"));
  const pub = A.publicado();
  assert.deepEqual(pub.plataformas.map((p) => [p.plataforma, p.versao]).sort(), [["linux-x64", "1.2.3"], ["macos-arm64", "1.2.4"], ["windows-x64", "1.2.3"]]);
  assert.equal(pub.versao, "1.2.3", "topo do resumo continua sendo o Windows");
  assert.ok(!fs.readdirSync(A.DIR).includes("GSTI-Diagnostico-1.2.0-macos-arm64.zip"), "versão anterior da mesma plataforma é removida");
  assert.throws(() => A.caminhoPublicado("macos-x64"), /macOS \(Intel\) ainda não foi publicado/);
  assert.equal(A.caminhoPublicado("qualquer").info.plataforma, "windows-x64");
});

test("liberação: licença com o módulo, sem o módulo, antiga (todos) e cliente do portal", () => {
  const com = L.emitirLicenca({ email: "com@loja.local", plano: "anual", dias: 365, modulos: ["diagnostico"] });
  const sem = L.emitirLicenca({ email: "sem@loja.local", plano: "anual", dias: 365, modulos: ["financeiro"] });
  const antiga = L.emitirLicenca({ email: "antiga@loja.local", plano: "vitalicia" });
  const tok = (lic) => L.ativar({ chave: lic.chave, maquinaId: maquina() }).token;
  assert.ok(A.autorizarApp(tok(com)));
  assert.throws(() => A.autorizarApp(tok(sem)), (e) => e.status === 403 && /não inclui/.test(e.message));
  assert.ok(A.autorizarApp(tok(antiga)), "licença sem lista de módulos inclui todos");
  assert.throws(() => A.autorizarApp("invalido"), (e) => e.status === 401);

  const cliente = (email) => require(path.join(LS, "lib", "db.js")).abrir().prepare("SELECT id FROM clientes WHERE email = ?").get(email).id;
  assert.equal(A.clienteTemModulo(cliente("com@loja.local")), true);
  assert.equal(A.clienteTemModulo(cliente("sem@loja.local")), false);
  L.alterarStatus(com.id, "suspensa", "teste");
  assert.equal(A.clienteTemModulo(cliente("com@loja.local")), false, "licença suspensa não baixa");
});

test("download pelo app confere sha512 e grava na pasta escolhida", async () => {
  const { base, fechar } = await servidor();
  try {
    const lic = L.emitirLicenca({ email: "app@loja.local", plano: "anual", dias: 365, modulos: ["diagnostico"] });
    const token = L.ativar({ chave: lic.chave, maquinaId: maquina() }).token;
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "pendrive-"));

    const r = await baixarAgente({ servidor: `${base}/`, token, pasta });
    assert.equal(r.success, true, r.error);
    assert.equal(r.versao, "1.2.3");
    assert.deepEqual(fs.readFileSync(r.caminho), fs.readFileSync(exe));
    const mac = await baixarAgente({ servidor: base, token, pasta, plataforma: "macos-arm64" });
    assert.equal(mac.versao, "1.2.4");
    assert.match((await baixarAgente({ servidor: base, token, pasta, plataforma: "macos-x64" })).error, /macOS \(Intel\) ainda não foi publicado/);
    assert.deepEqual(fs.readdirSync(pasta).sort(), ["GSTI-Diagnostico-1.2.3-windows-x64.exe", "GSTI-Diagnostico-1.2.4-macos-arm64.zip"], "sem arquivo temporário sobrando");

    const semModulo = L.emitirLicenca({ email: "semmod@loja.local", plano: "anual", dias: 365, modulos: [] });
    const t2 = L.ativar({ chave: semModulo.chave, maquinaId: maquina() }).token;
    assert.match((await baixarAgente({ servidor: base, token: t2, pasta })).error, /não inclui o módulo/);
    assert.match((await baixarAgente({ servidor: base, token: "", pasta })).error, /Ative a licença/);

    // Arquivo trocado no servidor depois da publicação: download recusado
    fs.appendFileSync(path.join(A.DIR, "GSTI-Diagnostico-1.2.3-windows-x64.exe"), "corrompido");
    const pasta2 = fs.mkdtempSync(path.join(os.tmpdir(), "pendrive-"));
    assert.match((await baixarAgente({ servidor: base, token, pasta: pasta2 })).error, /não confere/);
    assert.deepEqual(fs.readdirSync(pasta2), []);
  } finally {
    fechar();
  }
});
