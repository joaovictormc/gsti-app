// Suporte pelo app: abre chamado no servidor de licenças real (temporário), com dados
// técnicos e captura da tela, e lista "Meus chamados".
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");
const { shell } = require("electron");
const { executarSuite, RAIZ } = require("../lib/ambiente");

const PORTA = 3151;
const BASE = `http://127.0.0.1:${PORTA}`;
const DADOS = path.join(os.tmpdir(), "gsti-e2e-suporte-servidor");
const EMAIL = "loja@suporte-e2e.local";
const externos = [];
let servidor = null;

async function preparar(ctx) {
  fs.rmSync(DADOS, { recursive: true, force: true });
  fs.mkdirSync(path.join(DADOS, "keys"), { recursive: true });
  fs.writeFileSync(path.join(DADOS, "keys", "e2e.key"), crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }));
  const env = { ...process.env, DATA_DIR: DADOS, PORT: String(PORTA), HOST: "127.0.0.1", PUBLIC_URL: BASE, JOBS: "0" };
  delete env.ELECTRON_RUN_AS_NODE;
  const LS = path.join(RAIZ, "license-server");
  const token = execFileSync("node", ["-e", `
    const L = require(${JSON.stringify(path.join(LS, "lib", "licencas.js"))});
    const lic = L.emitirLicenca({ email: "${EMAIL}", nome: "Loja E2E", plano: "anual", dias: 365 });
    console.log(L.ativar({ chave: lic.chave, maquinaId: "${crypto.randomBytes(16).toString("hex")}" }).token);
  `], { env }).toString().trim().split(/\r?\n/).pop();

  servidor = spawn("node", [path.join(LS, "server.js")], { env, cwd: LS, stdio: "ignore" });
  process.on("exit", () => servidor && servidor.kill());
  for (let i = 0; i < 40; i++) {
    await ctx.espera(250);
    try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* subindo */ }
  }

  // Licença do app: token real no config.json e o servidor temporário no gerenciador simulado
  fs.writeFileSync(ctx.configPath, JSON.stringify({ license: { token, email: EMAIL, tipo: "full", plano: "anual" } }));
  Object.assign(ctx.licenca, { email: EMAIL, serverUrl: BASE });
  ctx.token = token;
  shell.openExternal = async (url) => { externos.push(url); };
}

async function roteiro(ctx) {
  const { wc, api, ok, espera, criarAdmin, entrar, recarregar, captura, token } = ctx;
  const texto = () => wc.executeJavaScript("document.body.textContent");
  const noDialogo = (js) => wc.executeJavaScript(`(() => { const d = document.querySelector('.MuiDialog-root'); ${js} })()`);
  const preencher = (rotulo, valor) => noDialogo(`
    const l = [...d.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(rotulo)}));
    const el = document.getElementById(l.htmlFor);
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(valor)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;`);
  const clicar = (seletor, rotulo) => wc.executeJavaScript(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(seletor)})].find((x) => x.textContent.trim() === ${JSON.stringify(rotulo)}); if (!b) return false; b.click(); return true; })()`);

  try {
    ok((await criarAdmin()).success, "configuração inicial");
    let r = await api("getSupportContext({ tela: 'HomeScreen' })");
    ok(r.success === false, "suporte exige sessão", r);

    await entrar("admin");
    r = await api("getSupportContext({ tela: 'HomeScreen' })");
    ok(r.success && r.temLicenca && r.email === EMAIL && r.nome === "Admin Teste", "contexto: licença, e-mail e usuário", r);
    ok(r.dadosTecnicos.versaoApp && r.dadosTecnicos.tela === "HomeScreen" && Array.isArray(r.dadosTecnicos.errosRecentes), "dados técnicos preenchidos", r.dadosTecnicos);
    ok(r.urlSite === `${BASE}/suporte`, "link do site de suporte", r.urlSite);

    // Pela interface: botão Suporte na barra lateral
    await recarregar(4000);
    ok(await clicar(".MuiDrawer-paper button", "Suporte"), "botão Suporte na barra lateral");
    await espera(2000);
    let t = await texto();
    ok(/Abrir chamado/.test(t) && /Meus chamados/.test(t) && /Anexar captura da tela atual/.test(t), "diálogo de suporte com opção de captura da tela");
    ok(await noDialogo("return !!d.querySelector('img[alt=\"Captura da tela\"]');"), "prévia da captura da tela");
    ok(await noDialogo("return d.querySelector('input[value]') && [...d.querySelectorAll('input')].some((i) => i.value === '" + EMAIL + "');"), "e-mail da licença preenchido");

    await preencher("Assunto", "Relatório não abre no e2e");
    await preencher("Descreva o que aconteceu", "Ao abrir o relatório de lucratividade a tela fica em branco.");
    await espera(300);
    await captura("suporte-dialogo.png");
    ok(await clicar(".MuiDialog-root button", "Enviar chamado"), "enviar chamado");
    await espera(3500);
    t = await texto();
    ok(/Chamado #1 aberto/.test(t), "confirmação com o número do chamado", t.slice(0, 400));
    await captura("suporte-enviado.png");

    // Conferência no servidor
    const lista = await (await fetch(`${BASE}/v2/suporte/chamados`, { headers: { "x-gsti-licenca": token } })).json();
    const ch = lista.itens.find((i) => i.numero === 1);
    ok(ch && ch.assunto === "Relatório não abre no e2e", "chamado gravado no servidor", lista);
    const det = await (await fetch(`${ch.link.replace(/^https?:\/\/[^/]+\/suporte\/chamado\/(\d+)\?t=/, `${BASE}/api/suporte/chamados/$1?t=`)}`)).json();
    const primeira = det.chamado?.mensagens?.[0];
    ok(primeira && primeira.anexos.some((a) => a.nome === "captura-da-tela.png" && a.mime === "image/png"), "captura da tela anexada ao chamado", det);

    ok(await clicar(".MuiDialog-root button", "Acompanhar no navegador"), "botão acompanhar");
    await espera(500);
    ok(externos.at(-1) === ch.link, "abre o link do chamado no navegador", externos);

    // Meus chamados
    await clicar(".MuiDialog-root button", "Fechar");
    await espera(800);
    await clicar(".MuiDrawer-paper button", "Suporte");
    await espera(1500);
    await clicar(".MuiDialog-root [role=tab]", "Meus chamados");
    await espera(2000);
    t = await texto();
    ok(/#1 · Relatório não abre no e2e/.test(t) && /Aberto/.test(t), "Meus chamados lista o chamado com a situação");
    await captura("suporte-meus-chamados.png");

    r = await api(`openSupportLink("https://golpe.example/suporte/chamado/1")`);
    ok(r.success === false, "não abre links de outros endereços", r);
    r = await api(`openSupportLink("${BASE}/admin")`);
    ok(r.success === false, "não abre páginas que não são de suporte", r);

    // Pedido de novo emissor de nota fiscal (Configurações → Nota fiscal)
    r = await api(`requestFiscalEmitter({ nome: "Focus NFe", documentos: ["NFS-e"], uf: "SP" })`);
    ok(r.success === true, "pedido de emissor pelo app", r);
    r = await api(`requestFiscalEmitter({ nome: "Notaas", documentos: ["NFS-e"] })`);
    ok(r.success === false && /já está no catálogo/.test(r.error), "emissor do catálogo não é pedido", r);

    r = await api(`openSupportTicket({ categoria: "erro", assunto: "oi", mensagem: "curta" })`);
    ok(r.success === false && /assunto/.test(r.error), "validação do servidor chega ao app", r);
  } finally {
    if (servidor) servidor.kill();
  }
}

executarSuite({ nome: "suporte", preparar, roteiro });
