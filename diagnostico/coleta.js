// Coleta do diagnóstico conforme o sistema: devolve as seções do laudo (ver laudo.js).
const { secoesWindows } = require("./laudo");

async function coletar({ plataforma = process.platform } = {}) {
  if (plataforma === "win32") return secoesWindows(await require("./coleta-windows").coletarBruto());
  if (plataforma === "darwin") return require("./coleta-macos").coletarMacOS();
  if (plataforma === "linux") return require("./coleta-linux").coletarLinux();
  throw new Error(`Sistema não suportado pelo diagnóstico: ${plataforma}.`);
}

module.exports = { coletar };
