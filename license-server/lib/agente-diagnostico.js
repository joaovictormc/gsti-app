/**
 * Distribuição do agente portátil GSTI Diagnóstico (módulo "diagnostico"), por plataforma.
 *
 * data/atualizacoes/diagnostico guarda um arquivo por plataforma e info.json (versão, sha512).
 * Baixam: o app com licença válida que inclui o módulo (token no cabeçalho) e o cliente
 * logado na área do cliente com uma licença assim.
 *
 * Publicar: node admin.js publicar-diagnostico <arquivo> (um por vez)
 *   GSTI-Diagnostico-1.1.0-windows-x64.exe · -macos-arm64.zip · -macos-x64.zip · -linux-x64.AppImage
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cfg = require("./config");
const L = require("./licencas");
const { abrir } = require("./db");
const { autorizar } = require("./atualizacoes");
const { LicencaErro } = require("./erros");

const DIR = path.join(cfg.DATA_DIR, "atualizacoes", "diagnostico");
const INFO = path.join(DIR, "info.json");
const MODULO = "diagnostico";

const PLATAFORMAS = {
  "windows-x64": { nome: "Windows", extensao: ".exe" },
  "macos-arm64": { nome: "macOS (Apple Silicon)", extensao: ".zip" },
  "macos-x64": { nome: "macOS (Intel)", extensao: ".zip" },
  "linux-x64": { nome: "Linux (AppImage)", extensao: ".AppImage" },
};
const PADRAO = "windows-x64";

const sha512Arquivo = (arquivo) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha512");
    fs.createReadStream(arquivo).on("data", (d) => hash.update(d)).on("error", reject).on("end", () => resolve(hash.digest("base64")));
  });

// Plataforma pelo nome do arquivo (o antigo "GSTI-Diagnostico-1.0.0.exe" é Windows)
function plataformaDoArquivo(nome) {
  const m = path.basename(nome).match(/(\d+\.\d+\.\d+)(?:-(windows|macos|linux)-(x64|arm64))?\.(exe|zip|AppImage)$/i);
  if (!m) return null;
  const chave = m[2] ? `${m[2].toLowerCase()}-${m[3].toLowerCase()}` : m[4].toLowerCase() === "exe" ? PADRAO : null;
  if (!PLATAFORMAS[chave] || PLATAFORMAS[chave].extensao.toLowerCase() !== `.${m[4].toLowerCase()}`) return null;
  return { versao: m[1], plataforma: chave };
}

function lerInfo() {
  if (!fs.existsSync(INFO)) return { arquivos: {} };
  const info = JSON.parse(fs.readFileSync(INFO, "utf8"));
  // Formato da primeira versão (só Windows)
  if (!info.arquivos && info.arquivo) return { arquivos: { [PADRAO]: { versao: info.versao, arquivo: info.arquivo, tamanho: info.tamanho, sha512: info.sha512, publicadoEm: info.publicadoEm } } };
  return { arquivos: info.arquivos || {} };
}

// Resumo: todas as plataformas publicadas (+ campos do Windows no topo, para compatibilidade)
function publicado() {
  const { arquivos } = lerInfo();
  const plataformas = Object.entries(arquivos).map(([chave, a]) => ({
    plataforma: chave, nome: PLATAFORMAS[chave]?.nome || chave, ...a, presente: fs.existsSync(path.join(DIR, a.arquivo)),
  }));
  if (!plataformas.length) return null;
  const win = plataformas.find((p) => p.plataforma === PADRAO) || plataformas[0];
  return { versao: win.versao, arquivo: win.arquivo, tamanho: win.tamanho, sha512: win.sha512, publicadoEm: win.publicadoEm, presente: win.presente, plataformas };
}

async function publicar(arquivoOrigem) {
  const origem = path.resolve(String(arquivoOrigem || ""));
  if (!fs.existsSync(origem)) throw new Error("Arquivo não encontrado.");
  const id = plataformaDoArquivo(origem);
  if (!id) throw new Error('Nome inválido. Use o arquivo gerado pelo build (ex.: "GSTI-Diagnostico-1.1.0-windows-x64.exe", "-macos-arm64.zip", "-linux-x64.AppImage").');
  fs.mkdirSync(DIR, { recursive: true });
  const nome = `GSTI-Diagnostico-${id.versao}-${id.plataforma}${PLATAFORMAS[id.plataforma].extensao}`;
  const temp = path.join(DIR, `${nome}.tmp`);
  fs.copyFileSync(origem, temp);
  fs.renameSync(temp, path.join(DIR, nome));
  const info = lerInfo();
  info.arquivos[id.plataforma] = { versao: id.versao, arquivo: nome, tamanho: fs.statSync(path.join(DIR, nome)).size, sha512: await sha512Arquivo(path.join(DIR, nome)), publicadoEm: new Date().toISOString() };
  fs.writeFileSync(INFO, JSON.stringify(info, null, 2));
  // Mantém só o arquivo atual de cada plataforma
  const manter = new Set(["info.json", ...Object.values(info.arquivos).map((a) => a.arquivo)]);
  for (const f of fs.readdirSync(DIR)) if (!manter.has(f)) fs.rmSync(path.join(DIR, f), { force: true });
  L.auditar("cli", "diagnostico_publicar", id.versao, { plataforma: id.plataforma, arquivo: nome });
  return { ...info.arquivos[id.plataforma], plataforma: id.plataforma, nome: PLATAFORMAS[id.plataforma].nome };
}

// Licença (token do app) com o módulo
function autorizarApp(token) {
  const p = autorizar(token); // licença válida ou teste no prazo (401/403 caso contrário)
  const modulos = p.tipo === "trial" ? L.modulosDoTrial() : L.modulosDaLicenca(L.licencaComCliente(p.lic));
  if (!modulos.includes(MODULO)) throw new LicencaErro("SEM_MODULO", "O plano desta licença não inclui o módulo Diagnóstico.", 403);
  return p;
}

// Cliente da área do cliente com alguma licença ativa que inclua o módulo
function clienteTemModulo(clienteId) {
  const agora = Date.now();
  return abrir().prepare("SELECT * FROM licencas WHERE cliente_id = ? AND status = 'ativa'").all(clienteId)
    .some((l) => (!l.valida_ate || new Date(l.valida_ate).getTime() > agora) && L.modulosDaLicenca(l).includes(MODULO));
}

function caminhoPublicado(plataforma = PADRAO) {
  const chave = PLATAFORMAS[plataforma] ? plataforma : PADRAO;
  const info = (publicado()?.plataformas || []).find((p) => p.plataforma === chave);
  if (!info || !info.presente) throw new LicencaErro("NAO_PUBLICADO", `O GSTI Diagnóstico para ${PLATAFORMAS[chave].nome} ainda não foi publicado.`, 404);
  return { info, arquivo: path.join(DIR, info.arquivo) };
}

module.exports = { DIR, PLATAFORMAS, plataformaDoArquivo, publicado, publicar, autorizarApp, clienteTemModulo, caminhoPublicado };
