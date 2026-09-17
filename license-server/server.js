/**
 * Plataforma GSTI App — servidor de licenças, vendas, site e área administrativa.
 *
 *   /              landing page, páginas legais, checkout, portal do cliente e suporte
 *   /v2/*          API do aplicativo (ativação, validação, transferência, trial)
 *   /webhooks/*    notificações do Mercado Pago
 *   /atualizacoes  atualização automática do app (exige licença válida)
 *   /admin         painel da equipe (SPA em public/admin) + /admin/api
 *   /health        verificação de saúde
 *
 * Dados em data/ (fora do git): licencas.db, keys/, uploads/ e .env opcional.
 * Primeiro acesso ao painel: node admin.js criar-usuario --email voce@x.com --nome "Seu Nome" --papeis admin
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const cfg = require("./lib/config");
const keys = require("./lib/keys");
const vendas = require("./lib/vendas");
const tarefas = require("./lib/tarefas");
const { abrir } = require("./lib/db");
const { cabecalhosSeguranca, csp, tratadorErros } = require("./lib/http");
const { version } = require("./package.json");

try {
  keys.kidAtivo();
} catch (e) {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
}
abrir();
vendas.semearOfertas();

const app = express();
app.disable("x-powered-by");
if (cfg.TRUST_PROXY) app.set("trust proxy", cfg.TRUST_PROXY);
app.use(cabecalhosSeguranca);
app.use(express.json({ limit: "200kb" }));

app.get("/health", (_req, res) => res.json({ ok: true, versao: version, kids: keys.kids() }));

// API do aplicativo
app.use("/v2", require("./routes/app-api"));

// Rotas da v1 (tokens assinados com a chave antiga, que foi vazada e descartada).
app.post(["/ativar", "/trial", "/validar"], (_req, res) => {
  const msg = "Esta versão do GSTI App está desatualizada. Instale a versão mais recente.";
  res.status(410).json({ success: false, valido: false, error: msg, motivo: msg });
});

app.use("/webhooks", require("./routes/webhooks"));

// Atualização automática do app (arquivos em data/atualizacoes)
app.use("/atualizacoes", require("./routes/atualizacoes"));

// Área administrativa
app.use("/admin/api", require("./routes/admin-api"));
const ADMIN_DIR = path.join(__dirname, "public", "admin");
app.use("/admin", csp, express.static(ADMIN_DIR, { index: false, maxAge: "1h" }));
app.get(/^\/admin(\/.*)?$/, csp, (_req, res) => {
  const index = path.join(ADMIN_DIR, "index.html");
  if (!fs.existsSync(index)) {
    return res.status(503).type("text").send("Painel não compilado. Rode: npm run build:admin");
  }
  res.set("Cache-Control", "no-store").sendFile(index);
});

// Site público (landing, checkout, portal do cliente) e suporte
app.use("/", require("./routes/suporte"));
app.use("/", require("./routes/site"));

app.use((req, res) => {
  if (req.accepts("html")) return res.status(404).type("html").send(require("./views/paginas").naoEncontrada());
  res.status(404).json({ success: false, error: "Rota não encontrada." });
});
app.use(tratadorErros);

if (cfg.JOBS) tarefas.iniciar();

if (cfg.MP_API_BASE !== cfg.MP_API_OFICIAL) {
  console.warn(`\n  ⚠ ATENÇÃO: usando API de pagamentos SIMULADA (${cfg.MP_API_BASE}). Somente homologação.\n`);
}

app.listen(cfg.PORT, cfg.HOST, () => {
  console.log(`GSTI plataforma v${version} em ${cfg.HOST}:${cfg.PORT} — ${cfg.PUBLIC_URL} (chave ativa: ${keys.kidAtivo()})`);
});
