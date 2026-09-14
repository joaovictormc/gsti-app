/**
 * Configuração de licenciamento embutida na build.
 *
 * - serverUrl: servidor de licenças padrão (pode ser sobrescrito em
 *   config.json → license.serverUrl, para suporte).
 * - publicKeys: chaves PÚBLICAS aceitas, por "kid". Gere no servidor com
 *   `node gerar-chaves.js` e cole aqui o trecho impresso. Mantenha as chaves
 *   antigas enquanto houver licenças emitidas com elas; remova uma chave
 *   apenas se ela vazar (e gere uma build nova).
 *
 * Nunca coloque chaves PRIVADAS neste arquivo.
 */
module.exports = {
  serverUrl: "http://joaosrv:3030",

  publicKeys: {
    // "2026-09-13": `-----BEGIN PUBLIC KEY-----
    // MCowBQYDK2VwAyEA...
    // -----END PUBLIC KEY-----`,
  },
};
