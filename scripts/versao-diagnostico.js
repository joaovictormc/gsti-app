// Usa a versão de diagnostico/versao.json no executável portátil do agente
const fs = require("fs");
const path = require("path");
const { versao } = require("../diagnostico/versao.json");

const config = path.join(__dirname, "..", "diagnostico", "electron-builder.json");
const c = JSON.parse(fs.readFileSync(config, "utf8"));
c.extraMetadata.version = versao;
fs.writeFileSync(config, JSON.stringify(c, null, 2) + "\n");
console.log(`[diagnostico] versão ${versao}`);
