const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const os = require("os");
const { Pool } = require("pg");
const axios = require("axios");
const fs = require("fs");
const ExcelJS = require("exceljs");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { execFile, execSync } = require("child_process");
const { Worker } = require("worker_threads");
const comunicacao = require("./os-comunicacao");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const archiver = require("archiver");
const unzipper = require("unzipper");

// Gera PDF em thread separada para não bloquear o processo principal.
// Em produção empacotada (ASAR), adicionar "asarUnpack": ["pdf-worker.js"] no electron-builder.
function runPdfWorker(data) {
  return new Promise((resolve, reject) => {
    const workerPath = path
      .join(__dirname, "pdf-worker.js")
      .replace("app.asar" + path.sep, "app.asar.unpacked" + path.sep);
    const worker = new Worker(workerPath, { workerData: data });
    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`PDF worker encerrou com código ${code}`));
    });
  });
}

const isDev = process.env.NODE_ENV !== "production";
const saltRounds = 10;

// Converte placeholders ? para $1, $2, ... compatíveis com pg
function pgQuery(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// --- LICENCIAMENTO ---
// Lógica em license-manager.js; chaves públicas e URL do servidor em license-config.js.
// O servidor de licenças (license-server/) detém a chave privada.
const { createLicenseManager } = require("./license-manager");
const licenseManager = createLicenseManager({
  getConfig: () => appConfig,
  saveConfig: () => fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2)),
  appVersion: app.getVersion(),
});

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
  branding: { companyName: "GSTI App", logoPath: null, backgroundPath: null },
  financeiro: { despesaFixaEstimada: 0 },
  emailNotifications: {
    notifyOnFinalize: false,
    notifyOnCreate: false,
    technicianEmail: "",
    notifyClientStatus: false,
    clientStatuses: comunicacao.STATUS_AVISO_PADRAO,
  },
  empresa: { documento: "", telefone: "", email: "", endereco: "", site: "" },
  documentos: { condicoesEntrada: "", termoGarantia: "" },
  mensagensStatus: {},
  permissions: { funcionario: { canSeeFinancial: false, canSeeReports: false } },
  autoBackup: {
    enabled: false,
    scheduledDays: [1, 2, 3, 4, 5],
    scheduledHour: 2,
    destinationPath: "",
    retentionDays: 30,
  },
  license: {
    email: "",
    token: "",
    tipo: "",
    plano: "",
    validade: null,
    detalhes: null,
    activatedAt: null,
    lastSeen: null,
    revoked: false,
    revogadaMotivo: "",
    serverUrl: "",
  },
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
        options: "-c statement_timeout=30000",
      });
      console.log("[DB] Pool de conexão inicializado com sucesso.");
      // Migrações automáticas de schema
      [
        "ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS data_prevista TIMESTAMP NULL",
        "ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS estoque_baixado BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE produtos_servicos ADD COLUMN IF NOT EXISTS estoque_atual INT NOT NULL DEFAULT 0",
        "ALTER TABLE produtos_servicos ADD COLUMN IF NOT EXISTS estoque_minimo INT NOT NULL DEFAULT 0",
        "ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS id_atendente INT NULL REFERENCES usuarios(id) ON DELETE SET NULL",
        "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cep VARCHAR(10)",
        "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logradouro TEXT",
        "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero VARCHAR(50)",
        "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro VARCHAR(100)",
        "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade VARCHAR(100)",
        "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado VARCHAR(2)",
        "CREATE TABLE IF NOT EXISTS metas_financeiras (id SERIAL PRIMARY KEY, descricao TEXT NOT NULL, valor NUMERIC(12,2) NOT NULL DEFAULT 0, criada_em TIMESTAMP NOT NULL DEFAULT NOW())",
        // Custo do produto/serviço (margem) e notas/custo por item da OS
        "ALTER TABLE produtos_servicos ADD COLUMN IF NOT EXISTS custo NUMERIC(10,2) NULL",
        "ALTER TABLE os_itens ADD COLUMN IF NOT EXISTS observacao TEXT NULL",
        "ALTER TABLE os_itens ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(10,2) NULL",
        // Histórico de mudanças de status da OS
        "CREATE TABLE IF NOT EXISTS os_status_historico (id SERIAL PRIMARY KEY, id_os INT NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE, status_anterior VARCHAR(50), status_novo VARCHAR(50) NOT NULL, id_usuario INT NULL REFERENCES usuarios(id) ON DELETE SET NULL, criado_em TIMESTAMP NOT NULL DEFAULT NOW())",
        "CREATE INDEX IF NOT EXISTS ix_os_status_historico_os ON os_status_historico(id_os, criado_em)",
        // Módulo de Equipamentos: série única POR CLIENTE (antes era única no banco inteiro)
        "ALTER TABLE equipamentos DROP CONSTRAINT IF EXISTS equipamentos_numero_serie_key",
        "ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS observacoes TEXT NULL",
        "ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP NOT NULL DEFAULT NOW()",
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_equipamentos_cliente_serie ON equipamentos(cliente_id, lower(numero_serie)) WHERE numero_serie IS NOT NULL AND numero_serie <> ''",
        "ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS id_equipamento INT NULL REFERENCES equipamentos(id) ON DELETE SET NULL",
        "CREATE INDEX IF NOT EXISTS ix_ordens_servico_equipamento ON ordens_servico(id_equipamento)",
        // Migra os equipamentos das OS antigas (idempotente: só OS ainda sem vínculo)
        "INSERT INTO equipamentos (cliente_id, tipo, marca, modelo, numero_serie) SELECT DISTINCT ON (os.id_cliente, lower(COALESCE(NULLIF(TRIM(os.numero_serie), ''), 'sem-serie|' || TRIM(COALESCE(os.tipo_equipamento, '')) || '|' || TRIM(COALESCE(os.marca, '')) || '|' || TRIM(COALESCE(os.modelo, ''))))) os.id_cliente, COALESCE(NULLIF(TRIM(os.tipo_equipamento), ''), 'Outro'), NULLIF(TRIM(os.marca), ''), NULLIF(TRIM(os.modelo), ''), NULLIF(TRIM(os.numero_serie), '') FROM ordens_servico os WHERE os.id_equipamento IS NULL AND NOT EXISTS (SELECT 1 FROM equipamentos e WHERE e.cliente_id = os.id_cliente AND lower(COALESCE(NULLIF(TRIM(e.numero_serie), ''), 'sem-serie|' || TRIM(COALESCE(e.tipo, '')) || '|' || TRIM(COALESCE(e.marca, '')) || '|' || TRIM(COALESCE(e.modelo, '')))) = lower(COALESCE(NULLIF(TRIM(os.numero_serie), ''), 'sem-serie|' || TRIM(COALESCE(os.tipo_equipamento, '')) || '|' || TRIM(COALESCE(os.marca, '')) || '|' || TRIM(COALESCE(os.modelo, ''))))) ORDER BY os.id_cliente, lower(COALESCE(NULLIF(TRIM(os.numero_serie), ''), 'sem-serie|' || TRIM(COALESCE(os.tipo_equipamento, '')) || '|' || TRIM(COALESCE(os.marca, '')) || '|' || TRIM(COALESCE(os.modelo, '')))), os.data_entrada DESC",
        "UPDATE ordens_servico os SET id_equipamento = e.id FROM equipamentos e WHERE os.id_equipamento IS NULL AND e.cliente_id = os.id_cliente AND lower(COALESCE(NULLIF(TRIM(e.numero_serie), ''), 'sem-serie|' || TRIM(COALESCE(e.tipo, '')) || '|' || TRIM(COALESCE(e.marca, '')) || '|' || TRIM(COALESCE(e.modelo, '')))) = lower(COALESCE(NULLIF(TRIM(os.numero_serie), ''), 'sem-serie|' || TRIM(COALESCE(os.tipo_equipamento, '')) || '|' || TRIM(COALESCE(os.marca, '')) || '|' || TRIM(COALESCE(os.modelo, ''))))",
      ].reduce(
        (anterior, sql) =>
          anterior.then(() =>
            dbPool.query(sql)
              .then(() => console.log("[Migration] OK:", sql.slice(0, 60)))
              .catch((e) => console.warn("[Migration]:", e.message))
          ),
        Promise.resolve()
      );
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

// --- NOTIFICAÇÕES POR E-MAIL ---

async function notifyOSCreated(osId, osData) {
  if (!mailTransporter || !appConfig.emailNotifications?.notifyOnCreate) return;
  const techEmail = appConfig.emailNotifications?.technicianEmail;
  if (!techEmail) return;

  const companyName = appConfig.branding?.companyName || "GSTI App";
  const from = appConfig.email?.from || appConfig.email?.user;
  let customerName = "Cliente";
  if (dbPool && osData.id_cliente) {
    try {
      const { rows } = await dbPool.query(
        pgQuery("SELECT nome FROM clientes WHERE id = ?"),
        [osData.id_cliente]
      );
      if (rows[0]) customerName = rows[0].nome;
    } catch (_) {}
  }

  const equipment = [osData.tipo_equipamento, osData.marca, osData.modelo]
    .filter(Boolean)
    .join(" - ");

  await mailTransporter.sendMail({
    from: `"${companyName}" <${from}>`,
    to: techEmail,
    subject: `Nova OS #${osId} - ${customerName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#3949ab;margin-bottom:4px">Nova Ordem de Serviço</h2>
        <p style="color:#757575;margin-top:0">${companyName}</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#555;width:140px"><strong>OS Nº</strong></td><td style="padding:6px 0">${osId}</td></tr>
          <tr><td style="padding:6px 0;color:#555"><strong>Cliente</strong></td><td style="padding:6px 0">${comunicacao.escapeHtml(customerName)}</td></tr>
          <tr><td style="padding:6px 0;color:#555"><strong>Equipamento</strong></td><td style="padding:6px 0">${comunicacao.escapeHtml(equipment || "Não informado")}</td></tr>
          ${osData.numero_serie ? `<tr><td style="padding:6px 0;color:#555"><strong>Nº de Série</strong></td><td style="padding:6px 0">${comunicacao.escapeHtml(osData.numero_serie)}</td></tr>` : ""}
          ${osData.defeito_relatado ? `<tr><td style="padding:6px 0;color:#555"><strong>Defeito</strong></td><td style="padding:6px 0">${comunicacao.escapeHtml(osData.defeito_relatado)}</td></tr>` : ""}
        </table>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
        <p style="color:#9e9e9e;font-size:12px">Enviado automaticamente pelo ${companyName}</p>
      </div>`,
  });
  console.log(`[Email] Nova OS #${osId} notificada para ${techEmail}`);
}

async function notifyOSFinalized(osId, osData, total) {
  if (!mailTransporter || !appConfig.emailNotifications?.notifyOnFinalize) return;
  if (!dbPool) return;

  const { rows } = await dbPool.query(
    pgQuery(
      "SELECT c.nome, c.email FROM clientes c JOIN ordens_servico os ON os.id_cliente = c.id WHERE os.id = ?"
    ),
    [osId]
  );
  const customer = rows[0];
  if (!customer?.email) return;

  const companyName = appConfig.branding?.companyName || "GSTI App";
  const from = appConfig.email?.from || appConfig.email?.user;
  const equipment = [osData.tipo_equipamento, osData.marca, osData.modelo]
    .filter(Boolean)
    .join(" ");
  const valueFormatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(total || 0);

  await mailTransporter.sendMail({
    from: `"${companyName}" <${from}>`,
    to: customer.email,
    subject: `Equipamento pronto para retirada! - OS #${osId}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#3949ab;margin-bottom:4px">Equipamento pronto!</h2>
        <p style="color:#757575;margin-top:0">${companyName}</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
        <p>Olá, <strong>${comunicacao.escapeHtml(customer.nome)}</strong>!</p>
        <p>Sua ordem de serviço foi concluída e o equipamento já está pronto para retirada.</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#555;width:140px"><strong>OS Nº</strong></td><td style="padding:6px 0">${osId}</td></tr>
          <tr><td style="padding:6px 0;color:#555"><strong>Equipamento</strong></td><td style="padding:6px 0">${comunicacao.escapeHtml(equipment || "Não informado")}</td></tr>
          ${osData.solucao_aplicada ? `<tr><td style="padding:6px 0;color:#555"><strong>Solução</strong></td><td style="padding:6px 0">${comunicacao.escapeHtml(osData.solucao_aplicada)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#555"><strong>Valor Total</strong></td><td style="padding:6px 0">${valueFormatted}</td></tr>
          ${osData.garantia_dias > 0 ? `<tr><td style="padding:6px 0;color:#555"><strong>Garantia</strong></td><td style="padding:6px 0">${osData.garantia_dias} dias a partir da retirada</td></tr>` : ""}
        </table>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
        <p>Entre em contato conosco para combinar a retirada.</p>
        <p style="color:#9e9e9e;font-size:12px">Enviado automaticamente pelo ${companyName}</p>
      </div>`,
  });
  console.log(`[Email] OS finalizada #${osId} notificada para ${customer.email}`);
}

// Dados da OS usados nas mensagens ao cliente.
async function dadosOSParaMensagem(osId) {
  const { rows } = await dbPool.query(
    `SELECT os.id, os.status, os.tipo_equipamento, os.marca, os.modelo, os.valor_total,
            c.nome AS nome_cliente, c.email AS email_cliente, c.telefone AS telefone_cliente
       FROM ordens_servico os JOIN clientes c ON c.id = os.id_cliente WHERE os.id = $1`,
    [osId]
  );
  return rows[0] || null;
}

// E-mail ao cliente quando a OS muda para um dos status escolhidos em Configurações.
async function notifyClientStatusChange(osId) {
  const cfg = appConfig.emailNotifications || {};
  if (!mailTransporter || !cfg.notifyClientStatus || !dbPool) return;
  const os = await dadosOSParaMensagem(osId);
  if (!os || !os.email_cliente) return;
  const statusAviso = Array.isArray(cfg.clientStatuses) ? cfg.clientStatuses : comunicacao.STATUS_AVISO_PADRAO;
  if (!statusAviso.includes(os.status)) return;
  // "Finalizado" já tem e-mail próprio quando essa opção está ligada.
  if (os.status === "Finalizado" && cfg.notifyOnFinalize) return;

  const empresa = appConfig.branding?.companyName || "GSTI App";
  const from = appConfig.email?.from || appConfig.email?.user;
  const texto = comunicacao.mensagemStatus(appConfig, os);
  const contato = comunicacao.linhaContatoEmpresa(appConfig);
  await mailTransporter.sendMail({
    from: `"${empresa.replace(/"/g, "")}" <${from}>`,
    to: os.email_cliente,
    subject: `OS #${os.id} — ${os.status}`,
    text: `${texto}${contato ? `\n\n${empresa}\n${contato}` : ""}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#3949ab;margin-bottom:4px">OS nº ${os.id}: ${comunicacao.escapeHtml(os.status)}</h2>
        <p style="color:#757575;margin-top:0">${comunicacao.escapeHtml(empresa)}</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
        <p style="font-size:15px;line-height:1.5">${comunicacao.escapeHtml(texto)}</p>
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
        <p style="color:#9e9e9e;font-size:12px">${comunicacao.escapeHtml(contato || `Enviado automaticamente pelo ${empresa}`)}</p>
      </div>`,
  });
  console.log(`[Email] Aviso de status (${os.status}) da OS #${os.id} enviado para ${os.email_cliente}`);
}

// Mensagem pronta para o WhatsApp do cliente, conforme o status atual da OS.
ipcMain.handle("get-os-whatsapp-message", async (event, osId) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  try {
    const os = await dadosOSParaMensagem(osId);
    if (!os) return { success: false, error: "OS não encontrada." };
    if (!String(os.telefone_cliente || "").replace(/\D/g, "")) {
      return { success: false, error: "Cliente sem telefone cadastrado." };
    }
    return { success: true, telefone: os.telefone_cliente, mensagem: comunicacao.mensagemStatus(appConfig, os) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// --- BACKUP AUTOMÁTICO ---

let autoBackupTimer = null;
let lastBackupDate = null; // "YYYY-MM-DD" — evita executar mais de uma vez no mesmo dia

function applyRetentionPolicy(destinationPath, retentionDays) {
  if (!retentionDays || retentionDays <= 0) return;
  try {
    const cutoff = Date.now() - retentionDays * 86400000;
    fs.readdirSync(destinationPath)
      .filter((f) => f.startsWith("gsti_backup_") && f.endsWith(".zip"))
      .forEach((f) => {
        const fPath = path.join(destinationPath, f);
        try {
          if (fs.statSync(fPath).mtimeMs < cutoff) {
            fs.unlinkSync(fPath);
            console.log(`[Retention] Removido: ${f}`);
          }
        } catch (_) {}
      });
  } catch (err) {
    console.error("[Retention] Erro:", err.message);
  }
}

async function runAutoBackup() {
  const config = appConfig?.autoBackup;
  if (!config?.enabled || !config?.destinationPath || !appConfig?.database) return;

  const db = appConfig.database;
  const pgDump = findPgTool("pg_dump");
  if (!pgDump) { console.error("[AutoBackup] pg_dump não encontrado."); return; }

  const dateStr = new Date().toISOString().slice(0, 10);
  const sqlName = `gsti_backup_${dateStr}.sql`;
  const zipName = `gsti_backup_${dateStr}.zip`;
  const tempSqlPath = path.join(app.getPath("temp"), sqlName);
  const destZipPath = path.join(config.destinationPath, zipName);

  lastBackupDate = dateStr;
  try {
    await execFileAsync(pgDump,
      ["-h", db.host, "-p", String(db.port), "-U", db.user, "-d", db.database,
       "--clean", "--if-exists", "-F", "p", "-f", tempSqlPath],
      { env: { ...process.env, PGPASSWORD: db.password } }
    );
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destZipPath);
      const arc = archiver("zip", { zlib: { level: 9 } });
      output.on("close", resolve);
      arc.on("error", reject);
      arc.pipe(output);
      arc.file(tempSqlPath, { name: sqlName });
      arc.finalize();
    });
    try { fs.unlinkSync(tempSqlPath); } catch (_) {}
    console.log(`[AutoBackup] Salvo: ${destZipPath}`);
    applyRetentionPolicy(config.destinationPath, config.retentionDays);
  } catch (err) {
    try { fs.unlinkSync(tempSqlPath); } catch (_) {}
    console.error("[AutoBackup] Erro:", err.message);
    lastBackupDate = null; // permite tentar novamente
  }
}

async function checkAndRunBackup() {
  const config = appConfig?.autoBackup;
  if (!config?.enabled || !config?.destinationPath) return;

  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();
  const todayStr = now.toISOString().slice(0, 10);

  const scheduledDays = config.scheduledDays ?? [1, 2, 3, 4, 5];
  const scheduledHour = config.scheduledHour ?? 2;

  if (currentHour !== scheduledHour) return;
  if (!scheduledDays.includes(currentDay)) return;
  if (lastBackupDate === todayStr) return;

  await runAutoBackup();
}

function scheduleAutoBackup() {
  if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
  const config = appConfig?.autoBackup;
  if (!config?.enabled || !config?.destinationPath) return;
  // Verifica a cada 30 minutos se chegou a hora agendada
  autoBackupTimer = setInterval(checkAndRunBackup, 30 * 60 * 1000);
  console.log(`[AutoBackup] Scheduler ativo — ${(config.scheduledDays ?? []).join(",")} dias, hora ${config.scheduledHour ?? 2}:00 → ${config.destinationPath}`);
}

// --- CARREGA A CONFIGURAÇÃO AO INICIAR ---
loadConfig();
// --- INICIALIZA OS SERVIÇOS QUE DEPENDEM DA CONFIG ---
// O dbPool e mailTransporter só serão realmente criados se setupComplete for true
initializeDbPool();
initializeMailTransporter();
scheduleAutoBackup();
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

    // --- Validação da licença (precisa estar ativada antes de concluir o setup) ---
    const licStatus = licenseManager.evaluate();
    if (!licStatus.active) {
      return {
        success: false,
        error: licStatus.motivo || "Ative o sistema antes de concluir a configuração.",
      };
    }

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
      // A licença já foi ativada e persistida em appConfig.license antes deste passo.
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
      initializeDbPool();
      initializeMailTransporter();
      scheduleAutoBackup();

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

// Setup em nova instalação quando o banco já existe: valida um usuário cadastrado
// em vez de criar outro administrador. Retorna o usuário para login automático.
ipcMain.handle(
  "save-initial-config-existing-user",
  async (event, { dbConfig, login, password }) => {
    const licStatus = licenseManager.evaluate();
    if (!licStatus.active) {
      return {
        success: false,
        error: licStatus.motivo || "Ative o sistema antes de concluir a configuração.",
      };
    }
    if (!dbConfig || !dbConfig.host || !dbConfig.port || !dbConfig.database || !dbConfig.user) {
      return { success: false, error: "Todos os campos de configuração do banco são obrigatórios." };
    }
    if (!login || !password) {
      return { success: false, error: "Informe login e senha." };
    }

    const database = {
      host: dbConfig.host,
      port: parseInt(dbConfig.port, 10) || 5432,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
    };
    let tempPool = null;
    try {
      tempPool = new Pool({ ...database, max: 1, connectionTimeoutMillis: 10000 });
      const { rows } = await tempPool.query(
        pgQuery("SELECT id, nome, senha, role FROM usuarios WHERE login = ?"),
        [login]
      );
      await tempPool.end();
      tempPool = null;

      const user = rows[0];
      if (!user || !(await bcrypt.compare(password, user.senha))) {
        return { success: false, error: "Login ou senha inválidos." };
      }

      appConfig.database = database;
      appConfig.setupComplete = true;
      fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
      console.log(`[Setup] Instalação vinculada ao banco existente (usuário ${user.nome}).`);

      initializeDbPool();
      initializeMailTransporter();
      scheduleAutoBackup();

      return { success: true, user: { id: user.id, nome: user.nome, role: user.role } };
    } catch (error) {
      if (tempPool) await tempPool.end().catch(() => {});
      console.error("[Setup] Erro ao vincular banco existente:", error);
      let errorMessage = error.message;
      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED")
        errorMessage = "Não foi possível conectar ao Host/Porta do banco.";
      else if (error.code === "28P01") errorMessage = "Usuário ou Senha do banco inválidos.";
      else if (error.code === "3D000") errorMessage = "Banco de dados não encontrado.";
      else if (error.code === "42P01")
        errorMessage =
          "Este banco não possui cadastro do GSTI App. Use \"Criar novo administrador\" ou verifique o nome do banco.";
      return { success: false, error: errorMessage };
    }
  }
);

// Handler para verificar se o setup inicial é necessário
ipcMain.handle("is-initial-setup-needed", async () => {
  return !appConfig.setupComplete;
});

// Ativação com chave de licença (GSTI-XXXX-XXXX-XXXX-XXXX)
ipcMain.handle("activate-license", async (event, { chave }) => {
  return await licenseManager.activate(chave);
});

// Início de período de teste
ipcMain.handle("start-trial", async (event, { email }) => {
  return await licenseManager.startTrial(email);
});

// Estado atual da licença (verificação local: assinatura, computador, validade)
ipcMain.handle("get-license-status", async () => {
  licenseManager.touchLastSeen();
  return { success: true, status: licenseManager.evaluate() };
});

// Revalidação online (revogação/renovação). Offline mantém o status local.
ipcMain.handle("revalidate-license", async () => {
  const { status, online } = await licenseManager.revalidate();
  return { success: true, status, online };
});

// Transferência: libera este computador no servidor e remove a licença local.
ipcMain.handle("deactivate-license", async () => {
  return await licenseManager.deactivate();
});

// Handler para buscar as configurações atuais (para a tela de Settings)
ipcMain.handle("get-app-settings", async () => {
  // Retorna uma cópia, excluindo senhas por segurança se necessário
  const settingsToSend = JSON.parse(JSON.stringify(appConfig));
  if (settingsToSend.database) delete settingsToSend.database.password; // Não envia senha do DB
  if (settingsToSend.email) delete settingsToSend.email.pass; // Não envia senha do Email
  if (settingsToSend.license) delete settingsToSend.license.token; // Não expõe o token de licença
  return {
    success: true,
    settings: settingsToSend,
    padroes: {
      statusOS: comunicacao.STATUS_OS,
      statusAviso: comunicacao.STATUS_AVISO_PADRAO,
      mensagensStatus: comunicacao.MENSAGENS_STATUS_PADRAO,
      condicoesEntrada: comunicacao.CONDICOES_ENTRADA_PADRAO,
      termoGarantia: comunicacao.TERMO_GARANTIA_PADRAO,
    },
  };
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
      ...appConfig,
      email: { ...appConfig.email, ...newSettings.email },
      branding: { ...appConfig.branding, ...newSettings.branding },
      emailNotifications: { ...appConfig.emailNotifications, ...(newSettings.emailNotifications || {}) },
      permissions: {
        funcionario: {
          ...appConfig.permissions?.funcionario,
          ...(newSettings.permissions?.funcionario || {}),
        },
      },
      autoBackup: { ...appConfig.autoBackup, ...(newSettings.autoBackup || {}) },
      empresa: { ...(appConfig.empresa || {}), ...(newSettings.empresa || {}) },
      documentos: { ...(appConfig.documentos || {}), ...(newSettings.documentos || {}) },
      mensagensStatus: { ...(appConfig.mensagensStatus || {}), ...(newSettings.mensagensStatus || {}) },
      // Licença não é editável pelas Configurações (token/URL preservados).
      license: appConfig.license,
      database: currentDbConfig,
      setupComplete: currentSetupStatus,
    };

    // Salva no arquivo
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
    console.log("[Config] Configurações salvas com sucesso.");

    initializeMailTransporter();
    scheduleAutoBackup();

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
  const { nome, tipo_pessoa, cpf_cnpj, telefone, email, logradouro, numero, bairro, cidade, estado, cep } = customerData;
  const sql = pgQuery(
    `INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, telefone, email, logradouro, numero, bairro, cidade, estado, cep)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
  );
  try {
    const { rows } = await dbPool.query(sql, [nome, tipo_pessoa, cpf_cnpj, telefone, email, logradouro || null, numero || null, bairro || null, cidade || null, estado || null, cep || null]);
    return { success: true, id: rows[0].id };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Busca de CEP via ViaCEP
ipcMain.handle("search-cep", async (event, cep) => {
  const clean = String(cep).replace(/\D/g, "");
  if (clean.length !== 8) return { success: false, error: "CEP inválido." };
  try {
    const { data } = await axios.get(`https://viacep.com.br/ws/${clean}/json/`, { timeout: 6000 });
    if (data.erro) return { success: false, error: "CEP não encontrado." };
    return { success: true, data };
  } catch (err) {
    const msg = err.code === "ECONNABORTED"
      ? "Tempo de resposta esgotado."
      : "Erro ao buscar CEP. Verifique a conexão com a internet.";
    return { success: false, error: msg };
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
  const { id, nome, tipo_pessoa, cpf_cnpj, telefone, email, logradouro, numero, bairro, cidade, estado, cep } = customerData;
  const sql = pgQuery(
    `UPDATE clientes SET nome = ?, tipo_pessoa = ?, cpf_cnpj = ?, telefone = ?, email = ?,
     logradouro = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, cep = ?
     WHERE id = ?`
  );
  try {
    await dbPool.query(sql, [nome, tipo_pessoa, cpf_cnpj, telefone, email, logradouro || null, numero || null, bairro || null, cidade || null, estado || null, cep || null, id]);
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

// Converte valor monetário vindo da tela ("1.234,56", "12.5", "") em número ou null.
function parseMoney(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  let t = String(v).trim();
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// --- EQUIPAMENTOS (inventário por cliente) ---

ipcMain.handle("get-equipments", async (event, filtros = {}) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  try {
    const params = [];
    let where = "";
    if (filtros.clienteId) {
      params.push(filtros.clienteId);
      where = "WHERE e.cliente_id = $1";
    }
    const { rows } = await dbPool.query(
      `SELECT e.id, e.cliente_id, c.nome AS nome_cliente, e.tipo, e.marca, e.modelo, e.numero_serie,
              e.observacoes, e.criado_em,
              COUNT(os.id)::int AS total_os,
              MAX(os.data_entrada) AS ultima_os_em,
              (SELECT o2.status FROM ordens_servico o2 WHERE o2.id_equipamento = e.id ORDER BY o2.data_entrada DESC LIMIT 1) AS ultimo_status
         FROM equipamentos e
         JOIN clientes c ON c.id = e.cliente_id
         LEFT JOIN ordens_servico os ON os.id_equipamento = e.id
         ${where}
        GROUP BY e.id, c.nome
        ORDER BY MAX(os.data_entrada) DESC NULLS LAST, e.id DESC`,
      params
    );
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

function dadosEquipamento(d) {
  const limpa = (v) => {
    const t = String(v ?? "").trim();
    return t || null;
  };
  return [d.cliente_id, limpa(d.tipo) || "Outro", limpa(d.marca), limpa(d.modelo), limpa(d.numero_serie), limpa(d.observacoes)];
}

ipcMain.handle("add-equipment", async (event, dados) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  if (!dados?.cliente_id) return { success: false, error: "Selecione o cliente." };
  try {
    const { rows } = await dbPool.query(
      "INSERT INTO equipamentos (cliente_id, tipo, marca, modelo, numero_serie, observacoes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      dadosEquipamento(dados)
    );
    return { success: true, id: rows[0].id };
  } catch (error) {
    return { success: false, error: mensagemErroEquipamento(error) };
  }
});

ipcMain.handle("update-equipment", async (event, dados) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  if (!dados?.id || !dados?.cliente_id) return { success: false, error: "Dados incompletos." };
  try {
    await dbPool.query(
      "UPDATE equipamentos SET cliente_id = $1, tipo = $2, marca = $3, modelo = $4, numero_serie = $5, observacoes = $6 WHERE id = $7",
      [...dadosEquipamento(dados), dados.id]
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: mensagemErroEquipamento(error) };
  }
});

ipcMain.handle("delete-equipment", async (event, id) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  try {
    const { rows } = await dbPool.query("SELECT COUNT(*)::int AS n FROM ordens_servico WHERE id_equipamento = $1", [id]);
    if (rows[0].n > 0) {
      return { success: false, error: `Este equipamento tem ${rows[0].n} OS no histórico e não pode ser excluído.` };
    }
    await dbPool.query("DELETE FROM equipamentos WHERE id = $1", [id]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-equipment-history", async (event, id) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  try {
    const { rows } = await dbPool.query(
      `SELECT os.id, os.status, os.data_entrada, os.data_saida, os.valor_total, os.defeito_relatado,
              os.solucao_aplicada, os.garantia_dias, u.nome AS nome_atendente
         FROM ordens_servico os LEFT JOIN usuarios u ON u.id = os.id_atendente
        WHERE os.id_equipamento = $1
        ORDER BY os.data_entrada DESC`,
      [id]
    );
    return { success: true, data: rows };
  } catch (error) {
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
  const custo = parseMoney(productData.custo);
  // Estoque só faz sentido para produtos; serviços ficam com zero.
  const ehProduto = tipo === "Produto";
  const estoqueAtual = ehProduto ? Math.max(0, parseInt(productData.estoque_atual, 10) || 0) : 0;
  const estoqueMinimo = ehProduto ? Math.max(0, parseInt(productData.estoque_minimo, 10) || 0) : 0;
  const sql = pgQuery(
    "INSERT INTO produtos_servicos (descricao, valor, tipo, custo, estoque_atual, estoque_minimo) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
  );
  try {
    const { rows } = await dbPool.query(sql, [descricao, valor, tipo, custo, estoqueAtual, estoqueMinimo]);
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
  const custo = parseMoney(productData.custo);
  const estoqueMinimo = tipo === "Produto" ? Math.max(0, parseInt(productData.estoque_minimo, 10) || 0) : 0;
  // O estoque atual é ajustado pela tela de Controle de Estoque (entradas/saídas).
  const sql = pgQuery(
    "UPDATE produtos_servicos SET descricao = ?, valor = ?, tipo = ?, custo = ?, estoque_minimo = ? WHERE id = ?"
  );

  try {
    await dbPool.query(sql, [descricao, valor, tipo, custo, estoqueMinimo, id]);
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
      CONCAT(os.tipo_equipamento, ' ', os.marca, ' ', os.modelo) AS equipamento,
      os.numero_serie, os.status, os.data_entrada, os.valor_total,
      c.nome AS nome_cliente, c.telefone AS telefone_cliente,
      u.nome AS nome_atendente
    FROM ordens_servico AS os
    JOIN clientes AS c ON os.id_cliente = c.id
    LEFT JOIN usuarios u ON u.id = os.id_atendente
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
      "SELECT id, descricao, valor, tipo, custo FROM produtos_servicos ORDER BY descricao ASC"
    );
    const { rows: users } = await dbPool.query(
      "SELECT id, nome FROM usuarios ORDER BY nome ASC"
    );
    return { success: true, customers, products, users };
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
      pgQuery(`SELECT ps.id, ps.descricao, oi.valor_unitario AS valor, ps.tipo, oi.quantidade,
              oi.observacao, COALESCE(oi.custo_unitario, ps.custo) AS custo_unitario
       FROM os_itens oi
       JOIN produtos_servicos ps ON oi.id_produto_servico = ps.id
       WHERE oi.id_os = ?
       ORDER BY oi.id`),
      [osId]
    );

    const { rows: historico } = await dbPool.query(
      `SELECT h.id, h.status_anterior, h.status_novo, h.criado_em, u.nome AS usuario
         FROM os_status_historico h LEFT JOIN usuarios u ON u.id = h.id_usuario
        WHERE h.id_os = $1 ORDER BY h.criado_em DESC, h.id DESC`,
      [osId]
    ).catch(() => ({ rows: [] }));

    return { success: true, os: osRows[0], items: itemRows, historico };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Encontra (ou cadastra) o equipamento da OS no inventário do cliente e devolve o id.
// - Com id_equipamento do mesmo cliente: usa e atualiza os dados do aparelho.
// - Sem id: procura pelo nº de série (ou tipo+marca+modelo quando não há série); se não achar, cadastra.
async function vincularEquipamentoOS(osData) {
  const limpa = (v) => {
    const t = String(v ?? "").trim();
    return t || null;
  };
  const clienteId = osData.id_cliente;
  const dados = {
    tipo: limpa(osData.tipo_equipamento) || "Outro",
    marca: limpa(osData.marca),
    modelo: limpa(osData.modelo),
    serie: limpa(osData.numero_serie),
  };
  if (!clienteId) return null;

  if (osData.id_equipamento) {
    const { rows } = await dbPool.query("SELECT id FROM equipamentos WHERE id = $1 AND cliente_id = $2", [osData.id_equipamento, clienteId]);
    if (rows.length) {
      await dbPool.query(
        "UPDATE equipamentos SET tipo = $1, marca = $2, modelo = $3, numero_serie = $4 WHERE id = $5",
        [dados.tipo, dados.marca, dados.modelo, dados.serie, rows[0].id]
      );
      return rows[0].id;
    }
  }

  const chave = dados.serie
    ? dados.serie.toLowerCase()
    : `sem-serie|${dados.tipo}|${dados.marca || ""}|${dados.modelo || ""}`.toLowerCase();
  const { rows: achados } = await dbPool.query(
    `SELECT e.id FROM equipamentos e WHERE e.cliente_id = $1 AND lower(COALESCE(NULLIF(TRIM(e.numero_serie), ''), 'sem-serie|' || TRIM(COALESCE(e.tipo, '')) || '|' || TRIM(COALESCE(e.marca, '')) || '|' || TRIM(COALESCE(e.modelo, '')))) = $2 ORDER BY e.id LIMIT 1`,
    [clienteId, chave]
  );
  if (achados.length) return achados[0].id;

  const { rows: novo } = await dbPool.query(
    "INSERT INTO equipamentos (cliente_id, tipo, marca, modelo, numero_serie) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [clienteId, dados.tipo, dados.marca, dados.modelo, dados.serie]
  );
  return novo[0].id;
}

const mensagemErroEquipamento = (error) =>
  error.code === "23505"
    ? "Este cliente já tem um equipamento cadastrado com esse número de série."
    : error.message;

// Registra a mudança de status (best-effort: não impede salvar a OS).
async function registrarStatusOS(osId, statusAnterior, statusNovo, usuarioId) {
  try {
    await dbPool.query(
      "INSERT INTO os_status_historico (id_os, status_anterior, status_novo, id_usuario) VALUES ($1, $2, $3, $4)",
      [osId, statusAnterior || null, statusNovo, usuarioId || null]
    );
  } catch (e) {
    console.error(`[Histórico] OS #${osId}:`, e.message);
  }
}

ipcMain.handle("add-os", async (event, { osData, total, usuarioId }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  // Atualizado para os novos campos
  const {
    id_cliente, tipo_equipamento, marca, modelo, numero_serie,
    defeito_relatado, observacoes_entrada, status, data_entrada,
    garantia_dias, data_prevista, id_atendente,
  } = osData;
  const sql = pgQuery(`INSERT INTO ordens_servico
    (id_cliente, tipo_equipamento, marca, modelo, numero_serie, defeito_relatado, observacoes_entrada, status, data_entrada, valor_total, garantia_dias, data_prevista, id_atendente, id_equipamento)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`);
  try {
    let idEquipamento = null;
    try {
      idEquipamento = await vincularEquipamentoOS(osData);
    } catch (e) {
      return { success: false, error: mensagemErroEquipamento(e) };
    }
    const { rows } = await dbPool.query(sql, [
      id_cliente, tipo_equipamento, marca, modelo, numero_serie,
      defeito_relatado, observacoes_entrada, status, data_entrada,
      total, garantia_dias, data_prevista || null, id_atendente || null, idEquipamento,
    ]);
    const osId = rows[0].id;
    await registrarStatusOS(osId, null, status, usuarioId);
    notifyOSCreated(osId, osData).catch((e) => console.error("[Email] notifyOSCreated:", e));
    notifyClientStatusChange(osId).catch((e) => console.error("[Email] aviso de status:", e));
    return { success: true, osId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-os", async (event, { osData, total, usuarioId }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  const {
    id, id_cliente, tipo_equipamento, marca, modelo, numero_serie,
    defeito_relatado, observacoes_entrada, laudo_tecnico, solucao_aplicada,
    status, data_entrada, garantia_dias, data_prevista, id_atendente,
  } = osData;
  try {
    const { rows } = await dbPool.query(
      pgQuery("SELECT status, data_saida, garantia_dias, estoque_baixado FROM ordens_servico WHERE id = ?"),
      [id]
    );
    const osAtual = rows[0];

    // --- VERIFICAÇÃO GARANTIA ---
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

    const baixarEstoque = status === "Finalizado" && !osAtual.estoque_baixado;

    let setDataSaidaSql = "";
    if (["Finalizado", "Entregue"].includes(status) && !osAtual.data_saida) {
      setDataSaidaSql = ", data_saida = NOW()";
    }

    const setEstoqueBaixadoSql = baixarEstoque ? ", estoque_baixado = TRUE" : "";

    let idEquipamento = null;
    try {
      idEquipamento = await vincularEquipamentoOS(osData);
    } catch (e) {
      return { success: false, error: mensagemErroEquipamento(e) };
    }

    const sql = pgQuery(`
      UPDATE ordens_servico SET
      id_cliente = ?, tipo_equipamento = ?, marca = ?, modelo = ?,
      numero_serie = ?, defeito_relatado = ?, observacoes_entrada = ?,
      laudo_tecnico = ?, solucao_aplicada = ?, status = ?,
      data_entrada = ?, valor_total = ?, garantia_dias = ?, data_prevista = ?,
      id_atendente = ?, id_equipamento = ?
      ${setDataSaidaSql}${setEstoqueBaixadoSql}
      WHERE id = ?`);

    await dbPool.query(sql, [
      id_cliente, tipo_equipamento, marca, modelo, numero_serie,
      defeito_relatado, observacoes_entrada, laudo_tecnico, solucao_aplicada,
      status, data_entrada, total, garantia_dias, data_prevista || null,
      id_atendente || null, idEquipamento, id,
    ]);

    if (baixarEstoque) {
      try {
        const { rows: itemRows } = await dbPool.query(
          pgQuery(`SELECT oi.id_produto_servico, oi.quantidade
                   FROM os_itens oi
                   JOIN produtos_servicos ps ON ps.id = oi.id_produto_servico
                   WHERE oi.id_os = ? AND ps.tipo = 'Produto'`),
          [id]
        );
        for (const item of itemRows) {
          await dbPool.query(
            `UPDATE produtos_servicos
             SET estoque_atual = GREATEST(0, estoque_atual - $1)
             WHERE id = $2`,
            [item.quantidade, item.id_produto_servico]
          );
        }
        console.log(`[Stock] Baixa automática OS #${id}: ${itemRows.length} produto(s) deduzido(s)`);
      } catch (stockErr) {
        console.error(`[Stock] Erro na baixa automática OS #${id}:`, stockErr.message);
      }
    }

    if (status !== osAtual.status) {
      await registrarStatusOS(id, osAtual.status, status, usuarioId);
      notifyClientStatusChange(id).catch((e) => console.error("[Email] aviso de status:", e));
    }

    if (status === "Finalizado" && osAtual.status !== "Finalizado") {
      notifyOSFinalized(id, osData, total).catch((e) =>
        console.error("[Email] notifyOSFinalized:", e)
      );
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar OS:", error);
    return { success: false, error: error.message };
  }
});

// Grava os itens da OS com nota e custo do momento (margem não muda se o custo do produto mudar depois).
async function inserirItensOS(conexao, osId, items) {
  const texto = (v) => {
    const t = String(v ?? "").trim();
    return t ? t.slice(0, 500) : null;
  };
  await conexao.query(
    `INSERT INTO os_itens (id_os, id_produto_servico, quantidade, valor_unitario, observacao, custo_unitario)
     SELECT $1, i.id, i.qtd, i.valor, i.obs, COALESCE(i.custo, ps.custo)
       FROM unnest($2::int[], $3::int[], $4::numeric[], $5::text[], $6::numeric[])
            AS i(id, qtd, valor, obs, custo)
       JOIN produtos_servicos ps ON ps.id = i.id`,
    [
      osId,
      items.map((i) => i.id),
      items.map((i) => i.quantidade),
      items.map((i) => i.valor),
      items.map((i) => texto(i.observacao)),
      items.map((i) => (i.custo_unitario === undefined || i.custo_unitario === null ? null : Number(i.custo_unitario))),
    ]
  );
}

ipcMain.handle("add-os-items", async (event, { osId, items }) => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };
  if (items.length === 0) return { success: true };
  try {
    await inserirItensOS(dbPool, osId, items);
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
      await inserirItensOS(client, osId, items);
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

// --- PDF COMPROVANTE DE ENTRADA (assíncrono via worker thread) ---
ipcMain.handle("generate-entry-receipt", async (event, osId) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };

  let osData;
  try {
    const { rows } = await dbPool.query(pgQuery(`
      SELECT os.*,
        c.nome AS nome_cliente, c.telefone AS telefone_cliente, c.cpf_cnpj,
        c.email AS email_cliente, c.endereco AS endereco_cliente,
        COALESCE(c.logradouro, '') AS logradouro,
        COALESCE(c.numero, '')    AS num_end,
        COALESCE(c.bairro, '')    AS bairro,
        COALESCE(c.cidade, '')    AS cidade,
        COALESCE(c.estado, '')    AS estado,
        COALESCE(c.cep, '')       AS cep,
        u.nome                    AS nome_atendente
      FROM ordens_servico os
      JOIN clientes c ON c.id = os.id_cliente
      LEFT JOIN usuarios u ON u.id = os.id_atendente
      WHERE os.id = ?`), [osId]);
    if (!rows.length) throw new Error("OS não encontrada.");
    osData = rows[0];
  } catch (err) {
    return { success: false, error: err.message };
  }

  const { filePath } = await dialog.showSaveDialog({
    title: "Salvar Comprovante de Entrada",
    defaultPath: `os_entrada_${osId}.pdf`,
    filters: [{ name: "Arquivos PDF", extensions: ["pdf"] }],
  });
  if (!filePath) return { success: false, error: "Cancelado." };

  try {
    const result = await runPdfWorker({
      type: "entry",
      osData,
      filePath,
      companyName: appConfig?.branding?.companyName || "GSTI App",
      logoPath: appConfig?.branding?.logoPath || null,
      contatoEmpresa: comunicacao.linhaContatoEmpresa(appConfig),
      enderecoEmpresa: appConfig?.empresa?.endereco || "",
      textos: comunicacao.textosDocumentos(appConfig),
    });
    if (!result.success) return result;
    shell.openPath(filePath);
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// --- PDF RECIBO DE SAÍDA / GARANTIA (assíncrono via worker thread) ---
ipcMain.handle("generate-exit-receipt", async (event, osId) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };

  let osData, itemsData;
  try {
    const osSql = pgQuery(`
      SELECT os.*, c.nome AS nome_cliente, c.telefone AS telefone_cliente, c.cpf_cnpj,
             c.email AS email_cliente, c.endereco AS endereco_cliente,
             COALESCE(c.logradouro, '') AS logradouro, COALESCE(c.numero, '') AS num_end,
             COALESCE(c.bairro, '') AS bairro, COALESCE(c.cidade, '') AS cidade,
             COALESCE(c.estado, '') AS estado
      FROM ordens_servico os JOIN clientes c ON c.id = os.id_cliente
      WHERE os.id = ?`);
    const { rows: osRows } = await dbPool.query(osSql, [osId]);
    if (!osRows.length) throw new Error("OS não encontrada.");
    osData = osRows[0];

    if (!osData.data_saida) {
      await dbPool.query(pgQuery("UPDATE ordens_servico SET data_saida = NOW() WHERE id = ?"), [osId]);
      const { rows: updated } = await dbPool.query(osSql, [osId]);
      osData = updated[0];
    }

    const { rows: itemRows } = await dbPool.query(pgQuery(`
      SELECT ps.descricao, oi.quantidade, oi.valor_unitario, oi.observacao
      FROM os_itens oi JOIN produtos_servicos ps ON oi.id_produto_servico = ps.id
      WHERE oi.id_os = ?
      ORDER BY oi.id`), [osId]);
    itemsData = itemRows;
  } catch (err) {
    return { success: false, error: `Erro ao buscar dados: ${err.message}` };
  }

  const { filePath } = await dialog.showSaveDialog({
    title: "Salvar Recibo de Saída e Garantia",
    defaultPath: `os_saida_garantia_${osId}.pdf`,
    filters: [{ name: "Arquivos PDF", extensions: ["pdf"] }],
  });
  if (!filePath) return { success: false, error: "Cancelado." };

  try {
    const result = await runPdfWorker({
      type: "exit",
      osData,
      itemsData,
      filePath,
      companyName: appConfig?.branding?.companyName || "GSTI App",
      logoPath: appConfig?.branding?.logoPath || null,
      contatoEmpresa: comunicacao.linhaContatoEmpresa(appConfig),
      enderecoEmpresa: appConfig?.empresa?.endereco || "",
      textos: comunicacao.textosDocumentos(appConfig),
    });
    if (!result.success) return result;
    shell.openPath(filePath);
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
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

ipcMain.handle('get-dashboard-stats', async () => {
  if (!dbPool) return { success: false, error: 'Banco de dados não configurado.' };
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const { rows: countRows } = await dbPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('Orçamento','Em Aberto','Aguardando Autorização','Aguardando Peça'))::int AS abertas,
        COUNT(*) FILTER (WHERE status = 'Em Andamento')::int AS em_andamento,
        COUNT(*) FILTER (WHERE status IN ('Finalizado','Entregue') AND data_saida IS NOT NULL
          AND EXTRACT(MONTH FROM data_saida)::int = $1 AND EXTRACT(YEAR FROM data_saida)::int = $2)::int AS finalizadas_mes
      FROM ordens_servico
    `, [month, year]);

    const { rows: osRevRows } = await dbPool.query(`
      SELECT COALESCE(SUM(valor_total),0) AS val FROM ordens_servico
      WHERE status IN ('Finalizado','Entregue') AND data_saida IS NOT NULL
        AND EXTRACT(MONTH FROM data_saida)::int=$1 AND EXTRACT(YEAR FROM data_saida)::int=$2
    `, [month, year]);

    const { rows: miscRevRows } = await dbPool.query(`
      SELECT COALESCE(SUM(valor),0) AS val FROM receitas_avulsas
      WHERE EXTRACT(MONTH FROM data)::int=$1 AND EXTRACT(YEAR FROM data)::int=$2
    `, [month, year]);

    const { rows: expRows } = await dbPool.query(`
      SELECT COALESCE(SUM(valor),0) AS val FROM despesas
      WHERE EXTRACT(MONTH FROM data)::int=$1 AND EXTRACT(YEAR FROM data)::int=$2
    `, [month, year]);

    const { rows: garantiaRows } = await dbPool.query(`
      SELECT o.id, c.nome AS nome_cliente,
        TRIM(CONCAT(o.tipo_equipamento,' ',COALESCE(o.marca,''),' ',COALESCE(o.modelo,''))) AS equipamento,
        o.data_saida, o.garantia_dias,
        (o.data_saida + (o.garantia_dias||' days')::INTERVAL)::DATE AS data_garantia,
        ((o.data_saida + (o.garantia_dias||' days')::INTERVAL)::DATE - CURRENT_DATE)::int AS dias_restantes
      FROM ordens_servico o JOIN clientes c ON c.id=o.id_cliente
      WHERE o.status='Entregue' AND o.data_saida IS NOT NULL AND o.garantia_dias > 0
        AND (o.data_saida + (o.garantia_dias||' days')::INTERVAL)::DATE
            BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY data_garantia ASC LIMIT 10
    `);

    const { rows: recentRows } = await dbPool.query(`
      SELECT o.id, c.nome AS nome_cliente,
        TRIM(CONCAT(o.tipo_equipamento,' ',COALESCE(o.marca,''),' ',COALESCE(o.modelo,''))) AS equipamento,
        o.status, o.data_entrada, o.defeito_relatado
      FROM ordens_servico o JOIN clientes c ON c.id=o.id_cliente
      WHERE o.status IN ('Orçamento','Em Aberto','Aguardando Autorização','Aguardando Peça','Em Andamento')
      ORDER BY o.data_entrada DESC LIMIT 5
    `);

    const receita_os = Number(osRevRows[0].val);
    const receita_avulsa = Number(miscRevRows[0].val);
    const receita = receita_os + receita_avulsa;
    const despesas = Number(expRows[0].val);

    return {
      success: true,
      counts: {
        abertas: countRows[0].abertas,
        em_andamento: countRows[0].em_andamento,
        finalizadas_mes: countRows[0].finalizadas_mes,
      },
      financeiro: {
        receita_os,
        receita_avulsa,
        receita_mes: receita,
        despesas_mes: despesas,
        lucro_mes: receita - despesas,
      },
      garantias: garantiaRows,
      recentOS: recentRows,
    };
  } catch (error) {
    console.error('[get-dashboard-stats] Erro:', error);
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

      return {
        success: true,
        summary: {
          totalRevenue,
          totalExpenses,
          netProfit,
          totalFixedExpenses,
          totalVariableExpenses,
          totalOSRevenue,
          totalMiscRevenue,
        },
      };
    } catch (error) {
      console.error("[get-financial-summary] Erro ao calcular resumo:", error);
      return { success: false, error: error.message };
    }
  }
);

// Despesas agrupadas por categoria (para gráfico pizza)
ipcMain.handle("get-expenses-by-category", async (event, { startDate, endDate }) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  try {
    const { rows } = await dbPool.query(pgQuery(`
      SELECT COALESCE(NULLIF(TRIM(categoria),''), 'Sem categoria') AS categoria,
             SUM(valor)::float AS total,
             COUNT(*)::int AS quantidade
      FROM despesas
      WHERE data BETWEEN ? AND ?
      GROUP BY COALESCE(NULLIF(TRIM(categoria),''), 'Sem categoria')
      ORDER BY total DESC`), [startDate, endDate]);
    return {
      success: true,
      data: rows.map((r) => ({
        categoria: r.categoria,
        total: Number(r.total) || 0,
        quantidade: Number(r.quantidade) || 0,
      })),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

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

      // --- Planilha Despesas por Categoria (resumo) ---
      const categoryMap = new Map();
      expenses.forEach((item) => {
        const cat =
          (item.categoria || "").trim() || "Sem categoria";
        const entry = categoryMap.get(cat) || { total: 0, quantidade: 0 };
        entry.total += Number(item.valor) || 0;
        entry.quantidade += 1;
        categoryMap.set(cat, entry);
      });
      const categoryRows = Array.from(categoryMap.entries())
        .map(([categoria, v]) => ({ categoria, ...v }))
        .sort((a, b) => b.total - a.total);

      const expCatSheet = workbook.addWorksheet("Despesas por Categoria");
      expCatSheet.columns = [
        { header: "Categoria", key: "categoria", width: 30 },
        { header: "Qtde. Lançamentos", key: "quantidade", width: 20 },
        {
          header: "Total",
          key: "total",
          width: 18,
          style: { numFmt: '"R$"#,##0.00' },
        },
        {
          header: "% do Total",
          key: "percentual",
          width: 14,
          style: { numFmt: '0.0"%"' },
        },
      ];
      expCatSheet.getRow(1).font = { bold: true };
      categoryRows.forEach((r) => {
        expCatSheet.addRow({
          categoria: r.categoria,
          quantidade: r.quantidade,
          total: r.total,
          percentual: totalExpenses > 0 ? (r.total / totalExpenses) * 100 : 0,
        });
      });
      const expCatTotalRow = expCatSheet.addRow({
        categoria: "TOTAL",
        quantidade: expenses.length,
        total: totalExpenses,
        percentual: totalExpenses > 0 ? 100 : 0,
      });
      expCatTotalRow.font = { bold: true };

      // --- Planilha Receitas por Fonte (resumo) ---
      const revSourceSheet = workbook.addWorksheet("Receitas por Fonte");
      revSourceSheet.columns = [
        { header: "Fonte", key: "fonte", width: 30 },
        {
          header: "Total",
          key: "total",
          width: 18,
          style: { numFmt: '"R$"#,##0.00' },
        },
        {
          header: "% do Total",
          key: "percentual",
          width: 14,
          style: { numFmt: '0.0"%"' },
        },
      ];
      revSourceSheet.getRow(1).font = { bold: true };
      [
        { fonte: "Receita de OS", total: totalOSRevenue },
        { fonte: "Receitas Avulsas", total: totalMiscRevenue },
      ].forEach((r) => {
        revSourceSheet.addRow({
          fonte: r.fonte,
          total: r.total,
          percentual: totalRevenue > 0 ? (r.total / totalRevenue) * 100 : 0,
        });
      });
      const revTotalRow = revSourceSheet.addRow({
        fonte: "TOTAL",
        total: totalRevenue,
        percentual: totalRevenue > 0 ? 100 : 0,
      });
      revTotalRow.font = { bold: true };

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

// --- PROJEÇÃO FINANCEIRA E METAS ---

// Calcula a receita média mensal e a despesa variável média mensal nos últimos N meses.
// A despesa fixa é estimada pelo usuário (config), então aqui só consideramos a variável.
ipcMain.handle("get-financial-projection", async (event, { months = 6 } = {}) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  const numMonths = Math.max(1, parseInt(months, 10));

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - numMonths);
  startDate.setDate(1);
  const fStart = startDate.toISOString().split("T")[0];
  const fEnd = endDate.toISOString().split("T")[0];

  const getMonthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;

  try {
    const osSql = pgQuery(`
      SELECT EXTRACT(YEAR FROM data_saida)::int AS year, EXTRACT(MONTH FROM data_saida)::int AS month,
             SUM(valor_total) AS total
      FROM ordens_servico
      WHERE status IN ('Finalizado', 'Entregue') AND data_saida IS NOT NULL
        AND data_saida >= ? AND data_saida <= ?
      GROUP BY EXTRACT(YEAR FROM data_saida), EXTRACT(MONTH FROM data_saida)`);
    const { rows: osRows } = await dbPool.query(osSql, [`${fStart} 00:00:00`, `${fEnd} 23:59:59`]);

    const miscSql = pgQuery(`
      SELECT EXTRACT(YEAR FROM data)::int AS year, EXTRACT(MONTH FROM data)::int AS month,
             SUM(valor) AS total
      FROM receitas_avulsas
      WHERE data >= ? AND data <= ?
      GROUP BY EXTRACT(YEAR FROM data), EXTRACT(MONTH FROM data)`);
    const { rows: miscRows } = await dbPool.query(miscSql, [fStart, fEnd]);

    // Apenas despesas variáveis (a fixa é estimada pelo usuário)
    const varSql = pgQuery(`
      SELECT EXTRACT(YEAR FROM data)::int AS year, EXTRACT(MONTH FROM data)::int AS month,
             SUM(valor) AS total
      FROM despesas
      WHERE tipo_despesa <> 'Fixa' AND data >= ? AND data <= ?
      GROUP BY EXTRACT(YEAR FROM data), EXTRACT(MONTH FROM data)`);
    const { rows: varRows } = await dbPool.query(varSql, [fStart, fEnd]);

    const revByMonth = {};
    const varByMonth = {};
    osRows.forEach((r) => {
      const k = getMonthKey(r.year, r.month);
      revByMonth[k] = (revByMonth[k] || 0) + (Number(r.total) || 0);
    });
    miscRows.forEach((r) => {
      const k = getMonthKey(r.year, r.month);
      revByMonth[k] = (revByMonth[k] || 0) + (Number(r.total) || 0);
    });
    varRows.forEach((r) => {
      const k = getMonthKey(r.year, r.month);
      varByMonth[k] = (varByMonth[k] || 0) + (Number(r.total) || 0);
    });

    // Média sobre os meses que tiveram algum movimento (receita ou despesa variável)
    const activeMonths = new Set([...Object.keys(revByMonth), ...Object.keys(varByMonth)]);
    const count = activeMonths.size;
    const sumRevenue = Object.values(revByMonth).reduce((s, v) => s + v, 0);
    const sumVariable = Object.values(varByMonth).reduce((s, v) => s + v, 0);

    const avgRevenue = count > 0 ? sumRevenue / count : 0;
    const avgVariableExpense = count > 0 ? sumVariable / count : 0;

    return {
      success: true,
      avgRevenue,
      avgVariableExpense,
      monthsWithData: count,
      months: numMonths,
    };
  } catch (error) {
    console.error("[get-financial-projection] Erro:", error);
    return { success: false, error: error.message };
  }
});

// Lê os parâmetros financeiros de planejamento (config.json)
ipcMain.handle("get-financial-config", async () => {
  const financeiro = appConfig.financeiro || { despesaFixaEstimada: 0 };
  return { success: true, financeiro };
});

// Salva os parâmetros financeiros de planejamento (config.json)
ipcMain.handle("save-financial-config", async (event, { despesaFixaEstimada }) => {
  try {
    const value = Number(despesaFixaEstimada);
    if (!isFinite(value) || value < 0) {
      return { success: false, error: "Valor de despesa fixa estimada inválido." };
    }
    appConfig.financeiro = { ...appConfig.financeiro, despesaFixaEstimada: value };
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
    return { success: true, financeiro: appConfig.financeiro };
  } catch (error) {
    console.error("[save-financial-config] Erro:", error);
    return { success: false, error: error.message };
  }
});

// Metas financeiras (CRUD)
ipcMain.handle("get-financial-goals", async () => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  try {
    const { rows } = await dbPool.query(
      "SELECT id, descricao, valor::float AS valor, criada_em FROM metas_financeiras ORDER BY criada_em ASC, id ASC"
    );
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        descricao: r.descricao,
        valor: Number(r.valor) || 0,
        criada_em: r.criada_em,
      })),
    };
  } catch (error) {
    console.error("[get-financial-goals] Erro:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("add-financial-goal", async (event, { descricao, valor }) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  const desc = String(descricao || "").trim();
  const value = Number(valor);
  if (!desc) return { success: false, error: "Informe uma descrição para a meta." };
  if (!isFinite(value) || value <= 0) {
    return { success: false, error: "Informe um valor de meta maior que zero." };
  }
  try {
    const { rows } = await dbPool.query(
      pgQuery("INSERT INTO metas_financeiras (descricao, valor) VALUES (?, ?) RETURNING id"),
      [desc, value]
    );
    return { success: true, id: rows[0].id };
  } catch (error) {
    console.error("[add-financial-goal] Erro:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("delete-financial-goal", async (event, id) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  try {
    await dbPool.query(pgQuery("DELETE FROM metas_financeiras WHERE id = ?"), [id]);
    return { success: true };
  } catch (error) {
    console.error("[delete-financial-goal] Erro:", error);
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

// Controle de Estoque
ipcMain.handle('get-stock', async () => {
  if (!dbPool) return { success: false, error: 'Banco não configurado.' };
  try {
    const { rows } = await dbPool.query(`
      SELECT id, descricao, tipo, valor, estoque_atual, estoque_minimo
      FROM produtos_servicos ORDER BY descricao ASC
    `);
    return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('adjust-stock', async (event, { productId, quantity, operation }) => {
  if (!dbPool) return { success: false, error: 'Banco não configurado.' };
  try {
    const delta = operation === 'entry' ? Math.abs(quantity) : -Math.abs(quantity);
    const { rows } = await dbPool.query(`
      UPDATE produtos_servicos
      SET estoque_atual = GREATEST(0, estoque_atual + $1)
      WHERE id = $2
      RETURNING estoque_atual
    `, [delta, productId]);
    if (!rows.length) return { success: false, error: 'Produto não encontrado.' };
    return { success: true, newStock: rows[0].estoque_atual };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('update-stock-min', async (event, { productId, estoque_minimo }) => {
  if (!dbPool) return { success: false, error: 'Banco não configurado.' };
  try {
    await dbPool.query('UPDATE produtos_servicos SET estoque_minimo=$1 WHERE id=$2', [estoque_minimo, productId]);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
});

// Relatório de Lucratividade por Serviço
ipcMain.handle('get-profitability-report', async () => {
  if (!dbPool) return { success: false, error: 'Banco não configurado.' };
  try {
    const { rows } = await dbPool.query(`
      SELECT
        ps.id, ps.descricao, ps.tipo,
        ps.valor AS preco_tabela,
        ps.custo AS custo_tabela,
        COUNT(v.id)::int AS total_vendas,
        COALESCE(SUM(v.quantidade),0)::int AS total_quantidade,
        COALESCE(SUM(v.quantidade * v.valor_unitario),0) AS receita_total,
        COALESCE(AVG(v.valor_unitario),0) AS preco_medio,
        COALESCE(SUM(v.quantidade * COALESCE(v.custo_unitario, ps.custo)),0) AS custo_total,
        -- Itens vendidos sem custo informado (a margem fica incompleta)
        COUNT(v.id) FILTER (WHERE COALESCE(v.custo_unitario, ps.custo) IS NULL)::int AS vendas_sem_custo
      FROM produtos_servicos ps
      LEFT JOIN (
        SELECT oi.* FROM os_itens oi
        JOIN ordens_servico os ON os.id = oi.id_os AND os.status IN ('Finalizado','Entregue')
      ) v ON v.id_produto_servico = ps.id
      GROUP BY ps.id, ps.descricao, ps.tipo, ps.valor, ps.custo
      ORDER BY receita_total DESC
    `);
    return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
});

// Timeline de OS por cliente
ipcMain.handle('get-customer-timeline', async (event, clientId) => {
  if (!dbPool) return { success: false, error: 'Banco não configurado.' };
  try {
    const { rows: statsRows } = await dbPool.query(`
      SELECT
        COUNT(*)::int AS total_os,
        COUNT(*) FILTER (WHERE status NOT IN ('Finalizado','Entregue','Cancelado'))::int AS os_abertas,
        COUNT(*) FILTER (WHERE status IN ('Finalizado','Entregue'))::int AS os_finalizadas,
        COALESCE(SUM(CASE WHEN status IN ('Finalizado','Entregue') THEN valor_total ELSE 0 END),0) AS total_gasto
      FROM ordens_servico WHERE id_cliente = $1
    `, [clientId]);
    const { rows: osRows } = await dbPool.query(`
      SELECT id, status, data_entrada, data_saida, valor_total,
        TRIM(CONCAT(tipo_equipamento,' ',COALESCE(marca,''),' ',COALESCE(modelo,''))) AS equipamento,
        defeito_relatado, solucao_aplicada
      FROM ordens_servico WHERE id_cliente = $1 ORDER BY data_entrada DESC
    `, [clientId]);
    return { success: true, stats: statsRows[0], os: osRows };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Agenda mensal de OS (por data_prevista)
ipcMain.handle('get-os-agenda', async (event, { month, year }) => {
  if (!dbPool) return { success: false, error: 'Banco não configurado.' };
  try {
    const { rows } = await dbPool.query(`
      SELECT o.id, o.status, o.data_prevista,
        c.nome AS nome_cliente,
        TRIM(CONCAT(o.tipo_equipamento,' ',COALESCE(o.marca,''),' ',COALESCE(o.modelo,''))) AS equipamento
      FROM ordens_servico o JOIN clientes c ON c.id=o.id_cliente
      WHERE o.data_prevista IS NOT NULL
        AND EXTRACT(MONTH FROM o.data_prevista)::int = $1
        AND EXTRACT(YEAR FROM o.data_prevista)::int = $2
        AND o.status NOT IN ('Entregue','Cancelado')
      ORDER BY o.data_prevista ASC
    `, [month, year]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Painel de Garantias
ipcMain.handle('get-warranty-panel', async () => {
  if (!dbPool) return { success: false, error: 'Banco de dados não configurado.' };
  try {
    const { rows } = await dbPool.query(`
      SELECT
        o.id,
        c.nome AS nome_cliente,
        c.telefone,
        c.email,
        TRIM(CONCAT(o.tipo_equipamento, ' ', COALESCE(o.marca,''), ' ', COALESCE(o.modelo,''))) AS equipamento,
        o.numero_serie,
        o.data_saida,
        o.garantia_dias,
        o.solucao_aplicada,
        (o.data_saida + (o.garantia_dias || ' days')::INTERVAL)::DATE AS data_vencimento,
        ((o.data_saida + (o.garantia_dias || ' days')::INTERVAL)::DATE - CURRENT_DATE)::int AS dias_restantes
      FROM ordens_servico o
      JOIN clientes c ON c.id = o.id_cliente
      WHERE o.status = 'Entregue'
        AND o.data_saida IS NOT NULL
        AND o.garantia_dias > 0
      ORDER BY dias_restantes ASC
    `);
    return { success: true, data: rows };
  } catch (error) {
    console.error('[get-warranty-panel] Erro:', error);
    return { success: false, error: error.message };
  }
});

// Handler para enviar e-mail de aviso de garantia
ipcMain.handle("send-warranty-email", async (event, { clienteEmail, clienteNome, equipamento, diasRestantes, dataVencimento }) => {
  if (!mailTransporter) return { success: false, error: "E-mail não configurado. Configure o SMTP nas Configurações." };
  if (!clienteEmail) return { success: false, error: "Cliente sem e-mail cadastrado." };

  const companyName = appConfig.branding?.companyName || "GSTI App";
  const from = appConfig.email?.from || appConfig.email?.user;
  const diasTexto = diasRestantes < 0
    ? "já expirou"
    : diasRestantes === 0
    ? "vence hoje"
    : `vence em ${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""}`;

  try {
    await mailTransporter.sendMail({
      from: `"${companyName}" <${from}>`,
      to: clienteEmail,
      subject: `Aviso de Garantia — ${equipamento} · ${companyName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#3949ab;margin-bottom:4px">Aviso de Vencimento de Garantia</h2>
          <p style="color:#757575;margin-top:0">${companyName}</p>
          <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
          <p>Olá, <strong>${clienteNome}</strong>!</p>
          <p>Informamos que a garantia do seu equipamento <strong>${equipamento}</strong>
             <strong>${diasTexto}</strong> (${dataVencimento}).</p>
          <p>Caso precise de assistência ou tenha dúvidas, entre em contato conosco.</p>
          <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
          <p style="color:#9e9e9e;font-size:12px">Enviado automaticamente pelo ${companyName}</p>
        </div>`,
    });
    return { success: true };
  } catch (err) {
    console.error("[send-warranty-email] Erro:", err.message);
    return { success: false, error: err.message };
  }
});

// Abre páginas fixas do site de vendas (planos, área do cliente) no navegador.
ipcMain.handle("open-license-site", async (event, { pagina } = {}) => {
  const LICENSE_CONFIG = require("./license-config");
  const base = String(LICENSE_CONFIG.siteUrl || LICENSE_CONFIG.serverUrl || "").replace(/\/+$/, "");
  const caminhos = { planos: "/#planos", cliente: "/cliente" };
  if (!/^https?:\/\//.test(base) || !caminhos[pagina]) return { success: false, error: "Site não configurado." };
  shell.openExternal(base + caminhos[pagina]);
  return { success: true };
});

// Handler para abrir link do WhatsApp
ipcMain.handle("open-whatsapp-link", async (event, { telefone, mensagem }) => {
  const digits = String(telefone || "").replace(/\D/g, "");
  if (digits.length < 10) return { success: false, error: "Telefone inválido." };
  const numero = digits.length >= 12 && digits.startsWith("55") ? digits : `55${digits}`;
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  shell.openExternal(url);
  return { success: true };
});

// --- Utilitário: localiza pg_dump / psql no sistema ---
function findPgTool(toolName) {
  try {
    execSync(
      process.platform === "win32" ? `where ${toolName}` : `which ${toolName}`,
      { stdio: "ignore" }
    );
    return toolName; // encontrado no PATH
  } catch {}
  if (process.platform === "win32") {
    for (const v of ["17", "16", "15", "14", "13", "12"]) {
      const p = path.join("C:\\Program Files\\PostgreSQL", v, "bin", `${toolName}.exe`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// Backup do banco via pg_dump (comprimido em .zip)
ipcMain.handle("backup-database", async () => {
  const db = appConfig?.database;
  if (!db) return { success: false, error: "Banco não configurado." };

  const pgDump = findPgTool("pg_dump");
  if (!pgDump)
    return { success: false, error: "pg_dump não encontrado. Verifique se o PostgreSQL está instalado e disponível no PATH." };

  const dateStr = new Date().toISOString().slice(0, 10);
  const sqlName = `gsti_backup_${dateStr}.sql`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Salvar Backup do Banco",
    defaultPath: path.join(app.getPath("documents"), `gsti_backup_${dateStr}.zip`),
    filters: [{ name: "Backup ZIP", extensions: ["zip"] }],
  });
  if (canceled || !filePath) return { success: false, canceled: true };

  const tempSqlPath = path.join(app.getPath("temp"), sqlName);
  try {
    await execFileAsync(pgDump,
      ["-h", db.host, "-p", String(db.port), "-U", db.user, "-d", db.database,
       "--clean", "--if-exists", "-F", "p", "-f", tempSqlPath],
      { env: { ...process.env, PGPASSWORD: db.password } }
    );
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(filePath);
      const arc = archiver("zip", { zlib: { level: 9 } });
      output.on("close", resolve);
      arc.on("error", reject);
      arc.pipe(output);
      arc.file(tempSqlPath, { name: sqlName });
      arc.finalize();
    });
    try { fs.unlinkSync(tempSqlPath); } catch (_) {}
    return { success: true, path: filePath };
  } catch (err) {
    try { fs.unlinkSync(tempSqlPath); } catch (_) {}
    console.error("[backup-database] Erro:", err);
    return { success: false, error: err.stderr || err.message };
  }
});

// Restauração do banco via psql (aceita .zip ou .sql)
ipcMain.handle("restore-database", async () => {
  const db = appConfig?.database;
  if (!db) return { success: false, error: "Banco não configurado." };

  const psql = findPgTool("psql");
  if (!psql)
    return { success: false, error: "psql não encontrado. Verifique se o PostgreSQL está instalado e disponível no PATH." };

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Selecionar Arquivo de Backup",
    filters: [
      { name: "Backup ZIP", extensions: ["zip"] },
      { name: "Arquivo SQL", extensions: ["sql"] },
    ],
    properties: ["openFile"],
  });
  if (canceled || !filePaths?.length) return { success: false, canceled: true };

  const selectedFile = filePaths[0];
  let sqlPath = selectedFile;
  let tempDir = null;

  try {
    if (selectedFile.toLowerCase().endsWith(".zip")) {
      tempDir = path.join(app.getPath("temp"), `gsti_restore_${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      await new Promise((resolve, reject) => {
        fs.createReadStream(selectedFile)
          .pipe(unzipper.Extract({ path: tempDir }))
          .on("close", resolve)
          .on("error", reject);
      });
      const files = fs.readdirSync(tempDir);
      const sqlFile = files.find((f) => f.endsWith(".sql"));
      if (!sqlFile) throw new Error("Nenhum arquivo .sql encontrado no ZIP.");
      sqlPath = path.join(tempDir, sqlFile);
    }

    await execFileAsync(psql,
      ["-h", db.host, "-p", String(db.port), "-U", db.user, "-d", db.database,
       "-v", "ON_ERROR_STOP=1", "-f", sqlPath],
      { env: { ...process.env, PGPASSWORD: db.password } }
    );
    return { success: true };
  } catch (err) {
    console.error("[restore-database] Erro:", err);
    return { success: false, error: err.stderr || err.message };
  } finally {
    if (tempDir) { try { fs.rmSync(tempDir, { recursive: true }); } catch (_) {} }
  }
});

// Selecionar pasta de destino para backup automático
ipcMain.handle("select-backup-folder", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Selecionar Pasta de Destino para Backup",
    properties: ["openDirectory"],
  });
  if (canceled || !filePaths?.length) return { success: false, canceled: true };
  return { success: true, folderPath: filePaths[0] };
});

// Relatório de OS por Atendente
ipcMain.handle("get-os-by-attendant", async (event, { userId, startDate, endDate }) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };
  if (!userId) return { success: false, error: "Usuário não informado." };

  let sql = `
    SELECT
      os.id,
      TRIM(CONCAT(os.tipo_equipamento,' ',COALESCE(os.marca,''),' ',COALESCE(os.modelo,''))) AS equipamento,
      os.status, os.data_entrada, os.data_saida, os.valor_total,
      c.nome AS nome_cliente
    FROM ordens_servico os
    JOIN clientes c ON c.id = os.id_cliente
    WHERE os.id_atendente = $1`;
  const params = [userId];

  if (startDate && endDate) {
    sql += ` AND os.data_entrada >= $2 AND os.data_entrada <= $3`;
    params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
  }
  sql += " ORDER BY os.id DESC";

  try {
    const { rows } = await dbPool.query(sql, params);
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Fluxo de Caixa Detalhado (Receitas OS + Avulsas + Despesas cronológico)
ipcMain.handle("get-detailed-cashflow", async (event, { startDate, endDate }) => {
  if (!dbPool) return { success: false, error: "Banco de dados não configurado." };

  const fStart = `${startDate} 00:00:00`;
  const fEnd   = `${endDate} 23:59:59`;
  try {
    const { rows: osRev } = await dbPool.query(pgQuery(`
      SELECT os.id, os.data_saida AS data, c.nome AS nome_cliente, os.valor_total AS valor
      FROM ordens_servico os JOIN clientes c ON c.id = os.id_cliente
      WHERE os.status IN ('Finalizado','Entregue') AND os.data_saida IS NOT NULL
        AND os.data_saida >= ? AND os.data_saida <= ?`), [fStart, fEnd]);

    const { rows: misc } = await dbPool.query(pgQuery(
      `SELECT id, data, descricao, valor FROM receitas_avulsas WHERE data BETWEEN ? AND ?`
    ), [startDate, endDate]);

    const { rows: exp } = await dbPool.query(pgQuery(
      `SELECT id, data, descricao, tipo_despesa, valor FROM despesas WHERE data BETWEEN ? AND ?`
    ), [startDate, endDate]);

    let seq = 0;
    const items = [];
    osRev.forEach((r) => items.push({ id: `os-${r.id}`, data: r.data, tipo: "Receita OS", descricao: `OS #${r.id} — ${r.nome_cliente}`, valor: Number(r.valor) || 0 }));
    misc.forEach((r)  => items.push({ id: `av-${r.id}`, data: new Date(`${r.data.toISOString().slice(0,10)} 00:00:00`), tipo: "Receita Avulsa", descricao: r.descricao, valor: Number(r.valor) || 0 }));
    exp.forEach((r)   => items.push({ id: `dp-${r.id}`, data: new Date(`${r.data.toISOString().slice(0,10)} 00:00:00`), tipo: `Despesa ${r.tipo_despesa}`, descricao: r.descricao, valor: -(Number(r.valor) || 0) }));
    items.sort((a, b) => new Date(a.data) - new Date(b.data));

    return { success: true, data: items };
  } catch (error) {
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

// Relatório de OS abertas por tempo: todas as OS não finalizadas,
// ordenadas das mais antigas para as mais recentes, com dias em aberto.
ipcMain.handle("get-open-os-aging", async () => {
  if (!dbPool)
    return { success: false, error: "Banco de dados não configurado." };

  const sql = `
    SELECT
      os.id,
      CONCAT(os.tipo_equipamento, ' ', os.marca, ' ', os.modelo) AS equipamento,
      os.status,
      os.data_entrada,
      os.data_prevista,
      os.valor_total,
      c.nome AS nome_cliente,
      (CURRENT_DATE - os.data_entrada::date)::int AS dias_aberto,
      CASE
        WHEN os.data_prevista IS NOT NULL AND os.data_prevista < NOW() THEN true
        ELSE false
      END AS atrasada
    FROM ordens_servico AS os
    JOIN clientes AS c ON os.id_cliente = c.id
    WHERE os.status NOT IN ('Finalizado', 'Entregue', 'Cancelado')
    ORDER BY os.data_entrada ASC NULLS LAST, os.id ASC
  `;

  try {
    const { rows } = await dbPool.query(sql);
    return { success: true, data: rows };
  } catch (error) {
    console.error("Erro ao buscar OS abertas por tempo:", error);
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
    LEFT JOIN equipamentos AS e ON e.id = os.id_equipamento
    WHERE os.numero_serie ILIKE ? OR e.numero_serie ILIKE ?
    ORDER BY os.id DESC
  `;

  try {
    const { rows } = await dbPool.query(pgQuery(sql), [searchTerm, searchTerm]);
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

// --- Handler para selecionar imagem de fundo da tela de login ---
ipcMain.handle("select-background-file", async (event) => {
  console.log("[Background Select] Abrindo diálogo para selecionar plano de fundo...");
  try {
    const result = await dialog.showOpenDialog({
      title: "Selecionar Imagem de Fundo (Login)",
      properties: ["openFile"],
      filters: [
        {
          name: "Imagens",
          extensions: ["png", "jpg", "jpeg", "webp"],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      console.log("[Background Select] Usuário cancelou a seleção.");
      return { success: true, filePath: null, error: "Seleção cancelada." };
    }

    const selectedPath = result.filePaths[0];
    console.log("[Background Select] Arquivo selecionado:", selectedPath);
    return { success: true, filePath: selectedPath };
  } catch (error) {
    console.error("[Background Select] Erro ao abrir diálogo:", error);
    return {
      success: false,
      error: "Erro ao tentar abrir o seletor de arquivos.",
    };
  }
});

// --- Handler para carregar a imagem de fundo de forma segura (limite 5 MB) ---
ipcMain.handle("load-background-image", async (event, bgPath) => {
  if (!bgPath || typeof bgPath !== "string") {
    return { success: false, error: "Caminho da imagem inválido." };
  }

  try {
    if (!fs.existsSync(bgPath)) {
      console.warn(`[Background Load] Arquivo não encontrado: ${bgPath}`);
      return {
        success: false,
        error: "Arquivo de imagem não encontrado no caminho especificado.",
      };
    }

    const stats = fs.statSync(bgPath);
    if (stats.size / (1024 * 1024) > 5) {
      return { success: false, error: "A imagem de fundo deve ter no máximo 5 MB." };
    }

    const imageBuffer = fs.readFileSync(bgPath);
    const ext = path.extname(bgPath).toLowerCase();
    let mimeType = "";
    if (ext === ".png") mimeType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".webp") mimeType = "image/webp";
    else {
      console.warn(`[Background Load] Tipo de arquivo não suportado: ${ext}`);
      return { success: false, error: "Formato de imagem não suportado." };
    }

    const base64Data = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
    return { success: true, imageData: base64Data };
  } catch (error) {
    console.error(`[Background Load] Erro ao carregar/converter imagem: ${bgPath}`, error);
    return {
      success: false,
      error: `Erro ao ler o arquivo de imagem: ${error.message}`,
    };
  }
});

// --- FUNÇÕES DA JANELA ---
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: "GSTI App - Gestão de Serviços de TI",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      devTools: !app.isPackaged,
      backgroundThrottling: false,
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

app.whenReady().then(() => {
  createWindow();
  // Revalida a licença periodicamente enquanto o app fica aberto.
  setInterval(() => {
    if (appConfig && appConfig.license && appConfig.license.token) {
      licenseManager.revalidate().catch(() => {});
    }
  }, 6 * 60 * 60 * 1000);
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
