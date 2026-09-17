/**
 * Atualização automática do app (electron-updater, provedor "generic").
 *
 * A pasta data/atualizacoes/win guarda a versão publicada: latest.yml + instalador
 * (+ .blockmap, usado no download diferencial). O app consulta /atualizacoes/win/latest.yml
 * enviando o token da licença no cabeçalho "x-gsti-licenca"; só licenças válidas baixam.
 *
 * Publicar: node admin.js publicar-atualizacao <pasta dist_electron>
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cfg = require("./config");
const tokens = require("./tokens");
const L = require("./licencas");
const { LicencaErro } = require("./erros");

const DIR = path.join(cfg.DATA_DIR, "atualizacoes", "win");
const EXTENSOES = /\.(yml|exe|blockmap)$/i;

// Leitura do latest.yml gerado pelo electron-builder (formato simples e conhecido).
function lerLatestYml(texto) {
  const valor = (chave) => {
    const m = texto.match(new RegExp(`^${chave}:\\s*'?([^'\\n]*)'?\\s*$`, "m"));
    return m ? m[1].trim() : null;
  };
  let notas = null;
  const bloco = texto.match(/^releaseNotes:\s*[|>][-+]?[ \t]*\n((?:(?:[ \t]+[^\n]*|[ \t]*)(?:\n|$))+)/m);
  if (bloco) notas = bloco[1].replace(/^ {2}/gm, "").trim();
  else notas = valor("releaseNotes");
  const tamanho = texto.match(/^\s+size:\s*(\d+)/m);
  return {
    versao: valor("version"),
    arquivo: valor("path"),
    sha512: valor("sha512"),
    dataPublicacao: valor("releaseDate"),
    tamanho: tamanho ? Number(tamanho[1]) : null,
    notas,
  };
}

function publicada() {
  const yml = path.join(DIR, "latest.yml");
  if (!fs.existsSync(yml)) return null;
  const info = lerLatestYml(fs.readFileSync(yml, "utf8"));
  info.instaladorPresente = !!info.arquivo && fs.existsSync(path.join(DIR, info.arquivo));
  info.blockmapPresente = !!info.arquivo && fs.existsSync(path.join(DIR, `${info.arquivo}.blockmap`));
  return info;
}

const sha512Arquivo = (arquivo) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha512");
    fs.createReadStream(arquivo).on("data", (d) => hash.update(d)).on("error", reject).on("end", () => resolve(hash.digest("base64")));
  });

// Copia a versão gerada pelo electron-builder para a pasta servida (substitui a anterior).
async function publicar(pastaDist) {
  const origemYml = path.join(pastaDist, "latest.yml");
  if (!fs.existsSync(origemYml)) throw new Error(`latest.yml não encontrado em ${pastaDist}. Gere com npm run dist:win.`);
  const info = lerLatestYml(fs.readFileSync(origemYml, "utf8"));
  if (!info.versao || !info.arquivo) throw new Error("latest.yml inválido.");
  const instalador = path.join(pastaDist, info.arquivo);
  if (!fs.existsSync(instalador)) throw new Error(`Instalador ${info.arquivo} não encontrado (o nome precisa bater com o latest.yml).`);
  if ((await sha512Arquivo(instalador)) !== info.sha512) throw new Error("O instalador não confere com o sha512 do latest.yml.");

  fs.mkdirSync(DIR, { recursive: true });
  // Arquivos novos primeiro; o latest.yml por último, para ninguém ver versão sem instalador
  fs.copyFileSync(instalador, path.join(DIR, info.arquivo));
  const blockmap = `${instalador}.blockmap`;
  if (fs.existsSync(blockmap)) fs.copyFileSync(blockmap, path.join(DIR, `${info.arquivo}.blockmap`));
  const temp = path.join(DIR, "latest.yml.tmp");
  fs.copyFileSync(origemYml, temp);
  fs.renameSync(temp, path.join(DIR, "latest.yml"));

  // Mantém só a versão atual e a anterior (o .blockmap anterior serve ao download diferencial)
  const manter = new Set(["latest.yml", info.arquivo, `${info.arquivo}.blockmap`]);
  const instaladores = fs.readdirSync(DIR).filter((f) => f.endsWith(".exe") && f !== info.arquivo)
    .map((f) => ({ f, t: fs.statSync(path.join(DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  if (instaladores[0]) { manter.add(instaladores[0].f); manter.add(`${instaladores[0].f}.blockmap`); }
  for (const f of fs.readdirSync(DIR)) if (!manter.has(f)) fs.rmSync(path.join(DIR, f), { force: true });

  L.auditar("cli", "atualizacao_publicar", info.versao, { arquivo: info.arquivo });
  return publicada();
}

// Só licenças utilizáveis (ou teste dentro do prazo) recebem atualizações.
function autorizar(token) {
  const p = token ? tokens.decodificar(String(token)) : null;
  if (!p) throw new LicencaErro("ATUALIZACAO_SEM_LICENCA", "Licença inválida para receber atualizações.", 401);
  const vencida = (iso) => !!iso && new Date(iso).getTime() < Date.now();
  if (p.tipo === "trial") {
    if (vencida(p.validade)) throw new LicencaErro("ATUALIZACAO_TRIAL_EXPIRADO", "Período de teste expirado.", 403);
    return p;
  }
  const lic = L.licencaComCliente(p.lic);
  if (!lic || lic.status !== "ativa" || vencida(lic.valida_ate)) {
    throw new LicencaErro("ATUALIZACAO_LICENCA_INATIVA", "Licença sem direito a atualizações (vencida, suspensa ou revogada).", 403);
  }
  return p;
}

// Caminho de um arquivo servido (sem subpastas e só as extensões esperadas)
function caminhoSeguro(nome) {
  const base = path.basename(String(nome || ""));
  if (base !== nome || !EXTENSOES.test(base)) return null;
  const completo = path.join(DIR, base);
  return fs.existsSync(completo) ? completo : null;
}

module.exports = { DIR, lerLatestYml, publicada, publicar, autorizar, caminhoSeguro };
