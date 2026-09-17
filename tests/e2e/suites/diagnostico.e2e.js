// Módulo Diagnóstico: laudos técnicos na OS (importar arquivo, receber pela rede,
// PDF do laudo e comparativo antes/depois) e bloqueio sem o módulo.
const path = require("path");
const fs = require("fs");
const { dialog, BrowserWindow } = require("electron");
const { executarSuite, RAIZ } = require("../lib/ambiente");
const { montarLaudo } = require(path.join(RAIZ, "diagnostico", "laudo.js"));
const rede = require(path.join(RAIZ, "diagnostico", "rede-local.js"));
const amostra = require(path.join(RAIZ, "tests", "unit", "fixtures", "diagnostico-coleta.json"));

async function roteiro(ctx) {
  const { api, ok, espera, licenca, criarAdmin, entrar, recarregar, abrirMenu, captura, arquivos, TMP, wc, sql } = ctx;
  const salvos = [];
  dialog.showSaveDialog = async (_janela, opcoes) => {
    const destino = path.join(TMP, path.basename(opcoes.defaultPath || "saida.pdf"));
    salvos.push(destino);
    return { canceled: false, filePath: destino };
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  ok((await criarAdmin()).success, "configuração inicial");
  await entrar("admin");
  let r = await api(`addCustomer({ nome: "Cliente Laudo", tipo_pessoa: "Física", cpf_cnpj: "52998224725", telefone: "43999990000" })`);
  const clientes = await api("getCustomers()");
  r = await api(`addOS({ osData: { id_cliente: ${clientes[0].id}, tipo_equipamento: "Notebook", marca: "Acidanthera", modelo: "MacBookPro13,1", numero_serie: "SERIE-TESTE-001", status: "Em Aberto", data_entrada: new Date().toISOString() }, total: 0 })`);
  ok(r.success, "OS criada", r);
  const osId = r.osId;

  // Sem o módulo
  licenca.modulos = ["financeiro"];
  r = await api(`getOSLaudos(${osId})`);
  ok(r.moduloBloqueado === true && r.modulo === "diagnostico", "sem o módulo Diagnóstico os laudos ficam bloqueados", r);
  licenca.modulos = null;

  // Importar arquivo
  const entrada = montarLaudo(amostra, { momento: "entrada", os: osId, tecnico: "Ana", testes: { disco: { escritaMBs: 60 } } });
  const arqEntrada = path.join(TMP, "entrada.gstilaudo");
  fs.writeFileSync(arqEntrada, JSON.stringify(entrada));
  arquivos.proximo = arqEntrada;
  r = await api(`importLaudoArquivo(${osId})`);
  ok(r.success && !r.avisos.length, "importa o laudo de entrada sem avisos", r);
  r = await api(`importLaudoArquivo(${osId})`);
  ok(!r.success && r.duplicado, "o mesmo laudo não é anexado duas vezes", r);

  const alterado = clone(entrada);
  alterado.memoria.totalGB = 64;
  fs.writeFileSync(path.join(TMP, "alterado.gstilaudo"), JSON.stringify(alterado));
  arquivos.proximo = path.join(TMP, "alterado.gstilaudo");
  r = await api(`importLaudoArquivo(${osId})`);
  ok(!r.success && /alterado/.test(r.error), "laudo alterado depois de gerado é recusado", r);

  // Receber pela rede
  r = await api(`startLaudoReceiver(${osId})`);
  ok(r.success && /^\d{6}$/.test(r.codigo) && r.porta > 0, "recebimento pela rede aberto com código", r);
  const recebidos = [];
  await wc.executeJavaScript(`window.__laudos = []; window.api.onLaudoRecebido((e) => window.__laudos.push(e)); true`);
  const saidaBruto = clone(amostra);
  saidaBruto.discos[0] = { ...saidaBruto.discos[0], FriendlyName: "Samsung 870 EVO", SerialNumber: "NOVO123" };
  const saida = montarLaudo(saidaBruto, { momento: "saida", os: 999, testes: { disco: { escritaMBs: 480 } } });
  const errado = await rede.enviar({ host: "127.0.0.1", porta: r.porta, codigo: "000000", laudo: saida });
  ok(!errado.success && /Código incorreto/.test(errado.error), "código errado é recusado", errado);
  const enviado = await rede.enviar({ host: "127.0.0.1", porta: r.porta, codigo: r.codigo, laudo: saida });
  ok(enviado.success && enviado.os === String(osId), "laudo de saída recebido pela rede", enviado);
  await espera(500);
  recebidos.push(...(await wc.executeJavaScript("window.__laudos")));
  ok(recebidos.some((e) => e.success && e.avisos?.some((a) => /OS 999/.test(a))), "aviso quando o laudo foi gerado para outra OS", recebidos);
  await api("stopLaudoReceiver()");

  r = await api(`getOSLaudos(${osId})`);
  ok(r.success && r.data.length === 2 && r.data[0].momento === "entrada" && r.data[1].origem === "rede", "OS com os laudos de entrada e saída", r);
  const [lEntrada, lSaida] = r.data;
  const lista = await api("getOSList()");
  ok(lista.find((o) => o.id === osId).laudos === 2, "lista de OS mostra a quantidade de laudos");

  // PDF e comparativo
  r = await api(`saveLaudoPdf(${lEntrada.id})`);
  ok(r.success && fs.statSync(r.caminho).size > 20000, "PDF do laudo gerado", r);
  r = await api(`laudoComparativo({ entradaId: ${lSaida.id}, saidaId: ${lEntrada.id}, acao: "pdf" })`);
  ok(r.success && r.mesmoEquipamento === true && fs.statSync(r.caminho).size > 10000, "PDF do comparativo (ordem corrigida pela data)", r);
  const antes = BrowserWindow.getAllWindows().length;
  r = await api(`viewLaudo(${lSaida.id})`);
  await espera(1200);
  ok(r.success && BrowserWindow.getAllWindows().length === antes + 1, "laudo abre em janela própria");
  BrowserWindow.getAllWindows().filter((w) => /Laudo técnico/.test(w.getTitle())).forEach((w) => w.close());

  // Tela: ícone na lista de OS e diálogo
  await recarregar(4000);
  await abrirMenu("Ordens de Serviço");
  const botao = await wc.executeJavaScript(`(() => { const b = document.querySelector('button[title^="Laudos técnicos"]'); if (!b) return false; b.click(); return true; })()`);
  ok(botao, "ícone de laudos na lista de OS");
  await espera(2000);
  const texto = await wc.executeJavaScript("document.querySelector('.MuiDialog-root')?.innerText || ''");
  ok(/Laudos técnicos — OS nº/.test(texto) && /Entrada/.test(texto) && /Saída/.test(texto) && /Comparativo antes e depois/.test(texto), "diálogo lista os laudos e oferece o comparativo", texto.slice(0, 300));
  await wc.executeJavaScript(`[...document.querySelectorAll('.MuiDialog-root button')].find((b) => b.textContent.includes("Receber pela rede")).click(); true`);
  await espera(1500);
  const painel = await wc.executeJavaScript("document.querySelector('.MuiDialog-root').innerText");
  ok(/Código para o agente/.test(painel) && /Aguardando o laudo/.test(painel), "painel de recebimento com código");
  await captura("laudos-os.png");
  await wc.executeJavaScript(`[...document.querySelectorAll('.MuiDialog-root button')].find((b) => b.textContent.trim() === "Fechar").click(); true`);
  await espera(800);
  r = await api(`getOSLaudos(${osId})`);
  ok(r.recebendo === false, "fechar o diálogo encerra o recebimento");

  // Sem o módulo, o ícone some
  licenca.modulos = [];
  await recarregar(4000);
  await abrirMenu("Ordens de Serviço");
  const semIcone = await wc.executeJavaScript(`!document.querySelector('button[title^="Laudos técnicos"]')`);
  ok(semIcone, "sem o módulo o ícone de laudos não aparece");
  licenca.modulos = null;

  // Exclusão
  r = await api(`deleteLaudo(${lSaida.id})`);
  ok(r.success, "exclusão do laudo", r);
  const restantes = await sql("SELECT COUNT(*)::int n FROM os_laudos WHERE id_os = $1", [osId]);
  ok(restantes[0].n === 1, "laudo removido do banco");
}

executarSuite({ nome: "diagnostico", roteiro });
