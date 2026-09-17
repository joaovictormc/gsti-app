// GSTI Diagnóstico — agente portátil (roda do pen drive no computador em reparo).
// Coleta hardware/saúde, faz testes rápidos, gera o laudo (arquivo + PDF) e envia ao
// GSTI App pela rede local. Nada é instalado nem alterado no computador do cliente.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile, spawn } = require("child_process");
const { coletarBruto } = require("../coleta-windows");
const { executarTestes } = require("../testes-rapidos");
const { montarLaudo, validarLaudo, comparar } = require("../laudo");
const { laudoHtml, comparativoHtml } = require("../laudo-html");
const rede = require("../rede-local");

const VERSAO = require("../versao.json").versao;
// Portátil: configurações e laudos ficam ao lado do .exe (pen drive)
const PASTA_BASE = process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(process.execPath) : path.join(app.getPath("userData")));
const ARQ_CONFIG = path.join(PASTA_BASE, "gsti-diagnostico.json");
const EXTENSAO = "gstilaudo";

let janela = null;

function lerConfig() {
  try {
    return { empresa: "", contato: "", tecnico: "", ...JSON.parse(fs.readFileSync(ARQ_CONFIG, "utf8")) };
  } catch {
    return { empresa: "", contato: "", tecnico: "" };
  }
}

function pastaLaudos() {
  const preferida = path.join(PASTA_BASE, "laudos");
  try {
    fs.mkdirSync(preferida, { recursive: true });
    fs.accessSync(preferida, fs.constants.W_OK);
    return preferida;
  } catch {
    return app.getPath("documents");
  }
}

const empresaDe = (cfg) => ({ nome: cfg.empresa, contato: cfg.contato });

function nomeArquivo(laudo, extensao) {
  const d = new Date(laudo.geradoEm);
  const carimbo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  const ref = laudo.os ? `OS${laudo.os}` : (laudo.equipamento?.modelo || laudo.equipamento?.computador || "equipamento");
  return `laudo-${ref}-${laudo.momento}-${carimbo}.${extensao}`.replace(/[^\w.-]+/g, "_");
}

// "net session" só funciona com permissão de administrador
const ehAdministrador = () =>
  new Promise((resolve) => execFile("net", ["session"], { windowsHide: true }, (erro) => resolve(!erro)));

function criarJanela() {
  Menu.setApplicationMenu(null);
  janela = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    title: "GSTI Diagnóstico",
    backgroundColor: "#f5f7fb",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  janela.loadFile(path.join(__dirname, "index.html"));
  janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  janela.webContents.on("will-navigate", (e) => e.preventDefault());
}

// Página HTML (laudo) em janela própria, sem acesso ao Node
function abrirHtml(html, titulo) {
  const w = new BrowserWindow({ width: 900, height: 900, title: titulo, parent: janela, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
  w.setMenu(null);
  w.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(html).toString("base64")}`);
}

async function htmlParaPdf(html) {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
  try {
    await w.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(html).toString("base64")}`);
    return await w.webContents.printToPDF({ pageSize: "A4", printBackground: true, margins: { marginType: "none" } });
  } finally {
    w.destroy();
  }
}

async function salvarComo(conteudo, nomePadrao, filtro) {
  const r = await dialog.showSaveDialog(janela, { defaultPath: path.join(pastaLaudos(), nomePadrao), filters: [filtro] });
  if (r.canceled || !r.filePath) return { success: false, cancelado: true };
  fs.writeFileSync(r.filePath, conteudo);
  return { success: true, caminho: r.filePath };
}

// ---------------------------------------------------------------------------
ipcMain.handle("agente:estado", async () => ({
  versao: VERSAO,
  admin: await ehAdministrador(),
  config: lerConfig(),
  pastaLaudos: pastaLaudos(),
}));

ipcMain.handle("agente:salvar-config", async (_e, cfg = {}) => {
  const limpo = { empresa: String(cfg.empresa || "").slice(0, 80), contato: String(cfg.contato || "").slice(0, 120), tecnico: String(cfg.tecnico || "").slice(0, 80) };
  try {
    fs.writeFileSync(ARQ_CONFIG, JSON.stringify(limpo, null, 2));
  } catch { /* pen drive protegido contra gravação: segue sem guardar */ }
  return { success: true };
});

ipcMain.handle("agente:diagnosticar", async (event, opcoes = {}) => {
  const avisar = (etapa) => event.sender.send("agente:progresso", etapa);
  try {
    avisar("coleta");
    const bruto = await coletarBruto();
    const testes = await executarTestes({ disco: opcoes.testeDisco !== false, rede: opcoes.testeRede !== false, aoProgredir: avisar });
    avisar("laudo");
    const laudo = montarLaudo(bruto, {
      testes, momento: opcoes.momento, os: String(opcoes.os || "").trim(), tecnico: opcoes.tecnico, observacao: opcoes.observacao, agente: VERSAO,
    });
    return { success: true, laudo };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle("agente:ver-laudo", async (_e, laudo) => {
  abrirHtml(laudoHtml(laudo, { empresa: empresaDe(lerConfig()) }), "Laudo técnico");
  return { success: true };
});

ipcMain.handle("agente:salvar-pdf", async (_e, laudo) => {
  const pdf = await htmlParaPdf(laudoHtml(laudo, { empresa: empresaDe(lerConfig()) }));
  return salvarComo(pdf, nomeArquivo(laudo, "pdf"), { name: "PDF", extensions: ["pdf"] });
});

ipcMain.handle("agente:salvar-arquivo", async (_e, laudo) =>
  salvarComo(JSON.stringify(laudo, null, 2), nomeArquivo(laudo, EXTENSAO), { name: "Laudo GSTI", extensions: [EXTENSAO] })
);

// Comparar com o laudo de entrada (arquivo salvo antes do reparo)
ipcMain.handle("agente:comparar", async (_e, saida) => {
  const r = await dialog.showOpenDialog(janela, { defaultPath: pastaLaudos(), filters: [{ name: "Laudo GSTI", extensions: [EXTENSAO] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return { success: false, cancelado: true };
  let entrada;
  try {
    entrada = JSON.parse(fs.readFileSync(r.filePaths[0], "utf8"));
  } catch {
    return { success: false, error: "Não foi possível ler o arquivo." };
  }
  const v = validarLaudo(entrada);
  if (!v.valido) return { success: false, error: v.erro };
  const [antes, depois] = new Date(entrada.geradoEm) <= new Date(saida.geradoEm) ? [entrada, saida] : [saida, entrada];
  const html = comparativoHtml(antes, depois, { empresa: empresaDe(lerConfig()) });
  abrirHtml(html, "Comparativo do reparo");
  return { success: true, mesmoEquipamento: comparar(antes, depois).mesmoEquipamento, html: true, entrada: antes, saida: depois };
});

ipcMain.handle("agente:salvar-pdf-comparativo", async (_e, { entrada, saida }) => {
  if (!validarLaudo(entrada).valido || !validarLaudo(saida).valido) return { success: false, error: "Laudos inválidos." };
  const pdf = await htmlParaPdf(comparativoHtml(entrada, saida, { empresa: empresaDe(lerConfig()) }));
  return salvarComo(pdf, nomeArquivo(saida, "pdf").replace("laudo-", "comparativo-"), { name: "PDF", extensions: ["pdf"] });
});

ipcMain.handle("agente:descobrir", async () => ({ success: true, itens: await rede.descobrir() }));

ipcMain.handle("agente:enviar", async (_e, { destino, codigo, laudo }) => {
  if (!/^\d{6}$/.test(String(codigo || "").trim())) return { success: false, error: "Digite o código de 6 dígitos mostrado no GSTI App." };
  let alvo = destino;
  if (typeof destino === "string") {
    const m = destino.trim().match(/^([\w.-]+):(\d{2,5})$/);
    if (!m) return { success: false, error: "Informe o endereço no formato IP:porta (ex.: 192.168.0.10:52344)." };
    alvo = { host: m[1], porta: Number(m[2]) };
  }
  return rede.enviar({ ...alvo, codigo, laudo });
});

ipcMain.handle("agente:abrir-pasta", async () => {
  shell.openPath(pastaLaudos());
  return { success: true };
});

// Reabre como administrador (SMART dos discos e temperaturas)
ipcMain.handle("agente:reabrir-admin", async () => {
  const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  const args = app.isPackaged ? [] : [path.join(__dirname)];
  const lista = args.map((a) => `'${a.replace(/'/g, "''")}'`).join(",");
  spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", `Start-Process -FilePath '${exe.replace(/'/g, "''")}'${lista ? ` -ArgumentList ${lista}` : ""} -Verb RunAs`], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
  setTimeout(() => app.quit(), 800);
  return { success: true };
});

app.whenReady().then(criarJanela);
app.on("window-all-closed", () => app.quit());
