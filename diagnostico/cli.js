#!/usr/bin/env node
// Diagnóstico pela linha de comando (sem interface): útil em servidores Linux sem tela e no CI.
// Uso: node diagnostico/cli.js [--saida laudo.gstilaudo] [--momento entrada|saida] [--os 123]
//                              [--tecnico Nome] [--sem-disco] [--sem-rede] [--html laudo.html]
const fs = require("fs");
const { coletar } = require("./coleta");
const { executarTestes } = require("./testes-rapidos");
const { montarLaudoDeSecoes } = require("./laudo");
const { laudoHtml } = require("./laudo-html");
const { versao } = require("./versao.json");

function opcoes(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sem-disco") o.semDisco = true;
    else if (a === "--sem-rede") o.semRede = true;
    else if (a.startsWith("--")) o[a.slice(2)] = argv[++i];
  }
  return o;
}

async function main() {
  const o = opcoes(process.argv.slice(2));
  const inicio = Date.now();
  process.stderr.write("Coletando…\n");
  const secoes = await coletar();
  process.stderr.write("Testes rápidos…\n");
  const testes = await executarTestes({ disco: !o.semDisco, rede: !o.semRede, aoProgredir: (e) => process.stderr.write(`  ${e}\n`) });
  const laudo = montarLaudoDeSecoes(secoes, { testes, momento: o.momento, os: o.os, tecnico: o.tecnico, agente: `${versao} (cli)` });
  const saida = o.saida || `laudo-${laudo.equipamento.computador || "equipamento"}-${laudo.momento}.gstilaudo`.replace(/[^\w.-]+/g, "_");
  fs.writeFileSync(saida, JSON.stringify(laudo, null, 2));
  if (o.html) fs.writeFileSync(o.html, laudoHtml(laudo));

  const e = laudo.equipamento;
  console.log(`\n${[e.fabricante, e.modelo].filter(Boolean).join(" ") || e.computador} · ${laudo.sistema.nome} (${laudo.plataforma})`);
  console.log(`Processador: ${laudo.processador.map((p) => p.nome).join("; ") || "—"} · Memória: ${laudo.memoria.totalGB ?? "—"} GB`);
  for (const d of laudo.discos) console.log(`Disco: ${d.modelo} ${d.tipo} ${d.tamanhoGB ?? "?"} GB · saúde: ${d.saude || "não lida"}`);
  if (laudo.bateria) console.log(`Bateria: ${laudo.bateria.saudePct ?? "?"}% da capacidade · ${laudo.bateria.ciclos ?? "?"} ciclos`);
  console.log(`Situação: ${laudo.situacao} · ${laudo.alertas.length} alerta(s)`);
  for (const a of laudo.alertas) console.log(`  [${a.nivel}] ${a.area}: ${a.titulo}`);
  console.log(`\nLaudo salvo em ${saida} (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
}

main().catch((e) => {
  console.error(`Erro: ${e.message}`);
  process.exit(1);
});
