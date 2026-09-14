/**
 * Configuração do servidor de licenças (variáveis de ambiente com padrões).
 */
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

module.exports = {
  PORT: Number(process.env.PORT || 3030),
  HOST: process.env.HOST || "0.0.0.0",
  // Defina quando houver proxy/túnel na frente (ex.: "loopback" ou "1"),
  // para o rate limit usar o IP real do cliente.
  TRUST_PROXY: process.env.TRUST_PROXY || false,

  DATA_DIR,
  KEYS_DIR: path.join(DATA_DIR, "keys"),
  DB_PATH: path.join(DATA_DIR, "licencas.db"),
  // kid usado para assinar novos tokens (padrão: o mais recente em data/keys).
  ACTIVE_KID: process.env.ACTIVE_KID || null,

  TRIAL_DIAS: Number(process.env.TRIAL_DIAS || 7),
  // Janela em que o app pode ficar offline sem revalidar.
  REVALIDAR_DIAS: Number(process.env.REVALIDAR_DIAS || 30),
  MAX_MAQUINAS_PADRAO: Number(process.env.MAX_MAQUINAS_PADRAO || 1),
};
