// Catálogo de emissores de nota fiscal.
// Cada emissor declara o que oferece, quanto custa, se precisa de certificado e quais
// credenciais o cliente cadastra; a tela de Configurações é montada a partir daqui.
// Emissores integrados ganham um adaptador (emitir, consultar, cancelar, PDF/XML) e
// passam para status "disponivel" quando forem homologados.
//
// Preços conforme os sites dos fornecedores em 09/2026 (docs/PESQUISA-NOTA-FISCAL.md).

const TIPOS_NOTA = ["NFS-e", "NF-e", "NFC-e"];

// "app": certificado A1 cadastrado no GSTI App (fica cifrado neste computador)
// "emissor": certificado enviado à plataforma do emissor (pelo painel dele)
// null: não precisa
const EMISSORES = [
  {
    id: "manual",
    nome: "Registro manual (emito por fora)",
    integrado: false,
    status: "disponivel",
    custo: { gratuito: true, texto: "Grátis" },
    documentos: TIPOS_NOTA,
    certificado: null,
    resumo:
      "Você emite a nota onde já emite hoje (portal da prefeitura, Emissor Nacional, Emissor Sebrae ou pelo contador) e registra na OS o número, a data, o valor e o PDF/XML.",
    ondeEmitirGratis: [
      { nome: "Emissor Nacional da NFS-e (gov.br)", url: "https://www.nfse.gov.br/EmissorNacional", documentos: ["NFS-e"] },
      { nome: "Portal de NFS-e da sua prefeitura", url: null, documentos: ["NFS-e"] },
      { nome: "Emissor Sebrae", url: "https://sebrae.com.br", documentos: ["NF-e", "NFS-e"] },
    ],
    credenciais: [],
    guia: [],
    site: null,
  },
  {
    id: "emissor-nacional",
    nome: "Emissor Nacional (gov.br) — direto pelo app",
    integrado: true,
    status: "em_desenvolvimento",
    custo: { gratuito: true, texto: "Grátis (oficial)" },
    documentos: ["NFS-e"],
    certificado: "app",
    resumo:
      "Emissão oficial e gratuita da NFS-e padrão nacional, feita pelo próprio app com o certificado A1 da empresa. Não emite nota de produto (NF-e/NFC-e).",
    credenciais: [
      { chave: "ambiente", rotulo: "Ambiente", tipo: "selecao", opcoes: [["producao_restrita", "Testes (Produção Restrita)"], ["producao", "Produção"]], obrigatorio: true },
    ],
    guia: [
      "Tenha um certificado digital A1 (arquivo .pfx) da empresa e cadastre-o abaixo em \"Certificado digital\".",
      "Confirme que sua empresa consegue acessar o Emissor Nacional (nfse.gov.br) com esse certificado.",
      "Preencha os dados fiscais da empresa (código do município, regime, código de tributação e alíquota do ISS) com seu contador.",
      "Emita notas de teste no ambiente de Produção Restrita antes de mudar para Produção.",
    ],
    site: "https://www.nfse.gov.br/EmissorNacional",
  },
  {
    id: "notaas",
    nome: "Notaas",
    integrado: true,
    status: "disponivel",
    emite: ["NFS-e"], // integrado no app hoje (NF-e/NFC-e: registro manual por enquanto)
    custo: { gratuito: true, texto: "Plano gratuito: 50 notas/mês (1 CNPJ); planos pagos a partir de R$ 99/mês" },
    documentos: TIPOS_NOTA,
    certificado: "emissor",
    resumo:
      "Plataforma de emissão com plano gratuito, usando o padrão nacional da NFS-e na maioria dos municípios. No GSTI App emite NFS-e direto da OS; o certificado fica cadastrado na conta Notaas.",
    credenciais: [
      { chave: "apiKey", rotulo: "Chave da API do projeto (começa com ntaas_)", tipo: "segredo", obrigatorio: true, ajuda: "Gerada no painel da Notaas, dentro do projeto da sua empresa." },
    ],
    guia: [
      "Crie sua conta em notaas.com.br (a conta e o contrato são seus, em nome da sua empresa).",
      "No painel da Notaas, crie o projeto da empresa (CNPJ, inscrição municipal, regime e município) e envie o certificado digital A1.",
      "Para testar, deixe o projeto em Homologação no painel da Notaas: a Notaas não tem ambiente de testes separado, e em Produção as notas têm valor fiscal.",
      "Gere a chave de API do projeto, cole abaixo e use \"Testar conexão\".",
      "Preencha os dados fiscais abaixo (código de tributação nacional de 6 dígitos e alíquota do ISS) com seu contador.",
    ],
    site: "https://www.notaas.com.br/",
  },
  {
    id: "focusnfe",
    nome: "Focus NFe",
    integrado: true,
    status: "em_desenvolvimento",
    custo: { gratuito: false, texto: "Pago: a partir de R$ 89,90/mês (1 CNPJ, 100 notas); teste de 30 dias" },
    documentos: TIPOS_NOTA,
    certificado: "emissor",
    resumo:
      "Uma das maiores plataformas de emissão do país: NFS-e municipal e nacional, NF-e e NFC-e, com mais de 3.000 municípios.",
    credenciais: [
      { chave: "token", rotulo: "Token de acesso", tipo: "segredo", obrigatorio: true, ajuda: "Disponível no painel da Focus NFe (use o token de homologação para testes)." },
      { chave: "ambiente", rotulo: "Ambiente", tipo: "selecao", opcoes: [["homologacao", "Testes (homologação)"], ["producao", "Produção"]], obrigatorio: true },
    ],
    guia: [
      "Contrate um plano em focusnfe.com.br (a conta e o contrato são seus, em nome da sua empresa).",
      "No painel da Focus NFe, cadastre a empresa e envie o certificado digital A1.",
      "Copie o token de homologação, cole abaixo e emita notas de teste antes de usar o token de produção.",
    ],
    site: "https://focusnfe.com.br/",
  },
];

const buscarEmissor = (id) => EMISSORES.find((e) => e.id === id) || null;

// Campos de credencial que são segredo (nunca voltam para a tela)
const camposSecretos = (emissor) => (emissor?.credenciais || []).filter((c) => c.tipo === "segredo").map((c) => c.chave);

module.exports = { EMISSORES, TIPOS_NOTA, buscarEmissor, camposSecretos };
