// Emissão de NFS-e pela Notaas (com simulador local da API).
const path = require("path");
const fs = require("fs");
const { executarSuite, RAIZ } = require("../lib/ambiente");
const { iniciarSimulador } = require("../../lib/notaas-simulado");

let sim;
async function iniciarSim() {
  sim = await iniciarSimulador();
  process.env.GSTI_NOTAAS_URL = sim.url;
}

async function roteiro(ctx) {
  const { w, wc, api, sql, ok, espera, DB, BANCO, USERDATA, TMP, configPath, lerConfig, captura, capturas, recarregar, abrirMenu, entrar, criarAdmin, licenca, arquivos, abertos, dialogos, fase, recriarBanco } = ctx;
  try {


    let r = await api(`saveInitialConfig(${JSON.stringify({
      dbConfig: DB,
      adminUser: { nome: "Admin Teste", email: "admin@teste.local", login: "admin", password: "Senha#123", confirmPassword: "Senha#123" },
    })})`);
    ok(r.success, "configuração inicial", r);
    await espera(4000);
    r = await api(`login({ login: "admin", password: "Senha#123" })`);

    // Configuração
    await api(`saveFiscalSettings({ aceitarTermo: true })`);
    await api(`saveFiscalSettings({ empresa: { cnpj: "12345678000199", codigoMunicipioIbge: "4113700", codigoTributacao: "140101", aliquotaIss: "2" } })`);
    r = await api(`testarCredenciaisFiscais({ emissorId: "notaas", apiKey: "ntaas_errada" })`);
    ok(!r.success && /inválida/.test(r.error), "testar conexão com chave errada", r);
    r = await api(`saveFiscalSettings({ credenciais: { notaas: { apiKey: "${sim.chave}" } } })`);
    r = await api(`testarCredenciaisFiscais({ emissorId: "notaas" })`);
    ok(r.success, "testar conexão com a chave salva", r);
    r = await api(`saveFiscalSettings({ emissor: "notaas" })`);
    ok(r.success && r.fiscal.emissor === "notaas", "Notaas escolhida como emissor", r.error);
    r = await api("getFiscalStatus()");
    ok(r.integradoAtivo && r.emiteIntegrado.includes("NFS-e"), "emissão integrada de NFS-e ativa", r);

    // Dados de OS
    const [semDoc] = await sql("INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj) VALUES ('Sem Documento', 'Física', 'x1') RETURNING id");
    const [cli] = await sql("INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, email, cep, logradouro, numero, bairro, cidade, estado) VALUES ('Maria Cliente', 'Física', '529.982.247-25', 'maria@teste.local', '86010-010', 'Rua das Flores', '100', 'Centro', 'Londrina', 'PR') RETURNING id");
    const [rej] = await sql("INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj) VALUES ('Cliente REJEITAR', 'Física', '11144477735') RETURNING id");
    const [prod] = await sql("INSERT INTO produtos_servicos (descricao, valor, tipo) VALUES ('Formatação com backup', 180, 'Serviço') RETURNING id");
    const novaOS = async (clienteId, status = "Finalizado") => {
      const o = await api(`addOS({ osData: { id_cliente: ${clienteId}, tipo_equipamento: "Notebook", marca: "Dell", modelo: "Inspiron", status: "${status}", data_entrada: new Date().toISOString(), garantia_dias: 90 }, total: 180 })`);
      await api(`addOSItems({ osId: ${o.osId}, items: [{ id: ${prod.id}, quantidade: 1, valor: 180, observacao: "" }] })`);
      await sql("UPDATE ordens_servico SET solucao_aplicada = 'Formatação e reinstalação do sistema' WHERE id = $1", [o.osId]);
      return o.osId;
    };
    const osSemDoc = await novaOS(semDoc.id);
    const osOk = await novaOS(cli.id);
    const osRej = await novaOS(rej.id);
    const osAberta = await novaOS(cli.id, "Em Andamento");

    r = await api(`prepararNFSeIntegrada(${osSemDoc})`);
    ok(r.success && r.pendencias.some((p) => /CPF ou CNPJ/.test(p)), "pendência: cliente sem CPF/CNPJ", r.pendencias);
    r = await api(`emitirNFSeIntegrada({ osId: ${osSemDoc} })`);
    ok(!r.success && /CPF ou CNPJ/.test(r.error), "emissão recusada com pendência", r);
    r = await api(`emitirNFSeIntegrada({ osId: ${osAberta} })`);
    ok(!r.success && /finalizar/.test(r.error), "OS não finalizada não emite", r);

    r = await api(`prepararNFSeIntegrada(${osOk})`);
    ok(r.success && r.pendencias.length === 0 && r.sugestao.tomador.documento === "52998224725" && /OS nº/.test(r.sugestao.descricao) && /Formatação e reinstalação/.test(r.sugestao.descricao), "pré-visualização montada a partir da OS", r);

    // Captura do formulário de emissão
    wc.reload();
    await new Promise((res) => wc.once("did-finish-load", res));
    await espera(3500);
    await wc.executeJavaScript(`[...document.querySelectorAll('.MuiListItemButton-root')].find(e => e.innerText.trim() === 'Ordens de Serviço').click()`);
    await espera(2500);
    await wc.executeJavaScript(`[...document.querySelectorAll('.MuiDataGrid-row')].map(r => r.innerText.includes('Maria Cliente') && r.querySelector('[title="Nota fiscal"]')).find(Boolean).click()`);
    await espera(1500);
    await wc.executeJavaScript(`[...document.querySelectorAll('button')].find(b => b.innerText.startsWith('Emitir NFS-e (')).click()`);
    await espera(1500);
    w.setSize(1280, 900);
    await espera(600);
    await captura("notaas-emitir.png");
    w.setSize(1280, 800);

    const antesPayloads = sim.registro.payloads.length;
    r = await api(`emitirNFSeIntegrada({ osId: ${osOk}, descricao: "Formatação com backup — OS 2", valor: "180,00" })`);
    ok(r.success && r.status === "emitida", "NFS-e emitida (fila → processando → emitida)", r);
    const payload = sim.registro.payloads[antesPayloads];
    ok(payload && payload.tomador.cpf === "52998224725" && !payload.tomador.cnpj && payload.tomador.endereco?.cep === "86010010" && payload.servico.codigo === "140101" && payload.valores.total === 180 && payload.valores.aliquotaIss === 2 && payload.referencia === `OS-${osOk}`, "payload enviado à Notaas", payload);
    ok(sim.registro.idempotencia.at(-1) === `gsti-nota-${r.id}`, "chave de idempotência por nota", sim.registro.idempotencia.at(-1));
    let [nota] = await sql("SELECT status, numero, chave_acesso, data_emissao, pdf IS NOT NULL AS tem_pdf, xml IS NOT NULL AS tem_xml, id_externo FROM notas_fiscais WHERE id = $1", [r.id]);
    ok(nota.status === "emitida" && nota.numero === "1001" && nota.chave_acesso.length === 50 && nota.tem_pdf && nota.tem_xml, "nota gravada com número, chave, PDF e XML", nota);
    ok(sim.registro.chaveNaCdn === 0, "chave da API não é enviada ao baixar PDF/XML da CDN");
    const notaOk = r.id;
    r = await api(`openNotaArquivo({ id: ${notaOk}, tipo: "pdf" })`);
    ok(r.success && fs.readFileSync(abertos.at(-1), "utf8").startsWith("%PDF-1.4"), "PDF da NFS-e abre a partir do banco");
    r = await api(`emitirNFSeIntegrada({ osId: ${osOk} })`);
    ok(!r.success && /já tem NFS-e/.test(r.error), "não emite segunda NFS-e para a mesma OS", r);
    r = await api("getOSList()");
    ok(r.find((o) => o.id === osOk).notas === 1, "lista de OS indica a nota");

    // Captura da nota emitida
    await wc.executeJavaScript(`location.reload()`);
    await espera(4000);
    await wc.executeJavaScript(`[...document.querySelectorAll('.MuiListItemButton-root')].find(e => e.innerText.trim() === 'Ordens de Serviço').click()`);
    await espera(2500);
    await wc.executeJavaScript(`document.querySelector('[title^="Nota fiscal (1"]').click()`);
    await espera(2000);
    await captura("notaas-emitida.png");

    // Rejeição
    r = await api(`emitirNFSeIntegrada({ osId: ${osRej} })`);
    ok(r.success && r.status === "erro" && /Código de tributação/.test(r.mensagemErro), "rejeição do município aparece com o motivo", r);
    const notaRej = r.id;
    r = await api("getOSList()");
    ok(r.find((o) => o.id === osRej).notas === 0, "nota rejeitada não conta como emitida");
    r = await api(`deleteNota(${notaRej})`);
    ok(r.success, "registro de nota rejeitada pode ser excluído", r);
    r = await api(`deleteNota(${notaOk})`);
    ok(!r.success && /cancele/.test(r.error), "NFS-e emitida não pode ser excluída", r);

    // Cancelamento
    r = await api(`cancelarNota({ id: ${notaOk}, motivo: "Erro no valor informado" })`);
    ok(r.success && ["cancelando", "cancelada"].includes(r.status), "cancelamento enviado à Notaas", r);
    ok(sim.registro.cancelamentos.at(-1)?.motivo === "Erro no valor informado", "motivo enviado no cancelamento");
    r = await api(`atualizarNota(${notaOk})`);
    ok(r.success && r.status === "cancelada", "situação atualizada para cancelada", r);
    r = await api("getOSList()");
    ok(r.find((o) => o.id === osOk).notas === 0, "nota cancelada deixa de contar");
    r = await api(`emitirNFSeIntegrada({ osId: ${osOk}, descricao: "Reemissão com valor correto", valor: "170" })`);
    ok(r.success && r.status === "emitida", "após cancelar, é possível emitir nova NFS-e", r);

    // Plano sem o recurso
    licenca.recursos = [];
    r = await api(`emitirNFSeIntegrada({ osId: ${osRej} })`);
    ok(!r.success && /Nenhum emissor integrado ativo/.test(r.error), "sem o plano, emissão integrada é bloqueada", r);
    r = await api("getFiscalStatus()");
    ok(!r.integradoAtivo, "status indica emissão integrada inativa");
    await api("logout()");
  } finally {
    sim.fechar();
  }
}

executarSuite({ nome: "notaas", roteiro, preparar: iniciarSim, recursos: ["emissorFiscal"] });
