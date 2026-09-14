#!/usr/bin/env node
/**
 * CLI de administração do servidor de licenças.  Ajuda: node admin.js --help
 * Pode rodar com o servidor ligado (SQLite em modo WAL).
 */
const fs = require("fs");
const L = require("./lib/licencas");

const AJUDA = `
Uso: node admin.js <comando> [opções]

Licenças
  emitir --email E [--nome N] [--documento D] [--plano ${L.PLANOS.join("|")}]
         [--dias N | --ate AAAA-MM-DD] [--maquinas N] [--obs TEXTO]
                                   Cria licença e imprime a chave (sem --dias/--ate = sem expiração)
  listar [--email E]               Lista licenças
  ver <ref>                        Detalhes + computadores ativados
  revogar <ref> [--motivo M]       Revoga (vale na próxima revalidação do app)
  suspender <ref> [--motivo M]     Suspende (ex.: pagamento em atraso)
  reativar <ref>                   Volta para "ativa"
  estender <ref> --dias N | --ate AAAA-MM-DD | --vitalicia
  maquinas <ref> <N>               Altera o limite de computadores
  desativar-maquina <ativacaoId>   Libera a vaga de um computador

Testes (trial)
  trials [--email E]               Lista testes emitidos
  liberar-trial --email E | --maquina ID   Permite um novo teste

Outros
  importar-clientes <clientes.json>  Emite licenças para os clientes ativos do formato v1
  auditoria [--limite N]

<ref> = chave completa (GSTI-...) ou o início do id da licença (mostrado em "listar").
`;

function parse(argv) {
  const pos = [];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const prox = argv[i + 1];
      if (prox === undefined || prox.startsWith("--")) op[k] = true;
      else op[k] = argv[++i];
    } else pos.push(a);
  }
  return { pos, op };
}

const data = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "sem expiração");

function mostrarLicenca(l) {
  console.log(`  id:        ${l.id}`);
  console.log(`  cliente:   ${l.email}${l.nome ? ` (${l.nome})` : ""}`);
  console.log(`  plano:     ${l.plano}   status: ${l.status}${l.motivo_status ? ` — ${l.motivo_status}` : ""}`);
  console.log(`  chave:     GSTI-…-${l.chave_final}   validade: ${data(l.valida_ate)}   máquinas: ${l.max_maquinas}`);
}

function executar() {
  const [cmd, ...resto] = process.argv.slice(2);
  const { pos, op } = parse(resto);

  switch (cmd) {
    case "emitir": {
      const r = L.emitirLicenca({
        email: op.email, nome: op.nome, documento: op.documento, plano: op.plano,
        dias: op.dias, ate: op.ate, maxMaquinas: op.maquinas, observacao: op.obs,
      });
      console.log("\nLicença emitida:");
      console.log(`  CHAVE:     ${r.chave}   <- envie ao cliente (não é possível recuperá-la depois)`);
      console.log(`  id:        ${r.id}`);
      console.log(`  cliente:   ${r.email}   plano: ${r.plano}   validade: ${data(r.validaAte)}   máquinas: ${r.maxMaquinas}\n`);
      break;
    }
    case "listar": {
      const rows = L.listarLicencas({ email: op.email });
      if (!rows.length) return console.log("Nenhuma licença.");
      console.table(rows.map((r) => ({
        id: r.id.slice(0, 8), email: r.email, plano: r.plano, status: r.status,
        chave: `…${r.chave_final}`, validade: data(r.valida_ate), maquinas: `${r.maquinas}/${r.max_maquinas}`,
      })));
      break;
    }
    case "ver": {
      const l = L.resolverLicenca(pos[0]);
      mostrarLicenca(l);
      const ativ = L.listarAtivacoes(l.id);
      console.log(`\n  Computadores (${ativ.filter((a) => !a.desativado_em).length} ativos):`);
      if (ativ.length) {
        console.table(ativ.map((a) => ({
          ativacaoId: a.id, nome: a.nome_maquina, versao: a.app_versao, ativado: data(a.ativado_em),
          ultimoContato: new Date(a.ultimo_contato).toLocaleString("pt-BR"),
          situacao: a.desativado_em ? `desativado ${data(a.desativado_em)}` : "ativo",
        })));
      }
      break;
    }
    case "revogar":
    case "suspender":
    case "reativar": {
      const status = { revogar: "revogada", suspender: "suspensa", reativar: "ativa" }[cmd];
      mostrarLicenca(L.alterarStatus(pos[0], status, op.motivo));
      break;
    }
    case "estender":
      mostrarLicenca(L.estender(pos[0], { dias: op.dias, ate: op.ate, vitalicia: !!op.vitalicia }));
      break;
    case "maquinas":
      mostrarLicenca(L.definirMaxMaquinas(pos[0], pos[1]));
      break;
    case "desativar-maquina":
      L.desativarAtivacao(pos[0]);
      console.log("Computador desativado.");
      break;
    case "trials": {
      const rows = L.listarTrials({ email: op.email });
      if (!rows.length) return console.log("Nenhum teste emitido.");
      console.table(rows.map((t) => ({
        email: t.email, maquina: `${t.maquina_id.slice(0, 8)}…`, emitido: data(t.emitido_em), expira: data(t.expira_em),
      })));
      break;
    }
    case "liberar-trial":
      console.log(`${L.liberarTrial({ email: op.email, maquina: op.maquina }).removidos} registro(s) removido(s).`);
      break;
    case "importar-clientes": {
      const lista = JSON.parse(fs.readFileSync(pos[0], "utf8"));
      for (const c of lista.filter((c) => c.ativo !== false)) {
        const r = L.emitirLicenca({ email: c.email, ate: c.validade || undefined, observacao: "importado do clientes.json (v1)" });
        console.log(`${r.email}: ${r.chave}`);
      }
      break;
    }
    case "auditoria":
      console.table(L.listarAuditoria(op.limite || 50).map((a) => ({
        quando: new Date(a.criado_em).toLocaleString("pt-BR"), ator: a.ator, acao: a.acao, alvo: a.alvo, dados: a.dados,
      })));
      break;
    default:
      console.log(AJUDA);
  }
}

try {
  executar();
} catch (e) {
  console.error(`Erro: ${e.message}`);
  process.exit(1);
}
