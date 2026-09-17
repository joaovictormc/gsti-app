// Personalização da marca, tela de login e senha do SMTP.
const path = require("path");
const fs = require("fs");
const { executarSuite, RAIZ } = require("../lib/ambiente");
const LOGO = path.join(RAIZ, "build_resources", "icons", "256x256.png");
const FUNDO = path.join(RAIZ, "build_resources", "icons", "512x512.png");

async function roteiro(ctx) {
  const { w, wc, api, sql, ok, espera, DB, BANCO, USERDATA, TMP, configPath, lerConfig, captura, capturas, recarregar, abrirMenu, entrar, criarAdmin, licenca, arquivos, abertos, dialogos, fase, recriarBanco } = ctx;

  const texto = () => wc.executeJavaScript("document.body.innerText");
  w.setSize(1280, 800);

  let r = await api(`saveInitialConfig(${JSON.stringify({
    dbConfig: DB,
    adminUser: { nome: "Admin Teste", email: "admin@teste.local", login: "admin", password: "Senha#123", confirmPassword: "Senha#123" },
  })})`);
  ok(r.success, "configuração inicial", r);
  await espera(3000);

  // Login com a marca padrão
  await recarregar();
  let t = await texto();
  ok(/GSTI App/.test(t) && /Faça login para continuar/.test(t), "login padrão: nome e mensagem padrão");
  ok(/Desenvolvido por João Victor Maciel Campos · versão \d+\.\d+\.\d+/.test(t), "rodapé com crédito padrão e versão", t.slice(-120));
  await captura("login-padrao.png");

  r = await api(`login({ login: "admin", password: "Senha#123" })`);
  ok(r.success, "login admin", r);

  // SMTP: grava uma senha e depois salva com o campo em branco
  r = await api(`saveAppSettings({ email: { host: "smtp.teste.local", port: 587, user: "u@teste.local", pass: "segredo-smtp", from: "u@teste.local" } })`);
  ok(r.success, "salva senha do SMTP", r);
  r = await api(`saveAppSettings({ email: { host: "smtp.teste.local", port: 587, user: "u@teste.local", pass: "", from: "u@teste.local" } })`);
  ok(r.success && lerConfig().email.passCifrada, "salvar com a senha do SMTP em branco mantém a senha gravada", lerConfig().email);

  // Personalização
  const branding = {
    companyName: "Assistência Silva", logoPath: LOGO, backgroundPath: FUNDO, logoComoIcone: true,
    loginSubtitulo: "Bem-vindo à Assistência Silva", creditoExibir: true, creditoNome: "Equipe GSTI",
  };
  r = await api(`saveAppSettings(${JSON.stringify({ branding })})`);
  ok(r.success, "salva personalização", r);
  const disco = lerConfig().branding;
  ok(disco.companyName === "Assistência Silva" && disco.logoComoIcone === true && disco.creditoNome === "Equipe GSTI", "personalização gravada no config.json", disco);

  r = await api(`loadLogoImage(${JSON.stringify(path.join(RAIZ, "build_resources", "icons", "64x64.png"))})`);
  ok(r.success, "admin pode pré-visualizar outra imagem", r);

  // Configurações (captura da nova seção)
  await recarregar(4000);
  ok(await wc.executeJavaScript("document.title") === "Assistência Silva", "título da janela com o nome da empresa");
  await wc.executeJavaScript(`[...document.querySelectorAll('.MuiListItemButton-root')].find(e => e.innerText.trim() === 'Configurações').click()`);
  await espera(2500);
  const temSecao = await wc.executeJavaScript(`(() => {
    const h = [...document.querySelectorAll('h6')].find(e => e.innerText.includes('Personalização da marca'));
    if (!h) return false;
    h.scrollIntoView({ block: 'start' });
    document.querySelector('main').scrollBy(0, -16);
    return true;
  })()`);
  ok(temSecao, "seção Personalização da marca nas Configurações");
  await espera(1200);
  w.setSize(1280, 1300);
  await espera(800);
  await captura("config-marca.png");
  w.setSize(1280, 800);

  await api("logout()");

  // Sem login: só as imagens salvas podem ser lidas
  r = await api(`loadLogoImage(${JSON.stringify(path.join(RAIZ, "build_resources", "icons", "64x64.png"))})`);
  ok(r.success === false, "sem login não lê imagem fora da configuração", r);
  r = await api(`loadLogoImage(${JSON.stringify(LOGO)})`);
  ok(r.success, "sem login lê a logo configurada", r);

  await recarregar();
  t = await texto();
  ok(/Assistência Silva/.test(t) && /Bem-vindo à Assistência Silva/.test(t), "login personalizado: nome e mensagem");
  ok(/Desenvolvido por Equipe GSTI/.test(t), "rodapé com crédito personalizado");
  const logoNaTela = await wc.executeJavaScript(`!!document.querySelector('img[src^="data:image/png"]')`);
  ok(logoNaTela, "logo exibida no login");
  await captura("login-personalizado.png");

  // Sem crédito: só a versão
  await api(`login({ login: "admin", password: "Senha#123" })`);
  r = await api(`saveAppSettings({ branding: { creditoExibir: false } })`);
  await api("logout()");
  await recarregar();
  t = await texto();
  ok(!/Desenvolvido por/.test(t) && /versão/.test(t), "crédito desligado: rodapé só com a versão");
}

executarSuite({ nome: "marca", roteiro });
