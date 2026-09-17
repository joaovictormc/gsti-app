// Diagnóstico: montagem do laudo a partir da coleta (amostra real anonimizada), alertas,
// integridade, comparação antes/depois, HTML e envio pela rede local.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const { montarLaudo, validarLaudo, comparar, resumo, selar, gerarAlertas } = require(path.join(RAIZ, "diagnostico", "laudo.js"));
const { laudoHtml, comparativoHtml } = require(path.join(RAIZ, "diagnostico", "laudo-html.js"));
const rede = require(path.join(RAIZ, "diagnostico", "rede-local.js"));
const { coletarBruto } = require(path.join(RAIZ, "diagnostico", "coleta-windows.js"));
const amostra = require("./fixtures/diagnostico-coleta.json");

const clone = (x) => JSON.parse(JSON.stringify(x));

test("coleta: JSON do PowerShell é lido mesmo com lixo antes", async () => {
  const bruto = await coletarBruto({ executar: async () => `aviso qualquer\r\n${JSON.stringify({ admin: true, computador: "X" })}` });
  assert.equal(bruto.computador, "X");
  await assert.rejects(coletarBruto({ executar: async () => "sem json" }), /não devolveu/);
});

test("laudo a partir da amostra real: equipamento, memória, discos e volumes", () => {
  const l = montarLaudo(amostra, { momento: "entrada", os: 42, tecnico: "Ana" });
  assert.equal(l.formato, "gsti-laudo");
  assert.equal(l.os, "42");
  assert.equal(l.equipamento.tipo, "Notebook");
  assert.equal(l.equipamento.numeroSerie, "SERIE-TESTE-001");
  assert.equal(l.memoria.totalGB, 15.9);
  assert.equal(l.memoria.modulos.length, 2);
  assert.equal(l.memoria.modulos[0].tipo, "DDR3");
  assert.equal(l.discos.length, 2);
  assert.equal(l.discos[0].tipo, "SSD");
  assert.equal(l.volumes.length, 1, "volume único vem como objeto no PowerShell");
  assert.equal(l.volumes[0].letra, "C");
  assert.equal(l.bateria, null);
  assert.equal(l.sistema.ativado, true);
  assert.ok(l.limitacoes.length, "sem administrador registra a limitação");
  assert.deepEqual(validarLaudo(clone(l)), { valido: true });
  assert.equal(resumo(l).memoriaGB, 15.9);
});

test("alertas: disco com falha, SSD gasto, pouco espaço, bateria, Windows e estabilidade", () => {
  const b = clone(amostra);
  b.admin = true;
  b.discos[0].HealthStatus = "Warning";
  b.confiabilidade = [{ DeviceId: b.discos[1].DeviceId, Wear: 92, Temperature: 64, ReadErrorsUncorrected: 3, PowerOnHours: 9000 }];
  b.volumes.SizeRemaining = b.volumes.Size * 0.03;
  b.baterias = [{ Id: "BAT", DesignCapacity: 50000, FullChargeCapacity: 20000, CycleCount: 900 }];
  b.ativacao = { Name: "Windows", LicenseStatus: 0 };
  b.antivirus = [];
  b.desligamentosInesperados = 5;
  b.temperaturas = [{ InstanceName: "ACPI\\ThermalZone\\CPU0", CurrentTemperature: 3682 }];
  const l = montarLaudo(b, { testes: { disco: { escritaMBs: 40 } } });
  const titulos = l.alertas.map((a) => `${a.nivel}:${a.area}:${a.titulo}`);
  const tem = (re) => assert.ok(titulos.some((t) => re.test(t)), `faltou ${re}: ${titulos.join(" | ")}`);
  tem(/^critico:Disco:.*saúde "Warning"/);
  tem(/^critico:Disco:.*3 erro/);
  tem(/^critico:Disco:.*desgaste de 92%/);
  tem(/^atencao:Disco:.*64 °C/);
  tem(/^critico:Armazenamento:Unidade C/);
  tem(/^critico:Bateria:.*40%/);
  tem(/^atencao:Bateria:.*900 ciclos/);
  tem(/^atencao:Sistema:Windows: Não licenciado/);
  tem(/^atencao:Segurança:Nenhum antivírus/);
  tem(/^atencao:Estabilidade:5 desligamentos/);
  tem(/^critico:Temperatura:CPU0: 95/);
  tem(/^atencao:Desempenho:Gravação no disco lenta/);
  assert.equal(l.situacao, "critico");
  assert.equal(l.alertas[0].nivel, "critico", "críticos primeiro");
  assert.ok(!titulos.some((t) => /Coleta sem administrador/.test(t)));
});

test("integridade: laudo alterado ou de outro formato é recusado", () => {
  const l = clone(montarLaudo(amostra));
  l.memoria.totalGB = 64;
  assert.match(validarLaudo(l).erro, /alterado/);
  assert.match(validarLaudo({ formato: "outro" }).erro, /não é um laudo/);
  assert.match(validarLaudo({ ...selar({ formato: "gsti-laudo", versao: 99 }) }).erro, /versão mais nova/);
  assert.match(validarLaudo(selar({ formato: "gsti-laudo", versao: 1, id: "x" })).erro, /incompleto/);
});

test("comparação antes/depois: troca de disco, espaço, alertas resolvidos e equipamento diferente", () => {
  const entradaBruto = clone(amostra);
  entradaBruto.volumes.SizeRemaining = entradaBruto.volumes.Size * 0.04;
  entradaBruto.desligamentosInesperados = 6;
  const entrada = montarLaudo(entradaBruto, { testes: { disco: { escritaMBs: 30 } } });

  const saidaBruto = clone(amostra);
  saidaBruto.discos[0] = { ...saidaBruto.discos[0], FriendlyName: "Samsung 870 EVO", SerialNumber: "NOVO123", Size: 500107862016 };
  saidaBruto.desligamentosInesperados = 0;
  const saida = montarLaudo(saidaBruto, { momento: "saida", testes: { disco: { escritaMBs: 480 } } });

  const c = comparar(entrada, saida);
  assert.equal(c.mesmoEquipamento, true);
  assert.ok(c.linhas.some((x) => x.item === "Instalado" && /Samsung 870 EVO/.test(x.depois)));
  assert.ok(c.linhas.some((x) => x.item === "Removido"));
  assert.ok(c.linhas.some((x) => /livre/.test(x.item) && x.efeito === "melhorou"));
  assert.ok(c.linhas.some((x) => /Gravação/.test(x.item) && x.efeito === "melhorou"));
  assert.ok(c.alertasResolvidos.some((a) => a.area === "Armazenamento"));
  assert.ok(c.alertasResolvidos.some((a) => a.area === "Estabilidade"));

  const outro = clone(amostra);
  outro.bios.SerialNumber = "OUTRA-MAQUINA";
  assert.equal(comparar(entrada, montarLaudo(outro)).mesmoEquipamento, false);
});

test("HTML do laudo escapa textos e gera o comparativo", () => {
  const b = clone(amostra);
  b.sistema.Model = `<img src=x onerror=alert(1)>`;
  const l = montarLaudo(b, { observacao: "<script>alert(1)</script>" });
  const html = laudoHtml(l, { empresa: { nome: "Loja <b>", contato: "43 9999" } });
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("<img src=x"));
  assert.match(html, /Loja &lt;b&gt;/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(comparativoHtml(l, l), /Comparativo antes e depois/);
});

test("rede local: descoberta, código errado, laudo inválido, envio e bloqueio por tentativas", async () => {
  const recebidos = [];
  const encerramentos = [];
  const portaDescoberta = 47890 + Math.floor(Math.random() * 50);
  const receptor = rede.criarReceptor({
    nome: "Loja Teste", portaDescoberta,
    aoReceber: async (l) => { recebidos.push(l.id); return { os: "7" }; },
    aoEncerrar: (m) => encerramentos.push(m),
  });
  const info = await receptor.iniciar();
  assert.match(info.codigo, /^\d{6}$/);
  // Descoberta por unicast no próprio computador (broadcast depende da rede do ambiente)
  const achados = await rede.descobrir({ porta: portaDescoberta, destinos: ["127.0.0.1"], tempoMs: 800 });
  assert.deepEqual(achados.map((a) => [a.nome, a.porta, a.host]), [["Loja Teste", info.porta, "127.0.0.1"]]);
  const alvo = achados[0];

  const laudo = montarLaudo(amostra);
  assert.match((await rede.enviar({ ...alvo, codigo: "000000", laudo })).error, /Código incorreto/);
  const alterado = clone(laudo);
  alterado.memoria.totalGB = 1;
  assert.match((await rede.enviar({ ...alvo, codigo: info.codigo, laudo: alterado })).error, /integridade/);
  const ok = await rede.enviar({ ...alvo, codigo: info.codigo, laudo });
  assert.deepEqual(ok, { success: true, os: "7" });
  assert.deepEqual(recebidos, [laudo.id]);

  for (let i = 0; i < 4; i++) await rede.enviar({ ...alvo, codigo: "111111", laudo });
  assert.deepEqual(encerramentos, ["tentativas"], "5 códigos errados encerram o receptor");
  const depois = await rede.enviar({ ...alvo, codigo: info.codigo, laudo, timeout: 2000 });
  assert.equal(depois.success, false);
  receptor.encerrar();
});

test("gerarAlertas sem dados não quebra", () => {
  assert.deepEqual(gerarAlertas({}), []);
});
