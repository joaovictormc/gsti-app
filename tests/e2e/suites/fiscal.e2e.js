// Nota fiscal: configurações, certificado A1 e registro manual na OS.
const path = require("path");
const fs = require("fs");
const { executarSuite, RAIZ } = require("../lib/ambiente");
const { gerarPfx } = require("../../lib/certificado-teste");

async function gerarCertificados({ TMP }) {
  fs.writeFileSync(path.join(TMP, "teste-a1-cnpj.pfx"), gerarPfx({ cn: "ASSISTENCIA SILVA LTDA:12345678000199", cnpjOtherName: "12345678000199" }));
}

async function roteiro(ctx) {
  const { w, wc, api, sql, ok, espera, DB, BANCO, USERDATA, TMP, configPath, lerConfig, captura, capturas, recarregar, abrirMenu, entrar, criarAdmin, licenca, arquivos, abertos, dialogos, fase, recriarBanco } = ctx;

  const configDisco = () => fs.readFileSync(path.join(USERDATA, "config.json"), "utf8");
  w.setSize(1280, 800);

  let r = await api(`saveInitialConfig(${JSON.stringify({
    dbConfig: DB,
    adminUser: { nome: "Admin Teste", email: "admin@teste.local", login: "admin", password: "Senha#123", confirmPassword: "Senha#123" },
  })})`);
  ok(r.success, "configuração inicial", r);
  await espera(4000);
  const tabela = await sql("SELECT to_regclass('public.notas_fiscais') IS NOT NULL AS existe");
  ok(tabela[0].existe, "tabela notas_fiscais criada pela migração");

  await entrar("admin");
  await api(`addUser({ nome: "Carlos Técnico", email: "tec@teste.local", login: "tec", password: "Senha#123", role: "Tecnico" })`);
  await api(`addUser({ nome: "Fernanda Func", email: "func@teste.local", login: "func", password: "Senha#123", role: "Funcionario" })`);

  // --- Configurações > Nota fiscal ---
  r = await api("getFiscalSettings()");
  ok(r.success && r.fiscal.emissor === "manual" && r.recursoEmissorIntegrado === false, "padrão: registro manual e sem recurso integrado", { emissor: r.fiscal?.emissor, rec: r.recursoEmissorIntegrado });
  const gratuitos = r.emissores.filter((e) => e.custo.gratuito).map((e) => e.id);
  ok(["manual", "emissor-nacional", "notaas"].every((id) => gratuitos.includes(id)), "catálogo destaca as opções gratuitas", gratuitos);
  ok(r.emissores.find((e) => e.id === "emissor-nacional").certificado === "app", "Emissor Nacional indica certificado no app");

  r = await api(`saveFiscalSettings({ emissor: "emissor-nacional" })`);
  ok(!r.success && /Anual com renovação automática/.test(r.error), "sem o plano, emissor integrado é recusado", r);
  r = await api(`saveFiscalSettings({ credenciais: { notaas: { apiKey: "x" } } })`);
  ok(!r.success && /Como funciona/.test(r.error), "credenciais exigem o aceite de responsabilidade", r);
  arquivos.proximo = path.join(TMP, "teste-a1-cnpj.pfx");
  let sel = await api("selectCertificateFile()");
  r = await api(`saveCertificate({ arquivo: "${sel.arquivo}", senha: "1234" })`);
  ok(!r.success && /Como funciona/.test(r.error), "certificado exige o aceite de responsabilidade", r);

  r = await api(`saveFiscalSettings({ aceitarTermo: true })`);
  ok(r.success && r.fiscal.termo?.usuario === "Admin Teste" && r.fiscal.termo.versao === r.fiscal.termoVersaoAtual, "aceite registrado com data e usuário", r.fiscal?.termo);
  r = await api(`saveFiscalSettings({ empresa: { cnpj: "12.345.678/0001-99", codigoMunicipioIbge: "355030", aliquotaIss: "2" } })`);
  ok(!r.success && /IBGE/.test(r.error), "código IBGE inválido é recusado", r);
  r = await api(`saveFiscalSettings({ empresa: { cnpj: "12.345.678/0001-99", inscricaoMunicipal: "123", regimeTributario: "Simples Nacional", codigoMunicipioIbge: "3550308", codigoTributacao: "14.01", aliquotaIss: "2,5" } })`);
  ok(r.success && r.fiscal.empresa.cnpj === "12345678000199" && r.fiscal.empresa.aliquotaIss === "2.5", "dados fiscais salvos e normalizados", r.fiscal?.empresa);

  licenca.recursos = ["emissorFiscal"];
  r = await api(`saveFiscalSettings({ emissor: "emissor-nacional" })`);
  ok(!r.success && /em desenvolvimento/.test(r.error), "com o plano, integração ainda em desenvolvimento não é ativada", r);
  r = await api(`saveFiscalSettings({ credenciais: { notaas: { apiKey: "segredo-notaas-123" }, "emissor-nacional": { ambiente: "producao_restrita" } } })`);
  ok(r.success && r.fiscal.credenciais.notaas.apiKey.preenchido === true && r.fiscal.credenciais["emissor-nacional"].ambiente === "producao_restrita", "credenciais salvas; segredo não volta para a tela", r.fiscal?.credenciais);
  ok(!configDisco().includes("segredo-notaas-123"), "chave da API cifrada no config.json");
  r = await api(`saveFiscalSettings({ credenciais: { notaas: { apiKey: "" }, "emissor-nacional": { ambiente: "producao" } } })`);
  r = await api("getFiscalSettings()");
  ok(r.fiscal.credenciais.notaas.apiKey.preenchido && r.fiscal.credenciais["emissor-nacional"].ambiente === "producao" && !r.fiscal.credenciais.focusnfe && r.emissores.length === 3, "campo secreto em branco mantém a chave cadastrada", r.fiscal.credenciais);
  r = await api("getAppSettings()");
  ok(r.success && r.settings.fiscal === undefined, "configurações gerais não expõem a seção fiscal");

  // Certificado
  sel = await api("selectCertificateFile()");
  r = await api(`saveCertificate({ arquivo: "${sel.arquivo}", senha: "errada" })`);
  ok(!r.success && /Senha/.test(r.error), "senha errada do certificado", r);
  sel = await api("selectCertificateFile()");
  r = await api(`saveCertificate({ arquivo: "arquivo-inventado", senha: "1234" })`);
  ok(!r.success && /novamente/.test(r.error), "caminho que não veio do diálogo é recusado", r);
  r = await api(`saveCertificate({ arquivo: "${sel.arquivo}", senha: "1234" })`);
  ok(r.success && r.certificado.documento.numero === "12345678000199" && !r.aviso, "certificado cadastrado (CNPJ confere com a empresa)", r);
  const bin = fs.readFileSync(path.join(USERDATA, "certificado-a1.bin"), "utf8");
  const original = fs.readFileSync(path.join(TMP, "teste-a1-cnpj.pfx")).toString("base64");
  ok(!bin.includes(original.slice(0, 40)) && !configDisco().includes('"1234"'), "arquivo e senha do certificado cifrados no disco");
  r = await api("getFiscalSettings()");
  ok(r.fiscal.certificado?.titular === "ASSISTENCIA SILVA LTDA", "certificado aparece nas configurações", r.fiscal.certificado);

  // Captura da seção
  await recarregar(4000);
  await abrirMenu("Configurações");
  await wc.executeJavaScript(`(() => { const h=[...document.querySelectorAll('h6')].find(e=>e.innerText.trim()==='Nota fiscal'); h.scrollIntoView({block:'start'}); document.querySelector('main').scrollBy(0,-16); })()`);
  await espera(1000);
  w.setSize(1280, 2300);
  await espera(1200);
  await captura("config-nota-fiscal.png");
  w.setSize(1280, 800);

  r = await api("removeCertificate()");
  ok(r.success && !fs.existsSync(path.join(USERDATA, "certificado-a1.bin")), "certificado removido do computador");

  // --- Notas da OS ---
  const [cli] = await sql("INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj) VALUES ('Cliente Nota', 'Física', '11122233344') RETURNING id");
  const novaOS = async (status, resp) => (await api(`addOS({ osData: { id_cliente: ${cli.id}, tipo_equipamento: "Notebook", status: "${status}", data_entrada: new Date().toISOString(), garantia_dias: 90, id_atendente: ${resp || "null"} }, total: 350 })`)).osId;
  const osAberta = await novaOS("Em Aberto");
  const osFinal = await novaOS("Finalizado");

  const pdf = path.join(TMP, "nota.pdf");
  fs.writeFileSync(pdf, "%PDF-1.4\n% nota de teste\n");
  const xml = path.join(TMP, "nota.xml");
  fs.writeFileSync(xml, '\uFEFF<?xml version="1.0"?><NFSe><numero>123</numero></NFSe>');
  const falso = path.join(TMP, "falso.pdf");
  fs.writeFileSync(falso, "não sou pdf");

  r = await api(`addNotaManual({ osId: ${osAberta}, tipo: "NFS-e", numero: "1", dataEmissao: "2026-09-16", valor: "10" })`);
  ok(!r.success && /finalizar/.test(r.error), "OS aberta não recebe nota", r);
  arquivos.proximo = falso;
  let anexoFalso = await api(`selectNotaArquivo("pdf")`);
  r = await api(`addNotaManual({ osId: ${osFinal}, tipo: "NFS-e", numero: "123", dataEmissao: "2026-09-16", valor: "350,00", pdfArquivo: "${anexoFalso.arquivo}" })`);
  ok(!r.success && /não é um PDF/.test(r.error), "anexo que não é PDF é recusado", r);
  r = await api(`addNotaManual({ osId: ${osFinal}, tipo: "NFS-e", numero: "123", dataEmissao: "2026-09-16", valor: "350,00", chaveAcesso: "123" })`);
  ok(!r.success && /44 dígitos/.test(r.error), "chave de acesso com tamanho inválido", r);
  arquivos.proximo = pdf;
  const anexoPdf = await api(`selectNotaArquivo("pdf")`);
  arquivos.proximo = xml;
  const anexoXml = await api(`selectNotaArquivo("xml")`);
  r = await api(`addNotaManual({ osId: ${osFinal}, tipo: "NFS-e", numero: "123", serie: "A", dataEmissao: "2026-09-16", valor: "350,00", chaveAcesso: "${"1".repeat(50)}", observacao: "Emitida no Emissor Nacional", pdfArquivo: "${anexoPdf.arquivo}", xmlArquivo: "${anexoXml.arquivo}" })`);
  ok(r.success, "nota manual registrada com PDF e XML", r);
  const notaId = r.id;
  r = await api(`getOSNotas(${osFinal})`);
  ok(r.success && r.data.length === 1 && r.data[0].tem_pdf && r.data[0].tem_xml && Number(r.data[0].valor) === 350 && r.data[0].usuario === "Admin Teste", "nota listada na OS", r.data);
  r = await api(`openNotaArquivo({ id: ${notaId}, tipo: "pdf" })`);
  ok(r.success && abertos.length === 1 && fs.readFileSync(abertos[0], "utf8").startsWith("%PDF-1.4"), "PDF anexado abre a partir do banco", { r, abertos });
  r = await api("getOSList()");
  ok(r.find((o) => o.id === osFinal).notas === 1, "lista de OS indica nota registrada");
  r = await api(`deleteOS(${osFinal})`);
  ok(!r.success && /nota fiscal/.test(r.error), "OS com nota não pode ser excluída", r);

  // Captura do diálogo de notas
  await recarregar(4000);
  await abrirMenu("Ordens de Serviço");
  await wc.executeJavaScript(`document.querySelector('[title^="Nota fiscal (1"]').click()`);
  await espera(2000);
  await captura("os-notas.png");

  // Permissões
  await entrar("tec");
  r = await api(`addNotaManual({ osId: ${osFinal}, tipo: "NFS-e", numero: "999", dataEmissao: "2026-09-16", valor: "1" })`);
  ok(r.acessoNegado === true, "técnico (padrão) não registra nota", r);
  r = await api("getFiscalSettings()");
  ok(r.acessoNegado === true, "técnico não vê configurações fiscais", r);
  await entrar("func");
  r = await api(`cancelarNota({ id: ${notaId}, motivo: "x" })`);
  ok(!r.success && /motivo/.test(r.error), "cancelamento exige motivo", r);
  r = await api(`cancelarNota({ id: ${notaId}, motivo: "Valor digitado errado" })`);
  ok(r.success, "funcionário marca nota como cancelada", r);
  r = await api("getOSList()");
  ok(r.find((o) => o.id === osFinal).notas === 0, "nota cancelada não conta na lista de OS");
  r = await api(`deleteNota(${notaId})`);
  ok(r.success, "funcionário exclui o registro da nota", r);
  r = await api(`getOSNotas(${osFinal})`);
  ok(r.success && r.data.length === 0, "registro removido");
  await api("logout()");
}

executarSuite({ nome: "fiscal", roteiro, preparar: gerarCertificados });
