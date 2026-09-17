// Coleta no macOS (somente leitura): system_profiler (hardware, memória, armazenamento com
// SMART, vídeo, bateria), sw_vers, kern.boottime e relatórios de pânico do kernel.
// lerEntradas() executa os comandos; secoesMacOS() interpreta (testável com amostras).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { gb, pct, num, texto } = require("./laudo");

const rodar = (cmd, args, timeout = 60000) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout, maxBuffer: 20 * 1024 * 1024, encoding: "utf8" }, (erro, stdout) => resolve(stdout || (erro ? null : "")));
  });
const json = (t) => {
  try {
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
};

// "16 GB" -> 16 ; "512 MB" -> 0.5
function tamanhoGB(t) {
  const m = String(t || "").match(/([\d.,]+)\s*(TB|GB|MB)/i);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return /TB/i.test(m[2]) ? v * 1024 : /MB/i.test(m[2]) ? Math.round((v / 1024) * 10) / 10 : v;
}

async function lerEntradas() {
  const pastaPanicos = "/Library/Logs/DiagnosticReports";
  const limite = Date.now() - 30 * 86400000;
  let panicos = 0;
  try {
    panicos = fs.readdirSync(pastaPanicos).filter((f) => /panic/i.test(f)).filter((f) => fs.statSync(path.join(pastaPanicos, f)).mtimeMs >= limite).length;
  } catch { /* sem permissão ou pasta inexistente */ }
  return {
    root: typeof process.getuid === "function" && process.getuid() === 0,
    computador: os.hostname(),
    perfil: await rodar("system_profiler", ["-json", "-detailLevel", "full", "SPHardwareDataType", "SPMemoryDataType", "SPStorageDataType", "SPDisplaysDataType", "SPPowerDataType"]),
    produto: await rodar("sw_vers", ["-productName"]),
    versao: await rodar("sw_vers", ["-productVersion"]),
    build: await rodar("sw_vers", ["-buildVersion"]),
    boottime: await rodar("sysctl", ["-n", "kern.boottime"]),
    memoriaLivrePct: await rodar("memory_pressure", ["-Q"]),
    portas: await rodar("networksetup", ["-listallhardwareports"]),
    interfaces: os.networkInterfaces(),
    arquitetura: process.arch,
    totalmem: os.totalmem(),
    panicos,
  };
}

function secoesMacOS(e) {
  const p = json(e.perfil) || {};
  const hw = (p.SPHardwareDataType || [])[0] || {};
  const appleSilicon = !!hw.chip_type;

  // Memória: Apple Silicon informa só o total; Intel lista os pentes
  const memItens = (p.SPMemoryDataType || []).flatMap((m) => m._items || []);
  const modulos = memItens.filter((m) => m.dimm_size && !/empty/i.test(m.dimm_size)).map((m) => ({
    capacidadeGB: tamanhoGB(m.dimm_size), tipo: texto(m.dimm_type) || null, velocidadeMHz: num(String(m.dimm_speed || "").split(" ")[0]),
    fabricante: texto(m.dimm_manufacturer), modelo: texto(m.dimm_part_number), slot: texto(m._name),
  }));
  const livre = String(e.memoriaLivrePct || "").match(/free percentage:\s*(\d+)%/i);

  // Armazenamento: um disco físico por nome, volumes montados
  const volumesSP = p.SPStorageDataType || [];
  const fisicos = new Map();
  for (const v of volumesSP) {
    const d = v.physical_drive || {};
    if (!d.device_name || fisicos.has(d.device_name)) continue;
    const smart = texto(d.smart_status);
    fisicos.set(d.device_name, {
      modelo: texto(d.device_name), tipo: /ssd/i.test(d.medium_type) ? "SSD" : /rotational|hdd/i.test(d.medium_type) ? "HDD" : texto(d.medium_type).toUpperCase() || "Desconhecido",
      barramento: texto(d.protocol), tamanhoGB: null, numeroSerie: "",
      saude: /verified/i.test(smart) ? "Healthy" : /fail/i.test(smart) ? "Unhealthy" : "", temperatura: null, temperaturaMax: null,
      desgastePct: null, horasLigado: null, errosLeitura: null, errosEscrita: null, errosNaoCorrigidos: null, interno: d.is_internal_disk === "yes",
    });
  }
  const discos = [...fisicos.values()].sort((a, b) => Number(b.interno) - Number(a.interno)).map(({ interno, ...d }) => d);
  // Volumes relevantes: raiz e volumes de dados (ignora partições do sistema selado)
  const volumes = volumesSP.filter((v) => v.mount_point && (v.mount_point === "/" || v.mount_point.startsWith("/Volumes/")) && num(v.size_in_bytes) > 0).map((v) => ({
    letra: v.mount_point, rotulo: texto(v._name), sistemaArquivos: texto(v.file_system), tamanhoGB: gb(v.size_in_bytes), livreGB: gb(v.free_space_in_bytes),
    livrePct: pct(num(v.free_space_in_bytes), num(v.size_in_bytes)), saude: "", bitlocker: null,
  }));
  if (discos[0] && volumes[0]) discos[0].tamanhoGB = volumes[0].tamanhoGB;

  const energia = (p.SPPowerDataType || []).find((x) => x.sppower_battery_health_info) || null;
  const saudeBat = energia?.sppower_battery_health_info || {};
  const maxCap = num(String(saudeBat.sppower_battery_health_maximum_capacity || "").replace("%", ""));
  const bateria = energia ? {
    fabricante: texto(energia.sppower_battery_model_info?.sppower_battery_manufacturer), quimica: "",
    capacidadeProjetoMWh: null, capacidadeAtualMWh: null, saudePct: maxCap ?? null, ciclos: num(saudeBat.sppower_battery_cycle_count),
    cargaPct: num(energia.sppower_battery_charge_info?.sppower_battery_state_of_charge), condicao: texto(saudeBat.sppower_battery_health),
  } : null;

  const graficos = (p.SPDisplaysDataType || []).map((g) => ({
    nome: texto(g.sppci_model || g._name), memoriaGB: tamanhoGB(g.spdisplays_vram || g.spdisplays_vram_shared), driver: "",
    resolucao: texto((g.spdisplays_ndrvs || [])[0]?._spdisplays_resolution),
  }));

  const bootSeg = num((String(e.boottime || "").match(/sec\s*=\s*(\d+)/) || [])[1]);
  const nucleos = String(hw.number_processors || "").match(/(\d+)/);
  const portas = String(e.portas || "").split(/\n\s*\n/).map((b) => ({ nome: (b.match(/Hardware Port:\s*(.+)/) || [])[1], dispositivo: (b.match(/Device:\s*(.+)/) || [])[1] })).filter((x) => x.nome && x.dispositivo);
  const interfaces = e.interfaces || {};

  const limitacoes = ["No macOS, temperaturas e desgaste do SSD não são lidos sem ferramentas adicionais."];
  return {
    plataforma: "macos",
    administrador: !!e.root,
    equipamento: {
      computador: texto(e.computador), fabricante: "Apple", modelo: [texto(hw.machine_name), texto(hw.machine_model || hw.model_number)].filter(Boolean).join(" "),
      tipo: /book/i.test(hw.machine_name || "") ? "Notebook" : "Desktop", numeroSerie: texto(hw.serial_number),
      placaMae: "", bios: texto(hw.boot_rom_version),
    },
    sistema: {
      nome: `${texto(e.produto) || "macOS"} ${texto(e.versao)}`.trim(), versao: texto(e.versao), build: texto(e.build), arquitetura: texto(e.arquitetura),
      instaladoEm: null, ligadoDesde: bootSeg ? new Date(bootSeg * 1000).toISOString() : null,
    },
    processador: [{
      nome: appleSilicon ? texto(hw.chip_type) : `${texto(hw.cpu_type)} ${texto(hw.current_processor_speed)}`.trim(),
      nucleos: num(hw.number_processors) ?? (nucleos ? num(nucleos[1]) : null), threads: null, frequenciaMHz: null,
    }],
    memoria: {
      totalGB: tamanhoGB(hw.physical_memory) ?? gb(e.totalmem), emUsoPct: livre ? 100 - Number(livre[1]) : null,
      slots: memItens.length || null, modulos: appleSilicon ? [{ capacidadeGB: tamanhoGB(hw.physical_memory), tipo: texto((p.SPMemoryDataType || [])[0]?.dimm_type) || null, velocidadeMHz: null, fabricante: texto((p.SPMemoryDataType || [])[0]?.dimm_manufacturer), modelo: "", slot: "Integrada" }] : modulos,
    },
    graficos, discos, volumes, bateria, temperaturas: [],
    rede: portas.filter((x) => /Wi-Fi|Ethernet|Thunderbolt Ethernet|USB/i.test(x.nome)).map((x) => ({
      nome: x.nome, descricao: x.dispositivo, conectado: (interfaces[x.dispositivo] || []).some((i) => i.family === "IPv4" && !i.internal), velocidade: "",
    })),
    eventos: { desligamentosInesperados30d: num(e.panicos) || 0, errosRecentes: [] },
    limitacoes,
  };
}

async function coletarMacOS() {
  return secoesMacOS(await lerEntradas());
}

module.exports = { coletarMacOS, secoesMacOS, lerEntradas, tamanhoGB };
