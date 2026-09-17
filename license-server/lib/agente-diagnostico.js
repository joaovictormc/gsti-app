/**
 * Distribuição do agente portátil GSTI Diagnóstico (módulo "diagnostico").
 *
 * data/atualizacoes/diagnostico guarda o .exe publicado e info.json (versão, sha512).
 * Baixam: o app com licença válida que inclui o módulo (token no cabeçalho) e o cliente
 * logado na área do cliente com uma licença assim.
 *
 * Publicar: node admin.js publicar-diagnostico <GSTI-Diagnostico-x.y.z.exe>
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

const sha512Arquivo = (arquivo) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha512");
    fs.createReadStream(arquivo).on("data", (d) => hash.update(d)).on("error", reject).on("end", () => resolve(hash.digest("base64")));
  });

function publicado() {
  if (!fs.existsSync(INFO)) return null;
  const info = JSON.parse(fs.readFileSync(INFO, "utf8"));
  info.presente = fs.existsSync(path.join(DIR, info.arquivo));
  return info;
}

async function publicar(exe) {
  const origem = path.resolve(String(exe || ""));
  if (!fs.existsSync(origem) || !/\.exe$/i.test(origem)) throw new Error("Informe o caminho do .exe gerado por npm run dist:diagnostico.");
  const m = path.basename(origem).match(/(\d+\.\d+\.\d+)/);
  if (!m) throw new Error('O nome do arquivo precisa ter a versão (ex.: "GSTI-Diagnostico-1.0.0.exe").');
  fs.mkdirSync(DIR, { recursive: true });
  const arquivo = `GSTI-Diagnostico-${m[1]}.exe`;
  const temp = path.join(DIR, `${arquivo}.tmp`);
  fs.copyFileSync(origem, temp);
  fs.renameSync(temp, path.join(DIR, arquivo));
  const info = { versao: m[1], arquivo, tamanho: fs.statSync(path.join(DIR, arquivo)).size, sha512: await sha512Arquivo(path.join(DIR, arquivo)), publicadoEm: new Date().toISOString() };
  fs.writeFileSync(INFO, JSON.stringify(info, null, 2));
  // Mantém só a versão atual
  for (const f of fs.readdirSync(DIR)) if (f !== arquivo && f !== "info.json") fs.rmSync(path.join(DIR, f), { force: true });
  L.auditar("cli", "diagnostico_publicar", info.versao, { arquivo });
  return publicado();
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

function caminhoPublicado() {
  const info = publicado();
  if (!info || !info.presente) throw new LicencaErro("NAO_PUBLICADO", "O GSTI Diagnóstico ainda não foi publicado.", 404);
  return { info, arquivo: path.join(DIR, info.arquivo) };
}

module.exports = { DIR, publicado, publicar, autorizarApp, clienteTemModulo, caminhoPublicado };
