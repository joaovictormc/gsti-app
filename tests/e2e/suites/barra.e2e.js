// Barra de título própria: layout abaixo da barra, tema dos botões nativos e atalhos.
const path = require("path");
const fs = require("fs");
const { executarSuite, RAIZ } = require("../lib/ambiente");
const { desktopCapturer } = require("electron");

// Captura a janela real (inclui os botões nativos); só com GSTI_TEST_CAPTURAS=1
async function capturaJanela(w, nome) {
  const [largura, altura] = w.getSize();
  const fontes = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: largura, height: altura } });
  const titulo = w.getTitle();
  const fonte = fontes.find((f) => f.name === titulo) || fontes.find((f) => f.name.includes("GSTI") || f.name.includes("Assistência"));
  if (!fonte) return false;
  fs.mkdirSync(path.join(RAIZ, "tests", "e2e", "saida", "barra"), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, "tests", "e2e", "saida", "barra", nome), fonte.thumbnail.toPNG());
  return true;
}

async function roteiro(ctx) {
  const { w, wc, api, sql, ok, espera, DB, BANCO, USERDATA, TMP, configPath, lerConfig, captura, capturas, recarregar, abrirMenu, entrar, criarAdmin, licenca, arquivos, abertos, dialogos, fase, recriarBanco } = ctx;

  const medir = () => wc.executeJavaScript(`(() => {
    const barra = document.querySelector('[style*="app-region"]') || [...document.querySelectorAll('div')].find(d => getComputedStyle(d).webkitAppRegion === 'drag');
    const paper = document.querySelector('.MuiDrawer-paper');
    const main = document.querySelector('main');
    const r = (e) => e && e.getBoundingClientRect();
    return {
      barra: barra && { top: r(barra).top, altura: r(barra).height, arrasto: getComputedStyle(barra).webkitAppRegion, fundo: getComputedStyle(barra).backgroundColor },
      varBarra: getComputedStyle(document.documentElement).getPropertyValue('--gsti-barra').trim(),
      menuTopo: paper && r(paper).top, menuBase: paper && r(paper).bottom,
      mainTopo: main && r(main).top, mainBase: main && r(main).bottom,
      alturaJanela: innerHeight, rolagemPagina: document.scrollingElement.scrollHeight - innerHeight,
    };
  })()`);

  w.setSize(1280, 800);
  w.center();

  // Configuração inicial (sem banco ainda): barra já aparece
  let m = await medir();
  ok(m.barra && m.barra.top === 0 && m.barra.altura === 36 && m.barra.arrasto === "drag", "barra no topo, 36px, arrastável (tela de configuração inicial)", m);
  ok(m.varBarra === "36px", "layout reserva a altura da barra", m.varBarra);

  let r = await api(`saveInitialConfig(${JSON.stringify({
    dbConfig: DB,
    adminUser: { nome: "Admin Teste", email: "admin@teste.local", login: "admin", password: "Senha#123", confirmPassword: "Senha#123" },
  })})`);
  ok(r.success, "configuração inicial", r);
  await espera(3000);

  // Login
  wc.reload();
  await new Promise((res) => wc.once("did-finish-load", res));
  await espera(3000);
  m = await medir();
  ok(m.rolagemPagina <= 0, "tela de login sem rolagem extra", m);
  if (capturas) {
    w.showInactive();
    await espera(1500);
  }
  if (capturas) ok(await capturaJanela(w, "janela-login.png"), "captura da janela (login)");

  await api(`login({ login: "admin", password: "Senha#123" })`);
  wc.reload();
  await new Promise((res) => wc.once("did-finish-load", res));
  await espera(3500);
  m = await medir();
  ok(m.menuTopo === 36 && Math.round(m.menuBase) === m.alturaJanela, "menu lateral começa abaixo da barra e vai até o fim da janela", m);
  ok(m.mainTopo === 36 && Math.round(m.mainBase) === m.alturaJanela && m.rolagemPagina <= 0, "área principal abaixo da barra, sem rolagem da página", m);
  await espera(800);
  if (capturas) ok(await capturaJanela(w, "janela-claro.png"), "captura da janela (tema claro)");

  // Tema escuro pelo botão do menu
  await wc.executeJavaScript(`document.querySelector('[title="Tema escuro"]').click()`);
  await espera(1200);
  m = await medir();
  ok(m.barra.fundo === "rgb(12, 20, 36)", "barra acompanha o tema escuro", m.barra);
  r = await api("definirTemaBarraTitulo('dark')");
  ok(r.success, "botões nativos recebem as cores do tema", r);
  r = await api("definirTemaBarraTitulo('roxo')");
  ok(!r.success, "tema inválido é ignorado", r);

  // Ordens de Serviço com diálogo aberto: barra continua visível por cima
  await wc.executeJavaScript(`[...document.querySelectorAll('.MuiListItemButton-root')].find(e => e.innerText.trim() === 'Ordens de Serviço').click()`);
  await espera(2000);
  m = await medir();
  ok(m.rolagemPagina <= 0, "Ordens de Serviço sem rolagem da página", m);
  await wc.executeJavaScript(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('Adicionar Nova OS')).click()`);
  await espera(1500);
  const sobre = await wc.executeJavaScript(`(() => { const el = document.elementFromPoint(40, 18); return !!el && getComputedStyle(el.closest('div[style*="position: fixed"]') || el).webkitAppRegion === 'drag'; })()`);
  ok(sobre, "com diálogo aberto a barra continua por cima (janela segue arrastável)");
  await espera(600);
  if (capturas) ok(await capturaJanela(w, "janela-escuro-dialogo.png"), "captura da janela (tema escuro com diálogo)");

  // Atalho de zoom (sem menu padrão)
  wc.sendInputEvent({ type: "keyDown", keyCode: "=", modifiers: ["control"] });
  await espera(400);
  ok(wc.getZoomLevel() > 0, "Ctrl + = aumenta o zoom", wc.getZoomLevel());
  wc.sendInputEvent({ type: "keyDown", keyCode: "0", modifiers: ["control"] });
  await espera(400);
  ok(wc.getZoomLevel() === 0, "Ctrl + 0 volta o zoom", wc.getZoomLevel());
  const { Menu } = require("electron");
  ok(Menu.getApplicationMenu() === null, "menu padrão do Electron removido");
  w.hide();
}

executarSuite({ nome: "barra", roteiro });
