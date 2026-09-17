// Laudo técnico em HTML (página A4 para visualizar e gerar PDF), simples ou comparativo.
// Usado pelo agente de diagnóstico e pelo GSTI App. Todo texto passa por esc().
const { comparar } = require("./laudo");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const data = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const valor = (v, sufixo = "") => (v == null || v === "" ? "—" : `${esc(v)}${sufixo}`);
const SITUACAO = { ok: ["Sem problemas encontrados", "ok"], atencao: ["Pontos de atenção", "atencao"], critico: ["Problemas críticos", "critico"] };
const NIVEL = { critico: "Crítico", atencao: "Atenção", info: "Informação", resolvido: "Resolvido" };
const MOMENTO = { entrada: "Entrada (antes do reparo)", saida: "Saída (depois do reparo)" };
const SAUDE = { Healthy: "Saudável", Warning: "Atenção", Unhealthy: "Com falha" };
const PLATAFORMA = { windows: "Windows", macos: "macOS", linux: "Linux" };
const mbOuGb = (bytes) => (bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)} GB` : `${Math.round((bytes || 0) / 1048576)} MB`);

// Drivers: dispositivos sem driver/com erro e os mais antigos
function blocoDrivers(d) {
  if (!d) return "";
  const antigos = (d.lista || []).filter((x) => x.data && (Date.now() - new Date(x.data).getTime()) / (365.25 * 86400000) >= 3).slice(0, 10);
  return `<h2>Drivers</h2>
  <p class="nota">${esc(d.total)} driver(s) de fabricantes · ${esc(d.antigos)} com mais de 3 anos · ${esc((d.semDriver || []).length)} dispositivo(s) sem driver</p>
  ${(d.semDriver || []).length ? `<table class="fixa"><colgroup><col style="width:40%"><col style="width:18%"><col></colgroup><thead><tr><th>Sem driver</th><th>Tipo</th><th>ID de hardware</th></tr></thead><tbody>
  ${d.semDriver.map((x) => `<tr><td>${esc(x.nome)}</td><td>${esc(x.classe)}</td><td>${esc(x.hardwareId)}</td></tr>`).join("")}</tbody></table>` : ""}
  ${antigos.length ? `<table class="fixa" style="margin-top:6px"><colgroup><col style="width:40%"><col style="width:22%"><col style="width:20%"><col></colgroup><thead><tr><th>Drivers mais antigos</th><th>Fabricante</th><th>Versão</th><th>Data</th></tr></thead><tbody>
  ${antigos.map((x) => `<tr><td>${esc(x.nome)}</td><td>${esc(x.provedor)}</td><td>${esc(x.versao)}</td><td>${data(x.data)}</td></tr>`).join("")}</tbody></table>` : ""}`;
}

// Otimizações executadas pelo agente (registradas no laudo gerado depois delas)
function blocoServicos(servicos) {
  if (!servicos?.acoes?.length) return "";
  const status = { ok: "Concluída", erro: "Falhou", pulado: "Não executada" };
  const grupo = { drivers: "Drivers", programas: "Programa" };
  return `<h2>Serviços executados pelo agente</h2>
  <p class="nota">${dataHora(servicos.executadoEm)} · autorizado por <b>${esc(servicos.autorizadoPor)}</b>${servicos.tecnico ? ` · técnico ${esc(servicos.tecnico)}` : ""} · espaço liberado: <b>${mbOuGb(servicos.liberadoTotalBytes)}</b>${servicos.acoes.some((a) => a.categoria === "desempenho" && a.status === "ok") ? " · ajustes de desempenho reversíveis pelo agente (Desfazer ajustes)" : ""}</p>
  <table class="fixa"><colgroup><col style="width:34%"><col style="width:12%"><col style="width:12%"><col></colgroup><thead><tr><th>Ação</th><th>Situação</th><th>Liberado</th><th>Detalhe</th></tr></thead><tbody>
  ${servicos.acoes.map((a) => `<tr><td>${grupo[a.categoria] ? `<small class="nota">${grupo[a.categoria]}:</small> ` : ""}${esc(a.nome)}${a.personalizado ? ' <small class="nota">(da assistência)</small>' : ""}</td><td class="${a.status === "ok" ? "melhorou" : "piorou"}">${esc(status[a.status] || a.status)}</td><td>${a.liberadoBytes ? mbOuGb(a.liberadoBytes) : "—"}</td><td>${esc(a.detalhe)}</td></tr>`).join("")}
  </tbody></table>`;
}

const CSS = `
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #1f2937; font-size: 11.5px; line-height: 1.45; margin: 0; background: #fff; }
.laudo { width: 100%; margin: 0 auto; }
header.topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 14px; }
.empresa { display: flex; gap: 10px; align-items: center; }
.empresa img { max-height: 46px; max-width: 120px; object-fit: contain; }
.empresa strong { font-size: 15px; color: #1e3a8a; display: block; }
.empresa small, .meta small { color: #6b7280; display: block; }
h1 { font-size: 18px; margin: 0; color: #111827; }
.meta { text-align: right; }
.situacao { border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.situacao strong { font-size: 14px; }
.situacao.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.situacao.atencao { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
.situacao.critico { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
h2 { font-size: 12.5px; text-transform: uppercase; letter-spacing: .06em; color: #1e3a8a; margin: 16px 0 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; break-after: avoid; }
table { width: 100%; border-collapse: collapse; break-inside: auto; }
th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
table.fixa { table-layout: fixed; }
th { color: #6b7280; font-weight: 600; font-size: 10.5px; }
tr { break-inside: avoid; }
.grade { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 14px; }
.grade div span { color: #6b7280; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
.alerta { border-left: 4px solid; padding: 5px 9px; margin-bottom: 5px; border-radius: 4px; break-inside: avoid; }
.alerta.critico { border-color: #dc2626; background: #fef2f2; }
.alerta.atencao { border-color: #d97706; background: #fffbeb; }
.alerta.info { border-color: #2563eb; background: #eff6ff; }
.alerta.resolvido { border-color: #059669; background: #ecfdf5; }
.alerta b { display: block; }
.alerta small { color: #4b5563; }
.etq { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-right: 6px; }
.melhorou { color: #047857; font-weight: 600; }
.piorou { color: #b91c1c; font-weight: 600; }
.nota { color: #6b7280; font-size: 10px; }
footer { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #6b7280; font-size: 9.5px; display: flex; justify-content: space-between; gap: 12px; }
.assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 34px; break-inside: avoid; }
.assinaturas div { border-top: 1px solid #9ca3af; text-align: center; padding-top: 4px; color: #4b5563; }
`;

function cabecalho(titulo, laudo, empresa, extra = "") {
  const e = empresa || {};
  return `<header class="topo">
    <div class="empresa">
      ${e.logo ? `<img src="${esc(e.logo)}" alt="">` : ""}
      <div>${e.nome ? `<strong>${esc(e.nome)}</strong>` : ""}${e.contato ? `<small>${esc(e.contato)}</small>` : ""}<h1>${esc(titulo)}</h1></div>
    </div>
    <div class="meta">
      ${laudo.os ? `<strong>OS nº ${esc(laudo.os)}</strong>` : ""}
      <small>${extra || `${esc(MOMENTO[laudo.momento] || "")} · ${dataHora(laudo.geradoEm)}`}</small>
      ${laudo.tecnico ? `<small>Técnico: ${esc(laudo.tecnico)}</small>` : ""}
    </div>
  </header>`;
}

function blocoAlertas(alertas) {
  if (!alertas?.length) return `<p>Nenhum problema encontrado na coleta.</p>`;
  return alertas.map((a) => `<div class="alerta ${esc(a.nivel)}"><b><span class="etq">${esc(NIVEL[a.nivel] || a.nivel)}</span>${esc(a.area)} · ${esc(a.titulo)}</b>${a.detalhe ? `<small>${esc(a.detalhe)}</small>` : ""}</div>`).join("");
}

function laudoHtml(laudo, { empresa } = {}) {
  const l = laudo;
  const e = l.equipamento || {};
  const s = l.sistema || {};
  const [rotuloSituacao, classe] = SITUACAO[l.situacao] || SITUACAO.ok;
  const contagem = (n) => (l.alertas || []).filter((a) => a.nivel === n).length;
  const t = l.testes || {};

  const corpo = `
  ${cabecalho("Laudo técnico do equipamento", l, empresa)}
  <div class="situacao ${classe}"><strong>${rotuloSituacao}</strong><span>${contagem("critico")} crítico(s) · ${contagem("atencao")} ponto(s) de atenção</span></div>

  <h2>Equipamento</h2>
  <div class="grade">
    <div><span>Fabricante / modelo</span>${valor([e.fabricante, e.modelo].filter(Boolean).join(" "))}</div>
    <div><span>Tipo</span>${valor(e.tipo)}</div>
    <div><span>Número de série</span>${valor(e.numeroSerie)}</div>
    <div><span>Nome do computador</span>${valor(e.computador)}${l.plataforma ? ` <small class="nota">(${esc(PLATAFORMA[l.plataforma] || l.plataforma)})</small>` : ""}</div>
    <div><span>Placa-mãe</span>${valor(e.placaMae)}</div>
    <div><span>BIOS</span>${valor(e.bios)}</div>
    <div><span>Processador</span>${valor((l.processador || []).map((p) => `${p.nome} (${p.nucleos}n/${p.threads}t)`).join("; "))}</div>
    <div><span>Memória</span>${valor(l.memoria?.totalGB, " GB")}${l.memoria?.emUsoPct != null ? ` <small class="nota">(${esc(l.memoria.emUsoPct)}% em uso)</small>` : ""}</div>
    <div><span>Vídeo</span>${valor((l.graficos || []).map((g) => g.nome).join("; "))}</div>
  </div>

  <h2>Diagnóstico</h2>
  ${blocoAlertas(l.alertas)}

  <h2>Sistema</h2>
  <div class="grade">
    <div><span>Sistema</span>${valor(s.nome)}</div>
    <div><span>Versão / build</span>${valor([s.versao, s.arquitetura].filter(Boolean).join(" · "))}</div>
    <div><span>Ativação</span>${valor(s.ativacao)}</div>
    <div><span>Instalado em</span>${data(s.instaladoEm)}</div>
    <div><span>Ligado desde</span>${dataHora(s.ligadoDesde)}</div>
    <div><span>Antivírus</span>${valor((s.antivirus || []).join(", ") || "Nenhum")}</div>
  </div>

  <h2>Discos</h2>
  <table><thead><tr><th>Modelo</th><th>Tipo</th><th>Tamanho</th><th>Saúde</th><th>Desgaste</th><th>Horas ligado</th><th>Temp.</th><th>Erros não corrigidos</th></tr></thead><tbody>
  ${(l.discos || []).map((d) => `<tr><td>${valor(d.modelo)}<br><small class="nota">${valor(d.numeroSerie)}</small></td><td>${valor(d.tipo)} ${d.barramento ? `<small class="nota">${esc(d.barramento)}</small>` : ""}</td><td>${valor(d.tamanhoGB, " GB")}</td><td>${valor(SAUDE[d.saude] || d.saude)}</td><td>${valor(d.desgastePct, "%")}</td><td>${valor(d.horasLigado)}</td><td>${valor(d.temperatura, " °C")}</td><td>${valor(d.errosNaoCorrigidos)}</td></tr>`).join("")}
  </tbody></table>
  ${(l.volumes || []).length ? `<table style="margin-top:6px"><thead><tr><th>Unidade</th><th>Tamanho</th><th>Livre</th><th>Sistema de arquivos</th><th>BitLocker</th></tr></thead><tbody>
  ${l.volumes.map((v) => `<tr><td>${esc(v.letra)}: ${esc(v.rotulo)}</td><td>${valor(v.tamanhoGB, " GB")}</td><td>${valor(v.livreGB, " GB")} (${valor(v.livrePct, "%")})</td><td>${valor(v.sistemaArquivos)}</td><td>${v.bitlocker == null ? "—" : v.bitlocker ? "Ativo" : "Desativado"}</td></tr>`).join("")}
  </tbody></table>` : ""}

  <h2>Memória</h2>
  <table><thead><tr><th>Slot</th><th>Capacidade</th><th>Tipo</th><th>Velocidade</th><th>Fabricante / modelo</th></tr></thead><tbody>
  ${(l.memoria?.modulos || []).map((m) => `<tr><td>${valor(m.slot)}</td><td>${valor(m.capacidadeGB, " GB")}</td><td>${valor(m.tipo)}</td><td>${valor(m.velocidadeMHz, " MHz")}</td><td>${valor([m.fabricante, m.modelo].filter(Boolean).join(" "))}</td></tr>`).join("")}
  </tbody></table>
  ${l.memoria?.slots ? `<p class="nota">${esc(l.memoria.modulos.length)} de ${esc(l.memoria.slots)} slots ocupados.</p>` : ""}

  ${l.bateria ? `<h2>Bateria</h2><div class="grade">
    <div><span>Saúde</span>${valor(l.bateria.saudePct, "% da capacidade original")}</div>
    <div><span>Capacidade atual / original</span>${valor(l.bateria.capacidadeAtualMWh)} / ${valor(l.bateria.capacidadeProjetoMWh, " mWh")}</div>
    <div><span>Ciclos</span>${valor(l.bateria.ciclos)}</div>
  </div>` : ""}

  ${(l.temperaturas || []).length ? `<h2>Temperaturas</h2><p>${l.temperaturas.map((x) => `${esc(x.nome)}: <b>${esc(x.celsius)} °C</b>`).join(" · ")}</p>` : ""}

  <h2>Testes rápidos</h2>
  <div class="grade">
    <div><span>Gravação no disco</span>${t.disco?.escritaMBs != null ? `${esc(t.disco.escritaMBs)} MB/s` : esc(t.disco?.motivo || t.disco?.erro || "Não executado")}</div>
    <div><span>Internet</span>${t.rede ? (t.rede.internet ? `Conectada · ${valor(t.rede.latenciaMs, " ms")}` : esc(t.rede.erro || "Sem conexão")) : "Não executado"}</div>
    <div><span>Download</span>${valor(t.rede?.downloadMbps, " Mbps")}</div>
    <div><span>Uso de CPU na coleta</span>${valor(t.cpu?.usoPct, "%")}</div>
    <div><span>Rede</span>${valor((l.rede || []).filter((r) => r.conectado).map((r) => `${r.nome} (${r.velocidade})`).join(", ") || "Nenhuma conectada")}</div>
    <div><span>Desligamentos inesperados (30 dias)</span>${valor(l.eventos?.desligamentosInesperados30d)}</div>
  </div>

  ${(l.eventos?.errosRecentes || []).length ? `<h2>Erros recentes do Windows (7 dias)</h2><table class="fixa"><colgroup><col style="width:17%"><col style="width:22%"><col></colgroup><tbody>
  ${l.eventos.errosRecentes.slice(0, 8).map((x) => `<tr><td style="white-space:nowrap">${dataHora(x.data)}</td><td>${esc(x.origem)}</td><td>${esc(x.mensagem)}</td></tr>`).join("")}
  </tbody></table>` : ""}

  ${blocoDrivers(l.drivers)}
  ${blocoServicos(l.servicos)}
  ${l.observacao ? `<h2>Observações do técnico</h2><p>${esc(l.observacao)}</p>` : ""}
  ${(l.limitacoes || []).length ? `<p class="nota">${l.limitacoes.map(esc).join(" ")}</p>` : ""}

  <div class="assinaturas"><div>Técnico responsável</div><div>Cliente</div></div>
  <footer><span>Laudo ${esc(String(l.id).slice(0, 8))} · gerado por GSTI Diagnóstico ${esc(l.agente || "")}</span><span>Integridade ${esc(String(l.integridade || "").slice(0, 16))}</span></footer>`;

  return pagina(`Laudo técnico ${e.modelo || ""}`, corpo);
}

function comparativoHtml(entrada, saida, { empresa } = {}) {
  const c = comparar(entrada, saida);
  const efeito = { melhorou: "Melhorou", piorou: "Piorou", neutro: "" };
  const corpo = `
  ${cabecalho("Comparativo antes e depois do reparo", saida, empresa, `Entrada ${dataHora(entrada.geradoEm)} · Saída ${dataHora(saida.geradoEm)}`)}
  ${c.mesmoEquipamento ? "" : `<div class="situacao critico"><strong>Atenção: os laudos parecem ser de equipamentos diferentes.</strong></div>`}
  <div class="grade">
    <div><span>Equipamento</span>${valor([saida.equipamento?.fabricante, saida.equipamento?.modelo].filter(Boolean).join(" "))}</div>
    <div><span>Número de série</span>${valor(saida.equipamento?.numeroSerie)}</div>
    <div><span>Situação</span>${esc((SITUACAO[entrada.situacao] || SITUACAO.ok)[0])} → <b>${esc((SITUACAO[saida.situacao] || SITUACAO.ok)[0])}</b></div>
  </div>

  <h2>Problemas resolvidos (${c.alertasResolvidos.length})</h2>
  ${c.alertasResolvidos.length ? blocoAlertas(c.alertasResolvidos.map((a) => ({ ...a, nivel: "resolvido" }))) : `<p class="nota">Nenhum.</p>`}
  <h2>Pontos que continuam (${c.alertasMantidos.length})</h2>
  ${c.alertasMantidos.length ? blocoAlertas(c.alertasMantidos) : `<p class="nota">Nenhum.</p>`}
  ${c.alertasNovos.length ? `<h2>Surgiram na saída (${c.alertasNovos.length})</h2>${blocoAlertas(c.alertasNovos)}` : ""}

  <h2>O que mudou</h2>
  ${c.linhas.length ? `<table><thead><tr><th>Item</th><th>Antes</th><th>Depois</th><th></th></tr></thead><tbody>
  ${c.linhas.map((x) => `<tr><td>${esc(x.grupo)} · ${esc(x.item)}</td><td>${esc(x.antes)}</td><td>${esc(x.depois)}</td><td class="${esc(x.efeito)}">${esc(efeito[x.efeito])}</td></tr>`).join("")}
  </tbody></table>` : `<p class="nota">Nenhuma diferença medida entre os laudos.</p>`}
  ${blocoServicos(saida.servicos)}
  ${saida.observacao ? `<h2>Observações do técnico</h2><p>${esc(saida.observacao)}</p>` : ""}
  <div class="assinaturas"><div>Técnico responsável</div><div>Cliente</div></div>
  <footer><span>Entrada ${esc(String(entrada.id).slice(0, 8))} · Saída ${esc(String(saida.id).slice(0, 8))}</span><span>GSTI Diagnóstico</span></footer>`;
  return pagina("Comparativo do reparo", corpo);
}

const pagina = (titulo, corpo) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${esc(titulo)}</title><style>${CSS}</style></head><body><main class="laudo">${corpo}</main></body></html>`;

module.exports = { laudoHtml, comparativoHtml };
