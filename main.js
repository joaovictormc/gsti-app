const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { Pool } = require("pg");
const axios = require("axios");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer"); // <-- Importa nodemailer
const crypto = require("crypto"); // <-- Módulo Node.js para gerar tokens

const isDev = process.env.NODE_ENV !== "production";
const saltRounds = 10;

// Converte placeholders ? para $1, $2, ... compatíveis com pg
function pgQuery(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// --- GERENCIAMENTO DE CONFIGURAÇÃO ---
const userDataPath = app.getPath("userData"); // Pasta de dados do usuário
const configPath = path.join(userDataPath, "config.json"); // Caminho completo do arquivo

let appConfig = null; // Variável global para guardar a configuração carregada
let dbPool = null; // Pool do DB será inicializado depois de carregar config
let mailTransporter = null; // Transporter do email será inicializado depois

// Estrutura padrão da configuração
const defaultConfig = {
  database: {
    host: "localhost",
    port: 5432,
    database: "gsti_db",
    user: "",
    password: "",
  },
  email: {
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    from: "",
  },
  branding: { companyName: "GSTI App", logoPath: null },
  setupComplete: false,
};

// Função para carregar a configuração
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      console.log(`[Config] Lendo configuração de: ${configPath}`);
      const rawData = fs.readFileSync(configPath);
      appConfig = JSON.parse(rawData);
      // Mescla com o padrão para garantir que todos os campos existam
      appConfig = { ...defaultConfig, ...appConfig };
      console.log("[Config] Configuração carregada:", appConfig);
    } else {
      console.log(
        "[Config] Arquivo de configuração não encontrado. Usando padrão e marcando setup como incompleto."
      );
      appConfig = { ...defaultConfig, setupComplete: false };
      // Salva o arquivo padrão na primeira vez
      fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
      console.log(`[Config] Arquivo padrão salvo em: ${configPath}`);
    }
  } catch (error) {
    console.error("[Config] Erro ao carregar/salvar configuração:", error);
    // Em caso de erro grave na leitura, força o setup
    appConfig = { ...defaultConfig, setupComplete: false };
    dialog.showErrorBox(
      "Erro de Configuração",
      `Não foi possível carregar ou criar o arquivo de configuração (${configPath}). Verifique as permissões da pasta. O aplicativo pode não funcionar corretamente.\n\nErro: ${error.message}`
    );
  }
}

// Função para inicializar o Pool do DB (só chamada após carregar config)
function initializeDbPool() {
  if (appConfig && appConfig.setupComplete && appConfig.database.user) {
    // Só inicializa se setup completo e user definido
    console.log("[DB] Inicializando pool de conexão...");
    try {
      dbPool = new Pool({
        host: appConfig.database.host,
        port: appConfig.database.port,
        user: appConfig.database.user,
        password: appConfig.database.password,
        database: appConfig.database.database,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      console.log("[DB] Pool de conexão inicializado com sucesso.");
      // Teste de conexão opcional aqui
    } catch (error) {
      console.error("[DB] Erro ao inicializar pool de conexão:", error);
      dbPool = null; // Garante que o pool não seja usado se falhar
      dialog.showErrorBox(
        "Erro de Banco de Dados",
        `Não foi possível conectar ao banco de dados com as configurações fornecidas. Verifique as configurações.\n\nErro: ${error.message}`
      );
    }
  } else {
    console.log(
      "[DB] Pool de conexão não inicializado (setup incompleto ou usuário não definido)."
    );
    dbPool = null;
  }
}

// Função para inicializar o Nodemailer (só chamada após carregar config)
function initializeMailTransporter() {
  if (
    appConfig &&
    appConfig.email.user &&
    appConfig.email.pass &&
    appConfig.email.host
  ) {
    // Só inicializa se configurado
    console.log("[Email] Inicializando transporter...");
    try {
      mailTransporter = nodemailer.createTransport({
        host: appConfig.email.host,
        port: appConfig.email.port,
        secure: appConfig.email.secure,
        auth: {
          user: appConfig.email.user,
          pass: appConfig.email.pass,
        },
      });
      // Verifica conexão
      mailTransporter.verify((error, success) => {
        if (error)
          console.error("[Email] Erro ao conectar ao servidor SMTP:", error);
        else console.log("[Email] Servidor SMTP conectado com sucesso.");
      });
    } catch (error) {
      console.error("[Email] Erro ao criar transporter:", error);
      mailTransporter = null;
    }
  } else {
    console.log(
      "[Email] Transporter não inicializado (configurações ausentes)."
    );
    mailTransporter = null;
  }
}

// --- CARREGA A CONFIGURAÇÃO AO INICIAR ---
loadConfig();
// --- INICIALIZA OS SERVIÇOS QUE DEPENDEM DA CONFIG ---
// O dbPool e mailTransporter só serão realmente criados se setupComplete for true
initializeDbPool();
initializeMailTransporter();
// --- FIM GERENCIAMENTO DE CONFIGURAÇÃO ---

// --- FUNÇÕES DE FORMATAÇÃO (Definidas globalmente no módulo) ---
const formatDocument = (doc) => {
  if (doc === null || doc === undefined) return "";
  const cleaned = String(doc).replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (cleaned.length === 14)
    return cleaned.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  return String(doc);
};

const formatPhone = (phone) => {
  if (phone === null || phone === undefined) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return String(phone);
};

// --- HANDLERS IPC ---

// Handler para testar a conexão com o banco de dados
ipcMain.handle("test-db-connection", async (event, dbConfig) => {
  console.log("[Setup] Testando conexão com o BD:", dbConfig);
  let tempPool = null;
  try {
    tempPool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      max: 1,
      connectionTimeoutMillis: 10000,
    });
    await tempPool.query("SELECT 1");
    console.log("[Setup] Conexão com BD testada com sucesso.");
    await tempPool.end();
    return { success: true };
  } catch (error) {
    console.error("[Setup] Erro ao testar conexão com BD:", error);
    if (tempPool) { try { await tempPool.end(); } catch (_) {} }
    let errorMessage = "Erro desconhecido.";
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED")
      errorMessage = "Não foi possível conectar ao Host/Porta especificados.";
    else if (error.code === "28P01")
      errorMessage = "Usuário ou Senha do banco inválidos.";
    else if (error.code === "3D000")
      errorMessage = "Banco de dados não encontrado.";
    else errorMessage = error.message;
    return { success: false, error: errorMessage };
  }
});

// Handler para salvar a configuração inicial e criar o primeiro admin
ipcMain.handle(
  "save-initial-config",
  async (event, { dbConfig, adminUser }) => {
    console.log("[Setup] Salvando configuração inicial e criando admin...");

    // --- Validações ---
    if (
      !dbConfig.host ||
      !dbConfig.port ||
      !dbConfig.database ||
      !dbConfig.user /* Não valida senha vazia aqui */
    ) {
      return {
        success: false,
        error: "Todos os campos de configuração do banco são obrigatórios.",
      };
    }
    if (
      !adminUser.nome ||
      !adminUser.email ||
      !adminUser.login ||
      !adminUser.password ||
      !adminUser.confirmPassword
    ) {
      return {
        success: false,
        error: "Todos os campos do administrador são obrigatórios.",
      };
    }
    if (adminUser.password !== adminUser.confirmPassword) {
      return {
        success: false,
        error: "As senhas do administrador não coincidem.",
      };
    }
    // TODO: Adicionar validação de complexidade de senha e formato de email

    let tempPool = null; // Pool temporário para criar o usuário
    try {
      // 1. Salva a configuração do DB no config.json
      console.log("[Setup] Salvando config.json...");
      appConfig.database = {
        // Atualiza SÓ a seção database
        host: dbConfig.host,
        port: parseInt(dbConfig.port, 10) || 5432,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password, // Salva a senha aqui
      };
      appConfig.setupComplete = true; // Marca setup como completo
      // Mantém as outras configs (email, branding) com os defaults
      fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
      console.log("[Setup] config.json salvo com setupComplete=true.");

      // 2. Tenta conectar ao banco recém-configurado para criar o admin
      console.log("[Setup] Criando pool temporário para inserir admin...");
      tempPool = new Pool({ ...appConfig.database, max: 1, connectionTimeoutMillis: 10000 });
      await tempPool.query("SELECT 1"); // Testa conexão
      console.log("[Setup] Conectado ao banco para criar admin.");

      // 3. Hashea a senha do admin
      const hashedPassword = await bcrypt.hash(adminUser.password, saltRounds);

      // 4. Insere o admin na tabela usuarios
      const sql = pgQuery(
        "INSERT INTO usuarios (nome, email, login, senha, role) VALUES (?, ?, ?, ?, 'Admin')"
      );
      await tempPool.query(sql, [
        adminUser.nome,
        adminUser.email,
        adminUser.login,
        hashedPassword,
      ]);
      console.log("[Setup] Usuário admin criado com sucesso.");

      await tempPool.end();

      // 5. Re-inicializa o dbPool global principal agora que a config está salva
      console.log("[Setup] Re-inicializando dbPool global...");
      initializeDbPool(); // Tenta inicializar o pool principal
      initializeMailTransporter(); // Tenta inicializar o mailer (pode não ter config ainda)

      return { success: true };
    } catch (error) {
      console.error(
        "[Setup] Erro ao salvar configuração inicial ou criar admin:",
        error
      );
      if (tempPool) await tempPool.end();

      // Se falhou, reverte setupComplete para false no arquivo
      try {
        appConfig.setupComplete = false;
        fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
        console.log(
          "[Setup] Revertido setupComplete para false devido a erro."
        );
      } catch (writeError) {
        console.error(
          "[Setup] Erro crítico ao tentar reverter config.json:",
          writeError
        );
      }
      // Limpa o dbPool global se a inicialização falhou
      dbPool = null;

      // Retorna erro específico
      let errorMessage = "Erro desconhecido.";
      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED")
        errorMessage = "Não foi possível conectar ao Host/Porta do banco.";
      else if (error.code === "28P01")
        errorMessage = "Usuário ou Senha do banco inválidos.";
      else if (error.code === "3D000")
        errorMessage = "Banco de dados não encontrado.";
      else if (error.code === "23505") {
        if (error.constraint && error.constraint.includes("login"))
          errorMessage = "O Login do admin já existe no banco.";
        else if (error.constraint && error.constraint.includes("email"))
          errorMessage = "O Email do admin já existe no banco.";
        else errorMessage = "Erro de duplicidade ao criar admin.";
      } else errorMessage = error.message;

      return {
        success: false,
        error: `Falha na configuração: ${errorMessage}`,
      };
    }
  }
);

// Handler para verificar se o setup inicial é necessário
ipcMain.handle("is-initial-setup-needed", async () => {
  return !appConfig.setupComplete;
});

// Handler para buscar as configurações atuais (para a tela de Settings)
ipcMain.handle("get-app-settings", async () => {
  // Retorna uma cópia, excluindo senhas por segurança se necessário
  const settingsToSend = JSON.parse(JSON.stringify(appConfig));
  if (settingsToSend.database) delete settingsToSend.database.password; // Não envia senha do DB
  if (settingsToSend.email) delete settingsToSend.email.pass; // Não envia senha do Email
  return { success: true, settings: settingsToSend };
});

// Handler para salvar as configurações (da tela de Settings)
ipcMain.handle("save-app-settings", async (event, newSettings) => {
  // TODO: Adicionar verificação de Admin
  console.log(
    "[Config] Recebido pedido para salvar configurações:",
    newSettings
  );
  try {
    // Mescla as novas configurações com as existentes (preserva DB config, setupComplete)
    const currentDbConfig = appConfig.database;
    const currentSetupStatus = appConfig.setupComplete;

    appConfig = {
      ...appConfig, // Mantém a base
      email: { ...appConfig.email, ...newSettings.email }, // Atualiza email
      branding: { ...appConfig.branding, ...newSettings.branding }, // Atualiza branding
      database: currentDbConfig, // Mantém config do DB
      setupComplete: currentSetupStatus, // Mantém status do setup
    };

    // Salva no arquivo
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
    console.log("[Config] Configurações salvas com sucesso.");

    // Re-inicializa o mail transporter com as novas configurações
    initializeMailTransporter();

    return { success: true };
  } catch (error) {
    console.error("[Config] Erro ao salvar configurações:", error);
    return {
      success: false,
      error: "Erro ao salvar o arquivo de configuração.",
    };
  }
});

// --- AUTENTICAÇÃO E USUÁRIOS ---

// Listener para Login
ipcMain.handle("handle-login", async (event, { login, password }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  if (!login || !password) {
    return { success: false, error: "Login e senha são obrigatórios." };
  }
  try {
    const sql = pgQuery("SELECT id, nome, senha, role FROM usuarios WHERE login = ?");
    const { rows } = await dbPool.query(sql, [login]);

    if (rows.length === 0) {
      return { success: false, error: "Usuário não encontrado." };
    }

    const user = rows[0];
    // Compara a senha fornecida com o hash armazenado
    const match = await bcrypt.compare(password, user.senha);

    if (match) {
      // Login bem-sucedido! Retorna dados do usuário (SEM A SENHA)
      console.log(
        `[Login] Usuário ${user.nome} (${user.role}) logado com sucesso.`
      );
      return {
        success: true,
        user: {
          id: user.id,
          nome: user.nome,
          role: user.role,
        },
      };
    } else {
      // Senha incorreta
      return { success: false, error: "Senha incorreta." };
    }
  } catch (error) {
    console.error("[Login] Erro durante o login:", error);
    return { success: false, error: "Erro interno no servidor." };
  }
});

// Listener para buscar todos os usuários (Admin Only)
ipcMain.handle("get-users", async (event /*, adminUserId */) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // TODO: Adicionar verificação de Admin
  // --- CORREÇÃO: Adicionado 'email' ao SELECT ---
  const sql =
    "SELECT id, nome, email, login, role FROM usuarios ORDER BY nome ASC";
  // --- FIM CORREÇÃO ---
  try {
    const { rows } = await dbPool.query(sql);
    // Filtra o próprio admin logado para segurança (se currentUser for passado no futuro)
    // const filteredRows = adminUserId ? rows.filter(user => user.id !== adminUserId) : rows;
    return { success: true, data: rows };
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return { success: false, error: error.message };
  }
});

// Adicionar usuário (ATUALIZADO com email)
ipcMain.handle("add-user", async (event, userData /*, adminUserId */) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // TODO: Adicionar verificação de Admin
  const { nome, email, login, password, role } = userData; // Adicionado email
  if (!nome || !email || !login || !password || !role) {
    // Adicionado email na validação
    return { success: false, error: "Todos os campos são obrigatórios." };
  }
  // TODO: Adicionar validação de formato de email
  if (!["Admin", "Funcionario"].includes(role)) {
    return { success: false, error: "Papel inválido." };
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // Adicionado email ao SQL
    const sql = pgQuery(
      "INSERT INTO usuarios (nome, email, login, senha, role) VALUES (?, ?, ?, ?, ?) RETURNING id"
    );
    const { rows } = await dbPool.query(sql, [
      nome,
      email,
      login,
      hashedPassword,
      role,
    ]);
    return { success: true, id: rows[0].id };
  } catch (error) {
    if (error.code === "23505") {
      if (error.constraint && error.constraint.includes("login"))
        return { success: false, error: "Este login já está em uso." };
      if (error.constraint && error.constraint.includes("email"))
        return { success: false, error: "Este email já está em uso." };
    }
    console.error("Erro ao adicionar usuário:", error);
    return {
      success: false,
      error: "Erro ao criar usuário. Verifique os dados.",
    };
  }
});

// Atualizar usuário (ATUALIZADO com email, sem alterar senha aqui)
ipcMain.handle("update-user", async (event, userData /*, adminUserId */) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // TODO: Adicionar verificação de Admin
  const { id, nome, email, login, role } = userData; // Adicionado email
  if (!id || !nome || !email || !login || !role) {
    // Adicionado email na validação
    return {
      success: false,
      error: "ID, Nome, Email, Login e Papel são obrigatórios.",
    };
  }
  if (!["Admin", "Funcionario"].includes(role)) {
    return { success: false, error: "Papel inválido." };
  }

  try {
    // Adicionado email ao SQL
    const sql = pgQuery(
      "UPDATE usuarios SET nome = ?, email = ?, login = ?, role = ? WHERE id = ?"
    );
    await dbPool.query(sql, [nome, email, login, role, id]);
    return { success: true };
  } catch (error) {
    if (error.code === "23505") {
      if (error.constraint && error.constraint.includes("login"))
        return {
          success: false,
          error: "Este login já está em uso por outro usuário.",
        };
      if (error.constraint && error.constraint.includes("email"))
        return {
          success: false,
          error: "Este email já está em uso por outro usuário.",
        };
    }
    console.error("Erro ao atualizar usuário:", error);
    return {
      success: false,
      error: "Erro ao atualizar usuário. Verifique os dados.",
    };
  }
});

// Listener para deletar usuário (Admin Only)
ipcMain.handle("delete-user", async (event, userId /*, adminUserId */) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // TODO: Adicionar verificação para garantir que apenas 'Admin' possa chamar esta função
  // TODO: Adicionar verificação para impedir que o Admin se auto-delete ou delete o último Admin
  const id = parseInt(userId, 10);
  if (isNaN(id) || id <= 0) {
    return { success: false, error: "ID de usuário inválido." };
  }

  try {
    const sql = pgQuery("DELETE FROM usuarios WHERE id = ?");
    await dbPool.query(sql, [id]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    return { success: false, error: error.message };
  }
});

// --- RECUPERAÇÃO DE SENHA ---

// Passo 1: Solicitar redefinição
ipcMain.handle("handle-forgot-password", async (event, { email }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  if (!mailTransporter)
    return { success: false, error: "Serviço de email não configurado." }; // Verifica email

  try {
    // 1. Encontra usuário pelo email
    const { rows } = await dbPool.query(
      pgQuery("SELECT id, nome, email FROM usuarios WHERE email = ?"),
      [email]
    );
    if (rows.length === 0) {
      // Por segurança, não informe se o email existe ou não
      console.warn(
        `[ForgotPwd] Tentativa de recuperação para email não encontrado: ${email}`
      );
      return { success: true }; // Retorna sucesso mesmo assim
    }
    const user = rows[0];

    // 2. Gera token seguro e data de expiração (ex: 1 hora)
    // const token = crypto.randomBytes(32).toString("hex");
    const code = crypto.randomInt(100000, 999999).toString();
    const expiry = new Date();
    expiry.setHours(expiry.getMinutes() + 6); // Token válido por 10 minutos

    // 3. Hashea o token antes de salvar no banco
    const hashedToken = await bcrypt.hash(code, saltRounds);

    // 4. Salva o token HASHED e a expiração no banco
    await dbPool.query(
      pgQuery("UPDATE usuarios SET reset_token = ?, reset_token_expiry = ? WHERE id = ?"),
      [hashedToken, expiry, user.id]
    );

    // 5. Envia o email com o token NÃO HASHED (ou link)
    const mailOptions = {
      from: `"GSTI App" <${appConfig.email.from}>`, // SEU EMAIL REMETENTE
      to: user.email,
      subject: "Redefinição de Senha - GSTI App",
      text: `Olá ${user.nome},\n\nVocê solicitou a redefinição de senha para o GSTI App.\n\nSeu código de redefinição é: ${code}\n\nEste código expira em 10 minutos.\n\nSe você não solicitou isso, ignore este email.\n`,
      // html: '<p>Seu código: <b>${token}</b></p>' // Versão HTML opcional
    };

    await mailTransporter.sendMail(mailOptions);
    console.log(`[ForgotPwd] Email de redefinição enviado para ${user.email}`);
    return { success: true }; // Informa sucesso (sem expor existência do email)
  } catch (error) {
    console.error("[ForgotPwd] Erro ao processar esqueci senha:", error);
    // Não retorne o erro detalhado para o usuário por segurança
    return {
      success: false,
      error: "Ocorreu um erro ao tentar enviar o email de recuperação.",
    };
  }
});

// Passo 2: Redefinir a senha com o token
ipcMain.handle(
  "handle-reset-password",
  async (event, { token, password, confirmPassword }) => {
    if (!dbPool)
      return { success: false, error: "Banco de dados não configurado." };
    if (!token || !password || !confirmPassword) {
      return { success: false, error: "Token e senhas são obrigatórios." };
    }
    if (password !== confirmPassword) {
      return { success: false, error: "As senhas não coincidem." };
    }
    // TODO: Adicionar validação de complexidade de senha

    try {
      // 1. Precisamos encontrar o usuário pelo token HASHED
      // Como bcrypt não permite busca reversa, temos que buscar TODOS os tokens não expirados
      // e comparar o token fornecido com cada hash. ISSO NÃO É EFICIENTE PARA MUITOS USUÁRIOS.
      // Alternativa: Usar um token simples (não hashed) no banco, mas menos seguro.
      // Ou usar um link único com o token. Para simplificar, faremos a comparação aqui.

      const now = new Date();
      const { rows: usersWithToken } = await dbPool.query(
        pgQuery("SELECT id, reset_token, reset_token_expiry FROM usuarios WHERE reset_token IS NOT NULL AND reset_token_expiry > ?"),
        [now]
      );

      let foundUser = null;
      for (const user of usersWithToken) {
        const match = await bcrypt.compare(token, user.reset_token);
        if (match) {
          foundUser = user;
          break; // Encontrou o usuário correspondente
        }
      }

      if (!foundUser) {
        return { success: false, error: "Token inválido ou expirado." };
      }

      // 2. Hashea a nova senha
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // 3. Atualiza a senha e invalida o token
      await dbPool.query(
        pgQuery("UPDATE usuarios SET senha = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?"),
        [hashedPassword, foundUser.id]
      );

      console.log(
        `[ResetPwd] Senha redefinida com sucesso para usuário ID ${foundUser.id}`
      );
      return { success: true };
    } catch (error) {
      console.error("[ResetPwd] Erro ao redefinir senha:", error);
      return { success: false, error: "Erro ao tentar redefinir a senha." };
    }
  }
);

// Listener para buscar os clientes
ipcMain.handle("get-customers", async () => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  try {
    const { rows } = await dbPool.query("SELECT * FROM clientes");
    return rows;
  } catch (error) {
    console.error(error);
    return []; // Retorna um array vazio em caso de erro
  }
});

// Listener para adicionar um novo cliente
ipcMain.handle("add-customer", async (event, customerData) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // Agora pegamos os novos campos do objeto recebido
  const { nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco } =
    customerData;
  const sql = pgQuery(
    "INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
  );

  try {
    // Passamos os novos campos como parâmetros na ordem correta
    const { rows } = await dbPool.query(sql, [
      nome,
      tipo_pessoa,
      cpf_cnpj,
      telefone,
      email,
      endereco,
    ]);
    return { success: true, id: rows[0].id };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Listener para validar APENAS CNPJ
ipcMain.handle("validate-cnpj", async (event, cnpj) => {
  const docNumber = cnpj.replace(/\D/g, "");
  if (docNumber.length !== 14) {
    return { success: false, error: "CNPJ deve ter 14 dígitos." };
  }

  const apiUrl = `https://brasilapi.com.br/api/cnpj/v1/${docNumber}`;

  try {
    const response = await axios.get(apiUrl);
    const name = response.data.razao_social;
    return { success: true, name: name, data: response.data };
  } catch (error) {
    return { success: false, error: "CNPJ não encontrado ou inválido." };
  }
});

ipcMain.handle("update-customer", async (event, customerData) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const { id, nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco } =
    customerData;
  const sql = pgQuery(
    "UPDATE clientes SET nome = ?, tipo_pessoa = ?, cpf_cnpj = ?, telefone = ?, email = ?, endereco = ? WHERE id = ?"
  );

  try {
    await dbPool.query(sql, [
      nome,
      tipo_pessoa,
      cpf_cnpj,
      telefone,
      email,
      endereco,
      id,
    ]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR um cliente
ipcMain.handle("delete-customer", async (event, customerId) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const sql = pgQuery("DELETE FROM clientes WHERE id = ?");

  try {
    await dbPool.query(sql, [customerId]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar cliente:", error);
    return { success: false, error: error.message };
  }
});

// Listener para buscar todos os produtos e serviços
ipcMain.handle("get-products", async () => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  try {
    const { rows } = await dbPool.query("SELECT * FROM produtos_servicos");
    return rows;
  } catch (error) {
    console.error("Erro ao buscar produtos/serviços:", error);
    return [];
  }
});

// Listener para adicionar um novo produto/serviço
ipcMain.handle("add-product", async (event, productData) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const { descricao, valor, tipo } = productData;
  const sql = pgQuery(
    "INSERT INTO produtos_servicos (descricao, valor, tipo) VALUES (?, ?, ?) RETURNING id"
  );
  try {
    const { rows } = await dbPool.query(sql, [descricao, valor, tipo]);
    return { success: true, id: rows[0].id };
  } catch (error) {
    console.error("Erro ao adicionar produto/serviço:", error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR um produto/serviço existente
ipcMain.handle("update-product", async (event, productData) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const { id, descricao, valor, tipo } = productData;
  const sql = pgQuery(
    "UPDATE produtos_servicos SET descricao = ?, valor = ?, tipo = ? WHERE id = ?"
  );

  try {
    await dbPool.query(sql, [descricao, valor, tipo, id]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar produto/serviço:", error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR um produto/serviço
ipcMain.handle("delete-product", async (event, productId) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const sql = pgQuery("DELETE FROM produtos_servicos WHERE id = ?");

  try {
    await dbPool.query(sql, [productId]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar produto/serviço:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-os-list", async () => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const sql = `
    SELECT 
      os.id, 
      -- Concatena os novos campos para exibição no grid
      CONCAT(os.tipo_equipamento, ' ', os.marca, ' ', os.modelo) AS equipamento, 
      os.status, os.data_entrada, os.valor_total,
      c.nome AS nome_cliente 
    FROM ordens_servico AS os
    JOIN clientes AS c ON os.id_cliente = c.id
    ORDER BY os.id DESC`;
  try {
    const { rows } = await dbPool.query(sql);
    return rows;
  } catch (error) {
    return [];
  }
});

ipcMain.handle("get-active-data", async () => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  try {
    const { rows: customers } = await dbPool.query(
      "SELECT id, nome FROM clientes ORDER BY nome ASC"
    );
    const { rows: products } = await dbPool.query(
      "SELECT id, descricao, valor, tipo FROM produtos_servicos ORDER BY descricao ASC"
    );
    return { success: true, customers, products };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- CORREÇÃO DO BUG (get-os-details) ---
ipcMain.handle("get-os-details", async (event, osId) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  try {
    const { rows: osRows } = await dbPool.query(
      pgQuery("SELECT * FROM ordens_servico WHERE id = ?"),
      [osId]
    );
    if (osRows.length === 0)
      return { success: false, error: "OS não encontrada." };

    // CORREÇÃO: Alterado de 'produtos_serviços' para 'produtos_servicos'
    const { rows: itemRows } = await dbPool.query(
      pgQuery(`SELECT ps.id, ps.descricao, ps.valor, ps.tipo, oi.quantidade
       FROM os_itens oi
       JOIN produtos_servicos ps ON oi.id_produto_servico = ps.id
       WHERE oi.id_os = ?`),
      [osId]
    );

    return { success: true, os: osRows[0], items: itemRows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("add-os", async (event, { osData, total }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // Atualizado para os novos campos
  const {
    id_cliente,
    tipo_equipamento,
    marca,
    modelo,
    numero_serie,
    defeito_relatado,
    observacoes_entrada,
    status,
    data_entrada,
    garantia_dias,
  } = osData;
  const sql = pgQuery(`INSERT INTO ordens_servico
    (id_cliente, tipo_equipamento, marca, modelo, numero_serie, defeito_relatado, observacoes_entrada, status, data_entrada, valor_total, garantia_dias)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`);
  try {
    const { rows } = await dbPool.query(sql, [
      id_cliente,
      tipo_equipamento,
      marca,
      modelo,
      numero_serie,
      defeito_relatado,
      observacoes_entrada,
      status,
      data_entrada,
      total,
      garantia_dias,
    ]);
    return { success: true, osId: rows[0].id };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-os", async (event, { osData, total }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const {
    id,
    id_cliente,
    tipo_equipamento,
    marca,
    modelo,
    numero_serie,
    defeito_relatado,
    observacoes_entrada,
    laudo_tecnico,
    solucao_aplicada,
    status,
    data_entrada,
    garantia_dias,
  } = osData;
  try {
    const { rows } = await dbPool.query(
      pgQuery("SELECT status, data_saida, garantia_dias FROM ordens_servico WHERE id = ?"),
      [id]
    );
    const osAtual = rows[0];

    // --- VERIFICAÇÃO GARANTIA (sem alterações) ---
    if (osAtual.status === "Entregue" && osAtual.data_saida) {
      const dataSaida = new Date(osAtual.data_saida);
      const dataExpiracaoGarantia = new Date(
        dataSaida.setDate(dataSaida.getDate() + (osAtual.garantia_dias || 0))
      );
      const hoje = new Date();
      if (hoje > dataExpiracaoGarantia) {
        throw new Error(
          "Esta OS está fora da garantia e não pode ser alterada."
        );
      }
    }

    // Define data_saida se status for Finalizado/Entregue e data_saida for NULL
    let setDataSaidaSql = "";
    if (["Finalizado", "Entregue"].includes(status) && !osAtual.data_saida) {
      setDataSaidaSql = ", data_saida = NOW()";
    }

    const sql = pgQuery(`
      UPDATE ordens_servico SET
      id_cliente = ?, tipo_equipamento = ?, marca = ?, modelo = ?,
      numero_serie = ?, defeito_relatado = ?, observacoes_entrada = ?,
      laudo_tecnico = ?, solucao_aplicada = ?, status = ?,
      data_entrada = ?, valor_total = ?, garantia_dias = ?
      ${setDataSaidaSql}
      WHERE id = ?`);

    await dbPool.query(sql, [
      id_cliente,
      tipo_equipamento,
      marca,
      modelo,
      numero_serie,
      defeito_relatado,
      observacoes_entrada,
      laudo_tecnico,
      solucao_aplicada,
      status,
      data_entrada,
      total,
      garantia_dias,
      id,
    ]);

    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar OS:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("add-os-items", async (event, { osId, items }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  if (items.length === 0) return { success: true };
  try {
    const productIds = items.map((i) => i.id);
    const quantities = items.map((i) => i.quantidade);
    const prices = items.map((i) => i.valor);
    await dbPool.query(
      `INSERT INTO os_itens (id_os, id_produto_servico, quantidade, valor_unitario)
       SELECT $1, unnest($2::int[]), unnest($3::int[]), unnest($4::numeric[])`,
      [osId, productIds, quantities, prices]
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-os-items", async (event, { osId, items }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(pgQuery("DELETE FROM os_itens WHERE id_os = ?"), [osId]);
    if (items.length > 0) {
      const productIds = items.map((i) => i.id);
      const quantities = items.map((i) => i.quantidade);
      const prices = items.map((i) => i.valor);
      await client.query(
        `INSERT INTO os_itens (id_os, id_produto_servico, quantidade, valor_unitario)
         SELECT $1, unnest($2::int[]), unnest($3::int[]), unnest($4::numeric[])`,
        [osId, productIds, quantities, prices]
      );
    }
    await client.query("COMMIT");
    return { success: true };
  } catch (error) {
    await client.query("ROLLBACK");
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
});

ipcMain.handle("delete-os", async (event, osId) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  try {
    await dbPool.query(pgQuery("DELETE FROM ordens_servico WHERE id = ?"), [osId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- FUNÇÃO PDF ATUALIZADA ---
ipcMain.handle("generate-entry-receipt", async (event, osId) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // 1. Buscar todos os dados necessários (SQL ATUALIZADO)
  const sql = pgQuery(`SELECT os.*, c.nome AS nome_cliente, c.telefone AS telefone_cliente, c.cpf_cnpj, c.email AS email_cliente, c.endereco AS endereco_cliente FROM ordens_servico os JOIN clientes c ON os.id_cliente = c.id WHERE os.id = ?`);
  let osData;
  try {
    const { rows } = await dbPool.query(sql, [osId]);
    if (rows.length === 0) throw new Error("OS não encontrada.");
    osData = rows[0];
  } catch (error) {
    return { success: false, error: error.message };
  }

  // 2. Perguntar onde salvar o arquivo
  const { filePath } = await dialog.showSaveDialog({
    title: "Salvar Comprovante de Entrada",
    defaultPath: `os_entrada_${osId}.pdf`,
    filters: [{ name: "Arquivos PDF", extensions: ["pdf"] }],
  });

  if (!filePath) {
    return { success: false, error: "Usuário cancelou a gravação." };
  }

  // 3. Gerar o PDF
  try {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Seus Termos de Serviço (do passo anterior)
    const termosDeServico = `
TERMOS PARA ORÇAMENTO E SERVIÇO (Baseado na Lei 8.078/90 - CDC)
1. ORÇAMENTO PRÉVIO (Art. 40, CDC): O presente documento registra o recebimento do equipamento para análise. O fornecedor é obrigado a entregar ao CLIENTE um orçamento prévio discriminando o valor da mão-de-obra, materiais, condições de pagamento e prazo de execução.
2. PRAZO DE ORÇAMENTO: O prazo para apresentação do orçamento é de até 5 (cinco) dias úteis. O orçamento apresentado terá validade de 10 (dez) dias, a contar do seu recebimento (aprovação) pelo CLIENTE.
3. AUTORIZAÇÃO DE SERVIÇO (Art. 39, CDC): Nenhum serviço será executado sem a autorização expressa e prévia do CLIENTE. Serviços executados sem autorização são equiparados a amostras grátis, não gerando ônus ao consumidor.
4. DADOS E SOFTWARE: O CLIENTE é o único responsável por realizar o backup prévio de seus dados (arquivos, fotos, etc.). A empresa não se responsabiliza por qualquer perda de dados.
5. ABANDONO DE EQUIPAMENTO: O CLIENTE deve retirar o equipamento em até 90 (noventa) dias após ser notificado da conclusão do serviço (ou da recusa do orçamento). Após este prazo, o equipamento será considerado abandonado, podendo a empresa tomar as medidas legais cabíveis para cobrir custos de serviço e armazenamento.
6. GARANTIA PÓS-SERVIÇO (Art. 26, CDC): Se o orçamento for aprovado e o serviço executado, a garantia legal para os serviços e peças é de 90 (noventa) dias a contar da data de efetiva entrega do equipamento. Esta garantia cobre exclusivamente o defeito solucionado e as peças substituídas, conforme descrito no laudo de saída.
`;

    // --- Função para desenhar o conteúdo (para as 2 vias) ---
    const drawReceipt = (isCliente) => {
      const via = isCliente ? "Via do Cliente" : "Via da Empresa";
      doc
        .fontSize(16)
        .text("Comprovante de Entrada de Equipamento", { align: "center" });
      doc.fontSize(10).text(via, { align: "right" });
      doc.fontSize(12).text(`OS Nº: ${osData.id}`, { align: "left" });
      doc.moveDown(1);

      // --- Dados do Cliente (ATUALIZADO) ---
      doc.fontSize(14).text("Dados do Cliente", { underline: true });
      doc.fontSize(10).text(`Nome: ${osData.nome_cliente}`);
      doc.text(
        `CPF/CNPJ: ${formatDocument(osData.cpf_cnpj) || "Não informado"}`
      );
      doc.text(
        `Telefone: ${formatPhone(osData.telefone_cliente) || "Não informado"}`
      );
      doc.text(`Email: ${osData.email_cliente || "Não informado"}`);
      doc.text(`Endereço: ${osData.endereco_cliente || "Não informado"}`);
      doc.moveDown(1);
      // --- FIM DA ATUALIZAÇÃO ---

      // Dados do Equipamento
      doc.fontSize(14).text("Dados do Equipamento", { underline: true });
      const dataEntrada = new Date(osData.data_entrada).toLocaleString(
        "pt-BR",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
      doc.fontSize(10).text(`Data de Entrada: ${dataEntrada}`);
      doc.text(`Tipo: ${osData.tipo_equipamento || "Não informado"}`);
      doc.text(`Marca: ${osData.marca || "Não informado"}`);
      doc.text(`Modelo: ${osData.modelo || "Não informado"}`);
      doc.text(`Nº de Série: ${osData.numero_serie || "Não informado"}`);
      doc.moveDown(0.5);
      doc.text(`Defeito Relatado: ${osData.defeito_relatado || "Nenhum"}`);
      doc.moveDown(0.5);
      doc.text(`Observações: ${osData.observacoes_entrada || "Nenhuma"}`);
      doc.moveDown(2);

      // Termos de Serviço
      doc
        .fontSize(12)
        .text("Termos de Serviço e Orçamento", { underline: true });
      doc.fontSize(8).text(termosDeServico, { align: "justify" });
      doc.moveDown(2);

      // Assinatura
      doc.fontSize(10);
      doc.text("___________________________________________", {
        align: "center",
      });
      doc.text("Assinatura do Cliente", { align: "center" });
      doc.text(
        "Declaro estar ciente e de acordo com os termos acima e das condições do equipamento descrito.",
        { align: "center", width: 450 }
      );
    };

    // --- Desenha as duas vias ---
    drawReceipt(false); // Via da Empresa
    doc
      .addPage()
      .fontSize(10)
      .text(
        "----------------------------------------------------------------------------------------------------------",
        { align: "center" }
      );
    doc.moveDown(2);
    drawReceipt(true); // Via do Cliente

    doc.end();

    // 4. Abrir o PDF após salvar
    stream.on("finish", () => {
      shell.openPath(filePath);
    });

    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- NOVA FUNÇÃO: GERAR PDF DE SAÍDA/GARANTIA ---
ipcMain.handle("generate-exit-receipt", async (event, osId) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // 1. Buscar dados da OS, Cliente e Itens
  let osData, itemsData;
  try {
    const osSql = pgQuery(`
      SELECT os.*, c.nome AS nome_cliente, c.telefone AS telefone_cliente, c.cpf_cnpj,
             c.email AS email_cliente, c.endereco AS endereco_cliente
      FROM ordens_servico os JOIN clientes c ON os.id_cliente = c.id
      WHERE os.id = ?`);
    const { rows: osRows } = await dbPool.query(osSql, [osId]);
    if (osRows.length === 0) throw new Error("OS não encontrada.");
    osData = osRows[0];

    // Verifica se a OS tem data de saída (necessária para garantia)
    if (!osData.data_saida) {
      await dbPool.query(
        pgQuery("UPDATE ordens_servico SET data_saida = NOW() WHERE id = ?"),
        [osId]
      );
      const { rows: updatedOsRows } = await dbPool.query(osSql, [osId]);
      osData = updatedOsRows[0];
    }

    const itemsSql = pgQuery(`
      SELECT ps.descricao, oi.quantidade, oi.valor_unitario
      FROM os_itens oi JOIN produtos_servicos ps ON oi.id_produto_servico = ps.id
      WHERE oi.id_os = ?`);
    const { rows: itemRows } = await dbPool.query(itemsSql, [osId]);
    itemsData = itemRows;
  } catch (error) {
    return { success: false, error: `Erro ao buscar dados: ${error.message}` };
  }

  // 2. Perguntar onde salvar
  const { filePath } = await dialog.showSaveDialog({
    title: "Salvar Recibo de Saída e Garantia",
    defaultPath: `os_saida_garantia_${osId}.pdf`,
    filters: [{ name: "Arquivos PDF", extensions: ["pdf"] }],
  });

  if (!filePath) return { success: false, error: "Usuário cancelou." };

  // 3. Gerar o PDF
  try {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // --- Constantes de Layout ---
    const pageTopMargin = 50;
    const pageBottomMargin = 50;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftMargin = doc.page.margins.left;

    // --- Função para adicionar nova página se necessário ---
    const checkAddPage = (currentY, neededHeight) => {
      if (currentY + neededHeight > doc.page.height - pageBottomMargin) {
        doc.addPage();
        return pageTopMargin; // Retorna a nova posição Y inicial
      }
      return currentY; // Mantém a posição Y atual
    };

    // --- Cabeçalho ---
    doc
      .fontSize(18)
      .text("Recibo de Entrega e Termo de Garantia", { align: "center" });
    let currentY = doc.y; // Pega a posição Y após o título
    doc.fontSize(12).text(`OS Nº: ${osData.id}`, leftMargin, currentY); // Posição X explícita
    const dataSaida = new Date(osData.data_saida);
    doc
      .fontSize(10)
      .text(
        `Data de Entrega: ${dataSaida.toLocaleDateString("pt-BR")}`,
        leftMargin,
        currentY,
        { align: "right" }
      ); // Alinhado à direita da página
    doc.moveDown(2);
    currentY = doc.y;

    // --- Dados do Cliente ---
    currentY = checkAddPage(currentY, 60); // Estima altura necessária
    doc.fontSize(14).text("Cliente", leftMargin, currentY, { underline: true });
    currentY += 20;
    doc.fontSize(10);
    doc.text(`Nome: ${osData.nome_cliente}`, leftMargin, currentY);
    currentY += 15;
    doc.text(
      `CPF/CNPJ: ${formatDocument(osData.cpf_cnpj) || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 15;
    doc.text(
      `Telefone: ${formatPhone(osData.telefone_cliente) || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 15;
    doc.text(
      `Email: ${osData.email_cliente || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 15;
    doc.text(
      `Endereço: ${osData.endereco_cliente || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 25; // Mais espaço após
    doc.y = currentY; // Atualiza cursor do PDFKit

    // --- Dados do Equipamento ---
    currentY = checkAddPage(currentY, 50);
    doc
      .fontSize(14)
      .text("Equipamento", leftMargin, currentY, { underline: true });
    currentY += 20;
    doc
      .fontSize(10)
      .text(
        `Tipo: ${osData.tipo_equipamento || ""} ${osData.marca || ""} ${
          osData.modelo || ""
        }`,
        leftMargin,
        currentY
      );
    currentY += 15;
    doc.text(
      `Nº de Série: ${osData.numero_serie || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 25;
    doc.y = currentY;

    // --- Detalhes do Serviço ---
    currentY = checkAddPage(currentY, 80); // Estima altura
    doc
      .fontSize(14)
      .text("Serviço Realizado", leftMargin, currentY, { underline: true });
    currentY += 20;
    doc.fontSize(10);
    doc
      .text("Defeito Relatado:", leftMargin, currentY, { continued: true })
      .text(osData.defeito_relatado || "Não informado.");
    currentY = doc.y + 5; // Pega Y após texto
    doc
      .text("Laudo Técnico:", leftMargin, currentY, { continued: true })
      .text(osData.laudo_tecnico || "Não informado.");
    currentY = doc.y + 5;
    doc
      .text("Solução Aplicada:", leftMargin, currentY, { continued: true })
      .text(osData.solucao_aplicada || "Não informada.");
    currentY = doc.y + 15;
    doc.y = currentY;

    // --- Itens e Custos (Layout Controlado) ---
    currentY = checkAddPage(currentY, 40); // Espaço para título e cabeçalho da tabela
    doc
      .fontSize(14)
      .text("Itens e Custos", leftMargin, currentY, { underline: true });
    currentY += 20;
    const tableTopY = currentY;
    const descX = leftMargin;
    const qtyX = 370;
    const unitX = 420;
    const subtotalX = 480;
    const endX = doc.page.width - leftMargin;
    const rowHeight = 15;

    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Descrição", descX, tableTopY);
    doc.text("Qtd.", qtyX, tableTopY, { width: 40, align: "right" });
    doc.text("Vlr. Unit.", unitX, tableTopY, { width: 60, align: "right" });
    doc.text("Subtotal", subtotalX, tableTopY, { width: 70, align: "right" });
    doc.font("Helvetica");
    currentY += 15; // Pula linha do cabeçalho
    doc.moveTo(descX, currentY).lineTo(endX, currentY).stroke(); // Linha abaixo
    currentY += 5;
    doc.y = currentY;

    itemsData.forEach((item) => {
      const subtotal = item.quantidade * item.valor_unitario;
      const descHeight = doc.heightOfString(item.descricao, {
        width: qtyX - descX - 10,
      });
      const actualRowHeight = Math.max(rowHeight, descHeight) + 4; // Altura + margem

      currentY = checkAddPage(currentY, actualRowHeight); // Verifica se cabe na página ANTES

      doc.fontSize(9);
      doc.text(item.descricao, descX, currentY, {
        width: qtyX - descX - 10,
        align: "left",
      });
      // Salva a posição Y antes de desenhar os itens alinhados à direita
      const rightItemsY = currentY;
      doc.text(item.quantidade, qtyX, rightItemsY, {
        width: 40,
        align: "right",
      });
      doc.text(
        Number(item.valor_unitario).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
        unitX,
        rightItemsY,
        { width: 60, align: "right" }
      );
      doc.text(
        subtotal.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
        subtotalX,
        rightItemsY,
        { width: 70, align: "right" }
      );

      currentY += actualRowHeight; // Atualiza Y para próxima linha
      doc.y = currentY;
    });

    currentY = checkAddPage(currentY, 30); // Espaço para linha e total
    doc.moveTo(descX, currentY).lineTo(endX, currentY).stroke(); // Linha abaixo dos itens
    currentY += 10;

    // --- Valor Total (Posição Controlada) ---
    doc.fontSize(12).text(
      `Valor Total: ${Number(osData.valor_total).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}`,
      leftMargin,
      currentY,
      { align: "right" }
    );
    currentY += 30; // Mais espaço após o total
    doc.y = currentY;

    // --- Garantia (Layout Controlado) ---
    // Calcula a altura estimada do texto da garantia
    const garantiaText = `Este serviço possui garantia de ${
      osData.garantia_dias || 0
    } dias... Consulte os Termos de Serviço completos para detalhes.`;
    const garantiaHeight = doc.heightOfString(garantiaText, {
      width: contentWidth,
      align: "justify",
    });
    currentY = checkAddPage(currentY, garantiaHeight + 30); // Verifica espaço para título e texto

    doc
      .fontSize(14)
      .text("Termo de Garantia", leftMargin, currentY, { underline: true });
    currentY += 20;
    doc.fontSize(9);
    const garantiaDias = osData.garantia_dias || 0;
    const dataExpiracao = new Date(dataSaida);
    dataExpiracao.setDate(dataExpiracao.getDate() + garantiaDias);

    doc.text(
      `Este serviço possui garantia de ${garantiaDias} dias, válida a partir da data de entrega (${dataSaida.toLocaleDateString(
        "pt-BR"
      )}). A garantia expira em: ${dataExpiracao.toLocaleDateString("pt-BR")}.`,
      leftMargin,
      currentY,
      { width: contentWidth, align: "justify" }
    );
    currentY = doc.y + 5; // Pega Y após o texto
    doc.text(
      'A garantia cobre defeitos de fabricação nas peças substituídas e/ou mão de obra referente ao serviço descrito em "Solução Aplicada". Não cobre mau uso, danos por software, acidentes ou defeitos não relacionados ao reparo original. Consulte os Termos de Serviço completos para detalhes.',
      leftMargin,
      currentY,
      { width: contentWidth, align: "justify" }
    );
    currentY = doc.y + 30; // Mais espaço após garantia
    doc.y = currentY;

    // --- Assinatura (Posição Controlada) ---
    currentY = checkAddPage(currentY, 60); // Espaço para assinatura
    doc.fontSize(10);
    doc.text(
      "___________________________________________",
      leftMargin,
      currentY,
      { align: "center" }
    );
    currentY += 15;
    doc.text("Assinatura do Cliente", leftMargin, currentY, {
      align: "center",
    });
    currentY += 15;
    doc.text(
      "Declaro ter recebido o equipamento descrito acima nas condições especificadas.",
      leftMargin,
      currentY,
      { align: "center", width: 450 }
    );

    // --- Finaliza o PDF ---
    // Não precisa mais mexer no buffer, o pdfkit lida com isso
    doc.end();
    stream.on("finish", () => {
      shell.openPath(filePath);
    });
    return { success: true, path: filePath };
  } catch (error) {
    console.error("Erro detalhado ao gerar PDF:", error);
    return { success: false, error: `Erro ao gerar PDF: ${error.message}` };
  }
});

// --- MÓDULO FINANCEIRO - DESPESAS ---

// Listener para buscar TODAS as despesas
ipcMain.handle("get-expenses", async () => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // Busca também o novo campo tipo_despesa
  const sql = "SELECT * FROM despesas ORDER BY data DESC, id DESC";
  try {
    const { rows } = await dbPool.query(sql);
    return rows;
  } catch (error) {
    console.error("Erro ao buscar despesas:", error);
    return [];
  }
});

// Listener para ADICIONAR uma nova despesa
ipcMain.handle("add-expense", async (event, expenseData) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // --- ALTERAÇÃO: Adiciona tipo_despesa ---
  let {
    descricao,
    data,
    categoria,
    tipo_despesa,
    km_rodados,
    preco_litro,
    consumo_medio,
    valor,
  } = expenseData;

  km_rodados = km_rodados ? parseFloat(km_rodados) : null;
  preco_litro = preco_litro ? parseFloat(preco_litro) : null;
  consumo_medio = consumo_medio ? parseFloat(consumo_medio) : null;
  valor = valor ? parseFloat(valor) : 0;
  tipo_despesa = tipo_despesa || "Variável"; // Garante um valor padrão se não vier

  if (
    categoria === "Combustível" &&
    km_rodados &&
    preco_litro &&
    consumo_medio &&
    consumo_medio > 0
  ) {
    valor = (km_rodados / consumo_medio) * preco_litro;
  }

  const sql = pgQuery(`
    INSERT INTO despesas
    (descricao, data, categoria, tipo_despesa, km_rodados, preco_litro, consumo_medio, valor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `);
  try {
    const { rows } = await dbPool.query(sql, [
      descricao,
      data,
      categoria,
      tipo_despesa,
      km_rodados,
      preco_litro,
      consumo_medio,
      valor,
    ]);
    return { success: true, id: rows[0].id };
  } catch (error) {
    console.error("Erro ao adicionar despesa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR uma despesa existente
ipcMain.handle("update-expense", async (event, expenseData) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // --- ALTERAÇÃO: Adiciona tipo_despesa ---
  let {
    id,
    descricao,
    data,
    categoria,
    tipo_despesa,
    km_rodados,
    preco_litro,
    consumo_medio,
    valor,
  } = expenseData;

  km_rodados = km_rodados ? parseFloat(km_rodados) : null;
  preco_litro = preco_litro ? parseFloat(preco_litro) : null;
  consumo_medio = consumo_medio ? parseFloat(consumo_medio) : null;
  valor = valor ? parseFloat(valor) : 0;
  tipo_despesa = tipo_despesa || "Variável";

  if (
    categoria === "Combustível" &&
    km_rodados &&
    preco_litro &&
    consumo_medio &&
    consumo_medio > 0
  ) {
    valor = (km_rodados / consumo_medio) * preco_litro;
  }

  const sql = pgQuery(`
    UPDATE despesas SET
    descricao = ?, data = ?, categoria = ?, tipo_despesa = ?,
    km_rodados = ?, preco_litro = ?, consumo_medio = ?, valor = ?
    WHERE id = ?
  `);
  try {
    await dbPool.query(sql, [
      descricao,
      data,
      categoria,
      tipo_despesa,
      km_rodados,
      preco_litro,
      consumo_medio,
      valor,
      id,
    ]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar despesa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR uma despesa
ipcMain.handle("delete-expense", async (event, expenseId) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const sql = pgQuery("DELETE FROM despesas WHERE id = ?");
  try {
    await dbPool.query(sql, [expenseId]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar despesa:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "get-financial-summary",
  async (event, { startDate, endDate }) => {
    if (!dbPool)
      return { success: false, error: "Banco de dados não configurado." };
    const formattedStartDate = `${startDate} 00:00:00`;
    const formattedEndDate = `${endDate} 23:59:59`;

    console.log(
      `[get-financial-summary] Buscando período: ${formattedStartDate} a ${formattedEndDate}`
    );

    try {
      // 1. Receita das OS
      const osRevenueSql = pgQuery(`SELECT SUM(valor_total) AS totalOSRevenue FROM ordens_servico WHERE status IN ('Finalizado', 'Entregue') AND data_saida IS NOT NULL AND data_saida >= ? AND data_saida <= ?`);
      const { rows: osRevenueResult } = await dbPool.query(osRevenueSql, [
        formattedStartDate,
        formattedEndDate,
      ]);
      const totalOSRevenue = Number(osRevenueResult[0].totalosrevenue) || 0;
      console.log(
        `[get-financial-summary] Resultado Receita OS (Numérico):`,
        totalOSRevenue
      );

      // 2. Receita Avulsa
      const miscRevenueSql = pgQuery(`SELECT SUM(valor) AS totalMiscRevenue FROM receitas_avulsas WHERE data BETWEEN ? AND ?`);
      const { rows: miscRevenueResult } = await dbPool.query(miscRevenueSql, [
        startDate,
        endDate,
      ]);
      const totalMiscRevenue =
        Number(miscRevenueResult[0].totalmiscrevenue) || 0;
      console.log(
        `[get-financial-summary] Resultado Receita Avulsa (Numérico):`,
        totalMiscRevenue
      );

      // 3. Receita Total (Soma Numérica Garantida)
      const totalRevenue = totalOSRevenue + totalMiscRevenue;
      console.log(
        `[get-financial-summary] Receita Total Calculada:`,
        totalRevenue
      );

      // 4. Despesas Fixas e Variáveis
      const fixedExpenseSql = pgQuery(`SELECT SUM(valor) AS totalFixedExpenses FROM despesas WHERE tipo_despesa = 'Fixa' AND data BETWEEN ? AND ?`);
      const { rows: fixedExpenseResult } = await dbPool.query(fixedExpenseSql, [
        startDate,
        endDate,
      ]);
      const totalFixedExpenses =
        Number(fixedExpenseResult[0].totalfixedexpenses) || 0;

      const variableExpenseSql = pgQuery(`SELECT SUM(valor) AS totalVariableExpenses FROM despesas WHERE tipo_despesa = 'Variável' AND data BETWEEN ? AND ?`);
      const { rows: variableExpenseResult } = await dbPool.query(variableExpenseSql, [
        startDate,
        endDate,
      ]);
      const totalVariableExpenses =
        Number(variableExpenseResult[0].totalvariableexpenses) || 0;

      const totalExpenses = totalFixedExpenses + totalVariableExpenses;
      console.log(
        `[get-financial-summary] Despesas Fixas: ${totalFixedExpenses}, Variáveis: ${totalVariableExpenses}, Total: ${totalExpenses}`
      );

      // 5. Lucro Líquido
      const netProfit = totalRevenue - totalExpenses;
      console.log(
        `[get-financial-summary] Lucro Líquido Calculado:`,
        netProfit
      );

      // --- CORREÇÃO: Retorna apenas os totais necessários e corretos ---
      return {
        success: true,
        summary: {
          totalRevenue, // Agora é um número correto
          totalExpenses,
          netProfit,
          totalFixedExpenses,
          totalVariableExpenses,
          // Removemos os subtotais daqui para evitar confusão no frontend
        },
      };
    } catch (error) {
      console.error("[get-financial-summary] Erro ao calcular resumo:", error);
      return { success: false, error: error.message };
    }
  }
);

// Listener para buscar dados mensais agregados para gráficos
ipcMain.handle("get-monthly-summary", async (event, { year }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // Valida o ano (simples)
  const numericYear = parseInt(year, 10);
  if (isNaN(numericYear) || numericYear < 1900 || numericYear > 2100) {
    return { success: false, error: "Ano inválido." };
  }

  try {
    // Inicializa um array para os 12 meses com valores zerados
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, // 1 (Janeiro) a 12 (Dezembro)
      totalRevenue: 0,
      totalExpenses: 0,
      totalFixedExpenses: 0,
      totalVariableExpenses: 0,
    }));

    // 1. Busca Receitas de OS agregadas por mês
    const osRevenueSql = pgQuery(`
      SELECT EXTRACT(MONTH FROM data_saida)::int AS month, SUM(valor_total) AS monthlyRevenue
      FROM ordens_servico
      WHERE status IN ('Finalizado', 'Entregue')
        AND data_saida IS NOT NULL
        AND EXTRACT(YEAR FROM data_saida)::int = ?
      GROUP BY EXTRACT(MONTH FROM data_saida)
    `);
    const { rows: osRevenues } = await dbPool.query(osRevenueSql, [numericYear]);
    osRevenues.forEach((row) => {
      if (row.month >= 1 && row.month <= 12) {
        monthlyData[row.month - 1].totalRevenue +=
          Number(row.monthlyrevenue) || 0;
      }
    });

    // 2. Busca Receitas Avulsas agregadas por mês
    const miscRevenueSql = pgQuery(`
      SELECT EXTRACT(MONTH FROM data)::int AS month, SUM(valor) AS monthlyRevenue
      FROM receitas_avulsas
      WHERE EXTRACT(YEAR FROM data)::int = ?
      GROUP BY EXTRACT(MONTH FROM data)
    `);
    const { rows: miscRevenues } = await dbPool.query(miscRevenueSql, [numericYear]);
    miscRevenues.forEach((row) => {
      if (row.month >= 1 && row.month <= 12) {
        monthlyData[row.month - 1].totalRevenue +=
          Number(row.monthlyrevenue) || 0;
      }
    });

    // 3. Busca Despesas agregadas por mês e tipo
    const expensesSql = pgQuery(`
      SELECT EXTRACT(MONTH FROM data)::int AS month, tipo_despesa, SUM(valor) AS monthlyExpense
      FROM despesas
      WHERE EXTRACT(YEAR FROM data)::int = ?
      GROUP BY EXTRACT(MONTH FROM data), tipo_despesa
    `);
    const { rows: expenses } = await dbPool.query(expensesSql, [numericYear]);
    expenses.forEach((row) => {
      if (row.month >= 1 && row.month <= 12) {
        const monthIndex = row.month - 1;
        const value = Number(row.monthlyexpense) || 0;
        monthlyData[monthIndex].totalExpenses += value; // Adiciona ao total geral de despesas
        if (row.tipo_despesa === "Fixa") {
          monthlyData[monthIndex].totalFixedExpenses += value;
        } else {
          monthlyData[monthIndex].totalVariableExpenses += value;
        }
      }
    });

    return { success: true, monthlyData };
  } catch (error) {
    console.error("Erro ao buscar resumo mensal:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "export-financial-report",
  async (event, { startDate, endDate }) => {
    if (!dbPool)
      return { success: false, error: "Banco de dados não configurado." };
    const formattedStartDate = `${startDate} 00:00:00`;
    const formattedEndDate = `${endDate} 23:59:59`;
    const dateOnlyStart = startDate;
    const dateOnlyEnd = endDate;

    console.log(
      `[export-report] Iniciando exportação para período: ${startDate} a ${endDate}`
    );

    try {
      // 1. Buscar Dados Detalhados
      const osRevenueSql = pgQuery(`
        SELECT os.id, os.data_saida AS data, c.nome AS nome_cliente, os.valor_total AS valor
        FROM ordens_servico os JOIN clientes c ON os.id_cliente = c.id
        WHERE os.status IN ('Finalizado', 'Entregue') AND os.data_saida IS NOT NULL
        AND os.data_saida >= ? AND os.data_saida <= ?`);
      const { rows: osRevenues } = await dbPool.query(osRevenueSql, [
        formattedStartDate,
        formattedEndDate,
      ]);

      const miscRevenueSql = pgQuery(`SELECT id, data, descricao, valor FROM receitas_avulsas WHERE data BETWEEN ? AND ?`);
      const { rows: miscRevenues } = await dbPool.query(miscRevenueSql, [
        dateOnlyStart,
        dateOnlyEnd,
      ]);

      const expensesSql = pgQuery(`SELECT id, data, descricao, categoria, tipo_despesa, valor FROM despesas WHERE data BETWEEN ? AND ?`);
      const { rows: expenses } = await dbPool.query(expensesSql, [
        dateOnlyStart,
        dateOnlyEnd,
      ]);

      // --- CRIAÇÃO DA LISTA UNIFICADA PARA FLUXO DE CAIXA ---
      const cashFlowItems = [];
      osRevenues.forEach((item) =>
        cashFlowItems.push({
          data: item.data, // DATETIME
          tipo: "Receita OS",
          descricao: `OS #${item.id} - ${item.nome_cliente}`,
          valor: Number(item.valor) || 0,
        })
      );
      miscRevenues.forEach((item) =>
        cashFlowItems.push({
          data: new Date(`${item.data.toISOString().split("T")[0]} 00:00:00`), // Converte DATE para DATETIME (início do dia)
          tipo: "Receita Avulsa",
          descricao: item.descricao,
          valor: Number(item.valor) || 0,
        })
      );
      expenses.forEach((item) =>
        cashFlowItems.push({
          data: new Date(`${item.data.toISOString().split("T")[0]} 00:00:00`), // Converte DATE para DATETIME
          tipo: `Despesa ${item.tipo_despesa}`, // Ex: Despesa Fixa, Despesa Variável
          descricao: item.descricao,
          valor: -(Number(item.valor) || 0), // Valor negativo para despesas
        })
      );

      // Ordena por data (mais antiga primeiro)
      cashFlowItems.sort((a, b) => a.data - b.data);
      // --- FIM DA CRIAÇÃO DA LISTA ---
      // 2. Calcular Resumo (similar ao get-financial-summary, mas sem precisar de nova busca)
      const totalOSRevenue = osRevenues.reduce(
        (sum, item) => sum + (Number(item.valor_total) || 0),
        0
      );
      const totalMiscRevenue = miscRevenues.reduce(
        (sum, item) => sum + (Number(item.valor) || 0),
        0
      );
      const totalRevenue = totalOSRevenue + totalMiscRevenue;

      let totalFixedExpenses = 0;
      let totalVariableExpenses = 0;
      expenses.forEach((exp) => {
        const value = Number(exp.valor) || 0;
        if (exp.tipo_despesa === "Fixa") {
          totalFixedExpenses += value;
        } else {
          totalVariableExpenses += value;
        }
      });
      const totalExpenses = totalFixedExpenses + totalVariableExpenses;
      const netProfit = totalRevenue - totalExpenses;

      console.log(
        `[export-report] Dados buscados. Receitas OS: ${osRevenues.length}, Avulsas: ${miscRevenues.length}, Despesas: ${expenses.length}`
      );

      // 3. Perguntar onde Salvar
      const { filePath } = await dialog.showSaveDialog({
        title: "Salvar Relatório Financeiro",
        defaultPath: `relatorio_financeiro_${dateOnlyStart}_a_${dateOnlyEnd}.xlsx`,
        filters: [{ name: "Arquivos Excel", extensions: ["xlsx"] }],
      });

      if (!filePath) {
        console.log("[export-report] Exportação cancelada pelo usuário.");
        return { success: false, error: "Usuário cancelou." };
      }

      // 4. Criar o Arquivo Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "GSTI App";
      workbook.created = new Date();

      // --- Planilha Resumo ---
      const summarySheet = workbook.addWorksheet("Resumo");
      summarySheet.addRow([
        "Período:",
        `${new Date(dateOnlyStart).toLocaleDateString("pt-BR")} a ${new Date(
          dateOnlyEnd
        ).toLocaleDateString("pt-BR")}`,
      ]);
      summarySheet.addRow([]);
      summarySheet.addRow(["Indicador", "Valor"]);
      summarySheet.addRow(["Receita Total (OS)", totalOSRevenue]);
      summarySheet.addRow(["Receita Total (Avulsas)", totalMiscRevenue]);
      summarySheet.addRow(["RECEITA TOTAL GERAL", totalRevenue]).font = {
        bold: true,
      };
      summarySheet.addRow(["Despesas Fixas", totalFixedExpenses]);
      summarySheet.addRow(["Despesas Variáveis", totalVariableExpenses]);
      summarySheet.addRow(["DESPESA TOTAL GERAL", totalExpenses]).font = {
        bold: true,
      };
      summarySheet.addRow([]);
      summarySheet.addRow(["LUCRO LÍQUIDO", netProfit]).font = {
        bold: true,
        color: { argb: netProfit >= 0 ? "FF008000" : "FFFF0000" },
      };
      ["B4", "B5", "B6", "B7", "B8", "B9", "B11"].forEach((cellRef) => {
        summarySheet.getCell(cellRef).numFmt =
          '"R$"#,##0.00;[Red]-"R$"#,##0.00';
      });
      summarySheet.getColumn("A").width = 25;
      summarySheet.getColumn("B").width = 20;

      // --- NOVA PLANILHA: Fluxo de Caixa ---
      const cashFlowSheet = workbook.addWorksheet("Fluxo de Caixa");
      cashFlowSheet.columns = [
        {
          header: "Data",
          key: "data",
          width: 20,
          style: { numFmt: "dd/mm/yyyy hh:mm" },
        }, // Formato com hora
        { header: "Tipo", key: "tipo", width: 20 },
        { header: "Descrição", key: "descricao", width: 50 },
        {
          header: "Valor",
          key: "valor",
          width: 20,
          style: { numFmt: '"R$"#,##0.00;[Red]-"R$"#,##0.00' },
        }, // Formato moeda com negativo
      ];
      // Adiciona os itens ordenados
      cashFlowItems.forEach((item) => {
        cashFlowSheet.addRow({
          ...item,
          data: item.data, // Já é objeto Date
        });
      });
      // --- FIM NOVA PLANILHA ---
      // --- Planilha Receitas OS ---
      const osSheet = workbook.addWorksheet("Receitas (OS)");
      osSheet.columns = [
        { header: "OS ID", key: "id", width: 10 },
        {
          header: "Data Saída",
          key: "data_saida",
          width: 15,
          style: { numFmt: "dd/mm/yyyy hh:mm" },
        },
        { header: "Cliente", key: "nome_cliente", width: 40 },
        {
          header: "Valor Total",
          key: "valor_total",
          width: 15,
          style: { numFmt: '"R$"#,##0.00' },
        },
      ];
      // Adiciona dados formatando a data corretamente para o Excel
      osRevenues.forEach((item) => {
        osSheet.addRow({
          ...item,
          data_saida: item.data_saida ? new Date(item.data_saida) : null, // Converte para objeto Date
        });
      });

      // --- Planilha Receitas Avulsas ---
      const miscSheet = workbook.addWorksheet("Receitas (Avulsas)");
      miscSheet.columns = [
        { header: "ID", key: "id", width: 10 },
        {
          header: "Data",
          key: "data",
          width: 15,
          style: { numFmt: "dd/mm/yyyy" },
        },
        { header: "Descrição", key: "descricao", width: 40 },
        {
          header: "Valor",
          key: "valor",
          width: 15,
          style: { numFmt: '"R$"#,##0.00' },
        },
      ];
      miscRevenues.forEach((item) => {
        miscSheet.addRow({
          ...item,
          data: item.data ? new Date(item.data) : null, // Converte para objeto Date
        });
      });

      // --- Planilha Despesas ---
      const expenseSheet = workbook.addWorksheet("Despesas");
      expenseSheet.columns = [
        { header: "ID", key: "id", width: 10 },
        {
          header: "Data",
          key: "data",
          width: 15,
          style: { numFmt: "dd/mm/yyyy" },
        },
        { header: "Descrição", key: "descricao", width: 40 },
        { header: "Categoria", key: "categoria", width: 20 },
        { header: "Tipo", key: "tipo_despesa", width: 15 },
        {
          header: "Valor",
          key: "valor",
          width: 15,
          style: { numFmt: '"R$"#,##0.00' },
        },
      ];
      expenses.forEach((item) => {
        expenseSheet.addRow({
          ...item,
          data: item.data ? new Date(item.data) : null, // Converte para objeto Date
        });
      });

      // 5. Salvar o Arquivo
      await workbook.xlsx.writeFile(filePath);
      console.log(`[export-report] Relatório salvo em: ${filePath}`);
      shell.openPath(filePath);
      return { success: true, path: filePath };
    } catch (error) {
      console.error("[export-report] Erro ao gerar Excel:", error);
      return { success: false, error: error.message };
    }
  }
);

// --- MÓDULO FINANCEIRO - RECEITAS AVULSAS ---

// Listener para buscar TODAS as receitas avulsas
ipcMain.handle("get-misc-revenues", async () => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const sql = "SELECT * FROM receitas_avulsas ORDER BY data DESC, id DESC";
  try {
    const { rows } = await dbPool.query(sql);
    return rows;
  } catch (error) {
    console.error("Erro ao buscar receitas avulsas:", error);
    return [];
  }
});

// Listener para ADICIONAR uma nova receita avulsa
ipcMain.handle("add-misc-revenue", async (event, revenueData) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const { descricao, valor, data } = revenueData;
  const sql = pgQuery(
    "INSERT INTO receitas_avulsas (descricao, valor, data) VALUES (?, ?, ?) RETURNING id"
  );
  try {
    const { rows } = await dbPool.query(sql, [
      descricao,
      parseFloat(valor) || 0,
      data,
    ]);
    return { success: true, id: rows[0].id };
  } catch (error) {
    console.error("Erro ao adicionar receita avulsa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR uma receita avulsa existente
ipcMain.handle("update-misc-revenue", async (event, revenueData) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const { id, descricao, valor, data } = revenueData;
  const sql = pgQuery(
    "UPDATE receitas_avulsas SET descricao = ?, valor = ?, data = ? WHERE id = ?"
  );
  try {
    await dbPool.query(sql, [descricao, parseFloat(valor) || 0, data, id]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar receita avulsa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR uma receita avulsa
ipcMain.handle("delete-misc-revenue", async (event, revenueId) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const sql = pgQuery("DELETE FROM receitas_avulsas WHERE id = ?");
  try {
    await dbPool.query(sql, [revenueId]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar receita avulsa:", error);
    return { success: false, error: error.message };
  }
});

// --- MÓDULO FINANCEIRO - DADOS PARA GRÁFICO ANUAL ---

ipcMain.handle("get-annual-summary", async () => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  try {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4; // Pega os últimos 5 anos (incluindo o atual)

    // Inicializa um objeto para armazenar os dados anuais
    const annualData = {};
    for (let year = startYear; year <= currentYear; year++) {
      annualData[year] = { year: year, totalRevenue: 0, totalExpenses: 0 };
    }

    // 1. Busca Receitas de OS agregadas por ANO
    const osRevenueSql = pgQuery(`
      SELECT EXTRACT(YEAR FROM data_saida)::int AS year, SUM(valor_total) AS annualRevenue
      FROM ordens_servico
      WHERE status IN ('Finalizado', 'Entregue')
        AND data_saida IS NOT NULL
        AND EXTRACT(YEAR FROM data_saida)::int >= ?
      GROUP BY EXTRACT(YEAR FROM data_saida)
    `);
    const { rows: osRevenues } = await dbPool.query(osRevenueSql, [startYear]);
    osRevenues.forEach((row) => {
      if (annualData[row.year]) {
        annualData[row.year].totalRevenue += Number(row.annualrevenue) || 0;
      }
    });

    // 2. Busca Receitas Avulsas agregadas por ANO
    const miscRevenueSql = pgQuery(`
      SELECT EXTRACT(YEAR FROM data)::int AS year, SUM(valor) AS annualRevenue
      FROM receitas_avulsas
      WHERE EXTRACT(YEAR FROM data)::int >= ?
      GROUP BY EXTRACT(YEAR FROM data)
    `);
    const { rows: miscRevenues } = await dbPool.query(miscRevenueSql, [startYear]);
    miscRevenues.forEach((row) => {
      if (annualData[row.year]) {
        annualData[row.year].totalRevenue += Number(row.annualrevenue) || 0;
      }
    });

    // 3. Busca Despesas agregadas por ANO
    const expensesSql = pgQuery(`
      SELECT EXTRACT(YEAR FROM data)::int AS year, SUM(valor) AS annualExpense
      FROM despesas
      WHERE EXTRACT(YEAR FROM data)::int >= ?
      GROUP BY EXTRACT(YEAR FROM data)
    `);
    const { rows: expenses } = await dbPool.query(expensesSql, [startYear]);
    expenses.forEach((row) => {
      if (annualData[row.year]) {
        annualData[row.year].totalExpenses += Number(row.annualexpense) || 0;
      }
    });

    // Converte o objeto de volta para um array ordenado por ano
    const resultData = Object.values(annualData).sort(
      (a, b) => a.year - b.year
    );

    return { success: true, annualData: resultData };
  } catch (error) {
    console.error("Erro ao buscar resumo anual:", error);
    return { success: false, error: error.message };
  }
});

// --- MÓDULO FINANCEIRO - CÁLCULO DE MÉDIA ---

ipcMain.handle("get-average-profit", async (event, { months = 6 } = {}) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // Garante que o número de meses seja válido
  const numMonths = Math.max(1, parseInt(months, 10));

  // Calcula a data de início (primeiro dia de X meses atrás)
  const endDate = new Date(); // Hoje
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - numMonths);
  startDate.setDate(1); // Vai para o primeiro dia daquele mês

  const formattedStartDate = startDate.toISOString().split("T")[0];
  const formattedEndDate = endDate.toISOString().split("T")[0];

  console.log(
    `[get-average-profit] Calculando média para ${numMonths} meses (${formattedStartDate} a ${formattedEndDate})`
  );

  try {
    // 1. Busca Receitas de OS agrupadas por ANO e MÊS
    const osRevenueSql = pgQuery(`
      SELECT
        EXTRACT(YEAR FROM data_saida)::int AS year,
        EXTRACT(MONTH FROM data_saida)::int AS month,
        SUM(valor_total) AS monthlyOsRevenue
      FROM ordens_servico
      WHERE status IN ('Finalizado', 'Entregue') AND data_saida IS NOT NULL
        AND data_saida >= ? AND data_saida <= ?
      GROUP BY EXTRACT(YEAR FROM data_saida), EXTRACT(MONTH FROM data_saida)
    `);
    const { rows: osRevenues } = await dbPool.query(osRevenueSql, [
      `${formattedStartDate} 00:00:00`,
      `${formattedEndDate} 23:59:59`,
    ]);

    // 2. Busca Receitas Avulsas agrupadas por ANO e MÊS
    const miscRevenueSql = pgQuery(`
      SELECT
        EXTRACT(YEAR FROM data)::int AS year,
        EXTRACT(MONTH FROM data)::int AS month,
        SUM(valor) AS monthlyMiscRevenue
      FROM receitas_avulsas
      WHERE data >= ? AND data <= ?
      GROUP BY EXTRACT(YEAR FROM data), EXTRACT(MONTH FROM data)
    `);
    const { rows: miscRevenues } = await dbPool.query(miscRevenueSql, [
      formattedStartDate,
      formattedEndDate,
    ]);

    // 3. Busca Despesas agrupadas por ANO e MÊS
    const expensesSql = pgQuery(`
      SELECT
        EXTRACT(YEAR FROM data)::int AS year,
        EXTRACT(MONTH FROM data)::int AS month,
        SUM(valor) AS monthlyExpense
      FROM despesas
      WHERE data >= ? AND data <= ?
      GROUP BY EXTRACT(YEAR FROM data), EXTRACT(MONTH FROM data)
    `);
    const { rows: expenses } = await dbPool.query(expensesSql, [
      formattedStartDate,
      formattedEndDate,
    ]);

    // 4. Agrega os resultados por mês (formato 'YYYY-MM')
    const monthlyProfitsMap = {};

    // Função auxiliar para obter a chave 'YYYY-MM'
    const getMonthKey = (year, month) =>
      `${year}-${String(month).padStart(2, "0")}`;

    osRevenues.forEach((row) => {
      const key = getMonthKey(row.year, row.month);
      monthlyProfitsMap[key] = monthlyProfitsMap[key] || {
        revenue: 0,
        expense: 0,
      };
      monthlyProfitsMap[key].revenue += Number(row.monthlyosrevenue) || 0;
    });

    miscRevenues.forEach((row) => {
      const key = getMonthKey(row.year, row.month);
      monthlyProfitsMap[key] = monthlyProfitsMap[key] || {
        revenue: 0,
        expense: 0,
      };
      monthlyProfitsMap[key].revenue += Number(row.monthlymiscrevenue) || 0;
    });

    expenses.forEach((row) => {
      const key = getMonthKey(row.year, row.month);
      monthlyProfitsMap[key] = monthlyProfitsMap[key] || {
        revenue: 0,
        expense: 0,
      };
      monthlyProfitsMap[key].expense += Number(row.monthlyexpense) || 0;
    });

    // 5. Calcula o lucro de cada mês e a média
    const monthlyProfits = [];
    Object.values(monthlyProfitsMap).forEach((monthData) => {
      monthlyProfits.push(monthData.revenue - monthData.expense);
    });

    if (monthlyProfits.length === 0) {
      console.log("[get-average-profit] Nenhum dado encontrado no período.");
      return { success: true, averageProfit: 0 }; // Retorna 0 se não houver dados
    }

    const totalProfitSum = monthlyProfits.reduce(
      (sum, profit) => sum + profit,
      0
    );
    const averageProfit = totalProfitSum / monthlyProfits.length; // Média dos meses COM dados

    console.log(
      `[get-average-profit] Lucros Mensais Calculados:`,
      monthlyProfits
    );
    console.log(`[get-average-profit] Média de Lucro:`, averageProfit);

    return { success: true, averageProfit };
  } catch (error) {
    console.error("Erro ao calcular média de lucro:", error);
    return { success: false, error: error.message };
  }
});

// --- RELATÓRIOS ---

// Listener para buscar OS por ID do Cliente
ipcMain.handle("get-os-by-client", async (event, clientId) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // Valida se clientId é um número
  const id = parseInt(clientId, 10);
  if (isNaN(id) || id <= 0) {
    return { success: false, error: "ID do Cliente inválido." };
  }

  // Busca OSs do cliente específico, incluindo detalhes do equipamento
  const sql = `
    SELECT 
      os.id, 
      CONCAT(os.tipo_equipamento, ' ', os.marca, ' ', os.modelo) AS equipamento, 
      os.status, 
      os.data_entrada, 
      os.data_saida, 
      os.valor_total,
      c.nome AS nome_cliente -- Inclui o nome para confirmação (opcional)
    FROM ordens_servico AS os
    JOIN clientes AS c ON os.id_cliente = c.id
    WHERE os.id_cliente = ?
    ORDER BY os.id DESC
  `;

  try {
    const { rows } = await dbPool.query(pgQuery(sql), [id]);
    return { success: true, data: rows };
  } catch (error) {
    console.error(`Erro ao buscar OS para cliente ${id}:`, error);
    return { success: false, error: error.message };
  }
});

// Listener para buscar OS por Status
ipcMain.handle("get-os-by-status", async (event, status) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // Valida se o status é uma string não vazia (poderíamos validar contra a lista de ENUMs se quiséssemos ser mais rigorosos)
  if (typeof status !== "string" || !status) {
    return { success: false, error: "Status inválido." };
  }

  // Busca OSs com o status específico, incluindo nome do cliente e detalhes do equipamento
  const sql = `
    SELECT 
      os.id, 
      CONCAT(os.tipo_equipamento, ' ', os.marca, ' ', os.modelo) AS equipamento, 
      os.status, 
      os.data_entrada, 
      os.data_saida, 
      os.valor_total,
      c.nome AS nome_cliente 
    FROM ordens_servico AS os
    JOIN clientes AS c ON os.id_cliente = c.id
    WHERE os.status = ? 
    ORDER BY os.id DESC
  `;

  try {
    const { rows } = await dbPool.query(pgQuery(sql), [status]);
    return { success: true, data: rows };
  } catch (error) {
    console.error(`Erro ao buscar OS com status ${status}:`, error);
    return { success: false, error: error.message };
  }
});

// Listener para buscar os Serviços/Produtos mais utilizados
ipcMain.handle(
  "get-most-used-services",
  async (event, { startDate, endDate }) => {
    if (!dbPool)
      return { success: false, error: "Banco de dados não configurado." };
    // Formata datas para query SQL
    const formattedStartDate = `${startDate} 00:00:00`;
    const formattedEndDate = `${endDate} 23:59:59`;

    // SQL que junta os itens da OS com os produtos/serviços e as OSs (para filtrar pela data de saída)
    // Ele soma a quantidade de cada item utilizado em OSs finalizadas/entregues no período.
    const sql = `
    SELECT 
      ps.id, 
      ps.descricao, 
      ps.tipo, 
      SUM(oi.quantidade) AS total_utilizado
    FROM os_itens oi
    JOIN produtos_servicos ps ON oi.id_produto_servico = ps.id
    JOIN ordens_servico os ON oi.id_os = os.id 
    WHERE 
      os.status IN ('Finalizado', 'Entregue') 
      AND os.data_saida IS NOT NULL 
      AND os.data_saida >= ? AND os.data_saida <= ?
    GROUP BY 
      ps.id, ps.descricao, ps.tipo 
    ORDER BY 
      total_utilizado DESC
    LIMIT 50; -- Limita aos 50 mais usados (opcional)
  `;

    try {
      const { rows } = await dbPool.query(pgQuery(sql), [
        formattedStartDate,
        formattedEndDate,
      ]);
      return { success: true, data: rows };
    } catch (error) {
      console.error(`Erro ao buscar serviços mais utilizados:`, error);
      return { success: false, error: error.message };
    }
  }
);

// Listener para buscar OS por Número de Série do Equipamento
ipcMain.handle("search-os-by-serial", async (event, serialNumber) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // Valida se o número de série é uma string não vazia
  if (typeof serialNumber !== "string" || !serialNumber.trim()) {
    // Retorna lista vazia se a busca for inválida ou vazia, em vez de erro
    return { success: true, data: [] };
  }

  // Busca OSs cujo numero_serie corresponde (busca exata ou parcial com LIKE)
  // Usaremos LIKE para permitir buscas parciais
  const searchTerm = `%${serialNumber.trim()}%`;
  const sql = `
    SELECT
      os.id,
      CONCAT(os.tipo_equipamento, ' ', os.marca, ' ', os.modelo) AS equipamento,
      os.numero_serie, -- Inclui o número de série no resultado
      os.status,
      os.data_entrada,
      os.data_saida,
      os.valor_total,
      c.nome AS nome_cliente
    FROM ordens_servico AS os
    JOIN clientes AS c ON os.id_cliente = c.id
    WHERE os.numero_serie LIKE ?
    ORDER BY os.id DESC
  `;

  try {
    const { rows } = await dbPool.query(pgQuery(sql), [searchTerm]);
    return { success: true, data: rows };
  } catch (error) {
    console.error(`Erro ao buscar OS pelo serial ${serialNumber}:`, error);
    return { success: false, error: error.message };
  }
});

// Listener para buscar Relatório Detalhado de Receitas
ipcMain.handle(
  "get-detailed-revenue-report",
  async (event, { startDate, endDate }) => {
    if (!dbPool)
      return { success: false, error: "Banco de dados não configurado." };
    const formattedStartDate = `${startDate} 00:00:00`;
    const formattedEndDate = `${endDate} 23:59:59`;
    const dateOnlyStart = startDate;
    const dateOnlyEnd = endDate;

    console.log(
      `[get-detailed-revenue] Buscando período: ${startDate} a ${endDate}`
    );

    try {
      // 1. Busca detalhes das Receitas de OS no período
      const osRevenueSql = pgQuery(`
      SELECT
        os.id,
        os.data_saida AS data,
        CONCAT('OS #', os.id, ' - ', c.nome) AS descricao,
        os.valor_total AS valor,
        'OS Finalizada' AS tipo
      FROM ordens_servico os
      JOIN clientes c ON os.id_cliente = c.id
      WHERE os.status IN ('Finalizado', 'Entregue')
        AND os.data_saida IS NOT NULL
        AND os.data_saida >= ? AND os.data_saida <= ?`);
      const { rows: osRevenues } = await dbPool.query(osRevenueSql, [
        formattedStartDate,
        formattedEndDate,
      ]);

      // 2. Busca detalhes das Receitas Avulsas no período
      const miscRevenueSql = pgQuery(`
      SELECT
        id,
        data,
        descricao,
        valor,
        'Receita Avulsa' AS tipo
      FROM receitas_avulsas
      WHERE data BETWEEN ? AND ?`);
      const { rows: miscRevenues } = await dbPool.query(miscRevenueSql, [
        dateOnlyStart,
        dateOnlyEnd,
      ]);

      // 3. Combina e Formata os resultados
      const combinedRevenues = [];
      osRevenues.forEach((item) =>
        combinedRevenues.push({
          id: `os-${item.id}`, // Cria um ID único prefixado
          data: item.data, // Já é DATETIME
          tipo: item.tipo,
          descricao: item.descricao,
          valor: Number(item.valor) || 0,
        })
      );
      miscRevenues.forEach((item) =>
        combinedRevenues.push({
          id: `misc-${item.id}`, // Cria um ID único prefixado
          data: new Date(`${item.data.toISOString().split("T")[0]} 00:00:00`), // Converte DATE para DATETIME
          tipo: item.tipo,
          descricao: item.descricao,
          valor: Number(item.valor) || 0,
        })
      );

      // 4. Ordena por data (mais antiga primeiro)
      combinedRevenues.sort((a, b) => a.data - b.data);

      console.log(
        `[get-detailed-revenue] Total de receitas encontradas: ${combinedRevenues.length}`
      );

      return { success: true, data: combinedRevenues };
    } catch (error) {
      console.error(`Erro ao buscar relatório detalhado de receitas:`, error);
      return { success: false, error: error.message };
    }
  }
);

// --- Handler para testar configurações de email ---
ipcMain.handle("test-email-settings", async (event, emailConfig) => {
  console.log("[Email Test] Recebido pedido para testar:", emailConfig);
  if (
    !emailConfig ||
    !emailConfig.host ||
    !emailConfig.port ||
    !emailConfig.user ||
    !emailConfig.pass ||
    !emailConfig.from
  ) {
    return { success: false, error: "Configurações de email incompletas." };
  }

  let testTransporter = null;
  try {
    // Cria um transporter TEMPORÁRIO com as configurações fornecidas
    testTransporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: parseInt(emailConfig.port, 10) || 587,
      secure: emailConfig.secure || false,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
      // Adiciona timeouts para evitar que a UI congele se a conexão falhar
      connectionTimeout: 10000, // 10 segundos
      greetingTimeout: 5000, // 5 segundos
      socketTimeout: 10000, // 10 segundos
    });

    console.log("[Email Test] Tentando verificar conexão...");
    // Tenta verificar a conexão
    await testTransporter.verify();
    console.log(
      "[Email Test] Verificação SMTP bem-sucedida. Tentando enviar email..."
    );

    // Se a verificação funcionou, tenta enviar um email de teste para o remetente
    const mailOptions = {
      from: `"GSTI App - Teste" <${emailConfig.from}>`,
      to: emailConfig.from, // Envia para o próprio remetente
      subject: "Teste de Configuração de Email - GSTI App",
      text: `Olá,\n\nSe você recebeu este email, as configurações SMTP no GSTI App estão funcionando corretamente!\n\nServidor: ${emailConfig.host}\nUsuário: ${emailConfig.user}\n`,
    };

    await testTransporter.sendMail(mailOptions);
    console.log("[Email Test] Email de teste enviado com sucesso.");
    return { success: true };
  } catch (error) {
    console.error("[Email Test] Erro:", error);
    // Retorna mensagens de erro mais específicas
    let errorMessage = "Erro desconhecido.";
    if (error.code === "ECONNECTION" || error.errno === -3008 /*ENOTFOUND*/)
      errorMessage =
        "Não foi possível conectar ao servidor SMTP (Host/Porta inválidos?).";
    else if (error.code === "EAUTH")
      errorMessage =
        "Falha na autenticação (Usuário/Senha SMTP incorretos?). Verifique também se o remetente está autorizado.";
    else if (error.command === "CONN")
      errorMessage = "Timeout ao conectar. Verifique Host, Porta e Firewall.";
    else if (error.command === "EHLO" || error.command === "AUTH")
      errorMessage = "Erro de autenticação ou negociação com o servidor SMTP.";
    else errorMessage = error.message;

    return { success: false, error: errorMessage };
  }
});

// --- Handler para selecionar arquivo de logo ---
ipcMain.handle("select-logo-file", async (event) => {
  // TODO: Adicionar verificação de Admin
  console.log("[Logo Select] Abrindo diálogo para selecionar logo...");
  try {
    const result = await dialog.showOpenDialog({
      title: "Selecionar Logo da Empresa",
      properties: ["openFile"],
      filters: [
        {
          name: "Imagens",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      console.log("[Logo Select] Usuário cancelou a seleção.");
      return { success: true, filePath: null, error: "Seleção cancelada." }; // Não é um erro real, só cancelamento
    }

    const selectedPath = result.filePaths[0];
    console.log("[Logo Select] Arquivo selecionado:", selectedPath);
    // Poderíamos adicionar validação extra aqui (tamanho, tipo MIME), mas por enquanto só retornamos o caminho
    return { success: true, filePath: selectedPath };
  } catch (error) {
    console.error("[Logo Select] Erro ao abrir diálogo:", error);
    return {
      success: false,
      error: "Erro ao tentar abrir o seletor de arquivos.",
    };
  }
});

// --- Handler para carregar a imagem da logo de forma segura ---
ipcMain.handle("load-logo-image", async (event, logoPath) => {
  console.log(`[Logo Load] Tentando carregar logo de: ${logoPath}`);
  if (!logoPath || typeof logoPath !== "string") {
    return { success: false, error: "Caminho da logo inválido." };
  }

  try {
    // Verifica se o arquivo existe
    if (!fs.existsSync(logoPath)) {
      console.warn(`[Logo Load] Arquivo não encontrado: ${logoPath}`);
      return {
        success: false,
        error: "Arquivo da logo não encontrado no caminho especificado.",
      };
    }

    // Valida tamanho máximo de 2 MB antes de converter
    const stats = fs.statSync(logoPath);
    if (stats.size / (1024 * 1024) > 2) {
      return { success: false, error: 'A imagem da logo deve ter no máximo 2 MB.' };
    }

    // Lê o arquivo como buffer
    const imageBuffer = fs.readFileSync(logoPath);
    // Converte para Base64 Data URL
    // Precisamos determinar o tipo MIME (simplesmente baseado na extensão por enquanto)
    const ext = path.extname(logoPath).toLowerCase();
    let mimeType = "";
    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".gif") mimeType = "image/gif";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".svg") mimeType = "image/svg+xml";
    else {
      console.warn(`[Logo Load] Tipo de arquivo não suportado: ${ext}`);
      return { success: false, error: "Formato de imagem não suportado." };
    }

    const base64Data = `data:${mimeType};base64,${imageBuffer.toString(
      "base64"
    )}`;
    console.log(
      "[Logo Load] Logo carregada com sucesso (convertida para Base64)."
    );
    return { success: true, imageData: base64Data };
  } catch (error) {
    console.error(
      `[Logo Load] Erro ao carregar/converter logo: ${logoPath}`,
      error
    );
    return {
      success: false,
      error: `Erro ao ler o arquivo da logo: ${error.message}`,
    };
  }
});

// --- FUNÇÕES DA JANELA ---
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "GSTI App - Gestão de Serviços de TI",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      devTools: !app.isPackaged,
    },
    contextIsolation: true,
    nodeIntegration: false
  });

  // --- MOVER openDevTools PARA CIMA e USAR app.isPackaged ---
  // Força a abertura ANTES de tentar carregar qualquer conteúdo
  // Mantenha descomentado APENAS para depurar a tela branca
  //mainWindow.webContents.openDevTools();

  if (isDev && !app.isPackaged) { // Verifica se está em modo DEV e NÃO empacotado
    console.log("[Window] Carregando URL de desenvolvimento...");
    mainWindow.loadURL("http://localhost:5173"); // Sua porta Vite
  } else {
    console.log("[Window] Carregando arquivo de produção...");
    // Caminho padrão para arquivos dentro do pacote asar
    const indexPath = path.join(__dirname, 'renderer/dist/index.html'); 
    console.log(`[Window] Tentando carregar: ${indexPath}`);
    mainWindow.loadFile(indexPath)
      .then(() => {
        console.log("[Window] loadFile bem-sucedido.");
      })
      .catch(err => {
        console.error("[Window] Erro ao carregar loadFile:", err);
        dialog.showErrorBox("Erro ao Carregar Aplicação", `Não foi possível carregar a interface.\nVerifique se a build foi gerada corretamente.\n\nErro: ${err.message}`);
      });
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
