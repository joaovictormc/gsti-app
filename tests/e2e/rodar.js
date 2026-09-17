// Executa as suítes de ponta a ponta no Electron, uma por processo.
// Uso: npm run test:e2e              (todas)
//      node tests/e2e/rodar.js fiscal notaas   (só as indicadas)
// Pré-requisitos: renderer compilado (npm run build) e PostgreSQL local — ver tests/README.md.
const { spawn } = require("child_process");
const path = require("path");

const electron = require("electron"); // no Node, devolve o caminho do executável
const SUITES = [
  { nome: "seguranca", fases: ["principal", "migracao", "corrompida"] },
  { nome: "perfis" },
  { nome: "marca" },
  { nome: "barra" },
  { nome: "fiscal" },
  { nome: "notaas" },
  { nome: "modulos" },
  { nome: "suporte" },
];

const filtro = process.argv.slice(2);
const escolhidas = filtro.length ? SUITES.filter((s) => filtro.includes(s.nome)) : SUITES;
if (!escolhidas.length) {
  console.error(`Suíte não encontrada. Disponíveis: ${SUITES.map((s) => s.nome).join(", ")}`);
  process.exit(2);
}

function rodar(suite, fase) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE; // o VS Code define essa variável e impede o modo app
    const args = [path.join(__dirname, "suites", `${suite}.e2e.js`)];
    if (fase) args.push(fase);
    const filho = spawn(electron, args, { env, cwd: path.resolve(__dirname, "..", "..") });
    const resultado = { suite: fase ? `${suite}:${fase}` : suite, ok: 0, falhas: [], erro: null, log: "" };
    const tratar = (dados) => {
      const texto = dados.toString();
      resultado.log += texto;
      for (const linha of texto.split(/\r?\n/)) {
        if (linha.startsWith("OK    ")) resultado.ok++;
        else if (linha.startsWith("FALHOU")) { resultado.falhas.push(linha); console.log(linha); }
        else if (linha.startsWith("ERRO ")) { resultado.erro = linha; console.log(linha); }
        else if (linha.startsWith("== ")) console.log(linha);
      }
    };
    filho.stdout.on("data", tratar);
    filho.stderr.on("data", tratar);
    const limite = setTimeout(() => {
      resultado.erro = "tempo esgotado (10 min)";
      filho.kill();
    }, 10 * 60 * 1000);
    filho.on("exit", (codigo) => {
      clearTimeout(limite);
      resultado.codigo = codigo;
      resolve(resultado);
    });
  });
}

(async () => {
  const resultados = [];
  for (const suite of escolhidas) {
    for (const fase of suite.fases || [null]) {
      console.log(`\n▶ ${suite.nome}${fase ? ":" + fase : ""}`);
      resultados.push(await rodar(suite.nome, fase));
    }
  }
  console.log("\nResumo");
  let problemas = 0;
  for (const r of resultados) {
    const falhou = r.codigo !== 0 || r.falhas.length || r.erro;
    if (falhou) problemas++;
    console.log(`  ${falhou ? "✗" : "✓"} ${r.suite.padEnd(22)} ${r.ok} OK${r.falhas.length ? `, ${r.falhas.length} falha(s)` : ""}${r.erro ? " — erro" : ""}`);
    if (falhou && !r.falhas.length && !r.erro) console.log(r.log.split(/\r?\n/).slice(-15).join("\n"));
  }
  process.exit(problemas ? 1 : 0);
})();
