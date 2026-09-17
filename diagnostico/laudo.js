// Laudo técnico: formato (gsti-laudo v1), montagem a partir da coleta, alertas,
// comparação antes/depois e integridade. Usado pelo agente de diagnóstico e pelo GSTI App.
//
// Cada coletor (Windows, macOS, Linux) devolve as mesmas SEÇÕES (equipamento, sistema,
// processador, memória, discos...); montarLaudoDeSecoes() completa, gera alertas e sela.
const crypto = require("crypto");

const FORMATO = "gsti-laudo";
const VERSAO = 1;
const NIVEIS = { critico: 3, atencao: 2, info: 1, ok: 0 };

const lista = (v) => (v == null ? [] : Array.isArray(v) ? v.filter((x) => x != null) : [v]);
const gb = (bytes) => (bytes ? Math.round((Number(bytes) / 1073741824) * 10) / 10 : null);
const num = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const texto = (v) => (v == null ? "" : String(v).trim());
const pct = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : null);

const TIPO_MEMORIA = { 20: "DDR", 21: "DDR2", 24: "DDR3", 26: "DDR4", 34: "DDR5" };
const STATUS_ATIVACAO = { 0: "Não licenciado", 1: "Ativado", 2: "Período de carência", 3: "Carência adicional", 4: "Não original", 5: "Notificação", 6: "Carência estendida" };

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------
// Coleta bruta do Windows (coleta-windows.js) -> seções do laudo
function secoesWindows(bruto) {
  const b = bruto || {};
  const sistemaCim = b.sistema || {};
  const osCim = b.os || {};
  const bios = b.bios || {};
  const confiab = new Map(lista(b.confiabilidade).map((c) => [String(c.DeviceId), c]));
  const bitlocker = new Map(lista(b.bitlocker).map((v) => [texto(v.DriveLetter).replace(":", ""), v.ProtectionStatus]));

  const modulos = lista(b.memoria).map((m) => ({
    capacidadeGB: gb(m.Capacity),
    tipo: TIPO_MEMORIA[m.SMBIOSMemoryType] || null,
    velocidadeMHz: num(m.ConfiguredClockSpeed) || num(m.Speed),
    fabricante: texto(m.Manufacturer),
    modelo: texto(m.PartNumber),
    slot: texto(m.DeviceLocator),
  }));
  const totalKB = num(osCim.TotalVisibleMemorySize);
  const livreKB = num(osCim.FreePhysicalMemory);

  const bateriaBruta = lista(b.baterias).find((x) => num(x.DesignCapacity) > 0);
  const carga = lista(b.cargaBateria)[0];
  const bateria = bateriaBruta
    ? {
        fabricante: texto(bateriaBruta.Manufacturer),
        quimica: texto(bateriaBruta.Chemistry),
        capacidadeProjetoMWh: num(bateriaBruta.DesignCapacity),
        capacidadeAtualMWh: num(bateriaBruta.FullChargeCapacity),
        saudePct: pct(num(bateriaBruta.FullChargeCapacity), num(bateriaBruta.DesignCapacity)),
        ciclos: num(bateriaBruta.CycleCount) || null,
        cargaPct: carga ? num(carga.EstimatedChargeRemaining) : null,
      }
    : null;

  const ativacao = lista(b.ativacao)[0];
  return {
    plataforma: "windows",
    administrador: !!b.admin,
    equipamento: {
      computador: texto(b.computador),
      fabricante: texto(sistemaCim.Manufacturer),
      modelo: texto(sistemaCim.Model),
      tipo: Number(sistemaCim.PCSystemType) === 2 ? "Notebook" : "Desktop",
      numeroSerie: texto(bios.SerialNumber),
      placaMae: [texto(b.placa?.Manufacturer), texto(b.placa?.Product)].filter(Boolean).join(" "),
      bios: [texto(bios.Manufacturer), texto(bios.SMBIOSBIOSVersion)].filter(Boolean).join(" "),
    },
    sistema: {
      nome: texto(osCim.Caption),
      versao: texto(osCim.Version),
      build: texto(osCim.BuildNumber),
      arquitetura: texto(osCim.OSArchitecture),
      instaladoEm: osCim.InstallDate || null,
      ligadoDesde: osCim.LastBootUpTime || null,
      ativacao: ativacao ? STATUS_ATIVACAO[ativacao.LicenseStatus] || `Situação ${ativacao.LicenseStatus}` : "Desconhecida",
      ativado: ativacao ? Number(ativacao.LicenseStatus) === 1 : null,
      antivirus: lista(b.antivirus).map((a) => texto(a.displayName)).filter(Boolean),
    },
    processador: lista(b.cpu).map((c) => ({
      nome: texto(c.Name).replace(/\s+/g, " "),
      nucleos: num(c.NumberOfCores),
      threads: num(c.NumberOfLogicalProcessors),
      frequenciaMHz: num(c.MaxClockSpeed),
    })),
    memoria: {
      totalGB: totalKB ? Math.round((totalKB / 1048576) * 10) / 10 : Math.round(modulos.reduce((s, m) => s + (m.capacidadeGB || 0), 0) * 10) / 10,
      emUsoPct: totalKB && livreKB != null ? pct(totalKB - livreKB, totalKB) : null,
      slots: num(b.slotsMemoria),
      modulos,
    },
    graficos: lista(b.gpu).map((g) => ({
      nome: texto(g.Name),
      memoriaGB: gb(g.AdapterRAM),
      driver: texto(g.DriverVersion),
      resolucao: g.CurrentHorizontalResolution ? `${g.CurrentHorizontalResolution}x${g.CurrentVerticalResolution}` : "",
    })),
    discos: lista(b.discos).map((d) => {
      const c = confiab.get(String(d.DeviceId)) || {};
      return {
        modelo: texto(d.FriendlyName),
        tipo: texto(d.MediaType) || "Desconhecido",
        barramento: texto(d.BusType),
        tamanhoGB: gb(d.Size),
        saude: texto(d.HealthStatus),
        numeroSerie: texto(d.SerialNumber),
        temperatura: num(c.Temperature) || null,
        temperaturaMax: num(c.TemperatureMax) || null,
        desgastePct: num(c.Wear),
        horasLigado: num(c.PowerOnHours),
        errosLeitura: num(c.ReadErrorsTotal),
        errosEscrita: num(c.WriteErrorsTotal),
        errosNaoCorrigidos: (num(c.ReadErrorsUncorrected) || 0) + (num(c.WriteErrorsUncorrected) || 0) || (c.DeviceId ? 0 : null),
      };
    }),
    volumes: lista(b.volumes).map((v) => ({
      letra: texto(v.DriveLetter),
      rotulo: texto(v.FileSystemLabel),
      sistemaArquivos: texto(v.FileSystem),
      tamanhoGB: gb(v.Size),
      livreGB: gb(v.SizeRemaining),
      livrePct: pct(num(v.SizeRemaining), num(v.Size)),
      saude: texto(v.HealthStatus),
      bitlocker: bitlocker.has(texto(v.DriveLetter)) ? Number(bitlocker.get(texto(v.DriveLetter))) === 1 : null,
    })),
    bateria,
    temperaturas: lista(b.temperaturas)
      .map((t) => ({ nome: texto(t.InstanceName).split("\\").pop(), celsius: Math.round((num(t.CurrentTemperature) / 10 - 273.15) * 10) / 10 }))
      .filter((t) => t.celsius > 0 && t.celsius < 150),
    rede: lista(b.rede).map((r) => ({ nome: texto(r.Name), descricao: texto(r.InterfaceDescription), conectado: texto(r.Status) === "Up", velocidade: texto(r.LinkSpeed) })),
    eventos: {
      desligamentosInesperados30d: num(b.desligamentosInesperados) || 0,
      errosRecentes: lista(b.ultimasFalhas).slice(0, 15).map((e) => ({ data: e.Data, origem: texto(e.ProviderName), id: num(e.Id), mensagem: texto(e.Mensagem).slice(0, 240) })),
    },
    limitacoes: b.admin ? [] : ["Coleta sem permissão de administrador: saúde SMART dos discos (desgaste, horas ligado, erros) e temperaturas podem não aparecer."],
  };
}

const PLATAFORMAS = { windows: "Windows", macos: "macOS", linux: "Linux" };

// Seções de qualquer plataforma -> laudo selado (com alertas e situação)
function montarLaudoDeSecoes(secoes, { testes = null, momento = "entrada", os = null, tecnico = "", observacao = "", agente = "", servicos = null } = {}) {
  const s = secoes || {};
  const laudo = {
    formato: FORMATO,
    versao: VERSAO,
    id: crypto.randomUUID(),
    geradoEm: new Date().toISOString(),
    momento: momento === "saida" ? "saida" : "entrada",
    agente: texto(agente),
    tecnico: texto(tecnico),
    os: os == null || os === "" ? null : String(os),
    observacao: texto(observacao),
    plataforma: PLATAFORMAS[s.plataforma] ? s.plataforma : "windows",
    administrador: !!s.administrador,
    equipamento: s.equipamento || {},
    sistema: { ativacao: "Não se aplica", ativado: null, antivirus: [], ...(s.sistema || {}) },
    processador: s.processador || [],
    memoria: { totalGB: null, emUsoPct: null, slots: null, modulos: [], ...(s.memoria || {}) },
    graficos: s.graficos || [],
    discos: s.discos || [],
    volumes: s.volumes || [],
    bateria: s.bateria || null,
    temperaturas: s.temperaturas || [],
    rede: s.rede || [],
    eventos: { desligamentosInesperados30d: 0, errosRecentes: [], ...(s.eventos || {}) },
    testes: testes || null,
    // Otimizações executadas pelo agente nesta visita (registradas no laudo de saída)
    servicos: servicos && Array.isArray(servicos.acoes) && servicos.acoes.length ? servicos : null,
    limitacoes: s.limitacoes || [],
  };
  laudo.alertas = gerarAlertas(laudo);
  laudo.situacao = situacaoGeral(laudo.alertas);
  return selar(laudo);
}

// Compatível com a versão anterior: coleta bruta do Windows
const montarLaudo = (bruto, opcoes) => montarLaudoDeSecoes(secoesWindows(bruto), opcoes);

const nomeVolume = (v) => (/^[A-Z]$/i.test(v.letra || "") ? `Unidade ${v.letra}:` : `Volume ${v.letra || v.rotulo || "?"}`);

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------
function gerarAlertas(l) {
  const a = [];
  const add = (nivel, area, titulo, detalhe = "") => a.push({ nivel, area, titulo, detalhe });

  for (const d of l.discos || []) {
    const nome = `${d.modelo || "Disco"} (${d.tamanhoGB || "?"} GB)`;
    if (d.saude && d.saude !== "Healthy") add("critico", "Disco", `${nome}: saúde "${d.saude}"`, "O sistema indica falha ou risco de falha. Faça backup imediato e avalie a troca.");
    if (d.errosNaoCorrigidos > 0) add("critico", "Disco", `${nome}: ${d.errosNaoCorrigidos} erro(s) não corrigido(s)`, "Setores com erro de leitura/escrita: risco de perda de dados.");
    if (d.desgastePct >= 90) add("critico", "Disco", `${nome}: desgaste de ${d.desgastePct}%`, "SSD no fim da vida útil. Recomenda-se a troca.");
    else if (d.desgastePct >= 70) add("atencao", "Disco", `${nome}: desgaste de ${d.desgastePct}%`, "SSD com vida útil avançada.");
    if (d.temperatura >= 70) add("critico", "Disco", `${nome}: ${d.temperatura} °C`, "Temperatura muito alta para o disco.");
    else if (d.temperatura >= 60) add("atencao", "Disco", `${nome}: ${d.temperatura} °C`, "Temperatura elevada; verifique ventilação.");
    if (/^HDD$/i.test(d.tipo)) add("info", "Desempenho", `${nome} é um HD mecânico`, "Trocar por SSD melhora muito a velocidade do sistema.");
  }
  for (const v of l.volumes || []) {
    if (v.livrePct == null) continue;
    if (v.livrePct < 5) add("critico", "Armazenamento", `${nomeVolume(v)} com ${v.livreGB} GB livres (${v.livrePct}%)`, "Pouco espaço deixa o sistema lento e pode impedir atualizações.");
    else if (v.livrePct < 15) add("atencao", "Armazenamento", `${nomeVolume(v)} com ${v.livreGB} GB livres (${v.livrePct}%)`, "Recomenda-se liberar espaço.");
  }
  if (l.bateria) {
    const s = l.bateria.saudePct;
    if (s != null && s < 50) add("critico", "Bateria", `Bateria com ${s}% da capacidade original`, "Autonomia muito reduzida. Recomenda-se a troca.");
    else if (s != null && s < 70) add("atencao", "Bateria", `Bateria com ${s}% da capacidade original`, "Autonomia reduzida.");
    if (l.bateria.ciclos >= 800) add("atencao", "Bateria", `Bateria com ${l.bateria.ciclos} ciclos de carga`, "");
  }
  const mem = l.memoria || {};
  if (mem.totalGB && mem.totalGB < 4) add("atencao", "Memória", `${mem.totalGB} GB de memória RAM`, "Pouca memória para os sistemas atuais; considere ampliar.");
  if (mem.emUsoPct >= 90) add("atencao", "Memória", `Memória em uso: ${mem.emUsoPct}%`, "Muitos programas abertos ou memória insuficiente.");
  for (const t of l.temperaturas || []) {
    if (t.celsius >= 90) add("critico", "Temperatura", `${t.nome}: ${t.celsius} °C`, "Superaquecimento: limpeza e troca da pasta térmica.");
    else if (t.celsius >= 80) add("atencao", "Temperatura", `${t.nome}: ${t.celsius} °C`, "Temperatura alta.");
  }
  if (l.sistema?.ativado === false) add("atencao", "Sistema", `Windows: ${l.sistema.ativacao}`, "O Windows não está ativado.");
  if ((l.plataforma || "windows") === "windows" && l.sistema && !(l.sistema.antivirus || []).length) add("atencao", "Segurança", "Nenhum antivírus registrado", "");
  const desl = l.eventos?.desligamentosInesperados30d || 0;
  if (desl >= 3) add("atencao", "Estabilidade", `${desl} desligamentos inesperados em 30 dias`, "Travamentos, queda de energia ou problema de fonte/bateria.");

  const t = l.testes || {};
  if (t.disco?.escritaMBs != null) {
    const sistema = (l.discos || [])[0];
    const minimo = /SSD/i.test(sistema?.tipo || "") ? 80 : 30;
    if (t.disco.escritaMBs < minimo) add("atencao", "Desempenho", `Gravação no disco lenta: ${t.disco.escritaMBs} MB/s`, "Abaixo do esperado para o tipo de disco.");
  }
  if (t.rede && t.rede.internet === false) add("info", "Rede", "Sem acesso à internet no teste", t.rede.erro || "");
  for (const limite of l.limitacoes || []) add("info", "Coleta", /sem permissão de administrador|sem root/i.test(limite) ? "Coleta sem administrador" : "Coleta parcial", limite);

  return a.sort((x, y) => NIVEIS[y.nivel] - NIVEIS[x.nivel]);
}

function situacaoGeral(alertas) {
  const pior = (alertas || []).reduce((m, x) => Math.max(m, NIVEIS[x.nivel] || 0), 0);
  return pior >= 3 ? "critico" : pior === 2 ? "atencao" : "ok";
}

// ---------------------------------------------------------------------------
// Integridade e validação
// ---------------------------------------------------------------------------
function hashDe(laudo) {
  const { integridade, ...resto } = laudo;
  return crypto.createHash("sha256").update(JSON.stringify(resto)).digest("hex");
}
const selar = (laudo) => ({ ...laudo, integridade: hashDe(laudo) });

// Confere estrutura mínima e integridade de um laudo importado (arquivo ou rede)
function validarLaudo(obj) {
  if (!obj || typeof obj !== "object") return { valido: false, erro: "Arquivo de laudo inválido." };
  if (obj.formato !== FORMATO) return { valido: false, erro: "Este arquivo não é um laudo do GSTI Diagnóstico." };
  if (obj.versao > VERSAO) return { valido: false, erro: "Laudo gerado por uma versão mais nova do agente. Atualize o GSTI App." };
  for (const campo of ["id", "geradoEm", "equipamento", "sistema", "discos", "memoria"]) {
    if (obj[campo] == null) return { valido: false, erro: `Laudo incompleto (falta "${campo}").` };
  }
  if (obj.integridade !== hashDe(obj)) return { valido: false, erro: "O laudo foi alterado depois de gerado (integridade não confere)." };
  return { valido: true };
}

// ---------------------------------------------------------------------------
// Comparação antes/depois
// ---------------------------------------------------------------------------
// Mesmo equipamento? (número de série ou, sem ele, nome do computador + modelo)
function mesmoEquipamento(a, b) {
  const sa = a.equipamento?.numeroSerie;
  const sb = b.equipamento?.numeroSerie;
  if (sa && sb && !/^(0+|to be filled|default string|system serial number)$/i.test(sa)) return sa === sb;
  return a.equipamento?.computador === b.equipamento?.computador && a.equipamento?.modelo === b.equipamento?.modelo;
}

function comparar(entrada, saida) {
  const linhas = [];
  const add = (grupo, item, antes, depois, melhorQuando) => {
    if (antes == null && depois == null) return;
    if (antes === depois) return;
    let efeito = "neutro";
    if (typeof antes === "number" && typeof depois === "number" && melhorQuando) {
      efeito = (melhorQuando === "maior" ? depois > antes : depois < antes) ? "melhorou" : "piorou";
    }
    linhas.push({ grupo, item, antes: antes ?? "—", depois: depois ?? "—", efeito });
  };

  add("Memória", "Total (GB)", entrada.memoria?.totalGB, saida.memoria?.totalGB, "maior");
  add("Memória", "Módulos", entrada.memoria?.modulos?.length, saida.memoria?.modulos?.length, null);
  const chaveDisco = (d) => d.numeroSerie || `${d.modelo}-${d.tamanhoGB}`;
  const discosA = new Map((entrada.discos || []).map((d) => [chaveDisco(d), d]));
  const discosB = new Map((saida.discos || []).map((d) => [chaveDisco(d), d]));
  for (const [k, d] of discosB) {
    if (!discosA.has(k)) linhas.push({ grupo: "Discos", item: "Instalado", antes: "—", depois: `${d.modelo} ${d.tamanhoGB} GB (${d.tipo})`, efeito: "neutro" });
    else {
      const a = discosA.get(k);
      add("Discos", `${d.modelo}: saúde`, a.saude, d.saude, null);
      add("Discos", `${d.modelo}: temperatura (°C)`, a.temperatura, d.temperatura, "menor");
    }
  }
  for (const [k, d] of discosA) if (!discosB.has(k)) linhas.push({ grupo: "Discos", item: "Removido", antes: `${d.modelo} ${d.tamanhoGB} GB (${d.tipo})`, depois: "—", efeito: "neutro" });
  const volumesB = new Map((saida.volumes || []).map((v) => [v.letra, v]));
  for (const v of entrada.volumes || []) {
    const n = volumesB.get(v.letra);
    if (n) add("Armazenamento", `${nomeVolume(v)} livre (GB)`, v.livreGB, n.livreGB, "maior");
  }
  add("Bateria", "Saúde (%)", entrada.bateria?.saudePct, saida.bateria?.saudePct, "maior");
  add("Sistema", "Sistema operacional", entrada.sistema?.nome, saida.sistema?.nome, null);
  add("Sistema", "Build", entrada.sistema?.build, saida.sistema?.build, null);
  add("Sistema", "Ativação", entrada.sistema?.ativacao, saida.sistema?.ativacao, null);
  const tempMax = (l) => ((l.temperaturas || []).length ? Math.max(...l.temperaturas.map((t) => t.celsius)) : null);
  add("Temperatura", "Maior temperatura (°C)", tempMax(entrada), tempMax(saida), "menor");
  add("Testes", "Gravação no disco (MB/s)", entrada.testes?.disco?.escritaMBs, saida.testes?.disco?.escritaMBs, "maior");
  add("Testes", "Download (Mbps)", entrada.testes?.rede?.downloadMbps, saida.testes?.rede?.downloadMbps, "maior");
  add("Testes", "Uso da memória (%)", entrada.memoria?.emUsoPct, saida.memoria?.emUsoPct, "menor");
  if (saida.servicos?.liberadoTotalBytes) {
    linhas.push({ grupo: "Otimização", item: "Espaço liberado pelo agente", antes: "—", depois: `${Math.round(saida.servicos.liberadoTotalBytes / 1048576)} MB`, efeito: "melhorou" });
  }

  const chaveAlerta = (x) => `${x.area}|${x.titulo.replace(/[\d.,]+/g, "#")}`;
  const alertasA = new Map((entrada.alertas || []).filter((x) => x.nivel !== "info").map((x) => [chaveAlerta(x), x]));
  const alertasB = new Map((saida.alertas || []).filter((x) => x.nivel !== "info").map((x) => [chaveAlerta(x), x]));
  return {
    mesmoEquipamento: mesmoEquipamento(entrada, saida),
    linhas,
    alertasResolvidos: [...alertasA].filter(([k]) => !alertasB.has(k)).map(([, x]) => x),
    alertasNovos: [...alertasB].filter(([k]) => !alertasA.has(k)).map(([, x]) => x),
    alertasMantidos: [...alertasB].filter(([k]) => alertasA.has(k)).map(([, x]) => x),
  };
}

// Resumo curto para listas (OS, histórico)
function resumo(laudo) {
  const e = laudo.equipamento || {};
  const disco = (laudo.discos || [])[0];
  return {
    id: laudo.id,
    geradoEm: laudo.geradoEm,
    momento: laudo.momento,
    situacao: laudo.situacao || situacaoGeral(laudo.alertas),
    equipamento: [e.fabricante, e.modelo].filter(Boolean).join(" ") || e.computador || "Equipamento",
    numeroSerie: e.numeroSerie || "",
    processador: laudo.processador?.[0]?.nome || "",
    memoriaGB: laudo.memoria?.totalGB ?? null,
    disco: disco ? `${disco.tipo} ${disco.tamanhoGB} GB` : "",
    alertas: { critico: 0, atencao: 0, ...(laudo.alertas || []).reduce((m, x) => ({ ...m, [x.nivel]: (m[x.nivel] || 0) + 1 }), {}) },
  };
}

module.exports = { FORMATO, VERSAO, PLATAFORMAS, montarLaudo, montarLaudoDeSecoes, secoesWindows, gb, pct, num, texto, lista, gerarAlertas, situacaoGeral, validarLaudo, hashDe, selar, comparar, mesmoEquipamento, resumo };
