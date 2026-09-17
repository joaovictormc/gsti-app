// Extrai do CHANGELOG.md a seção da versão do package.json e grava em
// build_resources/notas-da-versao.md — o electron-builder coloca esse texto no latest.yml
// e o app mostra como "novidades" ao oferecer a atualização.
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const { version } = require(path.join(raiz, "package.json"));
const changelog = fs.readFileSync(path.join(raiz, "CHANGELOG.md"), "utf8").replace(/\r\n/g, "\n");

const inicio = changelog.search(new RegExp(`^## ${version.replace(/\./g, "\\.")}\\b.*$`, "m"));
let notas = `Versão ${version}.`;
if (inicio >= 0) {
  const resto = changelog.slice(inicio);
  const fim = resto.slice(1).search(/^## /m);
  notas = (fim >= 0 ? resto.slice(0, fim + 1) : resto)
    .replace(/^## .*\n/, "") // o título da versão já aparece no aviso
    .replace(/^---\s*$/m, "")
    .trim();
} else {
  console.warn(`[notas-da-versao] Seção "## ${version}" não encontrada no CHANGELOG.md.`);
}

const destino = path.join(raiz, "build_resources", "notas-da-versao.md");
fs.writeFileSync(destino, notas + "\n");
console.log(`[notas-da-versao] ${version}: ${notas.length} caracteres em ${path.relative(raiz, destino)}`);
