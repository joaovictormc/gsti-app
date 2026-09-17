#!/usr/bin/env node
// Confere se os programas do catálogo existem na fonte oficial deste sistema
// (winget no Windows, Homebrew no macOS, Flathub no Linux). Usado no GitHub Actions.
const { execFileSync } = require("child_process");
const { CATALOGO } = require("./programas");

const plataforma = process.platform;
const chave = { win32: "w", darwin: "b", linux: "f" }[plataforma];
const itens = CATALOGO.filter((p) => p[chave]);
const falhas = [];

// Runner sem a ferramenta (ex.: winget no Windows Server): avisa e não falha, salvo com --exigir
const ferramenta = { win32: ["winget", ["--version"]], darwin: ["brew", ["--version"]], linux: ["flatpak", ["--version"]] }[plataforma];
try {
  execFileSync(ferramenta[0], ferramenta[1], { stdio: "pipe", timeout: 60000 });
} catch {
  console.log(`${ferramenta[0]} não está disponível neste sistema; verificação ignorada.`);
  process.exit(process.argv.includes("--exigir") ? 1 : 0);
}

for (const p of itens) {
  const id = p[chave];
  try {
    if (plataforma === "win32") {
      const args = ["show", "--id", id, "-e", "--accept-source-agreements", "--disable-interactivity"];
      if (p.fonte) args.push("--source", p.fonte);
      execFileSync("winget", args, { stdio: "pipe", timeout: 180000 });
    } else if (plataforma === "darwin") {
      execFileSync("brew", ["info", "--cask", id], { stdio: "pipe", timeout: 180000 });
    } else {
      execFileSync("flatpak", ["remote-info", "--user", "flathub", id], { stdio: "pipe", timeout: 180000 });
    }
    console.log(`ok     ${p.nome} (${id})`);
  } catch (e) {
    console.log(`FALHOU ${p.nome} (${id})`);
    falhas.push(id);
  }
}
console.log(`\n${itens.length - falhas.length} de ${itens.length} encontrados.`);
process.exit(falhas.length ? 1 : 0);
