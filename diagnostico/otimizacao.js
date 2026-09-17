// Otimização pelo agente GSTI Diagnóstico: catálogo de ações por sistema (scripts que não
// apagam dados do cliente, exceto as marcadas como risco "medio", que vêm desmarcadas),
// scripts próprios da assistência (pasta scripts/ ao lado do agente) e execução com registro.
//
// Protocolo dos scripts: imprimir, ao final, uma linha
//   GSTI_RESULTADO {"liberadoBytes": 123, "detalhe": "texto curto"}
// Sem essa linha, vale o código de saída (0 = ok).
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const MARCA = "GSTI_RESULTADO";

// Catálogos por sistema (scripts e utilitários em arquivos próprios)
const { UTIL: PS_UTIL, ACOES: WINDOWS } = require("./otimizacao-windows");
const { UTIL: SH_UTIL, MACOS, LINUX } = require("./otimizacao-unix");

// Categorias exibidas na tela, na ordem
const CATEGORIAS = { limpeza: "Limpeza", desempenho: "Desempenho e aparência", manutencao: "Manutenção e reparo", reverter: "Desfazer ajustes" };

const CATALOGO = { win32: WINDOWS, darwin: MACOS, linux: LINUX };
const EXT_SCRIPT = { win32: ".ps1", darwin: ".sh", linux: ".sh" };

// ---------------------------------------------------------------------------
// Scripts da assistência: scripts/<windows|macos|linux>/*.ps1|*.sh com cabeçalho
//   # nome: Remover barra de ferramentas X
//   # descricao: ...
//   # risco: baixo|medio      # admin: sim|nao      # lento: sim|nao
// ---------------------------------------------------------------------------
const PASTA_SISTEMA = { win32: "windows", darwin: "macos", linux: "linux" };

function lerScriptsPersonalizados(pastaBase, plataforma = process.platform) {
  const pasta = path.join(pastaBase, "scripts", PASTA_SISTEMA[plataforma] || "");
  let arquivos = [];
  try {
    arquivos = fs.readdirSync(pasta).filter((f) => f.toLowerCase().endsWith(EXT_SCRIPT[plataforma]));
  } catch {
    return [];
  }
  return arquivos.slice(0, 50).map((arquivo) => {
    const conteudo = fs.readFileSync(path.join(pasta, arquivo), "utf8");
    const meta = (campo) => (conteudo.match(new RegExp(`^\\s*#\\s*${campo}\\s*:\\s*(.+)$`, "im")) || [])[1]?.trim() || "";
    const sim = (v) => /^(sim|s|yes|true|1)$/i.test(v);
    return {
      id: `script:${arquivo}`,
      nome: meta("nome") || arquivo,
      descricao: meta("descricao") || "Script da assistência.",
      risco: /medio|médio|alto/i.test(meta("risco")) ? "medio" : "baixo",
      admin: plataforma === "win32" ? true : sim(meta("admin")),
      lento: sim(meta("lento")),
      padrao: false,
      categoria: "script",
      personalizado: true,
      sha256: crypto.createHash("sha256").update(conteudo).digest("hex").slice(0, 16),
      script: conteudo,
    };
  });
}

function catalogo({ plataforma = process.platform, pastaBase } = {}) {
  const base = CATALOGO[plataforma] || [];
  const extras = pastaBase ? lerScriptsPersonalizados(pastaBase, plataforma) : [];
  return [...base, ...extras];
}

// Sem o conteúdo dos scripts (para a interface)
const paraTela = (acoes) => acoes.map(({ script, ...a }) => a);

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
function interpretarSaida(saida, codigo) {
  const linha = String(saida || "").split(/\r?\n/).reverse().find((l) => l.startsWith(MARCA));
  let r = null;
  if (linha) {
    try {
      r = JSON.parse(linha.slice(MARCA.length).trim());
    } catch { /* linha malformada */ }
  }
  return {
    status: codigo === 0 || (codigo == null && r) ? "ok" : "erro",
    liberadoBytes: Math.max(0, Number(r?.liberadoBytes) || 0),
    detalhe: String(r?.detalhe || (codigo === 0 ? "Concluído." : `Terminou com código ${codigo}.`)).slice(0, 300),
  };
}

const rodarProcesso = (cmd, args, timeout) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 20 * 1024 * 1024, windowsHide: true, encoding: "utf8" }, (erro, stdout, stderr) => {
      resolve({ saida: `${stdout || ""}`, erro: `${stderr || ""}`, codigo: erro ? (typeof erro.code === "number" ? erro.code : 1) : 0, expirou: !!erro?.killed });
    });
  });

const tempo = (lento) => (lento ? 60 : 5) * 60000;

async function executarWindows(acao, executor) {
  const codificado = Buffer.from(`[Console]::OutputEncoding = [Text.Encoding]::UTF8\n${PS_UTIL}\n${acao.script}`, "utf16le").toString("base64");
  return executor("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codificado], tempo(acao.lento));
}

// macOS/Linux: um arquivo temporário com o script (e o bloco de utilitários)
function escreverScript(conteudo) {
  const arquivo = path.join(os.tmpdir(), `gsti-otimizacao-${crypto.randomBytes(6).toString("hex")}.sh`);
  fs.writeFileSync(arquivo, `#!/bin/bash\n${SH_UTIL}\n${conteudo}\n`, { mode: 0o700 });
  return arquivo;
}

// Várias ações admin em um único pedido de senha, com marcadores por ação
function scriptEmLote(acoes) {
  return acoes.map((a) => `echo "GSTI_INICIO ${a.id}"\n( ${a.script}\n)\necho "GSTI_FIM ${a.id} $?"`).join("\n");
}

function separarLote(saida) {
  const partes = {};
  const re = /GSTI_INICIO (\S+)\r?\n([\s\S]*?)GSTI_FIM \1 (\d+)/g;
  let m;
  while ((m = re.exec(String(saida)))) partes[m[1]] = { saida: m[2], codigo: Number(m[3]) };
  return partes;
}

function comandoAdmin(plataforma, arquivo) {
  if (plataforma === "darwin") {
    return ["osascript", ["-e", `do shell script "/bin/bash ${arquivo.replace(/"/g, "")}" with administrator privileges`]];
  }
  return ["pkexec", ["/bin/bash", arquivo]];
}

/**
 * Executa as ações escolhidas e devolve o registro para o laudo.
 * @param {string[]} ids
 * @param {{ plataforma, pastaBase, autorizadoPor, tecnico, aoProgredir, executor, ehRoot }} op
 */
async function executar(ids, { plataforma = process.platform, pastaBase, autorizadoPor, tecnico = "", aoProgredir = () => {}, executor = rodarProcesso, ehRoot } = {}) {
  if (!String(autorizadoPor || "").trim()) throw new Error("Informe quem autorizou a otimização (cliente ou responsável).");
  const disponiveis = catalogo({ plataforma, pastaBase });
  // Ordem do catálogo (não a da tela): o ponto de restauração vem antes de qualquer mudança
  const escolhidas = disponiveis.filter((a) => ids.includes(a.id));
  if (!escolhidas.length) throw new Error("Escolha ao menos uma ação.");
  const resultados = [];
  const registrar = (acao, r, duracaoS) => {
    const item = { id: acao.id, nome: acao.nome, categoria: acao.categoria, personalizado: !!acao.personalizado, sha256: acao.sha256, risco: acao.risco, reinicio: !!acao.reinicio, ...r, duracaoS: Math.round(duracaoS) };
    resultados.push(item);
    aoProgredir({ id: acao.id, fase: "fim", resultado: item });
  };
  const root = ehRoot ?? (typeof process.getuid === "function" && process.getuid() === 0);

  if (plataforma === "win32") {
    for (const acao of escolhidas) {
      aoProgredir({ id: acao.id, fase: "inicio" });
      const inicio = Date.now();
      const p = await executarWindows(acao, executor);
      registrar(acao, p.expirou ? { status: "erro", liberadoBytes: 0, detalhe: "Tempo esgotado." } : interpretarSaida(p.saida, p.codigo), (Date.now() - inicio) / 1000);
    }
  } else {
    // Primeiro as que rodam como usuário (uma por vez), depois as de administrador em lote
    for (const acao of escolhidas.filter((a) => !a.admin || root)) {
      aoProgredir({ id: acao.id, fase: "inicio" });
      const inicio = Date.now();
      const arquivo = escreverScript(acao.script);
      try {
        const p = await executor("/bin/bash", [arquivo], tempo(acao.lento));
        registrar(acao, p.expirou ? { status: "erro", liberadoBytes: 0, detalhe: "Tempo esgotado." } : interpretarSaida(p.saida, p.codigo), (Date.now() - inicio) / 1000);
      } finally {
        fs.rmSync(arquivo, { force: true });
      }
    }
    const admins = escolhidas.filter((a) => a.admin && !root);
    if (admins.length) {
      admins.forEach((a) => aoProgredir({ id: a.id, fase: "inicio" }));
      const inicio = Date.now();
      const arquivo = escreverScript(scriptEmLote(admins));
      try {
        const [cmd, args] = comandoAdmin(plataforma, arquivo);
        const p = await executor(cmd, args, admins.reduce((s, a) => s + tempo(a.lento), 0));
        const partes = separarLote(p.saida);
        const cancelado = !Object.keys(partes).length;
        for (const a of admins) {
          const parte = partes[a.id];
          registrar(a, parte ? interpretarSaida(parte.saida, parte.codigo) : { status: "erro", liberadoBytes: 0, detalhe: cancelado ? "Senha de administrador não informada ou recusada." : "Não executada." }, (Date.now() - inicio) / 1000 / admins.length);
        }
      } finally {
        fs.rmSync(arquivo, { force: true });
      }
    }
  }

  return {
    executadoEm: new Date().toISOString(),
    plataforma,
    autorizadoPor: String(autorizadoPor).trim().slice(0, 120),
    tecnico: String(tecnico || "").trim().slice(0, 80),
    liberadoTotalBytes: resultados.reduce((s, r) => s + r.liberadoBytes, 0),
    requerReinicio: resultados.some((r) => r.reinicio && r.status === "ok"),
    acoes: resultados,
  };
}

module.exports = { CATEGORIAS, catalogo, paraTela, executar, interpretarSaida, lerScriptsPersonalizados, scriptEmLote, separarLote, PS_UTIL, SH_UTIL, MARCA };
