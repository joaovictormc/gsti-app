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

// ---------------------------------------------------------------------------
// Windows (PowerShell; o agente já roda como administrador)
// ---------------------------------------------------------------------------
const PS_UTIL = String.raw`
$ErrorActionPreference = "SilentlyContinue"
function Tam($p) { $s = (Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($s) { [long]$s } else { 0 } }
function Livre() { [long](Get-PSDrive ($env:SystemDrive.TrimEnd(":"))).Free }
function Resultado($bytes, $detalhe) { "GSTI_RESULTADO " + (@{ liberadoBytes = [long]$bytes; detalhe = $detalhe } | ConvertTo-Json -Compress) }
`;

const WINDOWS = [
  {
    id: "ponto-restauracao", nome: "Criar ponto de restauração", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Permite desfazer as mudanças do sistema pela Restauração do Windows. Recomendado antes das demais ações.",
    script: String.raw`
try {
  Checkpoint-Computer -Description "GSTI Diagnostico - antes da otimizacao" -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
  Resultado 0 "Ponto de restauração criado."
} catch {
  Resultado 0 ("Não foi possível criar o ponto: " + $_.Exception.Message + " (a Proteção do Sistema pode estar desativada ou já houve um ponto nas últimas 24 h).")
}`,
  },
  {
    id: "temporarios", nome: "Limpar arquivos temporários", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Apaga arquivos temporários do usuário e do Windows com mais de 1 dia (arquivos em uso são mantidos).",
    script: String.raw`
$antes = Livre
$limite = (Get-Date).AddDays(-1)
foreach ($p in @($env:TEMP, "$env:SystemRoot\Temp")) {
  Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $limite } | Remove-Item -Force -ErrorAction SilentlyContinue
  Get-ChildItem -LiteralPath $p -Recurse -Force -Directory -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue) } | Remove-Item -Force -ErrorAction SilentlyContinue
}
Resultado ([Math]::Max(0, (Livre) - $antes)) "Temporários removidos."`,
  },
  {
    id: "miniaturas", nome: "Limpar cache de miniaturas", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Remove o cache de miniaturas do Explorador; o Windows recria conforme as pastas são abertas.",
    script: String.raw`
$pasta = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
$antes = Tam $pasta
Get-ChildItem -LiteralPath $pasta -Filter "thumbcache_*.db" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Resultado ([Math]::Max(0, $antes - (Tam $pasta))) "Arquivos em uso pelo Explorador são mantidos."`,
  },
  {
    id: "cache-windows-update", nome: "Limpar downloads do Windows Update", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Remove instaladores de atualizações já baixados (o Windows baixa de novo se precisar).",
    script: String.raw`
$pasta = "$env:SystemRoot\SoftwareDistribution\Download"
$antes = Tam $pasta
Stop-Service -Name wuauserv, bits -Force -ErrorAction SilentlyContinue
Get-ChildItem -LiteralPath $pasta -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Start-Service -Name bits, wuauserv -ErrorAction SilentlyContinue
Resultado ([Math]::Max(0, $antes - (Tam $pasta))) "Cache do Windows Update limpo."`,
  },
  {
    id: "dns", nome: "Limpar cache de DNS", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Resolve sites que não abrem por endereço antigo em cache.",
    script: String.raw`
Clear-DnsClientCache
Resultado 0 "Cache de DNS limpo."`,
  },
  {
    id: "componentes", nome: "Limpeza de componentes do Windows (DISM)", risco: "baixo", admin: true, lento: true, padrao: false,
    descricao: "Remove versões antigas de componentes substituídos por atualizações. Pode levar de 5 a 20 minutos.",
    script: String.raw`
$antes = Livre
$saida = & Dism.exe /Online /Cleanup-Image /StartComponentCleanup /NoRestart 2>&1 | Out-String
$ok = $LASTEXITCODE -eq 0
Resultado ([Math]::Max(0, (Livre) - $antes)) ($(if ($ok) { "Limpeza de componentes concluída." } else { "DISM terminou com código $LASTEXITCODE." }))
if (-not $ok) { exit 1 }`,
  },
  {
    id: "otimizar-unidades", nome: "Otimizar unidade do sistema (TRIM/desfragmentação)", risco: "baixo", admin: true, lento: true, padrao: true,
    descricao: "SSD: envia TRIM. HD: desfragmenta. O Windows escolhe o método conforme o tipo do disco.",
    script: String.raw`
$letra = $env:SystemDrive.TrimEnd(":")
Optimize-Volume -DriveLetter $letra -ErrorAction Stop
Resultado 0 "Unidade $letra otimizada."`,
  },
  {
    id: "sfc", nome: "Verificar e reparar arquivos do sistema (SFC)", risco: "baixo", admin: true, lento: true, padrao: false,
    descricao: "Verifica arquivos protegidos do Windows e repara os corrompidos. Leva de 10 a 30 minutos.",
    script: String.raw`
& sfc.exe /scannow | Out-Null
$codigo = $LASTEXITCODE
$msg = switch ($codigo) { 0 { "Nenhuma violação de integridade encontrada ou problemas reparados." } 1 { "Arquivos corrompidos foram reparados." } default { "SFC terminou com código $codigo (veja CBS.log)." } }
Resultado 0 $msg`,
  },
  {
    id: "lixeira", nome: "Esvaziar a Lixeira", risco: "medio", admin: false, lento: false, padrao: false,
    descricao: "Apaga definitivamente os arquivos da Lixeira. Só marque com autorização do cliente.",
    script: String.raw`
$antes = Livre
Clear-RecycleBin -Force -ErrorAction SilentlyContinue
Resultado ([Math]::Max(0, (Livre) - $antes)) "Lixeira esvaziada."`,
  },
];

// ---------------------------------------------------------------------------
// macOS e Linux (bash). Ações "admin" rodam juntas, com um único pedido de senha.
// ---------------------------------------------------------------------------
const SH_UTIL = String.raw`
tam() { du -sk "$@" 2>/dev/null | awk '{s+=$1} END {print s*1024+0}'; }
livre() { df -Pk / | awk 'NR==2 {print $4*1024}'; }
resultado() { printf 'GSTI_RESULTADO {"liberadoBytes": %s, "detalhe": "%s"}\n' "$1" "$2"; }
`;

const MACOS = [
  {
    id: "caches-usuario", nome: "Limpar caches do usuário", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Apaga ~/Library/Caches; os aplicativos recriam o que precisarem. Feche os programas antes.",
    script: String.raw`
antes=$(tam "$HOME/Library/Caches")
find "$HOME/Library/Caches" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
depois=$(tam "$HOME/Library/Caches")
resultado $((antes > depois ? antes - depois : 0)) "Caches removidos (itens protegidos pelo sistema são mantidos)."`,
  },
  {
    id: "logs-usuario", nome: "Limpar logs antigos do usuário", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Apaga logs de aplicativos com mais de 7 dias.",
    script: String.raw`
antes=$(tam "$HOME/Library/Logs")
find "$HOME/Library/Logs" -type f -mtime +7 -delete 2>/dev/null
depois=$(tam "$HOME/Library/Logs")
resultado $((antes > depois ? antes - depois : 0)) "Logs com mais de 7 dias removidos."`,
  },
  {
    id: "dns", nome: "Limpar cache de DNS", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Resolve sites que não abrem por endereço antigo em cache.",
    script: String.raw`
dscacheutil -flushcache; killall -HUP mDNSResponder 2>/dev/null
resultado 0 "Cache de DNS limpo."`,
  },
  {
    id: "verificar-disco", nome: "Verificar o volume do sistema", risco: "baixo", admin: true, lento: true, padrao: false,
    descricao: "diskutil verifyVolume: verifica a estrutura do sistema de arquivos sem alterar nada.",
    script: String.raw`
if diskutil verifyVolume / >/tmp/gsti-verify.log 2>&1; then resultado 0 "Volume verificado: sem problemas."; else resultado 0 "A verificação encontrou problemas: repare pelo Utilitário de Disco (modo de recuperação)."; fi`,
  },
  {
    id: "spotlight", nome: "Reindexar o Spotlight", risco: "baixo", admin: true, lento: true, padrao: false,
    descricao: "Recria o índice de busca (resolve busca lenta ou incompleta). A indexação continua em segundo plano.",
    script: String.raw`
mdutil -E / >/dev/null 2>&1
resultado 0 "Reindexação iniciada."`,
  },
  {
    id: "lixeira", nome: "Esvaziar a Lixeira", risco: "medio", admin: false, lento: false, padrao: false,
    descricao: "Apaga definitivamente os arquivos da Lixeira. Só marque com autorização do cliente.",
    script: String.raw`
antes=$(tam "$HOME/.Trash")
find "$HOME/.Trash" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
depois=$(tam "$HOME/.Trash")
resultado $((antes > depois ? antes - depois : 0)) "Lixeira esvaziada (sem Acesso Total ao Disco o macOS pode impedir)."`,
  },
];

const LINUX = [
  {
    id: "cache-pacotes", nome: "Limpar cache de pacotes", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Remove pacotes baixados já instalados (apt, dnf, pacman ou zypper).",
    script: String.raw`
antes=$(livre)
if command -v apt-get >/dev/null; then apt-get clean
elif command -v dnf >/dev/null; then dnf clean all -q
elif command -v pacman >/dev/null; then pacman -Sc --noconfirm >/dev/null
elif command -v zypper >/dev/null; then zypper clean -a >/dev/null
fi
depois=$(livre)
resultado $((depois > antes ? depois - antes : 0)) "Cache de pacotes limpo."`,
  },
  {
    id: "journal", nome: "Reduzir logs do sistema (journal)", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Mantém só os últimos 7 dias de logs do systemd.",
    script: String.raw`
antes=$(livre)
journalctl --vacuum-time=7d >/dev/null 2>&1
depois=$(livre)
resultado $((depois > antes ? depois - antes : 0)) "Logs com mais de 7 dias removidos."`,
  },
  {
    id: "cache-usuario", nome: "Limpar miniaturas do usuário", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Apaga ~/.cache/thumbnails; o sistema recria conforme as pastas são abertas.",
    script: String.raw`
antes=$(tam "$HOME/.cache/thumbnails")
rm -rf "$HOME/.cache/thumbnails/"* 2>/dev/null
resultado "$antes" "Miniaturas removidas."`,
  },
  {
    id: "trim", nome: "Enviar TRIM aos SSDs", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "fstrim em todos os sistemas de arquivos montados que suportam.",
    script: String.raw`
saida=$(fstrim -av 2>&1 | tr '\n' ' ' | tr -d '"')
resultado 0 "TRIM: $saida"`,
  },
  {
    id: "dns", nome: "Limpar cache de DNS", risco: "baixo", admin: true, lento: false, padrao: false,
    descricao: "systemd-resolved: resolvectl flush-caches.",
    script: String.raw`
(resolvectl flush-caches || systemd-resolve --flush-caches) >/dev/null 2>&1
resultado 0 "Cache de DNS limpo."`,
  },
  {
    id: "pacotes-orfaos", nome: "Remover pacotes órfãos", risco: "medio", admin: true, lento: false, padrao: false,
    descricao: "Remove dependências que nenhum programa usa mais (apt/dnf autoremove). Revise antes em sistemas personalizados.",
    script: String.raw`
antes=$(livre)
if command -v apt-get >/dev/null; then DEBIAN_FRONTEND=noninteractive apt-get autoremove -y >/dev/null
elif command -v dnf >/dev/null; then dnf autoremove -y -q
elif command -v pacman >/dev/null; then orfaos=$(pacman -Qdtq); [ -n "$orfaos" ] && pacman -Rns --noconfirm $orfaos >/dev/null
fi
depois=$(livre)
resultado $((depois > antes ? depois - antes : 0)) "Pacotes órfãos removidos."`,
  },
  {
    id: "lixeira", nome: "Esvaziar a Lixeira", risco: "medio", admin: false, lento: false, padrao: false,
    descricao: "Apaga definitivamente os arquivos da Lixeira. Só marque com autorização do cliente.",
    script: String.raw`
antes=$(tam "$HOME/.local/share/Trash")
rm -rf "$HOME/.local/share/Trash/files/"* "$HOME/.local/share/Trash/info/"* 2>/dev/null
resultado "$antes" "Lixeira esvaziada."`,
  },
];

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
  const escolhidas = ids.map((id) => disponiveis.find((a) => a.id === id)).filter(Boolean);
  if (!escolhidas.length) throw new Error("Escolha ao menos uma ação.");
  const resultados = [];
  const registrar = (acao, r, duracaoS) => {
    const item = { id: acao.id, nome: acao.nome, personalizado: !!acao.personalizado, sha256: acao.sha256, risco: acao.risco, ...r, duracaoS: Math.round(duracaoS) };
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
    acoes: resultados,
  };
}

module.exports = { catalogo, paraTela, executar, interpretarSaida, lerScriptsPersonalizados, scriptEmLote, separarLote, PS_UTIL, SH_UTIL, MARCA };
