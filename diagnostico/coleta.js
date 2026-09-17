// Coleta do diagnóstico conforme o sistema: devolve as seções do laudo (ver laudo.js).
const { secoesWindows } = require("./laudo");

async function coletar({ plataforma = process.platform } = {}) {
  if (plataforma === "win32") {
    const secoes = secoesWindows(await require("./coleta-windows").coletarBruto());
    try {
      const drivers = require("./drivers");
      const inv = await require("./drivers-windows").inventario();
      secoes.drivers = drivers.resumoDrivers(inv.dispositivos);
    } catch {
      secoes.limitacoes = [...(secoes.limitacoes || []), "Não foi possível ler o inventário de drivers."];
    }
    return secoes;
  }
  if (plataforma === "darwin") return require("./coleta-macos").coletarMacOS();
  if (plataforma === "linux") return require("./coleta-linux").coletarLinux();
  throw new Error(`Sistema não suportado pelo diagnóstico: ${plataforma}.`);
}

module.exports = { coletar };
