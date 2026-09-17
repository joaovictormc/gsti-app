// Otimização do agente: catálogos por sistema, scripts da assistência, protocolo de
// resultado, execução (com executor simulado) e registro no laudo.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

const RAIZ = path.join(__dirname, "..", "..");
const O = require(path.join(RAIZ, "diagnostico", "otimizacao.js"));
const { montarLaudoDeSecoes, validarLaudo, comparar } = require(path.join(RAIZ, "diagnostico", "laudo.js"));
const { laudoHtml } = require(path.join(RAIZ, "diagnostico", "laudo-html.js"));

test("catálogos: ids únicos, descrições e ações que apagam dados vêm desmarcadas", () => {
  for (const plataforma of ["win32", "darwin", "linux"]) {
    const acoes = O.catalogo({ plataforma });
    assert.ok(acoes.length >= 6, plataforma);
    assert.equal(new Set(acoes.map((a) => a.id)).size, acoes.length, `ids únicos em ${plataforma}`);
    for (const a of acoes) {
      assert.ok(a.nome && a.descricao, `${plataforma}/${a.id} com nome e descrição`);
      assert.match(a.script, /[Rr]esultado/, `${plataforma}/${a.id} usa o protocolo de resultado`);
      if (a.risco !== "baixo") assert.equal(a.padrao, false, `${plataforma}/${a.id} com risco não pode vir marcada`);
    }
    assert.ok(O.paraTela(acoes).every((a) => !("script" in a)), "a tela não recebe o conteúdo dos scripts");
  }
  assert.equal(O.catalogo({ plataforma: "win32" })[0].id, "ponto-restauracao", "ponto de restauração é a primeira ação no Windows");
  assert.deepEqual(O.catalogo({ plataforma: "freebsd" }), []);
});

test("scripts da assistência: cabeçalho, extensão por sistema e hash", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "gsti-scripts-"));
  fs.mkdirSync(path.join(base, "scripts", "windows"), { recursive: true });
  fs.mkdirSync(path.join(base, "scripts", "linux"), { recursive: true });
  fs.writeFileSync(path.join(base, "scripts", "windows", "remover-barra.ps1"), "# nome: Remover barra X\n# descricao: Remove a barra de ferramentas X\n# risco: medio\n# lento: sim\nResultado 0 \"ok\"");
  fs.writeFileSync(path.join(base, "scripts", "windows", "leia-me.txt"), "ignorado");
  fs.writeFileSync(path.join(base, "scripts", "linux", "sem-cabecalho.sh"), "resultado 0 ok");
  const win = O.catalogo({ plataforma: "win32", pastaBase: base }).filter((a) => a.personalizado);
  assert.deepEqual(win.map((a) => [a.id, a.nome, a.risco, a.lento, a.admin, a.padrao]), [["script:remover-barra.ps1", "Remover barra X", "medio", true, true, false]]);
  assert.match(win[0].sha256, /^[0-9a-f]{16}$/);
  const lin = O.lerScriptsPersonalizados(base, "linux");
  assert.deepEqual(lin.map((a) => [a.nome, a.admin, a.risco]), [["sem-cabecalho.sh", false, "baixo"]]);
  assert.deepEqual(O.lerScriptsPersonalizados(base, "darwin"), []);
});

test("protocolo de resultado", () => {
  assert.deepEqual(O.interpretarSaida(`log\nGSTI_RESULTADO {"liberadoBytes": 2048, "detalhe": "feito"}\n`, 0), { status: "ok", liberadoBytes: 2048, detalhe: "feito" });
  assert.deepEqual(O.interpretarSaida("sem marca", 3), { status: "erro", liberadoBytes: 0, detalhe: "Terminou com código 3." });
  assert.equal(O.interpretarSaida('GSTI_RESULTADO {"liberadoBytes": -5}', 0).liberadoBytes, 0);
  assert.equal(O.interpretarSaida("GSTI_RESULTADO {quebrado", 0).status, "ok");
});

test("execução no Windows: uma chamada por ação, autorização obrigatória", async () => {
  await assert.rejects(O.executar(["dns"], { plataforma: "win32" }), /quem autorizou/);
  await assert.rejects(O.executar(["inexistente"], { plataforma: "win32", autorizadoPor: "Cliente" }), /ao menos uma ação/);
  const chamadas = [];
  const progresso = [];
  const executor = async (cmd, args) => {
    chamadas.push(cmd);
    const script = Buffer.from(args[args.length - 1], "base64").toString("utf16le");
    return /Clear-DnsClientCache/.test(script)
      ? { saida: 'GSTI_RESULTADO {"liberadoBytes": 0, "detalhe": "DNS"}', codigo: 0 }
      : { saida: "", codigo: 1 };
  };
  const r = await O.executar(["dns", "sfc"], { plataforma: "win32", autorizadoPor: " Carla ", tecnico: "Ana", executor, aoProgredir: (p) => progresso.push(`${p.id}:${p.fase}`) });
  assert.deepEqual(chamadas, ["powershell.exe", "powershell.exe"]);
  assert.deepEqual(progresso, ["dns:inicio", "dns:fim", "sfc:inicio", "sfc:fim"]);
  assert.equal(r.autorizadoPor, "Carla");
  assert.deepEqual(r.acoes.map((a) => [a.id, a.status]), [["dns", "ok"], ["sfc", "erro"]]);
});

test("execução no macOS/Linux: usuário primeiro, administrador em lote com um pedido de senha", async () => {
  const chamadas = [];
  const executor = async (cmd, args) => {
    chamadas.push([cmd, args[0]]);
    const arquivo = cmd === "osascript" ? args[1].match(/bash (\S+)"/)[1] : args[args.length - 1];
    const conteudo = fs.readFileSync(arquivo, "utf8");
    if (cmd === "osascript") {
      // Simula o lote: devolve marcadores das ações presentes
      const ids = [...conteudo.matchAll(/GSTI_INICIO (\S+)"/g)].map((m) => m[1]);
      return { saida: ids.map((id) => `GSTI_INICIO ${id}\nGSTI_RESULTADO {"liberadoBytes": 10, "detalhe": "${id}"}\nGSTI_FIM ${id} 0`).join("\n"), codigo: 0 };
    }
    return { saida: 'GSTI_RESULTADO {"liberadoBytes": 1048576, "detalhe": "cache"}', codigo: 0 };
  };
  const r = await O.executar(["dns", "caches-usuario", "verificar-disco"], { plataforma: "darwin", autorizadoPor: "Cliente", executor, ehRoot: false });
  assert.deepEqual(chamadas.map((c) => c[0]), ["/bin/bash", "osascript"], "ação de usuário direto; as de administrador num único osascript");
  assert.deepEqual(r.acoes.map((a) => [a.id, a.status, a.liberadoBytes]), [["caches-usuario", "ok", 1048576], ["dns", "ok", 10], ["verificar-disco", "ok", 10]]);
  assert.equal(r.liberadoTotalBytes, 1048596);
  assert.ok(!fs.readdirSync(os.tmpdir()).some((f) => f.startsWith("gsti-otimizacao-")), "scripts temporários apagados");

  // Senha negada no pkexec: ações de administrador ficam com erro explicado
  const negado = await O.executar(["trim", "cache-usuario"], { plataforma: "linux", autorizadoPor: "Cliente", ehRoot: false, executor: async (cmd) => (cmd === "pkexec" ? { saida: "", codigo: 126 } : { saida: 'GSTI_RESULTADO {"liberadoBytes": 0, "detalhe": "ok"}', codigo: 0 }) });
  assert.deepEqual(negado.acoes.map((a) => [a.id, a.status]), [["cache-usuario", "ok"], ["trim", "erro"]]);
  assert.match(negado.acoes[1].detalhe, /Senha de administrador/);
});

test("lote real no bash: marcadores e códigos de saída por ação", { skip: (() => { try { execFileSync("bash", ["-c", "true"]); return false; } catch { return "bash indisponível"; } })() }, () => {
  const lote = O.scriptEmLote([
    { id: "a", script: 'resultado 5 "primeira"' },
    { id: "b", script: "false" },
  ]);
  const saida = execFileSync("bash", ["-c", `${O.SH_UTIL}\n${lote}`], { encoding: "utf8" });
  const partes = O.separarLote(saida);
  assert.deepEqual(O.interpretarSaida(partes.a.saida, partes.a.codigo), { status: "ok", liberadoBytes: 5, detalhe: "primeira" });
  assert.equal(partes.b.codigo, 1);
});

test("serviços executados entram no laudo de saída, no PDF e no comparativo", () => {
  const secoes = { plataforma: "linux", equipamento: { numeroSerie: "X1", computador: "pc" }, sistema: { nome: "Ubuntu" }, discos: [], memoria: {} };
  const servicos = { executadoEm: new Date().toISOString(), plataforma: "linux", autorizadoPor: "Cliente <b>", tecnico: "Ana", liberadoTotalBytes: 3 * 1073741824, acoes: [{ id: "journal", nome: "Reduzir logs", status: "ok", liberadoBytes: 3 * 1073741824, detalhe: "ok" }] };
  const entrada = montarLaudoDeSecoes(secoes);
  const saida = montarLaudoDeSecoes(secoes, { momento: "saida", servicos });
  assert.equal(entrada.servicos, null);
  assert.deepEqual(validarLaudo(JSON.parse(JSON.stringify(saida))), { valido: true });
  const html = laudoHtml(saida);
  assert.match(html, /Serviços executados pelo agente/);
  assert.match(html, /3\.0 GB/);
  assert.match(html, /Cliente &lt;b&gt;/);
  assert.ok(comparar(entrada, saida).linhas.some((l) => l.grupo === "Otimização" && l.depois === "3072 MB"));
  assert.equal(montarLaudoDeSecoes(secoes, { servicos: { acoes: [] } }).servicos, null, "otimização vazia não é registrada");
});
