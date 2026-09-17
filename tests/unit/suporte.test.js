// Suporte (helpdesk): regras dos chamados no servidor, rotas do site, do app e do painel,
// e o módulo do app que abre chamados. Usa uma pasta de dados temporária.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const dados = fs.mkdtempSync(path.join(os.tmpdir(), "gsti-sup-"));
fs.mkdirSync(path.join(dados, "keys"));
fs.writeFileSync(
  path.join(dados, "keys", "teste.key"),
  crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" })
);
process.env.DATA_DIR = dados;

const LS = path.join(__dirname, "..", "..", "license-server");
const L = require(path.join(LS, "lib", "licencas.js"));
const S = require(path.join(LS, "lib", "suporte.js"));
const auth = require(path.join(LS, "lib", "auth.js"));
const { abrir } = require(path.join(LS, "lib", "db.js"));
const { criarSuporteApp, criarRegistroErros } = require(path.join(__dirname, "..", "..", "suporte-app.js"));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(64)]);
const equipe = () => {
  const u = abrir().prepare("SELECT id, nome, email FROM admin_usuarios LIMIT 1").get();
  if (u) return u;
  auth.criarUsuario({ nome: "Ana Suporte", email: "ana@equipe.local", papeis: ["suporte"], senha: "SenhaForte123" });
  return abrir().prepare("SELECT id, nome, email FROM admin_usuarios WHERE email = ?").get("ana@equipe.local");
};
const emails = (modelo) => abrir().prepare("SELECT * FROM emails_log WHERE modelo = ? ORDER BY id").all(modelo);
const esperarEmails = () => new Promise((r) => setTimeout(r, 30));

const novo = (extra = {}) =>
  S.abrirChamado({ nome: "Maria", email: "maria@teste.local", categoria: "erro", assunto: "Erro ao imprimir", mensagem: "O PDF da OS não abre.", ...extra });

test("abrir chamado valida os campos, vincula o cliente e avisa por e-mail", async () => {
  assert.throws(() => novo({ email: "x" }), /e-mail válido/);
  assert.throws(() => novo({ categoria: "nada" }), /tipo do chamado/);
  assert.throws(() => novo({ assunto: "oi" }), /assunto/);
  assert.throws(() => novo({ mensagem: "curto" }), /detalhes/);

  const lic = L.emitirLicenca({ email: "maria@teste.local", nome: "Maria", plano: "anual", dias: 365 });
  const r = novo({ email: "MARIA@teste.local", dadosTecnicos: { versaoApp: "1.4.0" } });
  const c = abrir().prepare("SELECT * FROM chamados WHERE id = ?").get(r.id);
  assert.equal(c.email, "maria@teste.local");
  assert.equal(c.status, "aberto");
  assert.ok(c.cliente_id, "cliente com compra é vinculado pelo e-mail");
  assert.equal(JSON.parse(c.dados_tecnicos).versaoApp, "1.4.0");
  assert.ok(S.tokenConfere(r.id, r.token));
  assert.ok(!S.tokenConfere(r.id + 1, r.token), "o token é de um chamado só");
  assert.match(r.link, new RegExp(`/suporte/chamado/${r.id}\\?t=`));
  await esperarEmails();
  assert.equal(emails("chamado_aberto").at(-1).para, "maria@teste.local");
  assert.ok(emails("chamado_equipe").length >= 1, "equipe é avisada");
  assert.ok(lic.id);
});

test("fluxo de respostas: equipe, nota interna, cliente reabre, fechado bloqueia", async () => {
  const u = equipe();
  const { id } = novo();
  S.responderEquipe(id, { texto: "Pode mandar um print?" }, u);
  let c = S.detalhe(id, { publico: false });
  assert.equal(c.status, "aguardando_cliente");
  assert.equal(c.atribuidoA, u.id, "quem responde assume o chamado sem responsável");
  await esperarEmails();
  assert.match(emails("chamado_respondido").at(-1).assunto, new RegExp(`#${id}`));

  const antes = emails("chamado_respondido").length;
  S.responderEquipe(id, { texto: "Cliente usa versão antiga", interna: true }, u);
  await esperarEmails();
  assert.equal(emails("chamado_respondido").length, antes, "nota interna não envia e-mail");
  assert.equal(S.detalhe(id, { publico: false }).status, "aguardando_cliente", "nota interna não muda a situação");
  const publico = S.detalhe(id, { publico: true });
  assert.ok(!publico.mensagens.some((m) => m.interna), "cliente não vê notas internas");
  assert.equal(publico.dadosTecnicos, undefined);
  assert.match(publico.mensagens[1].autorNome, /^Ana · Suporte$/);

  S.responderCliente(id, "Segue o print");
  assert.equal(S.detalhe(id, { publico: false }).status, "aberto", "resposta do cliente reabre");

  S.atualizarChamado(id, { status: "fechado", prioridade: "alta" }, u);
  c = S.detalhe(id, { publico: false });
  assert.equal(c.status, "fechado");
  assert.ok(c.fechadoEm);
  assert.ok(c.mensagens.some((m) => m.autor === "sistema" && /Alta/.test(m.texto)), "mudança registrada como nota do sistema");
  assert.throws(() => S.responderCliente(id, "Mais uma"), (e) => e.status === 409);
  assert.throws(() => S.atualizarChamado(id, { status: "inventado" }, u), /Situação inválida/);
});

test("anexos: tipos aceitos, limites e janela do cliente", () => {
  const { id, mensagemId } = novo();
  assert.equal(S.anexar(id, mensagemId, PNG, "print.png", { autor: "cliente" }).anexo.mime, "image/png");
  assert.equal(S.anexar(id, mensagemId, Buffer.from("%PDF-1.4 teste"), "nota.pdf", { autor: "cliente" }).anexo.mime, "application/pdf");
  assert.equal(S.anexar(id, mensagemId, Buffer.from("erro X\nlinha 2"), "app.log", { autor: "cliente" }).anexo.mime, "text/plain");
  assert.throws(() => S.anexar(id, mensagemId, Buffer.from("MZ executável"), "virus.exe", { autor: "cliente" }), /Formato não aceito/);
  assert.throws(() => S.anexar(id, mensagemId, Buffer.from("<svg onload=x>"), "x.svg", { autor: "cliente" }), /Formato não aceito/);
  assert.throws(() => S.anexar(id, mensagemId, Buffer.from([0x41, 0x00, 0x42]), "bin.txt", { autor: "cliente" }), /Formato não aceito/);
  assert.throws(() => S.anexar(id, mensagemId, Buffer.alloc(S.MAX_ANEXO + 1, 1), "grande.txt", { autor: "cliente" }), (e) => e.status === 413);
  assert.throws(() => S.anexar(id, mensagemId, PNG, "p.png", { autor: "equipe" }), /Mensagem não encontrada/, "equipe não anexa em mensagem do cliente");
  S.anexar(id, mensagemId, PNG, "4.png", { autor: "cliente" });
  S.anexar(id, mensagemId, PNG, "5.png", { autor: "cliente" });
  assert.throws(() => S.anexar(id, mensagemId, PNG, "6.png", { autor: "cliente" }), /No máximo 5/);

  const antiga = novo();
  abrir().prepare("UPDATE chamado_mensagens SET criado_em = ? WHERE id = ?").run(new Date(Date.now() - 31 * 60000).toISOString(), antiga.mensagemId);
  assert.throws(() => S.anexar(antiga.id, antiga.mensagemId, PNG, "tarde.png", { autor: "cliente" }), (e) => e.status === 409);

  const nota = S.responderEquipe(id, { texto: "log interno", interna: true }, equipe());
  const anexoInterno = S.anexar(id, nota.mensagemId, PNG, "interno.png", { autor: "equipe" }).anexo;
  assert.equal(S.arquivoDoAnexo(id, anexoInterno.id, { publico: true }), null, "anexo de nota interna não é público");
  assert.ok(S.arquivoDoAnexo(id, anexoInterno.id, { publico: false }));
  assert.equal(S.arquivoDoAnexo(id, "../../keys/teste.key", { publico: false }), null);
});

test("fechamento automático de chamados parados", () => {
  const { id } = novo();
  S.responderEquipe(id, { texto: "Resolvido?", status: "aguardando_cliente" }, equipe());
  const ativo = novo();
  abrir().prepare("UPDATE chamados SET atualizado_em = ? WHERE id IN (?, ?)").run(new Date(Date.now() - 8 * 86400000).toISOString(), id, ativo.id);
  assert.ok(S.fecharInativos() >= 1);
  assert.equal(S.detalhe(id, { publico: true }).status, "fechado");
  assert.equal(S.detalhe(ativo.id, { publico: true }).status, "aberto", "chamado aguardando a equipe não fecha sozinho");
  const contagem = S.contagens();
  assert.ok(contagem.semResposta >= 1);
});

// --- HTTP ---
async function servidor() {
  const express = require(path.join(LS, "node_modules", "express"));
  const app = express();
  app.use(express.json({ limit: "200kb" }));
  app.use("/v2", require(path.join(LS, "routes", "app-api.js")));
  app.use("/admin/api", require(path.join(LS, "routes", "admin-api.js")));
  app.use("/", require(path.join(LS, "routes", "suporte.js")));
  const s = app.listen(0);
  await new Promise((r) => s.once("listening", r));
  return { base: `http://127.0.0.1:${s.address().port}`, fechar: () => s.close() };
}

test("site: abrir, acompanhar pelo link, responder e anexar", async () => {
  const { base, fechar } = await servidor();
  try {
    const json = (r) => r.json();
    const post = (url, corpo, headers = {}) => fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(corpo) });

    const robo = await post("/api/suporte/chamados", { email: "robo@x.com", categoria: "erro", assunto: "spam spam", mensagem: "spam spam spam", site: "http://spam" }).then(json);
    assert.equal(robo.numero, 0, "campo invisível preenchido não grava");

    const r = await post("/api/suporte/chamados", { nome: "João", email: "joao@teste.local", categoria: "duvida", assunto: "Como fazer backup", mensagem: "Onde fica o backup automático?" }).then(json);
    assert.ok(r.success && r.id && r.token);
    assert.equal((await fetch(`${base}/api/suporte/chamados/${r.id}`)).status, 404, "sem link nem sessão não acessa");
    assert.equal((await fetch(`${base}/api/suporte/chamados/${r.id}?t=errado`)).status, 404);
    const det = await fetch(`${base}/api/suporte/chamados/${r.id}?t=${r.token}`).then(json);
    assert.equal(det.chamado.assunto, "Como fazer backup");

    const up = await fetch(`${base}/api/suporte/chamados/${r.id}/mensagens/${r.mensagemId}/anexos?t=${r.token}`, {
      method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Nome-Arquivo": encodeURIComponent("tela ção.png") }, body: PNG,
    }).then(json);
    assert.equal(up.anexo.nome, "tela ção.png");
    const arq = await fetch(`${base}/api/suporte/chamados/${r.id}/anexos/${up.anexo.id}?t=${r.token}`);
    assert.equal(arq.status, 200);
    assert.equal(arq.headers.get("content-type"), "image/png");
    assert.match(arq.headers.get("content-security-policy"), /default-src 'none'/);

    const resp = await post(`/api/suporte/chamados/${r.id}/mensagens?t=${r.token}`, { texto: "Achei, obrigado" }).then(json);
    assert.ok(resp.mensagemId);
    assert.equal((await fetch(`${base}/suporte/chamado/${r.id}`)).status, 200);
    assert.equal((await fetch(`${base}/suporte`)).status, 200);
  } finally {
    fechar();
  }
});

test("app: abre e lista chamados com o token da licença", async () => {
  const { base, fechar } = await servidor();
  try {
    const lic = L.emitirLicenca({ email: "loja@teste.local", nome: "Loja", plano: "anual", dias: 365 });
    const { token } = L.ativar({ chave: lic.chave, maquinaId: crypto.randomBytes(16).toString("hex") });
    const erros = criarRegistroErros(3);
    ["a", "b", "c", "d"].forEach((x) => erros.registrar([new Error(`falha ${x}`)]));
    assert.equal(erros.listar().length, 3);

    const appFalso = { getVersion: () => "1.4.0", getLocale: () => "pt-BR" };
    const semLicenca = criarSuporteApp({ app: appFalso, obterServidor: () => base, obterToken: () => "", obterLicenca: () => ({}), erros });
    assert.equal((await semLicenca.abrirChamado({ categoria: "erro", assunto: "x", mensagem: "y" })).semLicenca, true);

    const sup = criarSuporteApp({
      app: appFalso, obterServidor: () => `${base}/`, obterToken: () => token, erros,
      obterLicenca: () => ({ tipo: "full", plano: "anual", active: true, email: "loja@teste.local", modulos: ["estoque"] }),
    });
    const ctx = sup.contexto({ usuario: { nome: "Carla", role: "Admin" }, tela: "OSGrid" });
    assert.equal(ctx.temLicenca, true);
    assert.equal(ctx.email, "loja@teste.local");
    assert.equal(ctx.dadosTecnicos.tela, "OSGrid");

    const r = await sup.abrirChamado({
      categoria: "erro", assunto: "Tela travou", mensagem: "Travou ao salvar a OS", email: "carla@loja.local",
      usuario: { nome: "Carla", role: "Admin" }, tela: "OSGrid", captura: PNG,
    });
    assert.equal(r.success, true, r.error);
    assert.equal(r.avisoCaptura, null);
    const c = S.detalhe(r.numero, { publico: false });
    assert.equal(c.origem, "app");
    assert.equal(c.email, "carla@loja.local", "responde no e-mail informado");
    assert.equal(c.licencaId, lic.id);
    assert.equal(c.dadosTecnicos.errosRecentes.length, 3);
    assert.equal(c.mensagens[0].anexos[0].nome, "captura-da-tela.png");

    const lista = await sup.listarChamados();
    assert.ok(lista.itens.some((i) => i.numero === r.numero), "lista inclui chamados da licença mesmo com outro e-mail");
    assert.ok(sup.linkPermitido(lista.itens[0].link));
    assert.ok(!sup.linkPermitido("https://golpe.example/suporte/chamado/1"));
    assert.ok(!sup.linkPermitido(`${base}/admin`), "só páginas de suporte");
    assert.ok(sup.linkPermitido(`${base}/suporte`));

    const invalido = criarSuporteApp({ app: appFalso, obterServidor: () => base, obterToken: () => "abc.def", obterLicenca: () => ({}) });
    assert.match((await invalido.abrirChamado({ categoria: "erro", assunto: "Assunto ok", mensagem: "Mensagem longa ok" })).error, /não foi reconhecida/);
  } finally {
    fechar();
  }
});

test("painel: papel suporte lista, responde e anexa; sem permissão não acessa", async () => {
  const { base, fechar } = await servidor();
  try {
    auth.criarUsuario({ nome: "Beto Conteúdo", email: "beto@equipe.local", papeis: ["conteudo"], senha: "SenhaForte123" });
    if (!abrir().prepare("SELECT 1 FROM admin_usuarios WHERE email = 'ana@equipe.local'").get()) equipe();
    const entrar = async (email) => {
      const r = await fetch(`${base}/admin/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha: "SenhaForte123" }) });
      const corpo = await r.json();
      return { cookie: r.headers.get("set-cookie").split(";")[0], csrf: corpo.csrf };
    };
    const beto = await entrar("beto@equipe.local");
    assert.equal((await fetch(`${base}/admin/api/suporte/chamados`, { headers: { cookie: beto.cookie } })).status, 403);

    const ana = await entrar("ana@equipe.local");
    const h = { cookie: ana.cookie, "X-CSRF-Token": ana.csrf, "Content-Type": "application/json" };
    const { id } = novo({ assunto: "Pelo painel" });
    const lista = await fetch(`${base}/admin/api/suporte/chamados?busca=%23${id}`, { headers: h }).then((r) => r.json());
    assert.deepEqual(lista.itens.map((i) => i.id), [id]);

    const semCsrf = await fetch(`${base}/admin/api/suporte/chamados/${id}/mensagens`, { method: "POST", headers: { cookie: ana.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ texto: "oi" }) });
    assert.equal(semCsrf.status, 403);
    const resp = await fetch(`${base}/admin/api/suporte/chamados/${id}/mensagens`, { method: "POST", headers: h, body: JSON.stringify({ texto: "Veja o anexo", status: "resolvido" }) }).then((r) => r.json());
    const up = await fetch(`${base}/admin/api/suporte/chamados/${id}/mensagens/${resp.mensagemId}/anexos`, {
      method: "POST", headers: { ...h, "Content-Type": "application/octet-stream", "X-Nome-Arquivo": "passo.png" }, body: PNG,
    }).then((r) => r.json());
    assert.ok(up.success, JSON.stringify(up));
    const det = await fetch(`${base}/admin/api/suporte/chamados/${id}`, { headers: h }).then((r) => r.json());
    assert.equal(det.chamado.status, "resolvido");
    assert.ok(det.equipe.some((u) => u.nome === "Ana Suporte"));
    assert.ok(!det.equipe.some((u) => u.nome === "Beto Conteúdo"), "só quem responde suporte aparece como responsável");
    const atualizado = await fetch(`${base}/admin/api/suporte/chamados/${id}`, { method: "PUT", headers: h, body: JSON.stringify({ prioridade: "urgente" }) }).then((r) => r.json());
    assert.ok(atualizado.success);
  } finally {
    fechar();
  }
});
