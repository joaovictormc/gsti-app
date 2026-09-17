// Diagnóstico no Linux e no macOS: interpretação das saídas dos comandos (amostras no
// formato real de lscpu/lsblk/smartctl/df e system_profiler) e laudo gerado a partir delas.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const { montarLaudoDeSecoes, validarLaudo, comparar } = require(path.join(RAIZ, "diagnostico", "laudo.js"));
const { secoesLinux, modulosDmidecode, saudeSmart } = require(path.join(RAIZ, "diagnostico", "coleta-linux.js"));
const { secoesMacOS, tamanhoGB } = require(path.join(RAIZ, "diagnostico", "coleta-macos.js"));
const { laudoHtml } = require(path.join(RAIZ, "diagnostico", "laudo-html.js"));

const linux = {
  root: true,
  computador: "notebook-cliente",
  arquitetura: "x64",
  dmi: { sys_vendor: "LENOVO", product_name: "20L7S0JX00", product_serial: "PF1ABCDE", board_vendor: "LENOVO", board_name: "20L7S0JX00", bios_vendor: "LENOVO", bios_version: "N22ET80W (1.57 )", chassis_type: "10" },
  lscpu: JSON.stringify({ lscpu: [
    { field: "Architecture:", data: "x86_64" }, { field: "CPU(s):", data: "8" }, { field: "Model name:", data: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz" },
    { field: "Core(s) per socket:", data: "4" }, { field: "Socket(s):", data: "1" }, { field: "CPU max MHz:", data: "3400.0000" },
  ] }),
  meminfo: "MemTotal:       16230496 kB\nMemFree:         9512344 kB\nMemAvailable:   12172872 kB\nBuffers:          120232 kB",
  dmidecodeMemoria: "Handle 0x0003, DMI type 17, 40 bytes\nMemory Device\n\tSize: 8 GB\n\tLocator: ChannelA-DIMM0\n\tType: DDR4\n\tSpeed: 2400 MT/s\n\tManufacturer: Samsung\n\tPart Number: M471A1K43CB1-CRC\n\tConfigured Memory Speed: 2400 MT/s\n\nHandle 0x0004, DMI type 17, 40 bytes\nMemory Device\n\tSize: No Module Installed\n\tLocator: ChannelB-DIMM0\n",
  osRelease: 'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"',
  kernel: "6.8.0-45-generic",
  uptime: "3600.52 14000.10",
  lspci: '00:02.0 "VGA compatible controller" "Intel Corporation" "UHD Graphics 620" -r07 "Lenovo" "Device 225d"\n00:1f.3 "Audio device" "Intel Corporation" "Sunrise Point-LP HD Audio"',
  lsblk: JSON.stringify({ blockdevices: [
    { name: "loop0", model: null, size: 4096, rota: false, tran: null, serial: null, type: "loop" },
    { name: "sda", model: "ST1000LM035-1RK172", size: 1000204886016, rota: true, tran: "sata", serial: "WL1ABCD", type: "disk" },
    { name: "nvme0n1", model: "KXG50ZNV256G TOSHIBA", size: 256060514304, rota: false, tran: "nvme", serial: "38PS1ABC", type: "disk" },
  ] }),
  smartctlInstalado: true,
  smart: {
    sda: JSON.stringify({ smart_status: { passed: true }, temperature: { current: 41 }, power_on_time: { hours: 21450 }, ata_smart_attributes: { table: [{ id: 5, raw: { value: 24 } }, { id: 197, raw: { value: 0 } }, { id: 198, raw: { value: 2 } }] } }),
    nvme0n1: JSON.stringify({ smart_status: { passed: true }, temperature: { current: 38 }, power_on_time: { hours: 9120 }, nvme_smart_health_information_log: { percentage_used: 93, media_errors: 0 } }),
  },
  df: "Mounted on                  Type        1B-blocks          Avail\n/                            ext4     250375106560   11400000000\n/boot/efi                    vfat        535805952      529000000\n/media/dados                 ext4    983349346304   600000000000",
  baterias: [{ nome: "BAT0", energy_full_design: "57020000", energy_full: "25100000", cycle_count: "612", manufacturer: "SMP", technology: "Li-poly", capacity: "88" }],
  temperaturas: [{ nome: "x86_pkg_temp", mili: "86000" }, { nome: "acpitz", mili: "0" }],
  redes: [{ nome: "wlp3s0", estado: "up", velocidade: null, sem_fio: true }, { nome: "enp0s31f6", estado: "down", velocidade: "-1", sem_fio: false }],
  journal: `${JSON.stringify({ __REALTIME_TIMESTAMP: "1726570000000000", SYSLOG_IDENTIFIER: "kernel", MESSAGE: "ACPI Error: AE_NOT_FOUND" })}\n`,
};

test("Linux: seções a partir de lscpu, meminfo, dmidecode, lsblk, smartctl, df e /sys", () => {
  const s = secoesLinux(linux);
  assert.equal(s.plataforma, "linux");
  assert.equal(s.equipamento.tipo, "Notebook");
  assert.equal(s.equipamento.fabricante, "LENOVO");
  assert.equal(s.sistema.nome, "Ubuntu 24.04.1 LTS");
  assert.deepEqual(s.processador[0], { nome: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz", nucleos: 4, threads: 8, frequenciaMHz: 3400 });
  assert.equal(s.memoria.totalGB, 15.5);
  assert.equal(s.memoria.emUsoPct, 25);
  assert.deepEqual(s.memoria.modulos.map((m) => [m.capacidadeGB, m.tipo, m.velocidadeMHz, m.slot]), [[8, "DDR4", 2400, "ChannelA-DIMM0"]]);
  assert.deepEqual(s.discos.map((d) => [d.modelo, d.tipo, d.barramento, d.saude]), [["ST1000LM035-1RK172", "HDD", "SATA", "Warning"], ["KXG50ZNV256G TOSHIBA", "SSD", "NVME", "Healthy"]]);
  assert.equal(s.discos[0].errosNaoCorrigidos, 2);
  assert.equal(s.discos[1].desgastePct, 93);
  assert.deepEqual(s.volumes.map((v) => v.letra), ["/", "/media/dados"], "ignora /boot/efi");
  assert.equal(s.bateria.saudePct, 44);
  assert.equal(s.bateria.ciclos, 612);
  assert.deepEqual(s.temperaturas, [{ nome: "x86_pkg_temp", celsius: 86 }]);
  assert.deepEqual(s.rede.map((r) => [r.nome, r.conectado]), [["wlp3s0", true], ["enp0s31f6", false]]);
  assert.equal(s.eventos.errosRecentes[0].origem, "kernel");
  assert.deepEqual(s.limitacoes, []);

  const l = montarLaudoDeSecoes(s, { momento: "entrada" });
  assert.deepEqual(validarLaudo(JSON.parse(JSON.stringify(l))), { valido: true });
  const titulos = l.alertas.map((a) => `${a.nivel}:${a.titulo}`).join(" | ");
  assert.match(titulos, /critico:ST1000LM035.*saúde "Warning"/);
  assert.match(titulos, /critico:ST1000LM035.*2 erro/);
  assert.match(titulos, /critico:KXG50ZNV256G.*desgaste de 93%/);
  assert.match(titulos, /critico:Volume \/ com 10\.6 GB livres/);
  assert.match(titulos, /critico:Bateria com 44%/);
  assert.match(titulos, /atencao:x86_pkg_temp: 86 °C/);
  assert.match(titulos, /info:ST1000LM035.*HD mecânico/);
  assert.doesNotMatch(titulos, /antivírus|Windows/, "sem alertas específicos do Windows");
  assert.match(laudoHtml(l), /Ubuntu 24\.04\.1 LTS/);
});

test("Linux sem root e sem smartmontools registra as limitações", () => {
  const s = secoesLinux({ ...linux, root: false, smartctlInstalado: false, smart: {}, dmidecodeMemoria: null });
  assert.equal(s.discos[0].saude, "");
  assert.equal(s.discos[0].errosNaoCorrigidos, null);
  assert.equal(s.memoria.modulos.length, 0);
  assert.equal(s.limitacoes.length, 2);
  const l = montarLaudoDeSecoes(s);
  assert.ok(l.alertas.some((a) => a.titulo === "Coleta sem administrador"));
  assert.ok(l.alertas.some((a) => a.titulo === "Coleta parcial" && /smartmontools/.test(a.detalhe)));
});

test("smartctl e dmidecode: casos de borda", () => {
  assert.deepEqual(saudeSmart(null), { saude: "" });
  assert.equal(saudeSmart({ smart_status: { passed: false } }).saude, "Unhealthy");
  assert.deepEqual(modulosDmidecode("Memory Device\n\tSize: 4096 MB\n\tLocator: DIMM1\n\tType: DDR3").map((m) => m.capacidadeGB), [4]);
});

const macIntel = {
  root: false,
  computador: "MacBook-da-Ana",
  arquitetura: "x64",
  totalmem: 17179869184,
  perfil: JSON.stringify({
    SPHardwareDataType: [{ machine_name: "MacBook Pro", machine_model: "MacBookPro14,1", cpu_type: "Dual-Core Intel Core i5", current_processor_speed: "2,3 GHz", number_processors: 2, physical_memory: "8 GB", serial_number: "C02VX0ABCD12", boot_rom_version: "529.0.0.0.0" }],
    SPMemoryDataType: [{ _name: "Memory Slots", _items: [{ _name: "BANK 0/DIMM0", dimm_size: "4 GB", dimm_speed: "2133 MHz", dimm_type: "LPDDR3", dimm_manufacturer: "0x80CE", dimm_part_number: "K4E6E304EB-EGCF" }, { _name: "BANK 1/DIMM0", dimm_size: "4 GB", dimm_speed: "2133 MHz", dimm_type: "LPDDR3", dimm_manufacturer: "0x80CE", dimm_part_number: "K4E6E304EB-EGCF" }] }],
    SPStorageDataType: [
      { _name: "Macintosh HD - Data", mount_point: "/System/Volumes/Data", file_system: "APFS", free_space_in_bytes: 5000000000, size_in_bytes: 250685575168, physical_drive: { device_name: "APPLE SSD AP0256J", is_internal_disk: "yes", medium_type: "ssd", protocol: "PCI-Express", smart_status: "Verified" } },
      { _name: "Macintosh HD", mount_point: "/", file_system: "APFS", free_space_in_bytes: 5000000000, size_in_bytes: 250685575168, physical_drive: { device_name: "APPLE SSD AP0256J", is_internal_disk: "yes", medium_type: "ssd", protocol: "PCI-Express", smart_status: "Verified" } },
      { _name: "Backup", mount_point: "/Volumes/Backup", file_system: "HFS+", free_space_in_bytes: 400000000000, size_in_bytes: 1000000000000, physical_drive: { device_name: "WD Elements", is_internal_disk: "no", medium_type: "rotational", protocol: "USB", smart_status: "Failing" } },
    ],
    SPDisplaysDataType: [{ sppci_model: "Intel Iris Plus Graphics 640", spdisplays_vram_shared: "1536 MB", spdisplays_ndrvs: [{ _spdisplays_resolution: "2560 x 1600 Retina" }] }],
    SPPowerDataType: [{ sppower_battery_charge_info: { sppower_battery_state_of_charge: 76 }, sppower_battery_health_info: { sppower_battery_cycle_count: 1043, sppower_battery_health: "Service Recommended", sppower_battery_health_maximum_capacity: "61%" } }],
  }),
  produto: "macOS\n",
  versao: "13.6.9\n",
  build: "22G830\n",
  boottime: "{ sec = 1726560000, usec = 0 } Tue Sep 17 08:00:00 2024",
  memoriaLivrePct: "System-wide memory free percentage: 38%",
  portas: "Hardware Port: Wi-Fi\nDevice: en0\nEthernet Address: 00:00:00:00:00:01\n\nHardware Port: Thunderbolt Bridge\nDevice: bridge0\nEthernet Address: N/A",
  interfaces: { en0: [{ family: "IPv4", internal: false, address: "192.168.0.20" }] },
  panicos: 4,
};

test("macOS (Intel): system_profiler, sw_vers e pânicos do kernel", () => {
  const s = secoesMacOS(macIntel);
  assert.equal(s.plataforma, "macos");
  assert.equal(s.equipamento.modelo, "MacBook Pro MacBookPro14,1");
  assert.equal(s.equipamento.tipo, "Notebook");
  assert.equal(s.sistema.nome, "macOS 13.6.9");
  assert.equal(s.sistema.build, "22G830");
  assert.equal(s.processador[0].nome, "Dual-Core Intel Core i5 2,3 GHz");
  assert.equal(s.memoria.totalGB, 8);
  assert.equal(s.memoria.emUsoPct, 62);
  assert.equal(s.memoria.modulos.length, 2);
  assert.deepEqual(s.discos.map((d) => [d.modelo, d.tipo, d.saude]), [["APPLE SSD AP0256J", "SSD", "Healthy"], ["WD Elements", "HDD", "Unhealthy"]], "disco interno primeiro");
  assert.deepEqual(s.volumes.map((v) => v.letra), ["/", "/Volumes/Backup"], "ignora volumes internos do sistema");
  assert.equal(s.bateria.saudePct, 61);
  assert.equal(s.bateria.ciclos, 1043);
  assert.deepEqual(s.rede, [{ nome: "Wi-Fi", descricao: "en0", conectado: true, velocidade: "" }]);
  assert.equal(s.eventos.desligamentosInesperados30d, 4);

  const l = montarLaudoDeSecoes(s);
  const titulos = l.alertas.map((a) => `${a.nivel}:${a.titulo}`).join(" | ");
  assert.match(titulos, /critico:WD Elements.*saúde "Unhealthy"/);
  assert.match(titulos, /critico:Volume \/ com 4\.7 GB livres/);
  assert.match(titulos, /atencao:Bateria com 61%/);
  assert.match(titulos, /atencao:Bateria com 1043 ciclos/);
  assert.match(titulos, /atencao:4 desligamentos inesperados/);
  assert.doesNotMatch(titulos, /antivírus/);
  assert.equal(l.situacao, "critico");
});

test("macOS (Apple Silicon): memória integrada e comparação entre visitas", () => {
  const perfil = JSON.parse(macIntel.perfil);
  perfil.SPHardwareDataType = [{ machine_name: "MacBook Air", machine_model: "Mac14,2", chip_type: "Apple M2", number_processors: "proc 8:4:4", physical_memory: "16 GB", serial_number: "H2WXYZ" }];
  perfil.SPMemoryDataType = [{ SPMemoryDataType: "16 GB", dimm_type: "LPDDR5", dimm_manufacturer: "Micron" }];
  const s = secoesMacOS({ ...macIntel, perfil: JSON.stringify(perfil) });
  assert.equal(s.processador[0].nome, "Apple M2");
  assert.equal(s.processador[0].nucleos, 8);
  assert.deepEqual(s.memoria.modulos, [{ capacidadeGB: 16, tipo: "LPDDR5", velocidadeMHz: null, fabricante: "Micron", modelo: "", slot: "Integrada" }]);
  const entrada = montarLaudoDeSecoes(s);
  const saida = montarLaudoDeSecoes(s, { momento: "saida" });
  assert.equal(comparar(entrada, saida).mesmoEquipamento, true);
  assert.equal(tamanhoGB("1,5 TB"), 1536);
});
