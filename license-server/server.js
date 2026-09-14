/**
 * Servidor de licenças do GSTI App — v2.
 *
 * Endpoints do app (com rate limit):
 *   POST /v2/ativar     { chave, maquinaId, nomeMaquina, appVersao } -> { success, token, detalhes }
 *   POST /v2/validar    { token }                                    -> { valido, token?, detalhes?, motivo? }
 *   POST /v2/desativar  { token }                                    -> { success }
 *   POST /v2/trial      { email, maquinaId }                         -> { success, token }
 *   GET  /health                                                     -> { ok, versao, kids }
 *
 * Dados em data/ (fora do git): licencas.db (SQLite) e keys/<kid>.key.
 * Administração: node admin.js --help
 */
const express = require("express");
const cfg = require("./lib/config");
const keys = require("./lib/keys");
const licencas = require("./lib/licencas");
const { abrir } = require("./lib/db");
const { version } = require("./package.json");

try {
  keys.kidAtivo();
} catch (e) {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
}
abrir();

const app = express();
app.disable("x-powered-by");
if (cfg.TRUST_PROXY) app.set("trust proxy", cfg.TRUST_PROXY);
app.use(express.json({ limit: "10kb" }));

// --- Rate limit simples em memória (janela fixa por IP + rota) ---
const janelas = new Map();
function limitar(max, janelaMin) {
  const janelaMs = janelaMin * 60000;
  return (req, res, next) => {
    const chave = `${req.ip}|${req.path}`;
    const agora = Date.now();
    let j = janelas.get(chave);
    if (!j || j.reinicia <= agora) {
      j = { n: 0, reinicia: agora + janelaMs };
      janelas.set(chave, j);
    }
    if (++j.n > max) {
      res.set("Retry-After", String(Math.ceil((j.reinicia - agora) / 1000)));
      return res.status(429).json({
        success: false,
        valido: false,
        error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      });
    }
    next();
  };
}
setInterval(() => {
  const agora = Date.now();
  for (const [k, j] of janelas) if (j.reinicia <= agora) janelas.delete(k);
}, 60000).unref();

// Converte erros de negócio em respostas HTTP.
const rota = (fn) => (req, res) => {
  try {
    res.json(fn(req.body || {}));
  } catch (e) {
    if (e instanceof licencas.LicencaErro) {
      return res.status(e.status).json({ success: false, codigo: e.codigo, error: e.message });
    }
    console.error(`[erro] ${req.method} ${req.path}:`, e);
    res.status(500).json({ success: false, error: "Erro interno no servidor de licenças." });
  }
};

app.get("/health", (_req, res) => res.json({ ok: true, versao: version, kids: keys.kids() }));

app.post(
  "/v2/ativar",
  limitar(10, 15),
  rota((b) => {
    const r = licencas.ativar(b);
    console.log(`[ativar] licença …${r.detalhes.chaveFinal} (${r.detalhes.maquinasAtivas}/${r.detalhes.maxMaquinas} máquinas)`);
    return { success: true, ...r };
  })
);

app.post("/v2/validar", limitar(60, 15), rota((b) => licencas.validar(b)));

app.post("/v2/desativar", limitar(10, 15), rota((b) => licencas.desativar(b)));

app.post(
  "/v2/trial",
  limitar(5, 60),
  rota((b) => {
    const r = licencas.iniciarTrial(b);
    console.log("[trial] teste iniciado");
    return { success: true, ...r };
  })
);

// Rotas da v1 (tokens assinados com a chave antiga, que foi vazada e descartada).
app.post(["/ativar", "/trial", "/validar"], (_req, res) =>
  res.status(410).json({
    success: false,
    valido: false,
    error: "Esta versão do GSTI App está desatualizada. Instale a versão mais recente.",
    motivo: "Esta versão do GSTI App está desatualizada. Instale a versão mais recente.",
  })
);

app.use((_req, res) => res.status(404).json({ success: false, error: "Rota não encontrada." }));

app.listen(cfg.PORT, cfg.HOST, () => {
  console.log(`Servidor de licenças GSTI v${version} em ${cfg.HOST}:${cfg.PORT} (chave ativa: ${keys.kidAtivo()})`);
});
