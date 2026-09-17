// Catálogo público de emissores e pedidos de novos emissores (ranking, avaliação e aviso).
// Usa uma pasta de dados temporária.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const dados = fs.mkdtempSync(path.join(os.tmpdir(), "gsti-emi-"));
fs.mkdirSync(path.join(dados, "keys"));
fs.writeFileSync(
  path.join(dados, "keys", "teste.key"),
  crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" })
);
process.env.DATA_DIR = dados;

const LS = path.join(__dirname, "..", "..", "license-server");
const E = require(path.join(LS, "lib", "emissores.js"));
const L = require(path.join(LS, "lib", "licencas.js"));
const auth = require(path.join(LS, "lib", "auth.js"));
const { abrir } = require(path.join(LS, "lib", "db.js"));
const { EMISSORES } = require(path.join(__dirname, "..", "..", "fiscal-emissores.js"));

const pedido = (extra = {}) => E.registrarPedido({ email: "a@loja.local", origem: "portal", nome: "Focus NFe", documentos: ["NFS-e"], ...extra });

test("catálogo do site é o mesmo do app, sem credenciais", () => {
  const cat = E.catalogo();
  assert.deepEqual(cat.map((c) => c.id), EMISSORES.map((c) => c.id));
  assert.ok(cat.every((c) => !("credenciais" in c)));
});

test("nome normalizado agrupa variações; validações", () => {
  assert.equal(E.chaveDoNome("Fócus-NF-e"), "focusnfe");
  assert.equal(E.chaveDoNome("focus nfe"), "focusnfe");
  assert.throws(() => pedido({ nome: "x" }), /nome do emissor/);
  assert.throws(() => pedido({ documentos: [] }), /Marque quais notas/);
  assert.throws(() => pedido({ documentos: ["Boleto"] }), /Marque quais notas/);
  assert.throws(() => pedido({ uf: "XX" }), /UF inválida/);
  assert.throws(() => pedido({ site: "javascript:alert(1)" }), /site completo/);
  assert.throws(() => pedido({ nome: "Notaas" }), (e) => e.status === 409 && /já está no catálogo/.test(e.message));
  assert.throws(() => pedido({ nome: "emissor nacional" }), (e) => e.status === 409);
});

test("ranking conta clientes distintos e o mesmo cliente não conta duas vezes", () => {
  pedido({ uf: "sp", municipio: "Campinas" });
  pedido({ nome: "FOCUS NF-e", documentos: ["NFS-e", "NF-e"] });
  E.registrarPedido({ email: "b@loja.local", origem: "app", nome: "focusnfe", documentos: ["NFC-e"], uf: "MG" });
  E.registrarPedido({ email: "c@loja.local", origem: "portal", nome: "eNotas", documentos: ["NFS-e"] });
  const r = E.ranking();
  assert.equal(r[0].chave, "focusnfe");
  assert.equal(r[0].pedidos, 2);
  assert.deepEqual(r[0].documentos.sort(), ["NF-e", "NFC-e", "NFS-e"]);
  assert.deepEqual(r[0].ufs, ["MG", "SP"]);
  assert.equal(r[1].pedidos, 1);
  assert.equal(E.pedidosDoCliente("A@loja.local").length, 1, "pedido repetido atualiza em vez de duplicar");
  assert.deepEqual(E.pedidosDoCliente("a@loja.local")[0].documentos, ["NFS-e", "NF-e"]);
});

test("avaliação, nota pública, planejados e aviso por e-mail", async () => {
  await assert.rejects(E.avisarDisponivel("focusnfe", "equipe"), (e) => e.status === 409);
  E.avaliar("focusnfe", { status: "planejado", notaPublica: "Previsto para a 1.5" }, "equipe@x");
  assert.deepEqual(E.planejados().map((p) => p.nome), ["Focus NFe"]);
  assert.equal(E.pedidosDoCliente("b@loja.local")[0].nota_publica, "Previsto para a 1.5");
  assert.throws(() => E.avaliar("focusnfe", { status: "talvez" }, "x"), /Situação inválida/);

  E.avaliar("focusnfe", { status: "disponivel" }, "equipe@x");
  const r = await E.avisarDisponivel("focusnfe", "equipe@x");
  assert.equal(r.enviados, 2);
  const emails = abrir().prepare("SELECT para FROM emails_log WHERE modelo = 'emissor_disponivel' ORDER BY para").all().map((x) => x.para);
  assert.deepEqual(emails, ["a@loja.local", "b@loja.local"]);
  assert.equal((await E.avisarDisponivel("focusnfe", "equipe@x")).enviados, 0, "não avisa duas vezes");
  assert.equal(E.planejados().length, 0);
});

async function servidor() {
  const express = require(path.join(LS, "node_modules", "express"));
  const app = express();
  app.use(express.json());
  app.use("/v2", require(path.join(LS, "routes", "app-api.js")));
  app.use("/admin/api", require(path.join(LS, "routes", "admin-api.js")));
  app.use("/", require(path.join(LS, "routes", "emissores.js")));
  const s = app.listen(0);
  await new Promise((r) => s.once("listening", r));
  return { base: `http://127.0.0.1:${s.address().port}`, fechar: () => s.close() };
}

test("rotas: guia público, pedido pelo app e painel com permissões", async () => {
  const { base, fechar } = await servidor();
  try {
    const pagina = await (await fetch(`${base}/emissores`)).text();
    assert.match(pagina, /Notaas/);
    assert.match(pagina, /Como configurar/);
    assert.equal((await fetch(`${base}/api/cliente/emissores`)).status, 401, "área do cliente exige sessão");

    const lic = L.emitirLicenca({ email: "app@loja.local", nome: "Loja App", plano: "anual", dias: 365 });
    const { token } = L.ativar({ chave: lic.chave, maquinaId: crypto.randomBytes(16).toString("hex") });
    const semToken = await fetch(`${base}/v2/emissores/pedidos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(semToken.status, 401);
    const r = await fetch(`${base}/v2/emissores/pedidos`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-gsti-licenca": token },
      body: JSON.stringify({ nome: "WebmaniaBR", documentos: ["NF-e"], uf: "PR" }),
    }).then((x) => x.json());
    assert.ok(r.success, JSON.stringify(r));
    const salvo = abrir().prepare("SELECT * FROM emissores_pedidos WHERE chave = 'webmaniabr'").get();
    assert.equal(salvo.origem, "app");
    assert.equal(salvo.email, "app@loja.local");
    assert.ok(salvo.cliente_id, "vinculado ao cliente da licença");

    for (const [email, papeis] of [["sup@eq.local", ["suporte"]], ["lic@eq.local", ["licencas"]], ["fin@eq.local", ["financeiro"]]]) {
      auth.criarUsuario({ nome: email, email, papeis, senha: "SenhaForte123" });
    }
    const entrar = async (email) => {
      const res = await fetch(`${base}/admin/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha: "SenhaForte123" }) });
      const corpo = await res.json();
      return { cookie: res.headers.get("set-cookie").split(";")[0], "X-CSRF-Token": corpo.csrf, "Content-Type": "application/json" };
    };
    const fin = await entrar("fin@eq.local");
    assert.equal((await fetch(`${base}/admin/api/emissores`, { headers: fin })).status, 403);
    const sup = await entrar("sup@eq.local");
    const lista = await fetch(`${base}/admin/api/emissores`, { headers: sup }).then((x) => x.json());
    assert.ok(lista.itens.some((i) => i.chave === "webmaniabr"));
    const naoPode = await fetch(`${base}/admin/api/emissores/webmaniabr`, { method: "PUT", headers: sup, body: JSON.stringify({ status: "planejado" }) });
    assert.equal(naoPode.status, 403, "suporte vê, mas não altera");
    const licH = await entrar("lic@eq.local");
    const ok = await fetch(`${base}/admin/api/emissores/webmaniabr`, { method: "PUT", headers: licH, body: JSON.stringify({ status: "em_analise", notaPublica: "Avaliando a API" }) }).then((x) => x.json());
    assert.ok(ok.success);
    const det = await fetch(`${base}/admin/api/emissores/webmaniabr`, { headers: licH }).then((x) => x.json());
    assert.equal(det.emissor.status, "em_analise");
    assert.equal(det.pedidos[0].cliente_nome, "Loja App");
    assert.match(await (await fetch(`${base}/emissores`)).text(), /WebmaniaBR[\s\S]*Em análise/, "guia mostra os emissores em estudo");
  } finally {
    fechar();
  }
});
