// Drivers no Windows: inventário de dispositivos, backup (pnputil /export-driver), instalação
// de INF, Windows Update (API oficial) e ferramentas dos fabricantes (Dell, Lenovo, HP).
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const D = require("./drivers");

const MARCA_JSON = "GSTI_JSON ";

const rodarProcesso = (cmd, args, timeout = 10 * 60000) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 50 * 1024 * 1024, windowsHide: true, encoding: "utf8" }, (erro, stdout, stderr) => {
      resolve({ saida: `${stdout || ""}`, erro: `${stderr || ""}`, codigo: erro ? (typeof erro.code === "number" ? erro.code : 1) : 0, expirou: !!erro?.killed });
    });
  });

function powershell(script, { executor = rodarProcesso, timeout } = {}) {
  const codificado = Buffer.from(`[Console]::OutputEncoding = [Text.Encoding]::UTF8\n$ErrorActionPreference = "SilentlyContinue"\n$ProgressPreference = "SilentlyContinue"\n${script}`, "utf16le").toString("base64");
  return executor("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codificado], timeout);
}

const lista = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function lerJson(saida) {
  const linha = String(saida || "").split(/\r?\n/).reverse().find((l) => l.startsWith(MARCA_JSON));
  if (!linha) return null;
  try {
    return JSON.parse(linha.slice(MARCA_JSON.length));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Inventário
// ---------------------------------------------------------------------------
const SCRIPT_INVENTARIO = String.raw`
$assinados = @{}
Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceID } | ForEach-Object { $assinados[$_.DeviceID] = $_ }
$lista = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPDeviceID -and $_.HardwareID } | ForEach-Object {
  $s = $assinados[$_.PNPDeviceID]
  $driver = $null
  if ($s -and $s.DriverVersion) {
    $driver = [ordered]@{ provedor = $s.DriverProviderName; versao = $s.DriverVersion; data = $(if ($s.DriverDate) { $s.DriverDate.ToString("yyyy-MM-dd") } else { $null }); inf = $s.InfName }
  }
  [ordered]@{ id = $_.PNPDeviceID; nome = $_.Name; classe = $_.PNPClass; erro = [int]$_.ConfigManagerErrorCode; hardwareIds = @($_.HardwareID); compativeis = @($_.CompatibleID); driver = $driver }
})
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
"GSTI_JSON " + (@{ fabricante = $cs.Manufacturer; modelo = $cs.Model; computador = $env:COMPUTERNAME; numeroSerie = $bios.SerialNumber; dispositivos = $lista } | ConvertTo-Json -Depth 6 -Compress)
`;

async function inventario({ executor } = {}) {
  const r = await powershell(SCRIPT_INVENTARIO, { executor, timeout: 3 * 60000 });
  const dados = lerJson(r.saida);
  if (!dados) throw new Error("Não foi possível ler os dispositivos do Windows.");
  return {
    fabricante: String(dados.fabricante || "").trim(),
    modelo: String(dados.modelo || "").trim(),
    computador: String(dados.computador || "").trim(),
    numeroSerie: String(dados.numeroSerie || "").trim(),
    dispositivos: lista(dados.dispositivos).map((d) => ({
      id: d.id, nome: d.nome || "", classe: d.classe || "", erro: Number(d.erro) || 0,
      hardwareIds: lista(d.hardwareIds).filter(Boolean), compativeis: lista(d.compativeis).filter(Boolean), driver: d.driver || null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Backup (antes de formatar)
// ---------------------------------------------------------------------------
const nomeSeguro = (t) => String(t || "").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 60);

async function backup({ pastaBase, equipamento = {}, executor } = {}) {
  const inv = await inventario({ executor });
  equipamento = { computador: equipamento.computador || inv.computador, numeroSerie: equipamento.numeroSerie || inv.numeroSerie };
  const d = new Date();
  const carimbo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  const destino = path.join(pastaBase, "drivers-backup", `${nomeSeguro(equipamento.numeroSerie || equipamento.computador || "computador")}_${carimbo}`);
  fs.mkdirSync(destino, { recursive: true });
  const r = await (executor || rodarProcesso)("pnputil.exe", ["/export-driver", "*", destino], 20 * 60000);
  const exportados = D.indexarPasta(destino, { fonte: "backup" }).entradas;
  const resumo = D.resumoDrivers(inv.dispositivos);
  const manifesto = {
    formato: "gsti-drivers-backup", versao: 1, geradoEm: d.toISOString(),
    computador: equipamento.computador || "", numeroSerie: equipamento.numeroSerie || "", fabricante: inv.fabricante, modelo: inv.modelo,
    pacotes: exportados.map((e) => ({ inf: path.relative(destino, e.arquivo), provedor: e.provedor, classe: e.classe, versao: e.versao, data: e.data, antigo: D.anosDesde(e.data) >= 3 })),
    drivers: resumo.lista,
  };
  fs.writeFileSync(path.join(destino, "manifesto.json"), JSON.stringify(manifesto, null, 2));
  return {
    status: r.codigo === 0 || exportados.length ? "ok" : "erro",
    pasta: destino,
    pacotes: exportados.length,
    antigos: manifesto.pacotes.filter((p) => p.antigo).length,
    detalhe: exportados.length ? `${exportados.length} pacote(s) de driver exportado(s)` : `Nenhum driver exportado (pnputil: código ${r.codigo}).`,
  };
}

// Backups do mesmo computador (número de série) no pen drive, mais recente primeiro
function backupsDoComputador(pastaBase, numeroSerie) {
  const base = path.join(pastaBase, "drivers-backup");
  let pastas = [];
  try {
    pastas = fs.readdirSync(base, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => path.join(base, x.name));
  } catch {
    return [];
  }
  return pastas.map((p) => {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(p, "manifesto.json"), "utf8"));
      return { pasta: p, ...m, mesmoComputador: !!numeroSerie && m.numeroSerie === numeroSerie };
    } catch {
      return null;
    }
  }).filter(Boolean).sort((a, b) => Number(b.mesmoComputador) - Number(a.mesmoComputador) || String(b.geradoEm).localeCompare(String(a.geradoEm)));
}

// ---------------------------------------------------------------------------
// Instalação
// ---------------------------------------------------------------------------
async function instalarInf(arquivo, { executor } = {}) {
  const r = await (executor || rodarProcesso)("pnputil.exe", ["/add-driver", arquivo, "/install"], 10 * 60000);
  // 0 = ok; 3010 = ok, reiniciar; 259 = adicionado, sem dispositivo a atualizar
  const ok = [0, 3010, 259].includes(r.codigo);
  const reiniciar = r.codigo === 3010 || /reboot|reiniciar/i.test(r.saida);
  return { ok, reiniciar, codigo: r.codigo, detalhe: ok ? (reiniciar ? "Instalado; reinicie para concluir." : "Instalado.") : `pnputil terminou com código ${r.codigo}.` };
}

const SCRIPT_WINDOWS_UPDATE = String.raw`
try {
  $sessao = New-Object -ComObject Microsoft.Update.Session
  $sessao.ClientApplicationID = "GSTI Diagnostico"
  $busca = $sessao.CreateUpdateSearcher()
  $r = $busca.Search("IsInstalled=0 and Type='Driver' and IsHidden=0")
  $atualizacoes = @($r.Updates | ForEach-Object { $_ })
  if (-not $atualizacoes.Count) { "GSTI_JSON " + (@{ encontrados = 0; itens = @() } | ConvertTo-Json -Compress); exit 0 }
  $colecao = New-Object -ComObject Microsoft.Update.UpdateColl
  foreach ($u in $atualizacoes) { if (-not $u.EulaAccepted) { $u.AcceptEula() }; [void]$colecao.Add($u) }
  $baixador = $sessao.CreateUpdateDownloader(); $baixador.Updates = $colecao; [void]$baixador.Download()
  $instalador = $sessao.CreateUpdateInstaller(); $instalador.Updates = $colecao; $res = $instalador.Install()
  $itens = @()
  for ($i = 0; $i -lt $colecao.Count; $i++) {
    $itens += [ordered]@{ titulo = $colecao.Item($i).Title; codigo = [int]$res.GetUpdateResult($i).ResultCode }
  }
  "GSTI_JSON " + (@{ encontrados = $atualizacoes.Count; reiniciar = [bool]$res.RebootRequired; itens = $itens } | ConvertTo-Json -Depth 4 -Compress)
} catch {
  "GSTI_JSON " + (@{ erro = $_.Exception.Message } | ConvertTo-Json -Compress)
}
`;

async function windowsUpdate({ executor } = {}) {
  const r = await powershell(SCRIPT_WINDOWS_UPDATE, { executor, timeout: 60 * 60000 });
  const j = lerJson(r.saida);
  if (!j || j.erro) return { ok: false, detalhe: `Windows Update indisponível: ${j?.erro || "sem resposta"} (verifique a internet).`, itens: [] };
  const itens = lista(j.itens).map((i) => ({ titulo: i.titulo, ok: [2, 3].includes(Number(i.codigo)) }));
  return {
    ok: true,
    reiniciar: !!j.reiniciar,
    itens,
    detalhe: j.encontrados ? `${itens.filter((i) => i.ok).length} de ${j.encontrados} driver(s) instalado(s) pelo Windows Update.` : "Windows Update: nenhum driver pendente.",
  };
}

// Ferramentas oficiais dos fabricantes (instaladas pelo winget quando faltarem)
const FERRAMENTAS = {
  dell: {
    nome: "Dell Command | Update", winget: "Dell.CommandUpdate",
    caminhos: ["C:\\Program Files\\Dell\\CommandUpdate\\dcu-cli.exe", "C:\\Program Files (x86)\\Dell\\CommandUpdate\\dcu-cli.exe"],
    argumentos: ["/applyUpdates", "-updateType=driver", "-reboot=disable", "-silent"],
    // 0 ok, 1 ok e reiniciar, 500 nada a atualizar
    interpretar: (c) => ({ ok: [0, 1, 5, 500].includes(c), reiniciar: [1, 5].includes(c), detalhe: c === 500 ? "Nenhuma atualização Dell pendente." : [0, 1, 5].includes(c) ? "Drivers Dell atualizados." : `Dell Command | Update: código ${c}.` }),
  },
  lenovo: {
    nome: "Lenovo System Update", winget: "Lenovo.SystemUpdate",
    caminhos: ["C:\\Program Files (x86)\\Lenovo\\System Update\\tvsu.exe"],
    argumentos: ["/CM", "-search", "A", "-action", "INSTALL", "-packagetypes", "2", "-noicon", "-includerebootpackages", "1,3,4", "-nolicense", "-noreboot"],
    interpretar: (c) => ({ ok: c === 0, reiniciar: false, detalhe: c === 0 ? "Drivers Lenovo verificados e instalados." : `Lenovo System Update: código ${c}.` }),
  },
  hp: {
    nome: "HP Image Assistant", winget: "HP.ImageAssistant",
    caminhos: ["C:\\Program Files\\HP\\HPIA\\HPImageAssistant.exe", "C:\\SWSetup\\HPImageAssistant\\HPImageAssistant.exe"],
    argumentos: ["/Operation:Analyze", "/Category:Drivers", "/Selection:All", "/Action:Install", "/Silent", "/Noninteractive", "/ReportFolder:C:\\Windows\\Temp\\gsti-hpia"],
    // 256 = nenhuma recomendação; 3010 = reiniciar
    interpretar: (c) => ({ ok: [0, 256, 3010].includes(c), reiniciar: c === 3010, detalhe: c === 256 ? "Nenhum driver HP pendente." : [0, 3010].includes(c) ? "Drivers HP instalados." : `HP Image Assistant: código ${c}.` }),
  },
};

const marcaDoFabricante = (fabricante) => (/dell/i.test(fabricante) ? "dell" : /lenovo/i.test(fabricante) ? "lenovo" : /hewlett|^hp\b/i.test(fabricante) ? "hp" : null);

async function ferramentaDoFabricante(fabricante, { executor, existe = fs.existsSync } = {}) {
  const marca = marcaDoFabricante(fabricante);
  if (!marca) return null;
  const f = FERRAMENTAS[marca];
  const rodar = executor || rodarProcesso;
  let exe = f.caminhos.find((c) => existe(c));
  if (!exe) {
    const w = await rodar("winget", ["install", "--id", f.winget, "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"], 20 * 60000);
    exe = f.caminhos.find((c) => existe(c));
    if (!exe) return { marca, nome: f.nome, ok: false, reiniciar: false, detalhe: `Não foi possível instalar o ${f.nome} (winget: código ${w.codigo}).` };
  }
  const r = await rodar(exe, f.argumentos, 60 * 60000);
  return { marca, nome: f.nome, ...f.interpretar(r.codigo) };
}

/**
 * Executa a pós-formatação de drivers e devolve as ações para o registro do laudo.
 * Ordem: rede (repositório/backup) -> Windows Update -> fabricante -> novo inventário e o
 * que continuar faltando do plano escolhido -> busca de dispositivos.
 */
async function executarPlano({ plano, selecionados, incluirWindowsUpdate, incluirFabricante, repositorio = [], backup: backupIdx = [], executor, aoProgredir = () => {} }) {
  const escolhidos = new Set((selecionados || plano.filter((i) => i.selecionado).map((i) => i.chave)).map((x) => String(x).toLowerCase()));
  const acoes = [];
  const registrar = (acao) => {
    acoes.push({ categoria: "drivers", risco: "baixo", liberadoBytes: 0, duracaoS: 0, ...acao });
    aoProgredir({ fase: "fim", resultado: acoes[acoes.length - 1] });
  };
  const instalarItem = async (item) => {
    aoProgredir({ fase: "inicio", id: item.chave, nome: `${item.classe || "Driver"} · ${item.provedor || ""} ${item.versao || ""}` });
    const inicio = Date.now();
    const r = await instalarInf(item.arquivo, { executor });
    registrar({
      id: `driver:${path.basename(item.arquivo)}`, nome: `${item.dispositivos.map((d) => d.nome).filter(Boolean).slice(0, 2).join(", ") || item.classe} — ${item.provedor || ""} ${item.versao || ""} (${item.fonte === "repositorio" ? "repositório" : "backup"})`,
      status: r.ok ? "ok" : "erro", detalhe: r.detalhe, reinicio: r.reiniciar, duracaoS: Math.round((Date.now() - inicio) / 1000),
    });
  };

  // 1) Rede primeiro: sem ela não há Windows Update nem ferramenta do fabricante
  const feitos = new Set();
  for (const item of plano.filter((i) => i.rede && escolhidos.has(i.chave))) {
    await instalarItem(item);
    feitos.add(item.chave);
  }

  // 2) Windows Update
  if (incluirWindowsUpdate) {
    aoProgredir({ fase: "inicio", id: "windows-update", nome: "Windows Update (drivers)" });
    const inicio = Date.now();
    const r = await windowsUpdate({ executor });
    registrar({ id: "windows-update", nome: "Drivers pelo Windows Update", status: r.ok ? "ok" : "erro", detalhe: r.detalhe + (r.itens?.length ? ` ${r.itens.map((i) => i.titulo).slice(0, 6).join("; ")}` : ""), reinicio: !!r.reiniciar, duracaoS: Math.round((Date.now() - inicio) / 1000) });
  }

  // 3) Fabricante
  let inv = null;
  if (incluirFabricante) {
    inv = await inventario({ executor });
    const marca = marcaDoFabricante(inv.fabricante);
    if (marca) {
      aoProgredir({ fase: "inicio", id: "fabricante", nome: FERRAMENTAS[marca].nome });
      const inicio = Date.now();
      const r = await ferramentaDoFabricante(inv.fabricante, { executor });
      registrar({ id: `fabricante:${marca}`, nome: `Drivers pelo ${r.nome}`, status: r.ok ? "ok" : "erro", detalhe: r.detalhe, reinicio: !!r.reiniciar, duracaoS: Math.round((Date.now() - inicio) / 1000) });
    }
  }

  // 4) Replaneja com o estado atual: só instala o que ainda faz falta ou é mais novo
  inv = await inventario({ executor });
  const novoPlano = D.planejar({ dispositivos: inv.dispositivos, repositorio, backup: backupIdx });
  for (const item of novoPlano.filter((i) => escolhidos.has(i.chave) && !feitos.has(i.chave))) await instalarItem(item);

  // 5) Busca de novos dispositivos
  await (executor || rodarProcesso)("pnputil.exe", ["/scan-devices"], 5 * 60000);
  const final = await inventario({ executor });
  const faltando = D.pendentes(final.dispositivos);
  return { acoes, pendentes: faltando.map((d) => ({ nome: d.nome || "Dispositivo desconhecido", classe: d.classe, hardwareId: d.hardwareIds[0] || "" })) };
}

module.exports = { inventario, backup, backupsDoComputador, instalarInf, windowsUpdate, ferramentaDoFabricante, marcaDoFabricante, executarPlano, lerJson, SCRIPT_INVENTARIO, SCRIPT_WINDOWS_UPDATE, FERRAMENTAS };
