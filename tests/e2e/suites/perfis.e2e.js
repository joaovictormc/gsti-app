// Permissões por perfil (Admin, Funcionário, Técnico).
const path = require("path");
const fs = require("fs");
const { executarSuite, RAIZ } = require("../lib/ambiente");

async function roteiro(ctx) {
  const { w, wc, api, sql, ok, espera, DB, BANCO, USERDATA, TMP, configPath, lerConfig, captura, capturas, recarregar, abrirMenu, entrar, criarAdmin, licenca, arquivos, abertos, dialogos, fase, recriarBanco } = ctx;

  const texto = () => wc.executeJavaScript("document.querySelector('main')?.innerText || document.body.innerText");
  w.setSize(1280, 800);

  // Migração em banco antigo (enum sem Tecnico)
  await sql("CREATE TYPE user_role_enum AS ENUM ('Admin', 'Funcionario')", [], `${BANCO}_antigo`);
  await sql("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'Tecnico'", [], `${BANCO}_antigo`);
  const valores = await sql("SELECT unnest(enum_range(NULL::user_role_enum))::text v", [], `${BANCO}_antigo`);
  ok(valores.map((x) => x.v).join(",") === "Admin,Funcionario,Tecnico", "migração adiciona Tecnico ao papel em banco antigo", valores);
  const main = fs.readFileSync(path.join(RAIZ, "main.js"), "utf8");
  ok(main.includes(`"ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'Tecnico'"`), "migração presente na lista do app");

  let r = await api(`saveInitialConfig(${JSON.stringify({
    dbConfig: DB,
    adminUser: { nome: "Admin Teste", email: "admin@teste.local", login: "admin", password: "Senha#123", confirmPassword: "Senha#123" },
  })})`);
  ok(r.success, "configuração inicial", r);
  await espera(3500);

  const admin = await entrar("admin");
  ok(admin.permissoes && admin.permissoes.podeExcluir && admin.permissoes.verCusto && !admin.permissoes.somenteOSAtribuidas, "admin com todas as permissões", admin.permissoes);
  r = await api(`addUser({ nome: "Fernanda Func", email: "func@teste.local", login: "func", password: "Senha#123", role: "Funcionario" })`);
  const funcId = r.id;
  r = await api(`addUser({ nome: "Carlos Técnico", email: "tec@teste.local", login: "tec", password: "Senha#123", role: "Tecnico" })`);
  ok(r.success, "admin cria usuário Técnico", r);
  const tecId = r.id;
  r = await api(`addUser({ nome: "X", email: "x@teste.local", login: "x", password: "Senha#123", role: "Gerente" })`);
  ok(!r.success, "papel desconhecido é recusado", r);

  // Dados: cliente, produto com custo, 3 OS
  const [cli] = await sql("INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, telefone) VALUES ('Cliente A', 'Física', '11122233344', '11999990000') RETURNING id");
  const [prod] = await sql("INSERT INTO produtos_servicos (descricao, valor, tipo, custo, estoque_atual) VALUES ('SSD 480GB', 250, 'Produto', 150, 10) RETURNING id");
  const novaOS = async (resp, serie) => {
    const res = await api(`addOS({ osData: { id_cliente: ${cli.id}, tipo_equipamento: "Notebook", marca: "Dell", modelo: "X", numero_serie: "${serie}", status: "Em Aberto", data_entrada: new Date().toISOString(), garantia_dias: 90, id_atendente: ${resp} }, total: 250 })`);
    await api(`addOSItems({ osId: ${res.osId}, items: [{ id: ${prod.id}, quantidade: 1, valor: 250, observacao: "", custo_unitario: 150 }] })`);
    return res.osId;
  };
  const osTec = await novaOS(tecId, "S-TEC");
  const osFunc = await novaOS(funcId, "S-FUNC");
  const osSem = await novaOS("null", "S-SEM");
  ok(osTec && osFunc && osSem, "admin cria 3 OS (técnico, funcionária, sem responsável)");

  // ---- Técnico (padrão: só OS atribuídas, consulta) ----
  const tec = await entrar("tec");
  ok(tec.role === "Tecnico" && tec.permissoes.somenteOSAtribuidas && !tec.permissoes.podeExcluir && !tec.permissoes.verCusto, "técnico recebe permissões padrão do perfil", tec.permissoes);
  r = await api("getOSList()");
  ok(Array.isArray(r) && r.length === 1 && r[0].id === osTec, "técnico lista só a OS dele", r);
  r = await api(`getOSDetails(${osFunc})`);
  ok(r.acessoNegado === true, "técnico não abre OS de outro responsável", r);
  r = await api(`getOSDetails(${osTec})`);
  ok(r.success && r.items.length === 1 && !("custo_unitario" in r.items[0]), "técnico abre a própria OS sem ver custo", r.items);
  const osAtualTec = (await api(`getOSDetails(${osTec})`)).os;
  r = await api(`updateOS(${JSON.stringify({ osData: { ...osAtualTec, laudo_tecnico: "Troca do SSD", id_atendente: funcId }, total: 250 })})`);
  ok(r.success, "técnico atualiza a própria OS", r);
  let [linha] = await sql("SELECT id_atendente, laudo_tecnico FROM ordens_servico WHERE id=$1", [osTec]);
  ok(linha.id_atendente === tecId && linha.laudo_tecnico === "Troca do SSD", "técnico não transfere a OS para outra pessoa", linha);
  r = await api(`updateOS({ osData: { id: ${osFunc}, id_cliente: ${cli.id}, status: "Em Andamento", data_entrada: new Date().toISOString() }, total: 0 })`);
  ok(r.acessoNegado === true, "técnico não altera OS de outro responsável", r);
  r = await api(`updateOSItems({ osId: ${osTec}, items: [{ id: ${prod.id}, quantidade: 2, valor: 240, observacao: "2 unidades" }] })`);
  ok(r.success, "técnico altera itens da própria OS", r);
  [linha] = await sql("SELECT quantidade, custo_unitario FROM os_itens WHERE id_os=$1", [osTec]);
  ok(linha.quantidade === 2 && Number(linha.custo_unitario) === 150, "custo gravado na venda é mantido quando o técnico edita itens", linha);
  r = await api(`updateOSItems({ osId: ${osFunc}, items: [] })`);
  ok(r.acessoNegado === true, "técnico não mexe nos itens de OS alheia", r);
  r = await api(`generateEntryReceipt(${osFunc})`);
  ok(r.acessoNegado === true, "técnico não gera PDF de OS alheia", r);
  r = await api(`getOSWhatsappMessage(${osFunc})`);
  ok(r.acessoNegado === true, "técnico não gera mensagem de WhatsApp de OS alheia", r);
  r = await api(`addOS({ osData: { id_cliente: ${cli.id}, tipo_equipamento: "Celular", status: "Orçamento", data_entrada: new Date().toISOString(), garantia_dias: 90, id_atendente: ${funcId} }, total: 0 })`);
  [linha] = await sql("SELECT id_atendente FROM ordens_servico WHERE id=$1", [r.osId]);
  ok(r.success && linha.id_atendente === tecId, "OS aberta pelo técnico fica com ele como responsável", linha);
  const osNovaTec = r.osId;
  for (const [expr, nome] of [
    [`deleteOS(${osTec})`, "excluir OS"], [`addProduct({ descricao: "X", valor: 1, tipo: "Serviço" })`, "cadastrar produto"],
    [`adjustStock({ productId: ${prod.id}, quantity: 1, operation: "entry" })`, "ajustar estoque"],
    [`addCustomer({ nome: "Novo", tipo_pessoa: "Física", cpf_cnpj: "99988877766" })`, "cadastrar cliente"],
    [`deleteCustomer(${cli.id})`, "excluir cliente"], ["getExpenses()", "Financeiro"], ["getOSByStatus('Em Aberto')", "Relatórios"],
    ["getUsers()", "usuários"],
  ]) {
    r = await api(expr);
    ok(r && r.acessoNegado === true, `técnico bloqueado: ${nome}`, r);
  }
  r = await api("getProducts()");
  ok(Array.isArray(r) && r.length === 1 && !("custo" in r[0]), "técnico consulta produtos sem custo", r);
  r = await api("getActiveData()");
  ok(r.success && r.products.every((p) => !("custo" in p)), "dados da OS sem custo para o técnico");
  r = await api("getCustomers()");
  ok(Array.isArray(r) && r.length === 1, "técnico consulta clientes");
  r = await api("getDashboardStats()");
  ok(r.success && r.counts.abertas === 2 && r.recentOS.every((o) => [osTec, osNovaTec].includes(o.id)) && r.financeiro === null, "tela inicial do técnico só com as OS dele", r.counts);
  const [equip] = await sql("SELECT id_equipamento FROM ordens_servico WHERE id=$1", [osFunc]);
  r = await api(`getEquipmentHistory(${equip.id_equipamento})`);
  ok(r.success && r.data.length === 0, "histórico de equipamento sem OS alheias", r);
  r = await api(`getCustomerTimeline(${cli.id})`);
  ok(r.success && r.os.every((o) => [osTec, osNovaTec].includes(o.id)) && r.stats.total_os === 2, "histórico do cliente só com as OS do técnico", r.stats);

  // Telas do técnico
  await recarregar();
  let t = await texto();
  await abrirMenu("Ordens de Serviço");
  t = await texto();
  ok(/Mostrando as OS em que você é o responsável/.test(t), "OS: aviso de filtro por responsável");
  const botoes = await wc.executeJavaScript(`({ excluir: document.querySelectorAll('[title="Excluir OS"]').length, editar: document.querySelectorAll('[title="Editar OS"]').length })`);
  ok(botoes.excluir === 0 && botoes.editar === 2, "OS do técnico sem botão Excluir", botoes);
  await captura("tecnico-os.png");
  await abrirMenu("Produtos/Serviços");
  t = await texto();
  ok(!/Adicionar Novo/.test(t) && !/Custo/.test(t) && !/Margem/.test(t), "Produtos do técnico: sem cadastrar, sem custo e margem");
  await captura("tecnico-produtos.png");
  const menu = await wc.executeJavaScript("document.querySelector('.MuiDrawer-paper').innerText");
  ok(!/Despesas|Relatórios|Configurações|Gerenciar Usuários/.test(menu), "menu do técnico sem Financeiro, Relatórios e administração");

  // ---- Funcionário (padrão: comportamento anterior) ----
  const func = await entrar("func");
  ok(func.permissoes.podeExcluir && func.permissoes.verCusto && !func.permissoes.somenteOSAtribuidas, "funcionário mantém permissões anteriores", func.permissoes);
  r = await api("getOSList()");
  ok(Array.isArray(r) && r.length === 4, "funcionário vê todas as OS", r.length);
  r = await api("getProducts()");
  ok(r[0].custo !== undefined, "funcionário vê custo");

  // ---- Admin ajusta a tabela de permissões ----
  await entrar("admin");
  r = await api(`saveAppSettings({ permissions: { funcionario: { podeExcluir: false, verCusto: false }, tecnico: { verCusto: true, canSeeReports: true } } })`);
  ok(r.success, "admin salva permissões por perfil", r);
  r = await api("getAppSettings()");
  const p = r.settings.permissions;
  ok(p.funcionario.podeExcluir === false && p.funcionario.editarProdutos === true && p.tecnico.verCusto === true && p.tecnico.somenteOSAtribuidas === true, "permissões gravadas e completadas com o padrão", p);

  // Captura da tabela
  await recarregar(4000);
  await abrirMenu("Configurações");
  const achou = await wc.executeJavaScript(`(() => { const h=[...document.querySelectorAll('h6')].find(e=>e.innerText.includes('Permissões por perfil')); if(!h) return false; h.scrollIntoView({block:'start'}); document.querySelector('main').scrollBy(0,-16); return true; })()`);
  ok(achou, "Configurações: seção Permissões por perfil");
  await espera(800);
  w.setSize(1280, 1050);
  await espera(800);
  await captura("config-permissoes.png");
  w.setSize(1280, 800);

  await entrar("func");
  r = await api(`deleteOS(${osSem})`);
  ok(r.acessoNegado === true, "funcionário sem 'Excluir' é bloqueado", r);
  r = await api(`updateProduct({ id: ${prod.id}, descricao: "SSD 480GB NVMe", valor: 260, tipo: "Produto", estoque_minimo: 2 })`);
  [linha] = await sql("SELECT descricao, custo FROM produtos_servicos WHERE id=$1", [prod.id]);
  ok(r.success && linha.descricao === "SSD 480GB NVMe" && Number(linha.custo) === 150, "funcionário sem 'Ver custo' edita produto sem apagar o custo", linha);
  r = await api("getProfitabilityReport()");
  ok(r.acessoNegado === true, "Lucratividade exige 'Ver custo'", r);

  await entrar("tec");
  r = await api("getProducts()");
  ok(r[0].custo !== undefined, "técnico com 'Ver custo' liberado passa a ver custo");
  r = await api("getOSByStatus('Em Aberto')");
  ok(!r.acessoNegado, "técnico com Relatórios liberado acessa relatório", r);
  r = await api(`updateProduct({ id: ${prod.id}, descricao: "Y", valor: 1, tipo: "Produto" })`);
  ok(r.acessoNegado === true, "técnico continua sem editar produtos", r);

  // Admin não pode ser afetado
  await entrar("admin");
  r = await api(`deleteOS(${osSem})`);
  ok(r.success, "admin continua excluindo", r);
  await api("logout()");
}

// Banco extra com o enum antigo (sem Tecnico) para testar a migração do papel
async function prepararBancoAntigo({ sql, BANCO }) {
  await sql(`DROP DATABASE IF EXISTS ${BANCO}_antigo`, [], "postgres");
  await sql(`CREATE DATABASE ${BANCO}_antigo`, [], "postgres");
}

async function roteiroComLimpeza(ctx) {
  try {
    await roteiro(ctx);
  } finally {
    await ctx.sql(`DROP DATABASE IF EXISTS ${ctx.BANCO}_antigo`, [], "postgres").catch(() => {});
  }
}

executarSuite({ nome: "perfis", roteiro: roteiroComLimpeza, preparar: prepararBancoAntigo });
