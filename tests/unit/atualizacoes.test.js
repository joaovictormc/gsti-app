// Atualização automática: publicação e autorização no servidor de licenças e a máquina de
// estados do atualizador no app (com um electron-updater falso).
// Usa uma pasta de dados temporária (não mexe em license-server/data).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { EventEmitter } = require("events");

const dados = fs.mkdtempSync(path.join(os.tmpdir(), "gsti-atu-"));
fs.mkdirSync(path.join(dados, "keys"));
fs.writeFileSync(
  path.join(dados, "keys", "teste.key"),
  crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" })
);
process.env.DATA_DIR = dados;

const LS = path.join(__dirname, "..", "..", "license-server");
const L = require(path.join(LS, "lib", "licencas.js"));
const A = require(path.join(LS, "lib", "atualizacoes.js"));
const { criarAtualizador, mensagemErro } = require(path.join(__dirname, "..", "..", "atualizacoes.js"));

const maquina = () => crypto.randomBytes(16).toString("hex");

// Simula a saída do electron-builder (instalador + blockmap + latest.yml)
function gerarDist(versao, notas = "") {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "gsti-dist-"));
  const nome = `GSTI-App-Setup-${versao}.exe`;
  const conteudo = crypto.randomBytes(4096);
  fs.writeFileSync(path.join(pasta, nome), conteudo);
  fs.writeFileSync(path.join(pasta, `${nome}.blockmap`), "blockmap");
  const sha512 = crypto.createHash("sha512").update(conteudo).digest("base64");
  const blocoNotas = notas ? `releaseNotes: |-\n${notas.split("\n").map((l) => `  ${l}`).join("\n")}\n` : "";
  fs.writeFileSync(
    path.join(pasta, "latest.yml"),
    `version: ${versao}\nfiles:\n  - url: ${nome}\n    sha512: ${sha512}\n    size: ${conteudo.length}\npath: ${nome}\nsha512: ${sha512}\nreleaseDate: '2026-09-17T12:00:00.000Z'\n${blocoNotas}`
  );
  return { pasta, nome };
}

test("lerLatestYml extrai versão, arquivo, tamanho e notas", () => {
  const { pasta } = gerarDist("1.4.0", "### Novidades\n- Atualização automática");
  const info = A.lerLatestYml(fs.readFileSync(path.join(pasta, "latest.yml"), "utf8"));
  assert.equal(info.versao, "1.4.0");
  assert.equal(info.arquivo, "GSTI-App-Setup-1.4.0.exe");
  assert.equal(info.tamanho, 4096);
  assert.equal(info.notas, "### Novidades\n- Atualização automática");
});

test("publicar copia os arquivos, recusa instalador adulterado e mantém só a versão anterior", async () => {
  assert.equal(A.publicada(), null);
  await A.publicar(gerarDist("1.4.0").pasta);
  await A.publicar(gerarDist("1.4.1").pasta);
  const info = await A.publicar(gerarDist("1.4.2").pasta);
  assert.equal(info.versao, "1.4.2");
  assert.ok(info.instaladorPresente && info.blockmapPresente);
  const exes = fs.readdirSync(A.DIR).filter((f) => f.endsWith(".exe")).sort();
  assert.deepEqual(exes, ["GSTI-App-Setup-1.4.1.exe", "GSTI-App-Setup-1.4.2.exe"]);

  const adulterado = gerarDist("1.4.3");
  fs.appendFileSync(path.join(adulterado.pasta, adulterado.nome), "x");
  await assert.rejects(A.publicar(adulterado.pasta), /sha512/);
  assert.equal(A.publicada().versao, "1.4.2", "falha não troca a versão publicada");
});

test("caminhoSeguro só serve arquivos da pasta com extensões esperadas", () => {
  assert.ok(A.caminhoSeguro("latest.yml"));
  assert.ok(A.caminhoSeguro("GSTI-App-Setup-1.4.2.exe"));
  assert.equal(A.caminhoSeguro("../keys/teste.key"), null);
  assert.equal(A.caminhoSeguro("..\\latest.yml"), null);
  assert.equal(A.caminhoSeguro("gsti.db"), null);
  assert.equal(A.caminhoSeguro("GSTI-App-Setup-9.9.9.exe"), null);
});

test("autorizar: licença ativa e trial no prazo passam; revogada, vencida e inválida não", () => {
  assert.throws(() => A.autorizar(""), (e) => e.status === 401);
  assert.throws(() => A.autorizar("abc.def"), (e) => e.status === 401);

  const lic = L.emitirLicenca({ email: "atualiza@teste.local", plano: "anual", dias: 365 });
  const { token } = L.ativar({ chave: lic.chave, maquinaId: maquina() });
  assert.equal(A.autorizar(token).lic, lic.id);
  L.alterarStatus(lic.id, "suspensa", "teste");
  assert.throws(() => A.autorizar(token), (e) => e.status === 403);

  const trial = L.iniciarTrial({ email: "trial-atualiza@teste.local", maquinaId: maquina() });
  assert.equal(A.autorizar(trial.token).tipo, "trial");
});

test("rota /atualizacoes exige licença e serve o latest.yml sem cache", async () => {
  const express = require(path.join(LS, "node_modules", "express"));
  const app = express();
  app.use("/atualizacoes", require(path.join(LS, "routes", "atualizacoes.js")));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/atualizacoes/win`;
  try {
    const lic = L.emitirLicenca({ email: "rota@teste.local", plano: "anual", dias: 365 });
    const { token } = L.ativar({ chave: lic.chave, maquinaId: maquina() });
    assert.equal((await fetch(`${base}/latest.yml`)).status, 401);
    const ok = await fetch(`${base}/latest.yml`, { headers: { "x-gsti-licenca": token } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("cache-control"), "no-store");
    assert.match(await ok.text(), /version: 1\.4\.2/);
    const parcial = await fetch(`${base}/GSTI-App-Setup-1.4.2.exe`, { headers: { "x-gsti-licenca": token, Range: "bytes=0-9" } });
    assert.equal(parcial.status, 206);
    assert.equal((await parcial.arrayBuffer()).byteLength, 10);
    assert.equal((await fetch(`${base}/nada.exe`, { headers: { "x-gsti-licenca": token } })).status, 404);
  } finally {
    server.close();
  }
});

// --- App ---

function updaterFalso(roteiro) {
  const u = new EventEmitter();
  u.chamadas = { feed: null, headers: null, instalar: 0 };
  u.setFeedURL = (feed) => (u.chamadas.feed = feed);
  Object.defineProperty(u, "requestHeaders", { set: (h) => (u.chamadas.headers = h) });
  u.checkForUpdates = async () => roteiro(u);
  u.quitAndInstall = () => u.chamadas.instalar++;
  return u;
}
const appFalso = (isPackaged = true) => ({ isPackaged, getVersion: () => "1.4.0" });

test("atualizador: fora do app instalado ou sem licença fica indisponível", async () => {
  const u = updaterFalso(() => assert.fail("não deveria consultar"));
  const dev = criarAtualizador({ app: appFalso(false), obterServidor: () => "http://x", obterToken: () => "t", updater: u });
  assert.equal((await dev.verificar()).fase, "indisponivel");
  const semToken = criarAtualizador({ app: appFalso(), obterServidor: () => "http://x", obterToken: () => "", updater: u });
  assert.equal((await semToken.verificar()).fase, "indisponivel");
});

test("atualizador: baixa, fica pronta e só instala quando pronta", async () => {
  const fases = [];
  const u = updaterFalso((up) => {
    up.emit("checking-for-update");
    up.emit("update-available", { version: "1.5.0", releaseNotes: "- Novidade" });
    up.emit("download-progress", { percent: 42.4 });
    up.emit("update-downloaded", { version: "1.5.0" });
  });
  const atu = criarAtualizador({
    app: appFalso(),
    obterServidor: () => "https://licencas.exemplo/",
    obterToken: () => "TOKEN",
    aoMudar: (e) => fases.push(e.fase === "baixando" ? `baixando:${e.progresso}` : e.fase),
    updater: u,
  });
  assert.equal(atu.instalar().success, false);
  const estado = await atu.verificar();
  assert.equal(u.chamadas.feed.url, "https://licencas.exemplo/atualizacoes/win");
  assert.deepEqual(u.chamadas.headers, { "x-gsti-licenca": "TOKEN" });
  assert.equal(estado.fase, "pronta");
  assert.equal(estado.versaoNova, "1.5.0");
  assert.equal(estado.notas, "- Novidade");
  assert.ok(fases.includes("baixando:42"));
  assert.equal(atu.instalar().success, true);
  await new Promise((r) => setImmediate(r));
  assert.equal(u.chamadas.instalar, 1);
});

test("atualizador: erros viram mensagens claras", async () => {
  const u = updaterFalso(() => {
    throw new Error("HttpError: 403 Forbidden");
  });
  const atu = criarAtualizador({ app: appFalso(), obterServidor: () => "http://x", obterToken: () => "t", updater: u });
  const estado = await atu.verificar();
  assert.equal(estado.fase, "erro");
  assert.match(estado.erro, /não tem direito/);
  assert.match(mensagemErro(new Error("net::ERR_INTERNET_DISCONNECTED")), /Sem conexão/);
  assert.match(mensagemErro(new Error("404 Not Found")), /Nenhuma atualização/);
});
