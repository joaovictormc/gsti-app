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
// "Só OS atribuídas" (somenteOSAtribuidas) não é um nível: é aplicado nos handlers de OS.
// Um canal pode aceitar mais de um nível (lista): basta atender a um deles.

// Perfis configuráveis (chave usada em config.permissions)
const PERFIS = { Funcionario: "funcionario", Tecnico: "tecnico" };

// Permissões de cada perfil quando ainda não foram ajustadas em Configurações.
// Funcionário mantém o comportamento anterior; Técnico começa restrito às OS dele.
const PERMISSOES_PADRAO = {
  funcionario: {
    somenteOSAtribuidas: false, podeExcluir: true, verCusto: true, editarProdutos: true,
    ajustarEstoque: true, editarCadastros: true, canSeeFinancial: false, canSeeReports: false,
  },
  tecnico: {
    somenteOSAtribuidas: true, podeExcluir: false, verCusto: false, editarProdutos: false,
    ajustarEstoque: false, editarCadastros: false, canSeeFinancial: false, canSeeReports: false,
  },
};

const PERMISSOES_ADMIN = {
  somenteOSAtribuidas: false, podeExcluir: true, verCusto: true, editarProdutos: true,
  ajustarEstoque: true, editarCadastros: true, canSeeFinancial: true, canSeeReports: true,
};

const NIVEL_PERMISSAO = {
  financeiro: "canSeeFinancial", relatorios: "canSeeReports", excluir: "podeExcluir",
  custo: "verCusto", produtos: "editarProdutos", estoque: "ajustarEstoque", cadastros: "editarCadastros",
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

function criarControleAcesso({ obterConfig, politicas = POLITICAS_IPC }) {
  const sessoes = new Map(); // id do webContents -> { id, nome, role }

  for (const [canal, nivel] of Object.entries(politicas)) {
    for (const n of [].concat(nivel)) {
      if (!NIVEIS.has(n)) throw new Error(`Nível de acesso desconhecido "${n}" no canal "${canal}".`);
    }
  }

  // Permissões efetivas do usuário (padrão do perfil + ajustes salvos em Configurações)
  function permissoesDe(usuario) {
    if (!usuario) return null;
    if (usuario.role === "Admin") return { ...PERMISSOES_ADMIN };
    const perfil = PERFIS[usuario.role];
    if (!perfil) return { ...PERMISSOES_PADRAO.tecnico }; // papel desconhecido: o mais restrito
    return { ...PERMISSOES_PADRAO[perfil], ...(obterConfig()?.permissions?.[perfil] || {}) };
  }

  function pode(usuario, nivel) {
    return [].concat(nivel).some((n) => {
      if (n === "publico") return true;
      if (n === "setup" && !obterConfig()?.setupComplete) return true;
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
      return registrar(canal, async (event, ...args) => {
        const usuario = usuarioDe(event);
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

  return { pode, permissoesDe, restricaoOS, iniciarSessao, encerrarSessao, usuarioDe, protegerIpc };
}

module.exports = { criarControleAcesso, POLITICAS_IPC, PERFIS, PERMISSOES_PADRAO };
