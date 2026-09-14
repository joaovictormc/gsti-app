/**
 * Conteúdo editável pela equipe (site, páginas legais e e-mails).
 * Cada chave tem um schema: o servidor valida com ele e o painel monta o formulário.
 * Salvar publica na hora; toda alteração fica no histórico e pode ser restaurada.
 */
const { abrir, transacao } = require("./db");
const { LicencaErro } = require("./erros");

const agoraIso = () => new Date().toISOString();

// Tipos de campo: texto (1 linha), textarea, markdown, url, imagem, booleano, lista (de objetos)
const t = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: "texto", max: 200, ...extra });
const area = (nome, rotulo, extra = {}) => ({ nome, rotulo, tipo: "textarea", max: 2000, ...extra });

const PLACEHOLDERS_EMAIL = "Variáveis: {{nome}}, {{email}}, {{produto}}, {{suporte}}, {{portal}}";

const SECOES = [
  {
    chave: "site.geral",
    grupo: "site",
    titulo: "Informações gerais",
    campos: [
      t("nomeProduto", "Nome do produto"),
      t("seoTitulo", "Título da página (SEO / aba do navegador)"),
      area("seoDescricao", "Descrição (SEO / compartilhamento)", { max: 300 }),
      t("emailContato", "E-mail de contato"),
      t("whatsapp", "WhatsApp (somente números, com DDD e país: 5511999999999)", { max: 20 }),
      { nome: "linkDownload", rotulo: "Link do instalador (.exe)", tipo: "url" },
      t("versaoApp", "Versão atual do app", { max: 20 }),
      t("requisitos", "Requisitos (ex.: Windows 10/11 64 bits + PostgreSQL)"),
      area("rodape", "Texto do rodapé", { max: 400 }),
    ],
    padrao: {
      nomeProduto: "GSTI App",
      seoTitulo: "GSTI App — Gestão de Serviços de TI para assistências técnicas",
      seoDescricao: "Ordens de serviço, clientes, estoque, garantias e financeiro da sua assistência técnica em um só sistema. Teste grátis por 7 dias.",
      emailContato: "",
      whatsapp: "",
      linkDownload: "",
      versaoApp: "1.2.0",
      requisitos: "Windows 10/11 (64 bits) e PostgreSQL",
      rodape: "Gestão de serviços para assistências técnicas e prestadores de TI.",
    },
  },
  {
    chave: "site.hero",
    grupo: "site",
    titulo: "Topo da página",
    campos: [
      t("selo", "Selo acima do título", { max: 60 }),
      t("titulo", "Título principal", { max: 120 }),
      area("subtitulo", "Subtítulo", { max: 400 }),
      t("ctaPrimario", "Botão principal", { max: 40 }),
      t("ctaSecundario", "Botão secundário", { max: 40 }),
      { nome: "imagem", rotulo: "Imagem de destaque (captura de tela)", tipo: "imagem" },
    ],
    padrao: {
      selo: "Para assistências técnicas e prestadores de TI",
      titulo: "Sua assistência técnica organizada, do balcão ao caixa.",
      subtitulo: "Ordens de serviço, clientes, estoque, garantias e financeiro em um só sistema — rodando no seu computador, com seus dados sob seu controle.",
      ctaPrimario: "Ver planos",
      ctaSecundario: "Testar 7 dias grátis",
      imagem: "",
    },
  },
  {
    chave: "site.recursos",
    grupo: "site",
    titulo: "Recursos",
    campos: [
      t("titulo", "Título da seção"),
      area("subtitulo", "Subtítulo", { max: 300 }),
      { nome: "itens", rotulo: "Recursos", tipo: "lista", max: 12, campos: [t("titulo", "Título", { max: 80 }), area("texto", "Descrição", { max: 300 })] },
    ],
    padrao: {
      titulo: "Tudo o que a rotina da assistência precisa",
      subtitulo: "Menos papel e planilha, mais controle sobre cada equipamento que entra na sua bancada.",
      itens: [
        { titulo: "Ordens de serviço completas", texto: "Entrada com checklist, acessórios e senha, status, orçamento, itens e comprovantes em PDF para o cliente." },
        { titulo: "Clientes e histórico", texto: "Cadastro com busca de CEP e todo o histórico de equipamentos e serviços de cada cliente." },
        { titulo: "Estoque integrado", texto: "Baixa automática ao finalizar a OS e alerta de estoque crítico." },
        { titulo: "Garantias sob controle", texto: "Painel de garantias com aviso de vencimento para você não perder prazo." },
        { titulo: "Financeiro e relatórios", texto: "Receitas, despesas por categoria, fluxo de caixa, metas e exportação para Excel." },
        { titulo: "Equipe com permissões", texto: "Usuários administradores e funcionários, com acesso controlado ao financeiro e relatórios." },
      ],
    },
  },
  {
    chave: "site.como_funciona",
    grupo: "site",
    titulo: "Como funciona",
    campos: [
      t("titulo", "Título da seção"),
      { nome: "passos", rotulo: "Passos", tipo: "lista", max: 6, campos: [t("titulo", "Título", { max: 80 }), area("texto", "Descrição", { max: 300 })] },
    ],
    padrao: {
      titulo: "Comece em poucos minutos",
      passos: [
        { titulo: "Escolha o plano", texto: "Pague com Pix, boleto ou cartão. A chave de licença chega no seu e-mail." },
        { titulo: "Instale no seu computador", texto: "Baixe o instalador, conecte ao banco de dados e crie o administrador." },
        { titulo: "Ative e comece a usar", texto: "Informe a chave de licença e cadastre sua primeira ordem de serviço." },
      ],
    },
  },
  {
    chave: "site.telas",
    grupo: "site",
    titulo: "Telas do sistema",
    campos: [
      { nome: "ativo", rotulo: "Exibir seção", tipo: "booleano" },
      t("titulo", "Título da seção"),
      { nome: "imagens", rotulo: "Imagens", tipo: "lista", max: 8, campos: [{ nome: "imagem", rotulo: "Imagem", tipo: "imagem" }, t("legenda", "Legenda", { max: 120 })] },
    ],
    padrao: { ativo: false, titulo: "Conheça o sistema por dentro", imagens: [] },
  },
  {
    chave: "site.planos",
    grupo: "site",
    titulo: "Planos (textos)",
    campos: [
      t("titulo", "Título da seção"),
      area("subtitulo", "Subtítulo", { max: 300 }),
      area("incluso", "Incluso em todos os planos (um item por linha)", { max: 1000 }),
      area("observacao", "Observação abaixo dos planos", { max: 400 }),
    ],
    padrao: {
      titulo: "Planos simples, sem mensalidade escondida",
      subtitulo: "Preços, parcelas e modalidades são configurados em Planos e preços.",
      incluso: "Todos os módulos do sistema\nAtualizações da versão\nSuporte por e-mail\nSeus dados no seu banco de dados",
      observacao: "Pagamento processado com segurança pelo Mercado Pago. A chave de licença é enviada por e-mail após a confirmação.",
    },
  },
  {
    chave: "site.depoimentos",
    grupo: "site",
    titulo: "Depoimentos",
    campos: [
      { nome: "ativo", rotulo: "Exibir seção", tipo: "booleano" },
      t("titulo", "Título da seção"),
      { nome: "itens", rotulo: "Depoimentos", tipo: "lista", max: 9, campos: [t("nome", "Nome", { max: 80 }), t("empresa", "Empresa / cidade", { max: 80 }), area("texto", "Depoimento", { max: 500 })] },
    ],
    padrao: { ativo: false, titulo: "Quem usa, recomenda", itens: [] },
  },
  {
    chave: "site.faq",
    grupo: "site",
    titulo: "Perguntas frequentes",
    campos: [
      t("titulo", "Título da seção"),
      { nome: "itens", rotulo: "Perguntas", tipo: "lista", max: 20, campos: [t("pergunta", "Pergunta", { max: 200 }), area("resposta", "Resposta", { max: 1500 })] },
    ],
    padrao: {
      titulo: "Perguntas frequentes",
      itens: [
        { pergunta: "Preciso de internet para usar?", resposta: "Só para ativar a licença e para uma verificação periódica. No dia a dia o sistema funciona no seu computador, com o banco de dados local." },
        { pergunta: "Qual a diferença entre o plano anual e o vitalício?", resposta: "O anual vale por 12 meses e pode ser renovado (à vista ou com renovação automática no cartão). O vitalício é pago uma vez e não expira." },
        { pergunta: "Posso trocar de computador?", resposta: "Sim. Em Configurações → Licença, use \"Transferir para outro computador\" e ative com a mesma chave no computador novo." },
        { pergunta: "Como funciona o teste grátis?", resposta: "Baixe o instalador e escolha \"Testar 7 dias grátis\" na ativação. Não pedimos cartão." },
        { pergunta: "Quais formas de pagamento?", resposta: "Pix, boleto e cartão de crédito (inclusive parcelado), pelo Mercado Pago. A renovação automática aceita apenas cartão." },
      ],
    },
  },
  {
    chave: "site.cta_final",
    grupo: "site",
    titulo: "Chamada final",
    campos: [t("titulo", "Título", { max: 120 }), area("texto", "Texto", { max: 300 }), t("botao", "Botão", { max: 40 })],
    padrao: {
      titulo: "Pronto para organizar sua assistência?",
      texto: "Teste grátis por 7 dias. Se gostar, escolha o plano que faz sentido para você.",
      botao: "Baixar e testar grátis",
    },
  },
  {
    chave: "pagina.termos",
    grupo: "paginas",
    titulo: "Termos de uso",
    campos: [t("titulo", "Título"), { nome: "texto", rotulo: "Conteúdo", tipo: "markdown", max: 30000 }],
    padrao: {
      titulo: "Termos de uso",
      texto: "## 1. Objeto\nEstes termos regulam o licenciamento de uso do GSTI App.\n\n## 2. Licença\nA licença é pessoal, intransferível para terceiros e vinculada ao limite de computadores do plano contratado.\n\n## 3. Pagamento e renovação\nPlanos anuais valem por 12 meses a partir da confirmação do pagamento.\n\n## 4. Suporte\nO suporte é prestado pelo e-mail informado no site.\n\n*Revise este texto com seu jurídico antes de publicar.*",
    },
  },
  {
    chave: "pagina.privacidade",
    grupo: "paginas",
    titulo: "Política de privacidade",
    campos: [t("titulo", "Título"), { nome: "texto", rotulo: "Conteúdo", tipo: "markdown", max: 30000 }],
    padrao: {
      titulo: "Política de privacidade",
      texto: "## Dados coletados\nNome, e-mail, documento (quando informado) e dados do pagamento processados pelo Mercado Pago. Para validar a licença, um identificador anônimo do computador.\n\n## Uso\nEmissão e validação de licenças, envio de e-mails transacionais e suporte.\n\n## Seus direitos (LGPD)\nSolicite acesso, correção ou exclusão pelo e-mail de contato.\n\n*Revise este texto com seu jurídico antes de publicar.*",
    },
  },
];

// Modelos de e-mail (markdown + variáveis {{...}})
const email = (chave, titulo, variaveis, assunto, texto) => ({
  chave: `email.${chave}`,
  grupo: "emails",
  titulo,
  ajuda: `${PLACEHOLDERS_EMAIL}${variaveis ? `, ${variaveis}` : ""}`,
  campos: [t("assunto", "Assunto", { max: 150 }), { nome: "texto", rotulo: "Mensagem", tipo: "markdown", max: 5000 }],
  padrao: { assunto, texto },
});

SECOES.push(
  email("licenca_emitida", "Licença emitida (compra)", "{{chave}}, {{plano}}, {{validade}}, {{download}}",
    "Sua licença do {{produto}} chegou",
    "Olá, {{nome}}!\n\nObrigado pela compra. Esta é a sua chave de licença (plano **{{plano}}**, validade: {{validade}}):\n\n**{{chave}}**\n\n## Como ativar\n- Baixe o instalador: [download]({{download}})\n- Na primeira abertura, escolha **Tenho uma chave** e cole a chave acima.\n\nGuarde este e-mail. Você pode gerenciar sua licença no [portal do cliente]({{portal}}).\n\nDúvidas? Responda para {{suporte}}."),
  email("renovacao_confirmada", "Renovação confirmada", "{{plano}}, {{validade}}",
    "Licença do {{produto}} renovada",
    "Olá, {{nome}}!\n\nRecebemos o pagamento da renovação. Sua licença agora vale até **{{validade}}**.\n\nNão é preciso fazer nada no sistema: a nova validade é aplicada automaticamente na próxima verificação.\n\n[Acessar o portal do cliente]({{portal}})"),
  email("lembrete_renovacao", "Lembrete de renovação", "{{validade}}, {{dias}}, {{link_renovacao}}",
    "Sua licença do {{produto}} vence em {{dias}} dia(s)",
    "Olá, {{nome}}!\n\nSua licença vence em **{{validade}}** ({{dias}} dia(s)).\n\nRenove para continuar usando sem interrupção:\n\n[Renovar agora]({{link_renovacao}})\n\nSe preferir, ative a renovação automática no cartão pelo portal do cliente."),
  email("link_acesso", "Link de acesso ao portal", "{{link}}, {{minutos}}",
    "Seu link de acesso ao {{produto}}",
    "Olá, {{nome}}!\n\nUse o link abaixo para entrar no portal do cliente. Ele vale por {{minutos}} minutos e só pode ser usado uma vez.\n\n[Entrar no portal]({{link}})\n\nSe você não pediu este acesso, ignore este e-mail."),
  email("chave_regenerada", "Nova chave de licença", "{{chave}}",
    "Nova chave de licença do {{produto}}",
    "Olá, {{nome}}!\n\nUma nova chave foi gerada para a sua licença. A chave anterior não pode mais ser usada para ativar novos computadores (os já ativados continuam funcionando).\n\n**{{chave}}**"),
  email("assinatura_cancelada", "Renovação automática cancelada", "{{validade}}",
    "Renovação automática do {{produto}} cancelada",
    "Olá, {{nome}}!\n\nA renovação automática da sua licença foi cancelada. A licença continua válida até **{{validade}}**.\n\nPara renovar depois, acesse o [portal do cliente]({{portal}})."),
  email("pagamento_estornado", "Pagamento estornado", "",
    "Pagamento do {{produto}} estornado",
    "Olá, {{nome}}!\n\nO pagamento da sua licença foi estornado ou contestado e, por isso, a licença foi desativada.\n\nSe isso foi um engano, responda este e-mail para {{suporte}}."),
);

const PORCHAVE = Object.fromEntries(SECOES.map((s) => [s.chave, s]));

// --- Validação por schema ---
function limparValor(campo, v) {
  switch (campo.tipo) {
    case "booleano":
      return !!v;
    case "lista": {
      const arr = Array.isArray(v) ? v.slice(0, campo.max || 50) : [];
      return arr.map((item) => limparObjeto(campo.campos, item || {}));
    }
    case "url":
    case "imagem": {
      const s = String(v ?? "").trim().slice(0, 500);
      if (s && !/^(https?:\/\/|\/)/i.test(s)) {
        throw new LicencaErro("URL_INVALIDA", `"${campo.rotulo}": use um endereço http(s) ou um caminho começando com /.`);
      }
      return s;
    }
    default:
      return String(v ?? "").slice(0, campo.max || 2000);
  }
}

function limparObjeto(campos, obj) {
  const out = {};
  for (const c of campos) out[c.nome] = limparValor(c, obj[c.nome]);
  return out;
}

function secao(chave) {
  const s = PORCHAVE[chave];
  if (!s) throw new LicencaErro("CONTEUDO_INEXISTENTE", "Seção de conteúdo desconhecida.", 404);
  return s;
}

function obter(chave) {
  const s = secao(chave);
  const row = abrir().prepare("SELECT valor FROM conteudo WHERE chave = ?").get(chave);
  const salvo = row ? JSON.parse(row.valor) : {};
  return { ...s.padrao, ...salvo };
}

function obterVarios(chaves) {
  return Object.fromEntries(chaves.map((c) => [c, obter(c)]));
}

function salvar(chave, valor, autor) {
  const s = secao(chave);
  // Mescla com o valor atual: campos não enviados são preservados.
  const limpo = limparObjeto(s.campos, { ...obter(chave), ...(valor || {}) });
  const json = JSON.stringify(limpo);
  const agora = agoraIso();
  transacao(() => {
    const db = abrir();
    db.prepare(
      `INSERT INTO conteudo (chave, valor, atualizado_por, atualizado_em) VALUES (?, ?, ?, ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em`
    ).run(chave, json, autor, agora);
    db.prepare("INSERT INTO conteudo_historico (chave, valor, autor, criado_em) VALUES (?, ?, ?, ?)").run(chave, json, autor, agora);
    db.prepare("INSERT INTO auditoria (ator, acao, alvo, criado_em) VALUES (?, 'conteudo_salvar', ?, ?)").run(autor, chave, agora);
  });
  return obter(chave);
}

function listarSecoes() {
  const db = abrir();
  return SECOES.map((s) => {
    const row = db.prepare("SELECT atualizado_por, atualizado_em FROM conteudo WHERE chave = ?").get(s.chave);
    return {
      chave: s.chave, grupo: s.grupo, titulo: s.titulo, ajuda: s.ajuda || null,
      atualizadoPor: row?.atualizado_por || null, atualizadoEm: row?.atualizado_em || null,
    };
  });
}

function detalheSecao(chave) {
  const s = secao(chave);
  return { chave: s.chave, grupo: s.grupo, titulo: s.titulo, ajuda: s.ajuda || null, campos: s.campos, valor: obter(chave), padrao: s.padrao };
}

function historico(chave) {
  secao(chave);
  return abrir()
    .prepare("SELECT id, autor, criado_em FROM conteudo_historico WHERE chave = ? ORDER BY id DESC LIMIT 50")
    .all(chave);
}

function restaurar(chave, historicoId, autor) {
  const h = abrir().prepare("SELECT valor FROM conteudo_historico WHERE id = ? AND chave = ?").get(Number(historicoId), chave);
  if (!h) throw new LicencaErro("NAO_ENCONTRADO", "Versão não encontrada.", 404);
  return salvar(chave, JSON.parse(h.valor), autor);
}

module.exports = { SECOES, obter, obterVarios, salvar, listarSecoes, detalheSecao, historico, restaurar };
