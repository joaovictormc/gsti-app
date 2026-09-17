// Coleta no Linux (somente leitura): /proc, /sys, lscpu, lsblk, df, lspci e, se disponível
// e com root, smartctl (saúde dos discos) e dmidecode (módulos de memória).
// ler*() executa os comandos; secoesLinux() interpreta as saídas (testável com amostras).
const fs = require("fs");
const { execFile } = require("child_process");
const { gb, pct, num, texto } = require("./laudo");

const rodar = (cmd, args, timeout = 20000) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 10 * 1024 * 1024, encoding: "utf8" }, (erro, stdout) => {
      // smartctl devolve código != 0 com alertas mas imprime o JSON
      resolve(stdout || (erro ? null : ""));
    });
  });
const lerArquivo = (p) => {
  try {
    return fs.readFileSync(p, "utf8").trim();
  } catch {
    return null;
  }
};
const listar = (p) => {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
};
const json = (t) => {
  try {
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
};

async function lerEntradas() {
  const root = typeof process.getuid === "function" && process.getuid() === 0;
  const dmi = {};
  for (const campo of ["sys_vendor", "product_name", "product_serial", "board_vendor", "board_name", "bios_vendor", "bios_version", "chassis_type"]) {
    dmi[campo] = lerArquivo(`/sys/class/dmi/id/${campo}`);
  }
  const lsblk = await rodar("lsblk", ["-J", "-b", "-d", "-o", "NAME,MODEL,SIZE,ROTA,TRAN,SERIAL,TYPE"]);
  const discos = (json(lsblk)?.blockdevices || []).filter((d) => d.type === "disk" && !/^(loop|zram|ram)/.test(d.name));
  const smartctlInstalado = (await rodar("smartctl", ["--version"])) != null;
  const smart = {};
  if (smartctlInstalado) {
    for (const d of discos) smart[d.name] = await rodar("smartctl", ["-j", "-a", `/dev/${d.name}`]);
  }
  const baterias = listar("/sys/class/power_supply").filter((n) => /^BAT/i.test(n)).map((n) => {
    const b = { nome: n };
    for (const c of ["energy_full_design", "energy_full", "charge_full_design", "charge_full", "cycle_count", "manufacturer", "technology", "capacity"]) {
      b[c] = lerArquivo(`/sys/class/power_supply/${n}/${c}`);
    }
    return b;
  });
  const temperaturas = [
    ...listar("/sys/class/thermal").filter((n) => n.startsWith("thermal_zone")).map((n) => ({
      nome: lerArquivo(`/sys/class/thermal/${n}/type`), mili: lerArquivo(`/sys/class/thermal/${n}/temp`),
    })),
    ...listar("/sys/class/hwmon").flatMap((h) => {
      const nome = lerArquivo(`/sys/class/hwmon/${h}/name`);
      return listar(`/sys/class/hwmon/${h}`).filter((f) => /^temp\d+_input$/.test(f)).slice(0, 2).map((f) => ({
        nome: `${nome} ${lerArquivo(`/sys/class/hwmon/${h}/${f.replace("_input", "_label")}`) || ""}`.trim(), mili: lerArquivo(`/sys/class/hwmon/${h}/${f}`),
      }));
    }),
  ];
  const redes = listar("/sys/class/net").filter((n) => n !== "lo" && fs.existsSync(`/sys/class/net/${n}/device`)).map((n) => ({
    nome: n, estado: lerArquivo(`/sys/class/net/${n}/operstate`), velocidade: lerArquivo(`/sys/class/net/${n}/speed`), sem_fio: fs.existsSync(`/sys/class/net/${n}/wireless`),
  }));
  return {
    root,
    computador: require("os").hostname(),
    dmi,
    lscpu: await rodar("lscpu", ["-J"]),
    meminfo: lerArquivo("/proc/meminfo"),
    dmidecodeMemoria: root ? await rodar("dmidecode", ["-t", "memory"]) : null,
    osRelease: lerArquivo("/etc/os-release"),
    kernel: lerArquivo("/proc/sys/kernel/osrelease"),
    arquitetura: process.arch,
    uptime: lerArquivo("/proc/uptime"),
    lspci: await rodar("lspci", ["-mm"]),
    lsblk,
    smart,
    smartctlInstalado,
    df: await rodar("df", ["-B1", "--output=target,fstype,size,avail", "-x", "tmpfs", "-x", "devtmpfs", "-x", "squashfs", "-x", "overlay", "-x", "efivarfs"]),
    baterias,
    temperaturas,
    redes,
    journal: await rodar("journalctl", ["-p", "3", "-b", "--no-pager", "-o", "json", "-n", "30"]),
  };
}

// Módulos de memória do dmidecode ("Memory Device" com tamanho)
function modulosDmidecode(textoDmi) {
  if (!textoDmi) return [];
  return textoDmi.split(/\n\s*\n/).filter((b) => /Memory Device/.test(b) && /Size:\s*\d/.test(b)).map((b) => {
    const campo = (nome) => (b.match(new RegExp(`^\\s*${nome}:\\s*(.+)$`, "m")) || [])[1]?.trim() || "";
    const [valor, unidade] = campo("Size").split(/\s+/);
    const capacidadeGB = /GB/i.test(unidade) ? Number(valor) : /MB/i.test(unidade) ? Math.round((Number(valor) / 1024) * 10) / 10 : null;
    return {
      capacidadeGB, tipo: campo("Type") || null, velocidadeMHz: num(campo("Configured Memory Speed").split(" ")[0]) || num(campo("Speed").split(" ")[0]),
      fabricante: campo("Manufacturer"), modelo: campo("Part Number"), slot: campo("Locator"),
    };
  });
}

function saudeSmart(s) {
  if (!s) return { saude: "" };
  const ata = new Map((s.ata_smart_attributes?.table || []).map((a) => [a.id, a.raw?.value]));
  const nvme = s.nvme_smart_health_information_log || {};
  const realocados = (ata.get(5) || 0) + (ata.get(197) || 0);
  const naoCorrigidos = (ata.get(198) || 0) + (nvme.media_errors || 0);
  let saude = s.smart_status ? (s.smart_status.passed ? "Healthy" : "Unhealthy") : "";
  if (saude === "Healthy" && realocados > 0) saude = "Warning";
  return {
    saude,
    temperatura: num(s.temperature?.current) || null,
    horasLigado: num(s.power_on_time?.hours),
    desgastePct: nvme.percentage_used != null ? num(nvme.percentage_used) : null,
    errosNaoCorrigidos: naoCorrigidos,
    setoresRealocados: realocados,
  };
}

function secoesLinux(e) {
  const d = e.dmi || {};
  const valorLscpu = (campo) => (json(e.lscpu)?.lscpu || []).find((x) => x.field.replace(/:$/, "") === campo)?.data;
  const meminfo = Object.fromEntries(String(e.meminfo || "").split("\n").map((l) => l.split(":")).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), num(v.trim().split(" ")[0])]));
  const totalKB = meminfo.MemTotal;
  const disponivelKB = meminfo.MemAvailable;
  const osRel = Object.fromEntries(String(e.osRelease || "").split("\n").map((l) => l.match(/^(\w+)=\"?(.*?)\"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  const uptimeS = num(String(e.uptime || "").split(" ")[0]);
  const sockets = num(valorLscpu("Socket(s)")) || 1;

  const bateria = (e.baterias || []).map((b) => {
    const projeto = num(b.energy_full_design) || num(b.charge_full_design);
    const atual = num(b.energy_full) || num(b.charge_full);
    if (!projeto) return null;
    // /sys informa µWh (energy) ou µAh (charge); a razão é o que importa
    return {
      fabricante: texto(b.manufacturer), quimica: texto(b.technology),
      capacidadeProjetoMWh: b.energy_full_design ? Math.round(projeto / 1000) : null,
      capacidadeAtualMWh: b.energy_full ? Math.round(atual / 1000) : null,
      saudePct: pct(atual, projeto), ciclos: num(b.cycle_count) || null, cargaPct: num(b.capacity),
    };
  }).find(Boolean) || null;

  const graficos = String(e.lspci || "").split("\n").filter((l) => /"(VGA compatible controller|3D controller|Display controller)"/.test(l)).map((l) => {
    const partes = [...l.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    return { nome: `${partes[1] || ""} ${partes[2] || ""}`.trim(), memoriaGB: null, driver: "", resolucao: "" };
  });

  const smart = e.smart || {};
  const discos = (json(e.lsblk)?.blockdevices || []).filter((x) => x.type === "disk" && !/^(loop|zram|ram)/.test(x.name)).map((x) => {
    const s = saudeSmart(json(smart[x.name]));
    const tipo = /^nvme/.test(x.name) || x.tran === "nvme" ? "SSD" : String(x.rota) === "1" || x.rota === true ? "HDD" : "SSD";
    return {
      modelo: texto(x.model) || x.name, tipo, barramento: texto(x.tran).toUpperCase(), tamanhoGB: gb(x.size), numeroSerie: texto(x.serial),
      saude: s.saude, temperatura: s.temperatura || null, temperaturaMax: null, desgastePct: s.desgastePct ?? null, horasLigado: s.horasLigado ?? null,
      errosLeitura: null, errosEscrita: null, errosNaoCorrigidos: smart[x.name] ? s.errosNaoCorrigidos : null,
    };
  });

  const volumes = String(e.df || "").split("\n").slice(1).map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 4 && p[0].startsWith("/") && !/^\/(snap|boot\/efi|run|dev|sys|proc)/.test(p[0])).map(([alvo, fs2, tamanho, livre]) => ({
    letra: alvo, rotulo: "", sistemaArquivos: fs2, tamanhoGB: gb(tamanho), livreGB: gb(livre), livrePct: pct(num(livre), num(tamanho)), saude: "", bitlocker: null,
  }));

  const temperaturas = (e.temperaturas || []).map((t) => ({ nome: texto(t.nome) || "sensor", celsius: Math.round((num(t.mili) / 1000) * 10) / 10 }))
    .filter((t) => t.celsius > 0 && t.celsius < 150);

  const erros = String(e.journal || "").split("\n").map(json).filter(Boolean).slice(0, 15).map((j) => ({
    data: j.__REALTIME_TIMESTAMP ? new Date(Number(j.__REALTIME_TIMESTAMP) / 1000).toISOString() : null,
    origem: texto(j.SYSLOG_IDENTIFIER || j._COMM), id: null, mensagem: texto(Array.isArray(j.MESSAGE) ? "" : j.MESSAGE).slice(0, 240),
  }));

  const limitacoes = [];
  if (!e.root) limitacoes.push("Coleta sem root (sudo): saúde SMART dos discos, número de série e módulos de memória podem não aparecer.");
  if (!e.smartctlInstalado) limitacoes.push("smartmontools não instalado: a saúde SMART dos discos não foi lida (sudo apt install smartmontools).");

  const chassi = num(d.chassis_type);
  return {
    plataforma: "linux",
    administrador: !!e.root,
    equipamento: {
      computador: texto(e.computador), fabricante: texto(d.sys_vendor), modelo: texto(d.product_name),
      tipo: [8, 9, 10, 14, 31, 32].includes(chassi) ? "Notebook" : "Desktop", numeroSerie: texto(d.product_serial),
      placaMae: [texto(d.board_vendor), texto(d.board_name)].filter(Boolean).join(" "), bios: [texto(d.bios_vendor), texto(d.bios_version)].filter(Boolean).join(" "),
    },
    sistema: {
      nome: osRel.PRETTY_NAME || "Linux", versao: `kernel ${texto(e.kernel)}`.trim(), build: osRel.VERSION_ID || "", arquitetura: texto(e.arquitetura),
      instaladoEm: null, ligadoDesde: uptimeS ? new Date(Date.now() - uptimeS * 1000).toISOString() : null,
    },
    processador: [{
      nome: texto(valorLscpu("Model name")), nucleos: (num(valorLscpu("Core(s) per socket")) || 0) * sockets || null,
      threads: num(valorLscpu("CPU(s)")), frequenciaMHz: Math.round(num(valorLscpu("CPU max MHz")) || 0) || null,
    }],
    memoria: {
      totalGB: totalKB ? Math.round((totalKB / 1048576) * 10) / 10 : null,
      emUsoPct: totalKB && disponivelKB != null ? pct(totalKB - disponivelKB, totalKB) : null,
      slots: null, modulos: modulosDmidecode(e.dmidecodeMemoria),
    },
    graficos, discos, volumes, bateria, temperaturas,
    rede: (e.redes || []).map((r) => ({ nome: r.nome, descricao: r.sem_fio ? "Wi-Fi" : "Cabeada", conectado: r.estado === "up", velocidade: num(r.velocidade) > 0 ? `${r.velocidade} Mbps` : "" })),
    eventos: { desligamentosInesperados30d: 0, errosRecentes: erros },
    limitacoes,
  };
}

async function coletarLinux() {
  return secoesLinux(await lerEntradas());
}

module.exports = { coletarLinux, secoesLinux, lerEntradas, modulosDmidecode, saudeSmart };
