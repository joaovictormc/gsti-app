// Programas da pós-formatação: catálogo selecionável e instalação silenciosa pelas fontes
// oficiais de cada sistema — Windows: winget (Microsoft), macOS: Homebrew, Linux: Flathub.
// A assistência pode acrescentar programas e instaladores offline em programas/programas.json
// (ao lado do agente).
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const CATEGORIAS = {
  navegadores: "Navegadores",
  escritorio: "Escritório",
  pdf: "Leitores e editores de PDF",
  compactadores: "Compactadores",
  midia: "Áudio e vídeo",
  comunicacao: "Comunicação e reuniões",
  "acesso-remoto": "Acesso remoto",
  nuvem: "Armazenamento em nuvem",
  essenciais: "Componentes essenciais do Windows",
  utilitarios: "Utilitários",
};

// w = winget (Windows), b = cask do Homebrew (macOS), f = Flathub (Linux)
const CATALOGO = [
  { id: "chrome", nome: "Google Chrome", categoria: "navegadores", w: "Google.Chrome", b: "google-chrome", f: "com.google.Chrome", padrao: true },
  { id: "firefox", nome: "Mozilla Firefox", categoria: "navegadores", w: "Mozilla.Firefox.pt-BR", b: "firefox", f: "org.mozilla.firefox" },
  { id: "brave", nome: "Brave", categoria: "navegadores", w: "Brave.Brave", b: "brave-browser", f: "com.brave.Browser" },
  { id: "opera", nome: "Opera", categoria: "navegadores", w: "Opera.Opera", b: "opera", f: "com.opera.Opera" },

  { id: "libreoffice", nome: "LibreOffice", categoria: "escritorio", w: "TheDocumentFoundation.LibreOffice", b: "libreoffice", f: "org.libreoffice.LibreOffice", nota: "Gratuito e livre." },
  { id: "onlyoffice", nome: "ONLYOFFICE Desktop Editors", categoria: "escritorio", w: "ONLYOFFICE.DesktopEditors", b: "onlyoffice", f: "org.onlyoffice.desktopeditors", nota: "Gratuito; visual parecido com o Microsoft Office." },
  { id: "wps", nome: "WPS Office", categoria: "escritorio", w: "Kingsoft.WPSOffice", b: "wpsoffice", f: "com.wps.Office", nota: "Gratuito com anúncios." },
  { id: "office", nome: "Microsoft 365 (Word, Excel, PowerPoint)", categoria: "escritorio", w: "Microsoft.Office", b: "microsoft-office", nota: "Exige licença ou assinatura do cliente; ative com a conta Microsoft do cliente." },

  { id: "acrobat", nome: "Adobe Acrobat Reader", categoria: "pdf", w: "Adobe.Acrobat.Reader.64-bit", b: "adobe-acrobat-reader", padrao: true },
  { id: "foxit", nome: "Foxit PDF Reader", categoria: "pdf", w: "Foxit.FoxitReader" },
  { id: "sumatra", nome: "SumatraPDF (leve)", categoria: "pdf", w: "SumatraPDF.SumatraPDF" },
  { id: "pdf24", nome: "PDF24 Creator (juntar, converter, comprimir PDF)", categoria: "pdf", w: "geeksoftwareGmbH.PDF24Creator" },
  { id: "okular", nome: "Okular", categoria: "pdf", f: "org.kde.okular" },

  { id: "7zip", nome: "7-Zip", categoria: "compactadores", w: "7zip.7zip", b: "keka", f: "io.github.peazip.PeaZip", padrao: true, nota: "No macOS instala o Keka; no Linux, o PeaZip." },
  { id: "winrar", nome: "WinRAR", categoria: "compactadores", w: "RARLab.WinRAR", nota: "Versão de avaliação; uso contínuo exige licença." },

  { id: "vlc", nome: "VLC Media Player", categoria: "midia", w: "VideoLAN.VLC", b: "vlc", f: "org.videolan.VLC", padrao: true },
  { id: "spotify", nome: "Spotify", categoria: "midia", w: "Spotify.Spotify", b: "spotify", f: "com.spotify.Client" },

  { id: "whatsapp", nome: "WhatsApp", categoria: "comunicacao", w: "9NKSQGP7F2NH", fonte: "msstore", b: "whatsapp" },
  { id: "zoom", nome: "Zoom", categoria: "comunicacao", w: "Zoom.Zoom", b: "zoom", f: "us.zoom.Zoom" },
  { id: "teams", nome: "Microsoft Teams", categoria: "comunicacao", w: "Microsoft.Teams", b: "microsoft-teams" },
  { id: "telegram", nome: "Telegram", categoria: "comunicacao", w: "Telegram.TelegramDesktop", b: "telegram", f: "org.telegram.desktop" },
  { id: "discord", nome: "Discord", categoria: "comunicacao", w: "Discord.Discord", b: "discord", f: "com.discordapp.Discord" },

  { id: "anydesk", nome: "AnyDesk", categoria: "acesso-remoto", w: "AnyDesk.AnyDesk", b: "anydesk", f: "com.anydesk.Anydesk", nota: "Gratuito só para uso pessoal." },
  { id: "rustdesk", nome: "RustDesk", categoria: "acesso-remoto", b: "rustdesk", f: "com.rustdesk.RustDesk", nota: "Gratuito e livre." },
  { id: "teamviewer", nome: "TeamViewer", categoria: "acesso-remoto", w: "TeamViewer.TeamViewer", b: "teamviewer", f: "com.teamviewer.TeamViewer", nota: "Gratuito só para uso pessoal." },

  { id: "google-drive", nome: "Google Drive", categoria: "nuvem", w: "Google.GoogleDrive", b: "google-drive" },
  { id: "dropbox", nome: "Dropbox", categoria: "nuvem", w: "Dropbox.Dropbox", b: "dropbox", f: "com.dropbox.Client" },

  { id: "vcredist", nome: "Microsoft Visual C++ Redistributable (2015–2022)", categoria: "essenciais", w: "Microsoft.VCRedist.2015+.x64", padrao: true, nota: "Exigido por muitos programas e jogos." },
  { id: "dotnet", nome: ".NET Desktop Runtime 8", categoria: "essenciais", w: "Microsoft.DotNet.DesktopRuntime.8" },
  { id: "java", nome: "Java (Oracle JRE)", categoria: "essenciais", w: "Oracle.JavaRuntimeEnvironment", nota: "Só se o cliente usar sistemas que exigem Java." },

  { id: "notepadpp", nome: "Notepad++", categoria: "utilitarios", w: "Notepad++.Notepad++" },
  { id: "paintnet", nome: "Paint.NET", categoria: "utilitarios", w: "dotPDN.PaintDotNet" },
  { id: "gimp", nome: "GIMP", categoria: "utilitarios", b: "gimp", f: "org.gimp.GIMP" },
  { id: "klite", nome: "K-Lite Codec Pack", categoria: "utilitarios", w: "CodecGuide.K-LiteCodecPack.Standard" },
];

const FONTE = { win32: "w", darwin: "b", linux: "f" };
const SISTEMA = { win32: "windows", darwin: "macos", linux: "linux" };

// ---------------------------------------------------------------------------
// Programas da assistência: programas/programas.json
// [{ "nome": "Sistema do banco X", "categoria": "utilitarios", "windows": { "instalador": "banco-x.exe", "argumentos": ["/S"] } },
//  { "nome": "Outro via winget", "windows": { "winget": "Fornecedor.Programa" }, "macos": { "brew": "cask" }, "linux": { "flatpak": "org.x.Y" } }]
// ---------------------------------------------------------------------------
function lerPersonalizados(pastaBase, plataforma = process.platform) {
  const arquivo = path.join(pastaBase, "programas", "programas.json");
  let dados;
  try {
    dados = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return [];
  }
  const sistema = SISTEMA[plataforma];
  return (Array.isArray(dados) ? dados : []).slice(0, 200).map((p, i) => {
    const alvo = (p && p[sistema]) || {};
    const instalador = alvo.instalador ? path.join(pastaBase, "programas", path.basename(String(alvo.instalador).replace(/\\/g, "/"))) : null;
    const item = {
      id: `assistencia:${i}`, nome: String(p?.nome || `Programa ${i + 1}`).slice(0, 80),
      categoria: CATEGORIAS[p?.categoria] ? p.categoria : "utilitarios", nota: String(p?.nota || "Programa da assistência.").slice(0, 200),
      personalizado: true, padrao: !!p?.padrao,
    };
    if (plataforma === "win32" && alvo.winget) item.w = String(alvo.winget);
    if (plataforma === "win32" && instalador) Object.assign(item, { instalador, argumentos: Array.isArray(alvo.argumentos) ? alvo.argumentos.map(String) : [] });
    if (plataforma === "darwin" && alvo.brew) item.b = String(alvo.brew);
    if (plataforma === "linux" && alvo.flatpak) item.f = String(alvo.flatpak);
    return item;
  }).filter((p) => p.instalador || p[FONTE[plataforma]]);
}

function catalogo({ plataforma = process.platform, pastaBase } = {}) {
  const chave = FONTE[plataforma];
  const base = CATALOGO.filter((p) => p[chave]);
  return [...base, ...(pastaBase ? lerPersonalizados(pastaBase, plataforma) : [])];
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
const rodarProcesso = (cmd, args, timeout = 30 * 60000) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 20 * 1024 * 1024, windowsHide: true, encoding: "utf8" }, (erro, stdout, stderr) => {
      resolve({ saida: `${stdout || ""}${stderr || ""}`, codigo: erro ? (typeof erro.code === "number" ? erro.code : -1) : 0, ausente: erro?.code === "ENOENT", expirou: !!erro?.killed });
    });
  });

// Códigos do winget (hexadecimal sem sinal)
const WINGET = { JA_INSTALADO: 0x8a150061, SEM_ATUALIZACAO: 0x8a15002b, NAO_ENCONTRADO: 0x8a150014, REINICIAR: [3010, 1641] };
const semSinal = (c) => (Number(c) >>> 0);

function interpretarWinget(codigo, saida = "") {
  const c = semSinal(codigo);
  if (codigo === 0) return { status: "ok", detalhe: "Instalado." };
  if (WINGET.REINICIAR.includes(codigo)) return { status: "ok", detalhe: "Instalado; reinicie para concluir.", reinicio: true };
  if (c === WINGET.JA_INSTALADO || c === WINGET.SEM_ATUALIZACAO || /already installed|já está instalado/i.test(saida)) return { status: "ok", detalhe: "Já estava instalado." };
  if (c === WINGET.NAO_ENCONTRADO) return { status: "erro", detalhe: "Programa não encontrado no winget (verifique o ID)." };
  return { status: "erro", detalhe: `winget terminou com código 0x${c.toString(16)}.` };
}

async function prepararFonte(plataforma, executor) {
  if (plataforma === "win32") {
    let r = await executor("winget", ["--version"], 60000);
    if (r.codigo !== 0) {
      // Windows recém-formatado: o winget (Instalador de Aplicativo) pode ainda não estar registrado
      await executor("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe"], 5 * 60000);
      r = await executor("winget", ["--version"], 60000);
    }
    if (r.codigo !== 0) return { ok: false, detalhe: "winget indisponível: atualize o \"Instalador de Aplicativo\" pela Microsoft Store (ou rode o Windows Update) e tente de novo." };
    return { ok: true };
  }
  if (plataforma === "darwin") {
    const brew = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"].find((b) => fs.existsSync(b));
    if (!brew) return { ok: false, detalhe: "Homebrew não está instalado. Instale em https://brew.sh e tente de novo." };
    const lista = await executor(brew, ["list", "--cask"], 120000);
    return { ok: true, brew, instalados: lista.saida };
  }
  if (plataforma === "linux") {
    const r = await executor("flatpak", ["--version"], 60000);
    if (r.codigo !== 0) return { ok: false, detalhe: "Flatpak não está instalado (ex.: sudo apt install flatpak)." };
    await executor("flatpak", ["remote-add", "--user", "--if-not-exists", "flathub", "https://dl.flathub.org/repo/flathub.flatpakrepo"], 120000);
    const lista = await executor("flatpak", ["list", "--app", "--columns=application"], 120000);
    return { ok: true, instalados: lista.saida };
  }
  return { ok: false, detalhe: "Sistema não suportado." };
}

/**
 * Instala os programas escolhidos e devolve as ações para o registro do laudo.
 */
async function instalar(ids, { plataforma = process.platform, pastaBase, executor = rodarProcesso, aoProgredir = () => {} } = {}) {
  const disponiveis = catalogo({ plataforma, pastaBase });
  const escolhidos = disponiveis.filter((p) => ids.includes(p.id));
  if (!escolhidos.length) throw new Error("Escolha ao menos um programa.");
  const acoes = [];
  const registrar = (p, r, inicio) => {
    const item = { id: `programa:${p.id}`, nome: p.nome, categoria: "programas", risco: "baixo", liberadoBytes: 0, reinicio: !!r.reinicio, personalizado: !!p.personalizado, status: r.status, detalhe: r.detalhe, duracaoS: Math.round((Date.now() - inicio) / 1000) };
    acoes.push(item);
    aoProgredir({ id: p.id, fase: "fim", resultado: item });
  };

  const locais = escolhidos.filter((p) => p.instalador);
  const daFonte = escolhidos.filter((p) => !p.instalador);
  let fonte = null;
  if (daFonte.length) {
    fonte = await prepararFonte(plataforma, executor);
    if (!fonte.ok) for (const p of daFonte) registrar(p, { status: "erro", detalhe: fonte.detalhe }, Date.now());
  }

  for (const p of locais) {
    aoProgredir({ id: p.id, fase: "inicio" });
    const inicio = Date.now();
    if (!fs.existsSync(p.instalador)) {
      registrar(p, { status: "erro", detalhe: `Instalador não encontrado: programas/${path.basename(p.instalador)}.` }, inicio);
      continue;
    }
    const r = await executor(p.instalador, p.argumentos, 30 * 60000);
    registrar(p, r.codigo === 0 || [3010, 1641].includes(r.codigo) ? { status: "ok", detalhe: "Instalado (instalador da assistência).", reinicio: [3010, 1641].includes(r.codigo) } : { status: "erro", detalhe: `Instalador terminou com código ${r.codigo}.` }, inicio);
  }

  if (fonte?.ok) {
    for (const p of daFonte) {
      aoProgredir({ id: p.id, fase: "inicio" });
      const inicio = Date.now();
      if (plataforma === "win32") {
        // O próprio winget reconhece programa já instalado (e atualiza se houver versão nova)
        const args = ["install", "--id", p.w, "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"];
        if (p.fonte) args.push("--source", p.fonte);
        const r = await executor("winget", args, 30 * 60000);
        registrar(p, r.expirou ? { status: "erro", detalhe: "Tempo esgotado." } : interpretarWinget(r.codigo, r.saida), inicio);
      } else if (plataforma === "darwin") {
        if (fonte.instalados.split(/\s+/).includes(p.b)) {
          registrar(p, { status: "ok", detalhe: "Já estava instalado." }, inicio);
          continue;
        }
        const r = await executor(fonte.brew, ["install", "--cask", p.b], 30 * 60000);
        registrar(p, r.codigo === 0 ? { status: "ok", detalhe: "Instalado." } : { status: "erro", detalhe: `Homebrew terminou com código ${r.codigo}.` }, inicio);
      } else {
        if (fonte.instalados.split(/\s+/).includes(p.f)) {
          registrar(p, { status: "ok", detalhe: "Já estava instalado." }, inicio);
          continue;
        }
        const r = await executor("flatpak", ["install", "--user", "-y", "--noninteractive", "flathub", p.f], 30 * 60000);
        registrar(p, r.codigo === 0 ? { status: "ok", detalhe: "Instalado (Flathub)." } : { status: "erro", detalhe: `Flatpak terminou com código ${r.codigo}.` }, inicio);
      }
    }
  }
  return { acoes };
}

const paraTela = (lista) => lista.map(({ instalador, argumentos, ...p }) => ({ ...p, local: !!instalador }));

module.exports = { CATEGORIAS, CATALOGO, catalogo, paraTela, instalar, interpretarWinget, lerPersonalizados, WINGET };
