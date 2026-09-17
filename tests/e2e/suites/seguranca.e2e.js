// Segurança: permissões no processo principal, senhas cifradas e schema automático.
// Fases (rodadas em sequência pelo rodar.js): principal | migracao | corrompida
const path = require("path");
const fs = require("fs");
const { executarSuite, RAIZ } = require("../lib/ambiente");

const fase = process.argv[process.argv.length - 1];

async function preparar(ctx) {
  const { lerConfig, configPath, recriarBanco, DB } = ctx;

  if (fase === "principal") {
    await recriarBanco(true);
  } else if (fase === "migracao") {
    // Simula config antiga: senha em texto puro
    const cfg = lerConfig();
    delete cfg.database.passwordCifrada;
    cfg.database.password = DB.password;
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  } else if (fase === "corrompida") {
    // Simula config copiada de outro usuário do Windows
    const cfg = lerConfig();
    cfg.database.passwordCifrada = Buffer.from("lixo de outro computador").toString("base64");
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  }
}

async function roteiro(ctx) {
  const { w, wc, api, sql, ok, espera, DB, BANCO, USERDATA, TMP, configPath, lerConfig, captura, capturas, recarregar, abrirMenu, entrar, criarAdmin, licenca, arquivos, abertos, dialogos, fase, recriarBanco } = ctx;

  if (fase === "principal") {
    ok(await api("isInitialSetupNeeded()") === true, "instalação nova pede configuração inicial");
    let r = await api("getCustomers()");
    ok(r.sessaoExpirada === true, "sem login não lista clientes", r);
    r = await api(`testDbConnection(${JSON.stringify(DB)})`);
    ok(r.success, "durante o setup o teste de conexão é liberado", r);

    r = await api(`saveInitialConfig(${JSON.stringify({
      dbConfig: DB,
      adminUser: { nome: "Admin Teste", email: "admin@teste.local", login: "admin", password: "Senha#123", confirmPassword: "Senha#123" },
    })})`);
    ok(r.success, "setup em banco VAZIO cria as tabelas e o admin", r);
    const tabelas = await sql("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'");
    ok(tabelas[0].n >= 9, `schema criado (${tabelas[0].n} tabelas)`);
    const disco = lerConfig();
    ok(disco.database.passwordCifrada && disco.database.password === undefined, "senha do banco gravada cifrada no config.json");
    ok(!fs.readFileSync(configPath, "utf8").includes(DB.password), "texto da senha não aparece no arquivo");
    await espera(4000); // migrações assíncronas

    r = await api(`testDbConnection(${JSON.stringify(DB)})`);
    ok(r.sessaoExpirada === true, "após o setup, teste de conexão exige login de Admin", r);
    r = await api(`saveInitialConfig(${JSON.stringify({ dbConfig: DB, adminUser: {} })})`);
    ok(r.success === false && r.sessaoExpirada, "após o setup, não dá para refazer a configuração sem login", r);
    r = await api("getAppSettings()");
    ok(r.success && r.settings.branding && !r.settings.email && !r.settings.database, "sem login, configurações só com marca/permissões", Object.keys(r.settings || {}));

    r = await api(`login({ login: "ADMIN ", password: "Senha#123" })`);
    ok(r.success && r.user.role === "Admin", "login do admin", r);
    r = await api("getCurrentSession()");
    ok(r.user && r.user.role === "Admin", "sessão registrada no processo principal", r);
    const adminId = r.user.id;
    r = await api("getAppSettings()");
    ok(r.settings.email && r.settings.database && r.settings.database.password === undefined, "admin recebe configurações completas (sem senhas)");

    r = await api(`addUser({ nome: "Func Teste", email: "func@teste.local", login: "func", password: "Senha#123", role: "Funcionario" })`);
    ok(r.success, "admin cria funcionário", r);
    const funcId = r.id;
    r = await api("getUsers()");
    ok(r.success && r.data.some((u) => u.email), "admin lista usuários com e-mail", r);
    r = await api(`deleteUser(${adminId})`);
    ok(!r.success && /próprio/.test(r.error), "admin não exclui a si mesmo", r);
    r = await api(`updateUser({ id: ${adminId}, nome: "Admin Teste", email: "admin@teste.local", login: "admin", role: "Funcionario" })`);
    ok(!r.success && /próprio/.test(r.error), "admin não rebaixa a si mesmo", r);

    // OS: histórico usa o usuário da sessão, não o id enviado pela tela
    const [cli] = await sql("INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj) VALUES ('Cliente', 'Física', '11122233344') RETURNING id");
    r = await api(`addOS({ osData: { id_cliente: ${cli.id}, tipo_equipamento: "Notebook", marca: "Dell", modelo: "X", status: "Em Aberto", data_entrada: new Date().toISOString(), garantia_dias: 90 }, total: 0, usuarioId: 999999 })`);
    ok(r.success, "admin cria OS", r);
    const hist = await sql("SELECT id_usuario FROM os_status_historico WHERE id_os=$1", [r.osId]);
    ok(hist[0] && hist[0].id_usuario === adminId, "histórico de status registra o usuário da sessão", hist);
    r = await api("getDashboardStats()");
    ok(r.success && r.financeiro && typeof r.financeiro.lucro_mes === "number", "admin vê valores financeiros na tela inicial", r.financeiro);

    await api("logout()");
    r = await api("getCurrentSession()");
    ok(r.user === null, "logout encerra a sessão", r);

    // Funcionário sem permissões extras
    r = await api(`login({ login: "func", password: "Senha#123" })`);
    ok(r.success && r.user.role === "Funcionario", "login do funcionário", r);
    r = await api("getCustomers()");
    ok(Array.isArray(r) && r.length === 1, "funcionário lista clientes", r);
    for (const [expr, nome] of [
      ["getExpenses()", "despesas"], ["getUsers()", "usuários"], ["saveAppSettings({})", "salvar configurações"],
      ["deleteUser(" + adminId + ")", "excluir usuário"], ["backupDatabase()", "backup"],
      ["getOSByStatus({})", "relatório por status"], ["getFinancialGoals()", "metas financeiras"],
    ]) {
      r = await api(expr);
      ok(r && r.acessoNegado === true, `funcionário bloqueado em ${nome}`, r);
    }
    r = await api("getDashboardStats()");
    ok(r.success && r.financeiro === null && r.counts, "funcionário sem Financeiro não recebe valores na tela inicial", r.financeiro);
    r = await api("getAppSettings()");
    ok(r.success && !r.settings.email && r.settings.permissions, "funcionário recebe só marca/permissões", Object.keys(r.settings));

    // Tela inicial do funcionário (captura para conferência visual)
    wc.reload();
    await new Promise((res) => wc.once("did-finish-load", res));
    await espera(3500);
    r = await api("getCurrentSession()");
    ok(r.user && r.user.id === funcId, "recarregar a janela mantém a sessão", r);
    const texto = await wc.executeJavaScript("document.body.innerText");
    ok(/Func/.test(texto) && !/Lucro do Mês/.test(texto) && !/Resumo Financeiro do Mês/.test(texto), "tela inicial do funcionário sem lucro/resumo financeiro");
    wc.getOwnerBrowserWindow().setSize(1280, 800);
    await captura("home-funcionario.png");

    // Admin libera Financeiro e o funcionário passa a acessar
    await api("logout()");
    await api(`login({ login: "admin", password: "Senha#123" })`);
    r = await api(`saveAppSettings({ permissions: { funcionario: { canSeeFinancial: true } } })`);
    ok(r.success, "admin libera Financeiro para funcionário", r);
    await api("logout()");
    await api(`login({ login: "func", password: "Senha#123" })`);
    r = await api("getExpenses()");
    ok(Array.isArray(r), "com a permissão, funcionário acessa despesas", r);
    r = await api("getDashboardStats()");
    ok(r.financeiro !== null, "com a permissão, tela inicial mostra valores", r.financeiro);
    r = await api("getOSByStatus({})");
    ok(r.acessoNegado === true, "Relatórios continuam bloqueados", r);
    await api("logout()");

    // Código de redefinição: 5 erros invalidam os códigos pendentes
    await sql("UPDATE usuarios SET reset_token='$2a$10$abcdefghijklmnopqrstuuWz0W3P1vQxT7m3m7m3m7m3m7m3m7m3m', reset_token_expiry=NOW() + interval '10 minutes' WHERE login='func'");
    for (let i = 1; i <= 5; i++) {
      r = await api(`resetPassword({ token: "00000${i}", password: "x", confirmPassword: "x" })`);
    }
    ok(/Muitas tentativas/.test(r.error), "5ª tentativa errada bloqueia", r);
    const [tok] = await sql("SELECT reset_token FROM usuarios WHERE login='func'");
    ok(tok.reset_token === null, "códigos pendentes invalidados", tok);
  }

  if (fase === "migracao") {
    const disco = lerConfig();
    ok(disco.database.passwordCifrada && disco.database.password === undefined, "config antiga (texto puro) migrada para cifrada ao abrir");
    ok(await api("isInitialSetupNeeded()") === false, "setup continua concluído após a migração");
    const r = await api(`login({ login: "admin", password: "Senha#123" })`);
    ok(r.success, "banco conecta com a senha decifrada", r);
  }

  if (fase === "corrompida") {
    ok(dialogos.length === 1, "avisa que a senha salva não pôde ser lida", dialogos);
    ok(await api("isInitialSetupNeeded()") === true, "volta para a configuração inicial");
    let r = await api(`saveInitialConfigExistingUser(${JSON.stringify({ dbConfig: DB, login: "admin", password: "Senha#123" })})`);
    ok(r.success && r.user.role === "Admin", "\"Já tenho cadastro\" reconecta e já deixa logado", r);
    r = await api("getUsers()");
    ok(r.success, "sessão ativa após reconectar", r);
    ok(lerConfig().database.passwordCifrada, "nova senha gravada cifrada");
    await recriarBanco(false);
  }
}

executarSuite({
  nome: "seguranca",
  fase,
  roteiro,
  preparar,
  manterDados: fase !== "principal",
  criarBanco: false,
  removerBanco: false,
});
