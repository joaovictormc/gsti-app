// Controle de acesso das chamadas IPC.
// O processo principal guarda quem fez login em cada janela e cada canal declara
// quem pode chamá-lo. Assim a regra não depende só do que a interface esconde:
// uma chamada feita pelo console do renderer passa pela mesma verificação.

// Níveis de acesso:
//   publico     — sem login (tela de login, ativação da licença)
//   setup       — sem login só enquanto a configuração inicial não foi concluída; depois, Admin
//   sessao      — qualquer usuário logado
//   admin       — somente Admin
//   financeiro  — Admin ou Funcionário com "Financeiro" liberado em Configurações
//   relatorios  — Admin ou Funcionário com "Relatórios" liberado em Configurações
// Um canal pode aceitar mais de um nível (lista): basta atender a um deles.
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
  "add-customer": "sessao",
  "update-customer": "sessao",
  "delete-customer": "sessao",
  "get-customer-timeline": "sessao",
  "get-equipments": "sessao",
  "add-equipment": "sessao",
  "update-equipment": "sessao",
  "delete-equipment": "sessao",
  "get-equipment-history": "sessao",
  "get-products": "sessao",
  "add-product": "sessao",
  "update-product": "sessao",
  "delete-product": "sessao",
  "get-os-list": "sessao",
  "get-active-data": "sessao",
  "get-os-details": "sessao",
  "add-os": "sessao",
  "update-os": "sessao",
  "add-os-items": "sessao",
  "update-os-items": "sessao",
  "delete-os": "sessao",
  "generate-entry-receipt": "sessao",
  "generate-exit-receipt": "sessao",
  "get-os-whatsapp-message": "sessao",
  "open-whatsapp-link": "sessao",
  "get-dashboard-stats": "sessao", // valores financeiros só com permissão (filtrado no handler)
  "get-os-agenda": "sessao",
  "get-stock": "sessao",
  "adjust-stock": "sessao",
  "update-stock-min": "sessao",
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
  "get-profitability-report": "relatorios",
  "search-os-by-serial": "relatorios",
  "get-detailed-revenue-report": "relatorios",
};

const NIVEIS = new Set(["publico", "setup", "sessao", "admin", "financeiro", "relatorios"]);

function criarControleAcesso({ obterConfig, politicas = POLITICAS_IPC }) {
  const sessoes = new Map(); // id do webContents -> { id, nome, role }

  for (const [canal, nivel] of Object.entries(politicas)) {
    for (const n of [].concat(nivel)) {
      if (!NIVEIS.has(n)) throw new Error(`Nível de acesso desconhecido "${n}" no canal "${canal}".`);
    }
  }

  function pode(usuario, nivel) {
    return [].concat(nivel).some((n) => {
      if (n === "publico") return true;
      if (n === "setup" && !obterConfig()?.setupComplete) return true;
      if (!usuario) return false;
      if (usuario.role === "Admin") return true;
      const perms = obterConfig()?.permissions?.funcionario || {};
      if (n === "sessao") return true;
      if (n === "financeiro") return !!perms.canSeeFinancial;
      if (n === "relatorios") return !!perms.canSeeReports;
      return false;
    });
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

  return { pode, iniciarSessao, encerrarSessao, usuarioDe, protegerIpc };
}

module.exports = { criarControleAcesso, POLITICAS_IPC };
