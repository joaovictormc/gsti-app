// Controle de acesso das chamadas IPC.
// O processo principal guarda quem fez login em cada janela e cada canal declara
// quem pode chamá-lo. Assim a regra não depende só do que a interface esconde:
// uma chamada feita pelo console do renderer passa pela mesma verificação.

// Níveis de acesso:
//   publico     — sem login (tela de login, ativação da licença)
//   setup       — sem login só enquanto a configuração inicial não foi concluída; depois, Admin
//   sessao      — qualquer usuário logado
//   admin       — somente Admin
// Os demais níveis dependem das permissões do perfil (Configurações > Permissões);
// o Admin sempre tem todas:
//   financeiro  — canSeeFinancial      relatorios — canSeeReports
//   excluir     — podeExcluir          custo      — verCusto
//   produtos    — editarProdutos       estoque    — ajustarEstoque
//   cadastros   — editarCadastros (clientes e equipamentos)
//   notas       — emitirNotaFiscal (registrar/emitir e cancelar notas da OS)
// "Só OS atribuídas" (somenteOSAtribuidas) não é um nível: é aplicado nos handlers de OS.
// Um canal pode aceitar mais de um nível (lista): basta atender a um deles.

// Venda por módulos: níveis que pertencem a um módulo (sem o módulo, ninguém acessa —
// nem o Admin) e canais avulsos de módulo (modulos.js).
const { CANAIS_DE_MODULO, nomeDoModulo } = require("./modulos");
const MODULO_DO_NIVEL = { financeiro: "financeiro", relatorios: "relatorios", estoque: "estoque" };

// Perfis configuráveis (chave usada em config.permissions)
const PERFIS = { Funcionario: "funcionario", Tecnico: "tecnico" };

// Permissões de cada perfil quando ainda não foram ajustadas em Configurações.
// Funcionário mantém o comportamento anterior; Técnico começa restrito às OS dele.
const PERMISSOES_PADRAO = {
  funcionario: {
    somenteOSAtribuidas: false, podeExcluir: true, verCusto: true, editarProdutos: true,
    ajustarEstoque: true, editarCadastros: true, canSeeFinancial: false, canSeeReports: false,
    emitirNotaFiscal: true,
  },
  tecnico: {
    somenteOSAtribuidas: true, podeExcluir: false, verCusto: false, editarProdutos: false,
    ajustarEstoque: false, editarCadastros: false, canSeeFinancial: false, canSeeReports: false,
    emitirNotaFiscal: false,
  },
};

const PERMISSOES_ADMIN = {
  somenteOSAtribuidas: false, podeExcluir: true, verCusto: true, editarProdutos: true,
  ajustarEstoque: true, editarCadastros: true, canSeeFinancial: true, canSeeReports: true,
  emitirNotaFiscal: true,
};

const NIVEL_PERMISSAO = {
  financeiro: "canSeeFinancial", relatorios: "canSeeReports", excluir: "podeExcluir",
  custo: "verCusto", produtos: "editarProdutos", estoque: "ajustarEstoque", cadastros: "editarCadastros",
  notas: "emitirNotaFiscal",
};
const POLITICAS_IPC = {
  // Configuração inicial e licença
  "is-initial-setup-needed": "publico",
  "test-db-connection": "setup",
  "save-initial-config": "setup",
  "save-initial-config-existing-user": "setup",
  "activate-license": "publico",
  "start-trial": "publico",
  "get-license-status": "publico",
  "revalidate-license": "publico",
  "open-license-site": "publico",
  "deactivate-license": "admin",

  // Configurações (a leitura sem Admin devolve só marca e permissões)
  "get-app-settings": "publico",
  "save-app-settings": "admin",
  "test-email-settings": "admin",
  "select-logo-file": "admin",
  "select-background-file": "admin",
  "load-logo-image": "publico", // sem Admin, só a logo salva (verificado no handler)
  "load-background-image": "publico", // sem Admin, só o fundo salvo (verificado no handler)
  "set-title-bar-theme": "publico",
  "get-update-status": "sessao",
  "check-for-updates": "sessao",
  "install-update": "sessao",
  "support-get-context": "sessao",
  "support-capture-screen": "sessao",
  "support-open-ticket": "sessao",
  "support-list-tickets": "sessao",
  "support-open-link": "sessao",
  "request-fiscal-emitter": "admin",
  "get-os-laudos": "sessao",
  "import-laudo-arquivo": "sessao",
  "start-laudo-receiver": "sessao",
  "stop-laudo-receiver": "sessao",
  "view-laudo": "sessao",
  "save-laudo-pdf": "sessao",
  "laudo-comparativo": "sessao",
  "delete-laudo": "excluir",
  "download-diagnostico-agente": "sessao",
  "backup-database": "admin",
  "restore-database": "admin",
  "select-backup-folder": "admin",

  // Autenticação e usuários
  "handle-login": "publico",
  "get-current-session": "publico",
  "logout": "publico",
  "handle-forgot-password": "publico",
  "handle-reset-password": "publico",
  "get-users": ["admin", "relatorios"],
  "add-user": "admin",
  "update-user": "admin",
  "delete-user": "admin",

  // Operação do dia a dia
  "search-cep": "sessao",
  "validate-cnpj": "sessao",
  "get-customers": "sessao",
  "add-customer": "cadastros",
  "update-customer": "cadastros",
  "delete-customer": "excluir",
  "get-customer-timeline": "sessao",
  "get-equipments": "sessao",
  "add-equipment": "cadastros",
  "update-equipment": "cadastros",
  "delete-equipment": "excluir",
  "get-equipment-history": "sessao",
  "get-products": "sessao",
  "add-product": "produtos",
  "update-product": "produtos",
  "delete-product": "excluir",
  "get-os-list": "sessao",
  "get-active-data": "sessao",
  "get-os-details": "sessao",
  "add-os": "sessao",
  "update-os": "sessao",
  "add-os-items": "sessao",
  "update-os-items": "sessao",
  "delete-os": "excluir",
  "generate-entry-receipt": "sessao",
  "generate-exit-receipt": "sessao",
  "get-os-whatsapp-message": "sessao",
  "open-whatsapp-link": "sessao",
  "get-dashboard-stats": "sessao", // valores financeiros só com permissão (filtrado no handler)
  "get-os-agenda": "sessao",
  "get-stock": "sessao",
  "adjust-stock": "estoque",
  "update-stock-min": "estoque",
  "get-warranty-panel": "sessao",
  "send-warranty-email": "sessao",
  "get-most-used-services": "sessao", // também aparece na tela inicial

  // Financeiro
  "get-expenses": "financeiro",
  "add-expense": "financeiro",
  "update-expense": "financeiro",
  "delete-expense": "financeiro",
  "get-misc-revenues": "financeiro",
  "add-misc-revenue": "financeiro",
  "update-misc-revenue": "financeiro",
  "delete-misc-revenue": "financeiro",
  "get-financial-summary": "financeiro",
  "get-expenses-by-category": "financeiro",
  "get-monthly-summary": "financeiro",
  "export-financial-report": "financeiro",
  "get-annual-summary": "financeiro",
  "get-average-profit": "financeiro",
  "get-financial-projection": "financeiro",
  "get-financial-config": "financeiro",
  "save-financial-config": "financeiro",
  "get-financial-goals": "financeiro",
  "add-financial-goal": "financeiro",
  "delete-financial-goal": "financeiro",
  "get-detailed-cashflow": "financeiro",

  // Nota fiscal
  "get-fiscal-settings": "admin",
  "save-fiscal-settings": "admin",
  "select-certificate-file": "admin",
  "save-certificate": "admin",
  "remove-certificate": "admin",
  "get-fiscal-status": "sessao",
  "get-os-notas": "sessao",
  "open-nota-arquivo": "sessao",
  "select-nota-arquivo": "notas",
  "add-nota-manual": "notas",
  "cancelar-nota": "notas",
  "delete-nota": "excluir", // também exige "notas" (verificado no handler)
  "testar-credenciais-fiscais": "admin",
  "preparar-nfse-integrada": "notas",
  "emitir-nfse-integrada": "notas",
  "atualizar-nota": "sessao",

  // Relatórios
  "get-os-by-client": "relatorios",
  "get-os-by-status": "relatorios",
  "get-os-by-attendant": "relatorios",
  "get-open-os-aging": "relatorios",
  "get-profitability-report": "relatorios", // também exige "custo" (verificado no handler)
  "search-os-by-serial": "relatorios",
  "get-detailed-revenue-report": "relatorios",
};

const NIVEIS = new Set(["publico", "setup", "sessao", "admin", ...Object.keys(NIVEL_PERMISSAO)]);

// obterModulos(): lista de módulos contratados ou null (= todos, ex.: token antigo).
function criarControleAcesso({ obterConfig, obterModulos = () => null, politicas = POLITICAS_IPC }) {
  const sessoes = new Map(); // id do webContents -> { id, nome, role }

  function moduloLiberado(chave) {
    const lista = obterModulos();
    return !Array.isArray(lista) || lista.includes(chave);
  }

  // Módulo de um canal: explícito (modulos.js) ou pelo nível único da política
  function moduloDoCanal(canal) {
    if (CANAIS_DE_MODULO[canal]) return CANAIS_DE_MODULO[canal];
    const nivel = politicas[canal];
    return typeof nivel === "string" ? MODULO_DO_NIVEL[nivel] || null : null;
  }

  for (const [canal, nivel] of Object.entries(politicas)) {
    for (const n of [].concat(nivel)) {
      if (!NIVEIS.has(n)) throw new Error(`Nível de acesso desconhecido "${n}" no canal "${canal}".`);
    }
  }

  // Permissões efetivas do usuário (padrão do perfil + ajustes salvos em Configurações)
  function permissoesDe(usuario) {
    if (!usuario) return null;
    let permissoes;
    if (usuario.role === "Admin") permissoes = { ...PERMISSOES_ADMIN };
    else {
      const perfil = PERFIS[usuario.role];
      if (!perfil) permissoes = { ...PERMISSOES_PADRAO.tecnico }; // papel desconhecido: o mais restrito
      // Sem o módulo "perfis", vale o padrão do perfil (a tabela de Configurações não se aplica)
      else if (!moduloLiberado("perfis")) permissoes = { ...PERMISSOES_PADRAO[perfil] };
      else permissoes = { ...PERMISSOES_PADRAO[perfil], ...(obterConfig()?.permissions?.[perfil] || {}) };
    }
    // Módulos não contratados desligam as permissões correspondentes
    if (!moduloLiberado("financeiro")) permissoes.canSeeFinancial = false;
    if (!moduloLiberado("relatorios")) permissoes.canSeeReports = false;
    if (!moduloLiberado("estoque")) permissoes.ajustarEstoque = false;
    return permissoes;
  }

  const modulosLiberados = () => {
    const lista = obterModulos();
    return Array.isArray(lista) ? [...lista] : null;
  };

  function pode(usuario, nivel) {
    return [].concat(nivel).some((n) => {
      if (n === "publico") return true;
      if (n === "setup" && !obterConfig()?.setupComplete) return true;
      if (MODULO_DO_NIVEL[n] && !moduloLiberado(MODULO_DO_NIVEL[n])) return false;
      if (!usuario) return false;
      if (usuario.role === "Admin") return true;
      if (n === "sessao") return true;
      const chave = NIVEL_PERMISSAO[n];
      return chave ? !!permissoesDe(usuario)[chave] : false;
    });
  }

  // Usuário restrito às OS em que é o responsável (id_atendente)? Devolve o id ou null.
  function restricaoOS(event) {
    const usuario = usuarioDe(event);
    return usuario && permissoesDe(usuario).somenteOSAtribuidas ? usuario.id : null;
  }

  function iniciarSessao(event, usuario) {
    const contents = event.sender;
    if (!sessoes.has(contents.id)) {
      const id = contents.id;
      contents.once("destroyed", () => sessoes.delete(id));
    }
    sessoes.set(contents.id, { id: usuario.id, nome: usuario.nome, role: usuario.role });
  }

  function encerrarSessao(event) {
    sessoes.delete(event.sender.id);
  }

  function usuarioDe(event) {
    return sessoes.get(event?.sender?.id) || null;
  }

  // Substitui ipcMain.handle para que todo canal registrado passe pela política.
  // Canal sem política falha ao iniciar: assim nenhum handler novo fica aberto por esquecimento.
  function protegerIpc(ipcMain) {
    const registrar = ipcMain.handle.bind(ipcMain);
    ipcMain.handle = (canal, handler) => {
      const nivel = politicas[canal];
      if (!nivel) throw new Error(`Canal IPC "${canal}" sem política de acesso em controle-acesso.js.`);
      const modulo = moduloDoCanal(canal);
      return registrar(canal, async (event, ...args) => {
        const usuario = usuarioDe(event);
        if (modulo && !moduloLiberado(modulo)) {
          return {
            success: false,
            moduloBloqueado: true,
            modulo,
            error: `Recurso do módulo "${nomeDoModulo(modulo)}", que não está incluído no seu plano.`,
          };
        }
        if (!pode(usuario, nivel)) {
          console.warn(`[Acesso] Negado "${canal}" para ${usuario ? `${usuario.nome} (${usuario.role})` : "usuário sem login"}.`);
          return usuario
            ? { success: false, acessoNegado: true, error: "Você não tem permissão para esta ação. Solicite ao administrador." }
            : { success: false, sessaoExpirada: true, error: "Sua sessão terminou. Entre novamente." };
        }
        return handler(event, ...args);
      });
    };
  }

  return { pode, permissoesDe, restricaoOS, iniciarSessao, encerrarSessao, usuarioDe, protegerIpc, moduloLiberado, modulosLiberados };
}

module.exports = { criarControleAcesso, POLITICAS_IPC, PERFIS, PERMISSOES_PADRAO };
