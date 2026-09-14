/**
 * Configuração do servidor (variáveis de ambiente com padrões).
 * Em desenvolvimento, lê também data/.env (formato CHAVE=valor), sem sobrescrever
 * variáveis já definidas. Em produção, prefira EnvironmentFile do systemd.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

const ENV_FILE = path.join(DATA_DIR, ".env");
if (fs.existsSync(ENV_FILE)) {
  for (const linha of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const env = process.env;
const bool = (v) => /^(1|true|sim|yes)$/i.test(String(v || ""));

module.exports = {
  PORT: Number(env.PORT || 3030),
  HOST: env.HOST || "0.0.0.0",
  // Defina quando houver proxy/túnel na frente (ex.: "loopback" ou "1"),
  // para rate limit e cookies "secure" enxergarem o cliente real.
  TRUST_PROXY: env.TRUST_PROXY || false,
  // URL pública (https) — usada em links de e-mail, retorno do checkout e webhook.
  PUBLIC_URL: String(env.PUBLIC_URL || `http://localhost:${env.PORT || 3030}`).replace(/\/+$/, ""),
  NODE_ENV: env.NODE_ENV || "development",

  DATA_DIR,
  KEYS_DIR: path.join(DATA_DIR, "keys"),
  DB_PATH: path.join(DATA_DIR, "licencas.db"),
  UPLOADS_DIR: path.join(DATA_DIR, "uploads"),
  // kid usado para assinar novos tokens (padrão: o mais recente em data/keys).
  ACTIVE_KID: env.ACTIVE_KID || null,

  TRIAL_DIAS: Number(env.TRIAL_DIAS || 7),
  // Janela em que o app pode ficar offline sem revalidar.
  REVALIDAR_DIAS: Number(env.REVALIDAR_DIAS || 30),
  MAX_MAQUINAS_PADRAO: Number(env.MAX_MAQUINAS_PADRAO || 1),
  // Duração de uma licença anual (e de cada renovação).
  DIAS_ANUAL: Number(env.DIAS_ANUAL || 365),

  // Sessões
  SESSAO_ADMIN_HORAS: Number(env.SESSAO_ADMIN_HORAS || 12),
  SESSAO_CLIENTE_HORAS: Number(env.SESSAO_CLIENTE_HORAS || 24),
  LINK_MAGICO_MINUTOS: Number(env.LINK_MAGICO_MINUTOS || 30),

  // Mercado Pago
  MP_ACCESS_TOKEN: env.MP_ACCESS_TOKEN || "",
  MP_WEBHOOK_SECRET: env.MP_WEBHOOK_SECRET || "",
  MP_SANDBOX: bool(env.MP_SANDBOX),
  MP_API_BASE: String(env.MP_API_BASE || "https://api.mercadopago.com").replace(/\/+$/, ""),
  MP_STATEMENT_DESCRIPTOR: env.MP_STATEMENT_DESCRIPTOR || "GSTI APP",

  // E-mail (SMTP — ex.: Brevo)
  SMTP_HOST: env.SMTP_HOST || "",
  SMTP_PORT: Number(env.SMTP_PORT || 587),
  SMTP_SECURE: bool(env.SMTP_SECURE),
  SMTP_USER: env.SMTP_USER || "",
  SMTP_PASS: env.SMTP_PASS || "",
  EMAIL_FROM: env.EMAIL_FROM || "GSTI App <nao-responda@labapp.com.br>",
  EMAIL_SUPORTE: env.EMAIL_SUPORTE || "suporte@labapp.com.br",

  // Tarefas em segundo plano (desligue em testes)
  JOBS: env.JOBS === undefined ? true : bool(env.JOBS),
};
