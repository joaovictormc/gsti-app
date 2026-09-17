// Pós-formatação do agente: leitura de INF, plano de drivers (sem rebaixar nem trocar de
// fornecedor), execução com executor simulado, catálogo e instalação de programas, e o
// registro de tudo no laudo.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const RAIZ = path.join(__dirname, "..", "..");
const D = require(path.join(RAIZ, "diagnostico", "drivers.js"));
const DW = require(path.join(RAIZ, "diagnostico", "drivers-windows.js"));
const P = require(path.join(RAIZ, "diagnostico", "programas.js"));
const { montarLaudoDeSecoes, validarLaudo, comparar } = require(path.join(RAIZ, "diagnostico", "laudo.js"));
const { laudoHtml } = require(path.join(RAIZ, "diagnostico", "laudo-html.js"));

const INF_REALTEK = `; Driver de rede
[Version]
Signature   = "$Windows NT$"
Class       = Net
Provider    = %Realtek%
CatalogFile = rt640x64.cat
DriverVer   = 03/15/2024,10.68.315.2024

[Manufacturer]
%Realtek% = Realtek, NTamd64.10.0, NTarm64

[Realtek.NTamd64.10.0]
%RTL8168.DeviceDesc% = RTL8168.ndi, PCI\\VEN_10EC&DEV_8168&SUBSYS_86771043 ; exato
%RTL8168.DeviceDesc% = RTL8168.ndi, PCI\\VEN_10EC&DEV_8168

[Realtek.NTarm64]
%RTL8168.DeviceDesc% = RTL8168.ndi, PCI\\VEN_10EC&DEV_9999

[Strings]
Realtek = "Realtek"
RTL8168.DeviceDesc = "Realtek PCIe GbE Family Controller; rede"
`;

function pastaTemp(prefixo) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefixo));
}

test("INF: lê UTF-16 com BOM, [Version], strings e só modelos x64", () => {
  const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(INF_REALTEK, "utf16le")]);
  const inf = D.interpretarInf(D.lerTextoInf(buffer));
  assert.equal(inf.classe, "Net");
  assert.equal(inf.provedor, "Realtek");
  assert.equal(inf.catalogo, "rt640x64.cat");
  assert.equal(inf.data, "2024-03-15");
  assert.equal(inf.versao, "10.68.315.2024");
  assert.deepEqual(inf.hardwareIds.sort(), ["pci\\ven_10ec&dev_8168", "pci\\ven_10ec&dev_8168&subsys_86771043"]);
  assert.equal(D.lerTextoInf(Buffer.from(INF_REALTEK, "latin1")).includes("[Version]"), true);
});

test("índice da pasta: encontra INF em subpastas e confere o catálogo (.cat)", () => {
  const pasta = pastaTemp("gsti-drivers-");
  try {
    const sub = path.join(pasta, "rede", "realtek", "8168", "10.68_2024-03");
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, "rt640x64.inf"), INF_REALTEK);
    fs.writeFileSync(path.join(sub, "rt640x64.cat"), "x");
    fs.writeFileSync(path.join(pasta, "leia.txt"), "não é INF");
    const { entradas, erros } = D.indexarPasta(pasta, { fonte: "repositorio" });
    assert.equal(erros.length, 0);
    assert.equal(entradas.length, 1);
    assert.equal(entradas[0].fonte, "repositorio");
    assert.equal(entradas[0].temCatalogo, true);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

const entrada = (x) => ({ fonte: "repositorio", arquivo: `/repo/${x.nome || "a"}.inf`, classe: "Net", temCatalogo: true, ...x, hardwareIds: x.hardwareIds.map((i) => i.toLowerCase()) });
const dispositivo = (x) => ({ id: x.id || "PCI\\1", nome: x.nome || "Placa", classe: x.classe || "Net", erro: 0, compativeis: [], ...x });

test("plano: sem driver instala; atualização só do mesmo fornecedor e nunca rebaixa", () => {
  const hw = ["PCI\\VEN_10EC&DEV_8168&SUBSYS_86771043"];
  const novo = entrada({ nome: "novo", provedor: "Realtek", versao: "10.68.315.2024", data: "2024-03-15", hardwareIds: hw });
  const microsoft = entrada({ nome: "ms", provedor: "Microsoft", versao: "99.0.0.0", data: "2025-01-01", hardwareIds: hw });

  const sem = D.planejar({ dispositivos: [dispositivo({ hardwareIds: hw, erro: 28, driver: null })], repositorio: [novo] });
  assert.equal(sem.length, 1);
  assert.equal(sem[0].dispositivos[0].motivo, "sem-driver");

  const antigo = { provedor: "Realtek Semiconductor Corp.", versao: "10.50.1.2021", data: "2021-05-01" };
  const atualiza = D.planejar({ dispositivos: [dispositivo({ hardwareIds: hw, driver: antigo })], repositorio: [novo, microsoft] });
  assert.equal(atualiza.length, 1, "Microsoft genérico não substitui o driver da Realtek");
  assert.match(atualiza[0].arquivo, /novo\.inf$/);
  assert.equal(atualiza[0].dispositivos[0].motivo, "mais-novo");

  const maisNovoInstalado = { provedor: "Realtek", versao: "10.70.0.2025", data: "2025-02-01" };
  assert.equal(D.planejar({ dispositivos: [dispositivo({ hardwareIds: hw, driver: maisNovoInstalado })], repositorio: [novo] }).length, 0);
});

test("plano: ID exato vence o compatível, repositório vence o backup e rede vem primeiro", () => {
  const generico = entrada({ nome: "generico", provedor: "Intel", versao: "30.0.0.0", data: "2025-01-01", classe: "System", hardwareIds: ["PCI\\CC_0C05"] });
  const exato = entrada({ nome: "exato", provedor: "Intel", versao: "10.0.0.0", data: "2020-01-01", classe: "System", hardwareIds: ["PCI\\VEN_8086&DEV_A323"] });
  const smbus = dispositivo({ id: "PCI\\SMBUS", nome: "SMBus", classe: "System", erro: 28, driver: null, hardwareIds: ["PCI\\VEN_8086&DEV_A323"], compativeis: ["PCI\\CC_0C05"] });
  const doBackup = { ...entrada({ nome: "rede-backup", provedor: "Realtek", versao: "1.0.0.0", data: "2019-01-01", hardwareIds: ["PCI\\VEN_10EC&DEV_8168"] }), fonte: "backup" };
  const doRepo = entrada({ nome: "rede-repo", provedor: "Realtek", versao: "2.0.0.0", data: "2024-01-01", hardwareIds: ["PCI\\VEN_10EC&DEV_8168"] });
  const rede = dispositivo({ id: "PCI\\REDE", nome: "Ethernet", classe: "Net", erro: 28, driver: null, hardwareIds: ["PCI\\VEN_10EC&DEV_8168"] });

  const plano = D.planejar({ dispositivos: [smbus, rede], repositorio: [generico, exato, doRepo], backup: [doBackup] });
  assert.deepEqual(plano.map((i) => path.basename(i.arquivo)), ["rede-repo.inf", "exato.inf"]);
  assert.equal(plano[0].rede, true);

  const soBackup = D.planejar({ dispositivos: [rede], repositorio: [], backup: [doBackup] });
  assert.equal(soBackup[0].fonte, "backup");
});

test("resumo de drivers: terceiros antigos, sem driver e com erro", () => {
  const agora = Date.parse("2026-09-01");
  const r = D.resumoDrivers([
    dispositivo({ nome: "Vídeo", driver: { provedor: "Intel Corporation", versao: "1", data: "2020-01-01" }, hardwareIds: ["a"] }),
    dispositivo({ nome: "Áudio", driver: { provedor: "Realtek", versao: "2", data: "2025-06-01" }, hardwareIds: ["b"] }),
    dispositivo({ nome: "Teclado", driver: { provedor: "Microsoft", versao: "3", data: "2006-06-21" }, hardwareIds: ["c"] }),
    dispositivo({ nome: "Desconhecido", erro: 28, driver: null, hardwareIds: ["PCI\\X"] }),
    dispositivo({ nome: "Bluetooth", erro: 10, driver: { provedor: "Intel", versao: "4", data: "2024-01-01" }, hardwareIds: ["d"] }),
  ], { agora });
  assert.equal(r.total, 3);
  assert.equal(r.antigos, 1);
  assert.deepEqual(r.semDriver, [{ nome: "Desconhecido", classe: "Net", hardwareId: "PCI\\X" }]);
  assert.deepEqual(r.comErro, [{ nome: "Bluetooth", classe: "Net", codigo: 10 }]);
  assert.equal(r.lista[0].nome, "Vídeo");
});

// ---------------------------------------------------------------------------
// Execução no Windows com executor simulado
// ---------------------------------------------------------------------------
const scriptDe = (args) => {
  const i = args.indexOf("-EncodedCommand");
  return i >= 0 ? Buffer.from(args[i + 1], "base64").toString("utf16le") : "";
};

function simulador({ dispositivos, fabricante = "Dell Inc.", codigosPnputil = {}, windowsUpdate }) {
  const chamadas = [];
  const executor = async (cmd, args) => {
    chamadas.push([cmd, ...args]);
    const script = scriptDe(args);
    if (/Win32_PnPEntity/.test(script)) return { codigo: 0, saida: `GSTI_JSON ${JSON.stringify({ fabricante, modelo: "Latitude", computador: "PC", numeroSerie: "ABC123", dispositivos: dispositivos() })}` };
    if (/Microsoft\.Update\.Session/.test(script)) return { codigo: 0, saida: `GSTI_JSON ${JSON.stringify(windowsUpdate)}` };
    if (cmd === "pnputil.exe" && args[0] === "/add-driver") return { codigo: codigosPnputil[path.basename(args[1])] ?? 0, saida: "" };
    return { codigo: 0, saida: "" };
  };
  return { executor, chamadas };
}

test("inventário e Windows Update: leitura do JSON do PowerShell", async () => {
  const { executor } = simulador({ dispositivos: () => [{ id: "X", nome: "Placa", classe: "Net", erro: 28, hardwareIds: "PCI\\A", compativeis: null, driver: null }], windowsUpdate: { encontrados: 2, reiniciar: true, itens: [{ titulo: "Intel - Display", codigo: 2 }, { titulo: "Realtek - Net", codigo: 4 }] } });
  const inv = await DW.inventario({ executor });
  assert.equal(inv.numeroSerie, "ABC123");
  assert.deepEqual(inv.dispositivos[0].hardwareIds, ["PCI\\A"]);
  assert.deepEqual(inv.dispositivos[0].compativeis, []);
  const wu = await DW.windowsUpdate({ executor });
  assert.equal(wu.ok, true);
  assert.equal(wu.reiniciar, true);
  assert.match(wu.detalhe, /1 de 2/);
  const falha = await DW.windowsUpdate({ executor: async () => ({ codigo: 0, saida: 'GSTI_JSON {"erro":"0x8024402C"}' }) });
  assert.equal(falha.ok, false);
});

test("instalarInf: 0, 3010 e 259 são sucesso; outros códigos são falha", async () => {
  const com = (codigo) => DW.instalarInf("x.inf", { executor: async () => ({ codigo, saida: "" }) });
  assert.equal((await com(0)).ok, true);
  assert.equal((await com(3010)).reiniciar, true);
  assert.equal((await com(259)).ok, true);
  assert.equal((await com(5)).ok, false);
});

test("fabricante: reconhece a marca e interpreta os códigos das ferramentas", () => {
  assert.equal(DW.marcaDoFabricante("Dell Inc."), "dell");
  assert.equal(DW.marcaDoFabricante("LENOVO"), "lenovo");
  assert.equal(DW.marcaDoFabricante("Hewlett-Packard"), "hp");
  assert.equal(DW.marcaDoFabricante("HP"), "hp");
  assert.equal(DW.marcaDoFabricante("ASUSTeK COMPUTER INC."), null);
  assert.equal(DW.FERRAMENTAS.dell.interpretar(500).ok, true);
  assert.equal(DW.FERRAMENTAS.hp.interpretar(3010).reiniciar, true);
  assert.equal(DW.FERRAMENTAS.lenovo.interpretar(1).ok, false);
});

test("executarPlano: rede primeiro, depois Windows Update, fabricante e o que ainda faltar", async () => {
  const pasta = pastaTemp("gsti-plano-");
  try {
    const hwRede = ["PCI\\VEN_10EC&DEV_8168"];
    const hwVideo = ["PCI\\VEN_8086&DEV_9A49"];
    const repo = [
      entrada({ nome: "rede", provedor: "Realtek", versao: "2.0.0.0", data: "2024-01-01", hardwareIds: hwRede }),
      entrada({ nome: "video", classe: "Display", provedor: "Intel", versao: "31.0.0.0", data: "2024-01-01", hardwareIds: hwVideo }),
    ];
    let videoInstalado = false;
    const dispositivos = () => [
      { id: "R", nome: "Ethernet", classe: "Net", erro: 28, hardwareIds: hwRede, compativeis: [], driver: null },
      { id: "V", nome: "Vídeo", classe: "Display", erro: 0, hardwareIds: hwVideo, compativeis: [], driver: { provedor: "Intel", versao: videoInstalado ? "31.0.0.0" : "27.0.0.0", data: "2021-01-01" } },
      { id: "Z", nome: "Sensor", classe: "", erro: 28, hardwareIds: ["ACPI\\Z"], compativeis: [], driver: null },
    ];
    const sim = simulador({ dispositivos, windowsUpdate: { encontrados: 0, itens: [] } });
    const executor = async (cmd, args, t) => {
      const r = await sim.executor(cmd, args, t);
      if (cmd.endsWith("dcu-cli.exe")) videoInstalado = true; // fabricante já atualizou o vídeo
      return r;
    };
    const plano = D.planejar({ dispositivos: dispositivos(), repositorio: repo });
    assert.equal(plano.length, 2);

    const eventos = [];
    // Ferramenta Dell "instalada" (caminho existe) para não chamar o winget
    const original = fs.existsSync;
    fs.existsSync = (c) => /dcu-cli\.exe$/i.test(c) || original(c);
    let r;
    try {
      r = await DW.executarPlano({ plano, incluirWindowsUpdate: true, incluirFabricante: true, repositorio: repo, executor, aoProgredir: (p) => eventos.push(p) });
    } finally {
      fs.existsSync = original;
    }
    const ids = r.acoes.map((a) => a.id);
    assert.deepEqual(ids, ["driver:rede.inf", "windows-update", "fabricante:dell"], "vídeo já atualizado pelo fabricante não é reinstalado");
    assert.ok(r.acoes.every((a) => a.categoria === "drivers"));
    assert.equal(sim.chamadas.filter((c) => c[0] === "pnputil.exe" && c[1] === "/add-driver").length, 1);
    assert.ok(sim.chamadas.some((c) => c[0] === "pnputil.exe" && c[1] === "/scan-devices"));
    assert.deepEqual(r.pendentes.map((d) => d.nome), ["Ethernet", "Sensor"]);
    assert.equal(eventos.filter((e) => e.fase === "fim").length, 3);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

test("backups do computador: o do mesmo número de série vem primeiro", () => {
  const pasta = pastaTemp("gsti-backup-");
  try {
    const criar = (nome, m) => {
      fs.mkdirSync(path.join(pasta, "drivers-backup", nome), { recursive: true });
      fs.writeFileSync(path.join(pasta, "drivers-backup", nome, "manifesto.json"), JSON.stringify({ formato: "gsti-drivers-backup", ...m }));
    };
    criar("OUTRO_20260102-1000", { numeroSerie: "OUTRO", geradoEm: "2026-01-02T10:00:00Z" });
    criar("ABC_20250101-1000", { numeroSerie: "ABC", geradoEm: "2025-01-01T10:00:00Z" });
    criar("ABC_20260101-1000", { numeroSerie: "ABC", geradoEm: "2026-01-01T10:00:00Z" });
    const lista = DW.backupsDoComputador(pasta, "ABC");
    assert.deepEqual(lista.map((b) => path.basename(b.pasta)), ["ABC_20260101-1000", "ABC_20250101-1000", "OUTRO_20260102-1000"]);
    assert.equal(DW.backupsDoComputador(path.join(pasta, "nada"), "ABC").length, 0);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Programas
// ---------------------------------------------------------------------------
test("catálogo de programas: ids únicos, categorias válidas e fonte por sistema", () => {
  const ids = P.CATALOGO.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of P.CATALOGO) {
    assert.ok(P.CATEGORIAS[p.categoria], `${p.id}: categoria`);
    assert.ok(p.w || p.b || p.f, `${p.id}: sem fonte`);
  }
  const win = P.catalogo({ plataforma: "win32" });
  assert.ok(["chrome", "libreoffice", "wps", "office", "acrobat", "7zip"].every((id) => win.some((p) => p.id === id)));
  assert.ok(P.catalogo({ plataforma: "linux" }).every((p) => p.f));
  assert.ok(P.catalogo({ plataforma: "darwin" }).every((p) => p.b));
  assert.ok(!P.catalogo({ plataforma: "linux" }).some((p) => p.id === "vcredist"));
});

test("programas da assistência: programas.json com instalador offline e winget", () => {
  const pasta = pastaTemp("gsti-programas-");
  try {
    fs.mkdirSync(path.join(pasta, "programas"));
    fs.writeFileSync(path.join(pasta, "programas", "programas.json"), JSON.stringify([
      { nome: "Banco X", categoria: "utilitarios", padrao: true, windows: { instalador: "..\\..\\banco-x.exe", argumentos: ["/S", 1] } },
      { nome: "Via winget", categoria: "inexistente", windows: { winget: "Fornecedor.Programa" }, linux: { flatpak: "org.x.Y" } },
      { nome: "Só macOS", macos: { brew: "algo" } },
    ]));
    const win = P.lerPersonalizados(pasta, "win32");
    assert.equal(win.length, 2);
    assert.equal(win[0].instalador, path.join(pasta, "programas", "banco-x.exe"), "instalador fica preso na pasta programas");
    assert.deepEqual(win[0].argumentos, ["/S", "1"]);
    assert.equal(win[1].categoria, "utilitarios");
    assert.equal(P.lerPersonalizados(pasta, "linux").length, 1);
    const tela = P.paraTela(P.catalogo({ plataforma: "win32", pastaBase: pasta }));
    const banco = tela.find((p) => p.nome === "Banco X");
    assert.equal(banco.local, true);
    assert.equal(banco.instalador, undefined, "caminho do instalador não vai para a tela");
    assert.deepEqual(P.lerPersonalizados(path.join(pasta, "nada"), "win32"), []);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

test("winget: códigos com e sem sinal", () => {
  assert.equal(P.interpretarWinget(0).status, "ok");
  assert.equal(P.interpretarWinget(3010).reinicio, true);
  assert.match(P.interpretarWinget(-1978335135).detalhe, /Já estava/);
  assert.match(P.interpretarWinget(0x8a150061).detalhe, /Já estava/);
  assert.equal(P.interpretarWinget(-1978335212).status, "erro");
  assert.match(P.interpretarWinget(1).detalhe, /0x1/);
});

test("instalar (Windows): winget com msstore, instalador offline e winget ausente", async () => {
  const pasta = pastaTemp("gsti-inst-");
  try {
    fs.mkdirSync(path.join(pasta, "programas"));
    fs.writeFileSync(path.join(pasta, "programas", "banco.exe"), "MZ");
    fs.writeFileSync(path.join(pasta, "programas", "programas.json"), JSON.stringify([{ nome: "Banco", windows: { instalador: "banco.exe", argumentos: ["/S"] } }]));
    const chamadas = [];
    const executor = async (cmd, args) => {
      chamadas.push([cmd, ...args]);
      if (cmd === "winget" && args[0] === "--version") return { codigo: 0, saida: "v1.9" };
      if (cmd === "winget" && args.includes("Google.Chrome")) return { codigo: -1978335135, saida: "" };
      return { codigo: 0, saida: "" };
    };
    const eventos = [];
    const r = await P.instalar(["chrome", "whatsapp", "assistencia:0"], { plataforma: "win32", pastaBase: pasta, executor, aoProgredir: (e) => eventos.push(e) });
    assert.deepEqual(r.acoes.map((a) => [a.id, a.status]), [["programa:assistencia:0", "ok"], ["programa:chrome", "ok"], ["programa:whatsapp", "ok"]]);
    assert.ok(r.acoes.every((a) => a.categoria === "programas"));
    assert.match(r.acoes[1].detalhe, /Já estava/);
    const whatsapp = chamadas.find((c) => c.includes("9NKSQGP7F2NH"));
    assert.deepEqual(whatsapp.slice(-2), ["--source", "msstore"]);
    assert.ok(chamadas.some((c) => c[0] === path.join(pasta, "programas", "banco.exe") && c[1] === "/S"));
    assert.equal(eventos.filter((e) => e.fase === "fim").length, 3);

    const semWinget = await P.instalar(["chrome"], { plataforma: "win32", executor: async () => ({ codigo: -1, saida: "", ausente: true }) });
    assert.equal(semWinget.acoes[0].status, "erro");
    assert.match(semWinget.acoes[0].detalhe, /winget indisponível/);
    await assert.rejects(P.instalar(["nao-existe"], { plataforma: "win32", executor }), /ao menos um/);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

test("instalar (Linux): Flathub do usuário e pula os já instalados", async () => {
  const chamadas = [];
  const executor = async (cmd, args) => {
    chamadas.push([cmd, ...args]);
    if (args[0] === "list") return { codigo: 0, saida: "org.mozilla.firefox\norg.videolan.VLC\n" };
    return { codigo: 0, saida: "" };
  };
  const r = await P.instalar(["firefox", "libreoffice"], { plataforma: "linux", executor });
  assert.deepEqual(r.acoes.map((a) => a.detalhe), ["Já estava instalado.", "Instalado (Flathub)."]);
  assert.ok(chamadas.some((c) => c.join(" ") === "flatpak install --user -y --noninteractive flathub org.libreoffice.LibreOffice"));
});

// ---------------------------------------------------------------------------
// Laudo
// ---------------------------------------------------------------------------
test("laudo: seção de drivers, alertas, comparativo e serviços de drivers/programas", () => {
  const drivers = (semDriver, antigos) => ({
    total: 5, antigos, comErro: [],
    semDriver: Array.from({ length: semDriver }, (_x, i) => ({ nome: `Dispositivo ${i}`, classe: "", hardwareId: `PCI\\${i}` })),
    lista: [{ nome: "Vídeo <antigo>", classe: "Display", provedor: "Intel", versao: "27.0", data: "2019-01-01" }],
  });
  const secoes = { equipamento: { computador: "PC", numeroSerie: "ABC" }, sistema: {}, processador: [], memoria: {}, discos: [], rede: [] };
  const entrada = montarLaudoDeSecoes({ ...secoes, drivers: drivers(2, 4) }, { momento: "entrada" });
  assert.equal(validarLaudo(entrada).valido, true);
  assert.ok(entrada.alertas.some((a) => a.area === "Drivers" && /2 dispositivo\(s\) sem driver/.test(a.titulo)));
  assert.ok(entrada.alertas.some((a) => a.area === "Drivers" && /4 de 5/.test(a.titulo)));

  const servicos = {
    executadoEm: new Date().toISOString(), plataforma: "win32", autorizadoPor: "Cliente", tecnico: "Téc", liberadoTotalBytes: 0, requerReinicio: true,
    acoes: [
      { id: "windows-update", nome: "Drivers pelo Windows Update", categoria: "drivers", status: "ok", detalhe: "3 de 3", liberadoBytes: 0 },
      { id: "programa:chrome", nome: "Google Chrome", categoria: "programas", status: "erro", detalhe: "winget", liberadoBytes: 0 },
    ],
  };
  const saida = montarLaudoDeSecoes({ ...secoes, drivers: drivers(0, 1) }, { momento: "saida", servicos });
  const html = laudoHtml(saida);
  assert.match(html, /<h2>Drivers<\/h2>/);
  assert.match(html, /Vídeo &lt;antigo&gt;/);
  assert.match(html, /Drivers:<\/small> Drivers pelo Windows Update/);
  assert.match(html, /Programa:<\/small> Google Chrome/);
  const linhas = comparar(entrada, saida).linhas.filter((l) => l.grupo === "Drivers");
  assert.equal(linhas.length, 2);
  assert.ok(linhas.every((l) => l.efeito === "melhorou"));
});
