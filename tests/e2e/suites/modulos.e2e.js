// Venda por módulos: plano só com a base, depois com todos os módulos.
const path = require("path");
const { executarSuite, RAIZ } = require("../lib/ambiente");

async function roteiro(ctx) {
  const { wc, api, sql, ok, espera, licenca, entrar, criarAdmin, recarregar, abrirMenu, captura, lerConfig } = ctx;
  const texto = () => wc.executeJavaScript("document.body.innerText");

  // Plano só com a base
  licenca.modulos = [];
  ok((await criarAdmin()).success, "configuração inicial");
  const admin = await entrar("admin");
  ok(Array.isArray(admin.modulos) && admin.modulos.length === 0, "sessão informa os módulos do plano (só a base)", admin.modulos);
  ok(admin.permissoes.canSeeFinancial === false && admin.permissoes.canSeeReports === false && admin.permissoes.ajustarEstoque === false, "permissões do Admin respeitam os módulos", admin.permissoes);

  for (const [expr, modulo] of [
    ["getExpenses()", "financeiro"],
    ["getFinancialGoals()", "financeiro"],
    ["getOSByStatus('Em Aberto')", "relatorios"],
    ["getStock()", "estoque"],
    [`adjustStock({ productId: 1, quantity: 1, operation: "entry" })`, "estoque"],
    ["selectLogoFile()", "marca"],
    ["selectBackupFolder()", "automacoes"],
  ]) {
    const r = await api(expr);
    ok(r && r.moduloBloqueado === true && r.modulo === modulo, `sem o módulo ${modulo}: ${expr.split("(")[0]} bloqueado`, r);
  }
  let r = await api("getCustomers()");
  ok(Array.isArray(r), "base continua liberada (clientes)");
  r = await api("getDashboardStats()");
  ok(r.success && r.financeiro === null, "tela inicial sem valores financeiros");

  r = await api(`addUser({ nome: "Carlos", email: "tec@teste.local", login: "tec", password: "Senha#123", role: "Tecnico" })`);
  ok(!r.success && r.moduloBloqueado && r.modulo === "perfis", "perfil Técnico exige o módulo perfis", r);
  r = await api(`addUser({ nome: "Fernanda", email: "func@teste.local", login: "func", password: "Senha#123", role: "Funcionario" })`);
  ok(r.success, "Funcionário é da base", r);

  r = await api(`saveAppSettings(${JSON.stringify({
    branding: { companyName: "Assistência Base", loginSubtitulo: "Não deve salvar", creditoExibir: false },
    emailNotifications: { notifyOnCreate: true, technicianEmail: "x@teste.local" },
    autoBackup: { enabled: true, destinationPath: "C:\\\\backup" },
    permissions: { funcionario: { canSeeFinancial: true } },
  })})`);
  ok(r.success, "salvar configurações com seções de módulos não contratados", r);
  const cfg = lerConfig();
  ok(cfg.branding.companyName === "Assistência Base" && cfg.branding.loginSubtitulo !== "Não deve salvar" && cfg.branding.creditoExibir !== false, "nome da empresa salvo; resto da marca ignorado", cfg.branding);
  ok(!cfg.emailNotifications.notifyOnCreate && !cfg.autoBackup.enabled, "automações não são ativadas sem o módulo", { e: cfg.emailNotifications, b: cfg.autoBackup });
  ok(!cfg.permissions?.funcionario?.canSeeFinancial, "tabela de permissões não é alterada sem o módulo", cfg.permissions);
  r = await api("getAppSettings()");
  ok(r.brandingAtivo.companyName === "Assistência Base" && r.brandingAtivo.creditoExibir === true, "marca ativa usa o padrão + nome da empresa", r.brandingAtivo);

  // Interface: menu com cadeado e tela de módulo bloqueado
  await recarregar(4000);
  const menu = await wc.executeJavaScript("document.querySelector('.MuiDrawer-paper').innerText");
  ok(/Financeiro/.test(menu) && /Relatórios/.test(menu) && /Estoque/.test(menu) && !/Despesas|Resumo Financeiro/.test(menu), "menu do Admin mostra os módulos não contratados com cadeado", menu);
  await abrirMenu("Financeiro");
  let t = await texto();
  ok(/Financeiro completo/.test(t) && /não está incluído no seu plano/.test(t) && /Ver planos/.test(t), "tela de módulo não incluído");
  await captura("modulo-bloqueado.png");
  await abrirMenu("Configurações");
  t = await texto();
  ok(/Personalização da marca — /.test(t) && /Perfis e permissões avançadas — /.test(t) && /Automações — /.test(t), "Configurações mostram os avisos dos módulos");
  await captura("config-sem-modulos.png");

  // Funcionário: não vê itens com cadeado
  await entrar("func");
  await recarregar(4000);
  const menuFunc = await wc.executeJavaScript("document.querySelector('.MuiDrawer-paper').innerText");
  ok(!/Financeiro|Relatórios|Estoque/.test(menuFunc), "funcionário não vê módulos não contratados", menuFunc);

  // Licença com todos os módulos (ex.: upgrade no painel e revalidação)
  licenca.modulos = ["financeiro", "relatorios", "estoque", "perfis", "marca", "automacoes"];
  const admin2 = await entrar("admin");
  ok(admin2.permissoes.canSeeFinancial && admin2.modulos.length === 6, "após o upgrade, a sessão traz os módulos", admin2.modulos);
  r = await api("getExpenses()");
  ok(Array.isArray(r), "financeiro liberado após o upgrade", r);
  r = await api(`addUser({ nome: "Carlos", email: "tec@teste.local", login: "tec", password: "Senha#123", role: "Tecnico" })`);
  ok(r.success, "perfil Técnico liberado com o módulo", r);
  r = await api(`saveAppSettings({ branding: { loginSubtitulo: "Agora salva" } })`);
  ok(lerConfig().branding.loginSubtitulo === "Agora salva", "marca salva com o módulo");
  await recarregar(4000);
  const menuCompleto = await wc.executeJavaScript("document.querySelector('.MuiDrawer-paper').innerText");
  ok(/Despesas/.test(menuCompleto) && /Resumo Financeiro/.test(menuCompleto), "menu completo com os módulos");

  // Token antigo (sem lista de módulos) libera todos
  delete licenca.modulos;
  const admin3 = await entrar("admin");
  ok(admin3.modulos === null && admin3.permissoes.canSeeReports, "token sem lista de módulos libera todos", admin3.modulos);
}

executarSuite({ nome: "modulos", roteiro });
