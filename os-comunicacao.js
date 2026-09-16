/**
 * Textos padrão dos documentos e mensagens ao cliente sobre o andamento da OS.
 * Os valores podem ser personalizados em Configurações; campo vazio = texto padrão.
 */

const STATUS_OS = [
  "Orçamento",
  "Aguardando Autorização",
  "Em Aberto",
  "Aguardando Peça",
  "Em Andamento",
  "Finalizado",
  "Entregue",
  "Cancelado",
];

// Status que, por padrão, geram aviso ao cliente.
const STATUS_AVISO_PADRAO = ["Aguardando Autorização", "Aguardando Peça", "Em Andamento", "Finalizado", "Entregue"];

// Variáveis: {cliente} {os} {equipamento} {status} {empresa} {valor} {telefone_empresa}
const MENSAGENS_STATUS_PADRAO = {
  "Orçamento": "Olá, {cliente}! Recebemos seu equipamento ({equipamento}) na {empresa}. OS nº {os}. Em breve enviaremos o orçamento.",
  "Aguardando Autorização": "Olá, {cliente}! O orçamento da OS nº {os} ({equipamento}) está pronto: {valor}. Podemos seguir com o serviço?",
  "Em Aberto": "Olá, {cliente}! Sua OS nº {os} ({equipamento}) foi registrada na {empresa} e está na fila de atendimento.",
  "Aguardando Peça": "Olá, {cliente}! A OS nº {os} ({equipamento}) está aguardando a chegada de peça. Avisaremos assim que o serviço continuar.",
  "Em Andamento": "Olá, {cliente}! O serviço da OS nº {os} ({equipamento}) está em andamento.",
  "Finalizado": "Olá, {cliente}! Seu equipamento ({equipamento}) está pronto para retirada. OS nº {os} — valor: {valor}.",
  "Entregue": "Olá, {cliente}! Obrigado por escolher a {empresa}. A OS nº {os} ({equipamento}) foi entregue. Conte com a gente!",
  "Cancelado": "Olá, {cliente}! A OS nº {os} ({equipamento}) foi cancelada. Qualquer dúvida, estamos à disposição.",
};

const CONDICOES_ENTRADA_PADRAO =
  "LEIA COM ATENÇÃO! O prazo para orçamento é de até 7 (sete) dias úteis a partir da data de entrada, de acordo com a demanda de serviços. " +
  "O orçamento é apresentado ao cliente para aprovação prévia - nenhum serviço é executado sem autorização expressa. " +
  "Ao realizar diagnóstico em equipamentos eletrônicos, podem ser identificados defeitos adicionais além do informado, podendo inviabilizar o conserto total ou parcial. " +
  "Por isso, informe qualquer defeito pré-existente; somente o defeito descrito nesta ordem será considerado. " +
  "Não cobramos taxa de orçamento. Serviços em placa-mãe possuem taxa de bancada, independentemente do resultado. " +
  "O cliente é o único responsável pelo backup de seus dados - a empresa não se responsabiliza por perda de informações durante o serviço. " +
  "O equipamento deve ser retirado em até 90 (noventa) dias após conclusão ou recusa do serviço; após esse prazo, poderão ser aplicadas taxas de armazenamento conforme legislação vigente (Lei 8.078/90 - CDC).";

// Variáveis: {dias} {data_entrega} {data_expiracao}
const TERMO_GARANTIA_PADRAO =
  "Este serviço possui garantia de {dias} dias, válida a partir da data de entrega ({data_entrega}). A garantia expira em: {data_expiracao}.\n" +
  "A garantia cobre defeitos de fabricação nas peças substituídas e/ou mão de obra referente ao serviço descrito em \"Solução Aplicada\". " +
  "Não cobre mau uso, danos por software, acidentes ou defeitos não relacionados ao reparo original.";

const preencher = (modelo, vars) =>
  String(modelo || "").replace(/\{([a-z_]+)\}/g, (m, chave) => (vars[chave] !== undefined && vars[chave] !== null ? String(vars[chave]) : m));

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const moeda = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

/** Textos efetivos dos documentos (personalizado ou padrão). */
function textosDocumentos(config) {
  const d = (config && config.documentos) || {};
  return {
    condicoesEntrada: String(d.condicoesEntrada || "").trim() || CONDICOES_ENTRADA_PADRAO,
    termoGarantia: String(d.termoGarantia || "").trim() || TERMO_GARANTIA_PADRAO,
  };
}

/** Mensagem ao cliente para um status (personalizada ou padrão). */
function mensagemStatus(config, os) {
  const personalizadas = (config && config.mensagensStatus) || {};
  const modelo = String(personalizadas[os.status] || "").trim() || MENSAGENS_STATUS_PADRAO[os.status] || "";
  const equipamento = [os.tipo_equipamento, os.marca, os.modelo].filter(Boolean).join(" ") || "equipamento";
  return preencher(modelo, {
    cliente: String(os.nome_cliente || "").split(" ")[0] || "cliente",
    os: os.id,
    equipamento,
    status: os.status,
    empresa: (config && config.branding && config.branding.companyName) || "nossa assistência",
    valor: moeda(os.valor_total),
    telefone_empresa: (config && config.empresa && config.empresa.telefone) || "",
  });
}

/** Linha de contato da empresa para o cabeçalho dos PDFs. */
function linhaContatoEmpresa(config) {
  const e = (config && config.empresa) || {};
  return [e.documento && `CNPJ/CPF: ${e.documento}`, e.telefone, e.email, e.site].filter(Boolean).join("  ·  ");
}

module.exports = {
  STATUS_OS,
  STATUS_AVISO_PADRAO,
  MENSAGENS_STATUS_PADRAO,
  CONDICOES_ENTRADA_PADRAO,
  TERMO_GARANTIA_PADRAO,
  preencher,
  escapeHtml,
  moeda,
  textosDocumentos,
  mensagemStatus,
  linhaContatoEmpresa,
};
