const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const mysql = require("mysql2");
const axios = require("axios");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer"); // <-- Importa nodemailer
const crypto = require("crypto"); // <-- Módulo Node.js para gerar tokens

const isDev = process.env.NODE_ENV !== "production";
const saltRounds = 10;

// Configuração da Pool de Conexão com o MySQL
// Lembre-se de usar os dados que você configurou (usuário e senha do BD)
const dbPool = mysql
  .createPool({
    host: "192.168.100.4", // ou o IP do seu servidor caseiro
    user: "gsit_app",
    password: "gstiapp", // <<-- SUA SENHA AQUI
    database: "gsti_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
  .promise(); // Usar a versão com Promises para código mais limpo

// --- CONFIGURAÇÃO NODEMAILER (Exemplo com Gmail - USE VARIÁVEIS DE AMBIENTE EM PRODUÇÃO!) ---
// CUIDADO: Substitua com suas credenciais ou use um serviço transacional.
// Para Gmail, use uma "Senha de App" se tiver 2FA ativado.
const mailTransporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com", // Servidor SMTP do Brevo (verifique na sua conta)
  port: 587, // Porta TLS (mais comum)
  secure: false, // true para porta 465, false para outras portas como 587
  auth: {
    user: "99ea2b001@smtp-brevo.com", // SEU EMAIL DE LOGIN DO BREVO
    pass: "f59DkpQ8OmYGzJjd", // SUA CHAVE SMTP GERADA NO BREVO
  },
});

mailTransporter.verify(function (error, success) {
  if (error) {
    console.error("Erro ao conectar ao servidor SMTP Brevo:", error);
  } else {
    console.log("Servidor SMTP Brevo conectado com sucesso.");
  }
});

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
// --- FIM DAS FUNÇÕES DE FORMATAÇÃO ---

// --- AUTENTICAÇÃO E USUÁRIOS ---

// Listener para Login
ipcMain.handle("handle-login", async (event, { login, password }) => {
  if (!login || !password) {
    return { success: false, error: "Login e senha são obrigatórios." };
  }
  try {
    const sql = "SELECT id, nome, senha, role FROM usuarios WHERE login = ?";
    const [rows] = await dbPool.query(sql, [login]);

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
  // TODO: Adicionar verificação de Admin
  // --- CORREÇÃO: Adicionado 'email' ao SELECT ---
  const sql =
    "SELECT id, nome, email, login, role FROM usuarios ORDER BY nome ASC";
  // --- FIM CORREÇÃO ---
  try {
    const [rows] = await dbPool.query(sql);
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
    const sql =
      "INSERT INTO usuarios (nome, email, login, senha, role) VALUES (?, ?, ?, ?, ?)";
    const [result] = await dbPool.query(sql, [
      nome,
      email,
      login,
      hashedPassword,
      role,
    ]);
    return { success: true, id: result.insertId };
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      if (error.message.includes("login"))
        return { success: false, error: "Este login já está em uso." };
      if (error.message.includes("email"))
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
    const sql =
      "UPDATE usuarios SET nome = ?, email = ?, login = ?, role = ? WHERE id = ?";
    await dbPool.query(sql, [nome, email, login, role, id]);
    return { success: true };
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      if (error.message.includes("login"))
        return {
          success: false,
          error: "Este login já está em uso por outro usuário.",
        };
      if (error.message.includes("email"))
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
  // TODO: Adicionar verificação para garantir que apenas 'Admin' possa chamar esta função
  // TODO: Adicionar verificação para impedir que o Admin se auto-delete ou delete o último Admin
  const id = parseInt(userId, 10);
  if (isNaN(id) || id <= 0) {
    return { success: false, error: "ID de usuário inválido." };
  }

  try {
    const sql = "DELETE FROM usuarios WHERE id = ?";
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
  if (!email) return { success: false, error: "Email é obrigatório." };

  try {
    // 1. Encontra usuário pelo email
    const [rows] = await dbPool.query(
      "SELECT id, nome, email FROM usuarios WHERE email = ?",
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
      "UPDATE usuarios SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [hashedToken, expiry, user.id]
    );

    // 5. Envia o email com o token NÃO HASHED (ou link)
    const mailOptions = {
      from: '"GSTI App" <joaovictormc089@gmail.com>', // SEU EMAIL REMETENTE
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
      const [usersWithToken] = await dbPool.query(
        "SELECT id, reset_token, reset_token_expiry FROM usuarios WHERE reset_token IS NOT NULL AND reset_token_expiry > ?",
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
        "UPDATE usuarios SET senha = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
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
  try {
    const [rows] = await dbPool.query("SELECT * FROM clientes");
    return rows;
  } catch (error) {
    console.error(error);
    return []; // Retorna um array vazio em caso de erro
  }
});

// Listener para adicionar um novo cliente
ipcMain.handle("add-customer", async (event, customerData) => {
  // Agora pegamos os novos campos do objeto recebido
  const { nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco } =
    customerData;
  const sql =
    "INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco) VALUES (?, ?, ?, ?, ?, ?)";

  try {
    // Passamos os novos campos como parâmetros na ordem correta
    const [result] = await dbPool.query(sql, [
      nome,
      tipo_pessoa,
      cpf_cnpj,
      telefone,
      email,
      endereco,
    ]);
    return { success: true, id: result.insertId };
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
  const { id, nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco } =
    customerData;
  const sql =
    "UPDATE clientes SET nome = ?, tipo_pessoa = ?, cpf_cnpj = ?, telefone = ?, email = ?, endereco = ? WHERE id = ?";

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
  const sql = "DELETE FROM clientes WHERE id = ?";

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
  try {
    const [rows] = await dbPool.query("SELECT * FROM produtos_servicos");
    return rows;
  } catch (error) {
    console.error("Erro ao buscar produtos/serviços:", error);
    return [];
  }
});

// Listener para adicionar um novo produto/serviço
ipcMain.handle("add-product", async (event, productData) => {
  const { descricao, valor, tipo } = productData;
  const sql =
    "INSERT INTO produtos_servicos (descricao, valor, tipo) VALUES (?, ?, ?)";
  try {
    const [result] = await dbPool.query(sql, [descricao, valor, tipo]);
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error("Erro ao adicionar produto/serviço:", error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR um produto/serviço existente
ipcMain.handle("update-product", async (event, productData) => {
  const { id, descricao, valor, tipo } = productData;
  const sql =
    "UPDATE produtos_servicos SET descricao = ?, valor = ?, tipo = ? WHERE id = ?";

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
  const sql = "DELETE FROM produtos_servicos WHERE id = ?";

  try {
    await dbPool.query(sql, [productId]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar produto/serviço:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-os-list", async () => {
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
    const [rows] = await dbPool.query(sql);
    return rows;
  } catch (error) {
    return [];
  }
});

ipcMain.handle("get-active-data", async () => {
  try {
    const [customers] = await dbPool.query(
      "SELECT id, nome FROM clientes ORDER BY nome ASC"
    );
    const [products] = await dbPool.query(
      "SELECT id, descricao, valor, tipo FROM produtos_servicos ORDER BY descricao ASC"
    );
    return { success: true, customers, products };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- CORREÇÃO DO BUG (get-os-details) ---
ipcMain.handle("get-os-details", async (event, osId) => {
  try {
    const [osRows] = await dbPool.query(
      "SELECT * FROM ordens_servico WHERE id = ?",
      [osId]
    );
    if (osRows.length === 0)
      return { success: false, error: "OS não encontrada." };

    // CORREÇÃO: Alterado de 'produtos_serviços' para 'produtos_servicos'
    const [itemRows] = await dbPool.query(
      `SELECT ps.id, ps.descricao, ps.valor, ps.tipo, oi.quantidade 
       FROM os_itens oi 
       JOIN produtos_servicos ps ON oi.id_produto_servico = ps.id 
       WHERE oi.id_os = ?`,
      [osId]
    );

    return { success: true, os: osRows[0], items: itemRows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("add-os", async (event, { osData, total }) => {
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
  const sql = `INSERT INTO ordens_servico 
    (id_cliente, tipo_equipamento, marca, modelo, numero_serie, defeito_relatado, observacoes_entrada, status, data_entrada, valor_total, garantia_dias) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  try {
    const [result] = await dbPool.query(sql, [
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
    return { success: true, osId: result.insertId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-os", async (event, { osData, total }) => {
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
  const connection = await dbPool.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT status, data_saida, garantia_dias FROM ordens_servico WHERE id = ?",
      [id]
    );
    const osAtual = rows[0];

    // --- VERIFICAÇÃO GARANTIA (sem alterações) ---
    if (osAtual.status === "Entregue" && osAtual.data_saida) {
      // ... (código de verificação da garantia) ...
      const dataSaida = new Date(osAtual.data_saida);
      const dataExpiracaoGarantia = new Date(
        dataSaida.setDate(dataSaida.getDate() + (osAtual.garantia_dias || 0))
      ); // Usa 0 se garantia for null
      const hoje = new Date();
      if (hoje > dataExpiracaoGarantia) {
        throw new Error(
          "Esta OS está fora da garantia e não pode ser alterada."
        );
      }
    }

    // --- CORREÇÃO: Define data_saida se status for Finalizado/Entregue e data_saida for NULL ---
    let setDataSaidaSql = "";
    if (["Finalizado", "Entregue"].includes(status) && !osAtual.data_saida) {
      setDataSaidaSql = ", data_saida = NOW()"; // Define data_saida AGORA
    }

    const sql = `
      UPDATE ordens_servico SET 
      id_cliente = ?, tipo_equipamento = ?, marca = ?, modelo = ?, 
      numero_serie = ?, defeito_relatado = ?, observacoes_entrada = ?, 
      laudo_tecnico = ?, solucao_aplicada = ?, status = ?, 
      data_entrada = ?, valor_total = ?, garantia_dias = ?
      ${setDataSaidaSql}
      WHERE id = ?`;

    await connection.query(sql, [
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

    connection.release();
    return { success: true };
  } catch (error) {
    connection.release();
    console.error("Erro ao atualizar OS:", error); // Log do erro
    return { success: false, error: error.message };
  }
});

ipcMain.handle("add-os-items", async (event, { osId, items }) => {
  if (items.length === 0) return { success: true };
  const sql =
    "INSERT INTO os_itens (id_os, id_produto_servico, quantidade, valor_unitario) VALUES ?";
  const values = items.map((item) => [
    osId,
    item.id,
    item.quantidade,
    item.valor,
  ]);
  try {
    await dbPool.query(sql, [values]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-os-items", async (event, { osId, items }) => {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM os_itens WHERE id_os = ?", [osId]);
    if (items.length > 0) {
      const sql =
        "INSERT INTO os_itens (id_os, id_produto_servico, quantidade, valor_unitario) VALUES ?";
      const values = items.map((item) => [
        osId,
        item.id,
        item.quantidade,
        item.valor,
      ]);
      await connection.query(sql, [values]);
    }
    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
});

ipcMain.handle("delete-os", async (event, osId) => {
  try {
    await dbPool.query("DELETE FROM ordens_servico WHERE id = ?", [osId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- FUNÇÃO PDF ATUALIZADA ---
ipcMain.handle("generate-entry-receipt", async (event, osId) => {
  // 1. Buscar todos os dados necessários (SQL ATUALIZADO)
  const sql = `SELECT os.*, c.nome AS nome_cliente, c.telefone AS telefone_cliente, c.cpf_cnpj, c.email AS email_cliente, c.endereco AS endereco_cliente FROM ordens_servico os JOIN clientes c ON os.id_cliente = c.id WHERE os.id = ?`;
  let osData;
  try {
    const [rows] = await dbPool.query(sql, [osId]);
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
  // 1. Buscar dados da OS, Cliente e Itens
  let osData, itemsData;
  try {
    const osSql = `
      SELECT os.*, c.nome AS nome_cliente, c.telefone AS telefone_cliente, c.cpf_cnpj,
             c.email AS email_cliente, c.endereco AS endereco_cliente
      FROM ordens_servico os JOIN clientes c ON os.id_cliente = c.id
      WHERE os.id = ?`;
    const [osRows] = await dbPool.query(osSql, [osId]);
    if (osRows.length === 0) throw new Error("OS não encontrada.");
    osData = osRows[0];

    // Verifica se a OS tem data de saída (necessária para garantia)
    if (!osData.data_saida) {
      // Define a data de saída como AGORA se ainda não tiver sido definida
      await dbPool.query(
        "UPDATE ordens_servico SET data_saida = NOW() WHERE id = ?",
        [osId]
      );
      // Busca novamente os dados para pegar a data_saida atualizada
      const [updatedOsRows] = await dbPool.query(osSql, [osId]);
      osData = updatedOsRows[0];
    }

    const itemsSql = `
      SELECT ps.descricao, oi.quantidade, oi.valor_unitario
      FROM os_itens oi JOIN produtos_servicos ps ON oi.id_produto_servico = ps.id
      WHERE oi.id_os = ?`;
    const [itemRows] = await dbPool.query(itemsSql, [osId]);
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
  // Busca também o novo campo tipo_despesa
  const sql = "SELECT * FROM despesas ORDER BY data DESC, id DESC";
  try {
    const [rows] = await dbPool.query(sql);
    return rows;
  } catch (error) {
    console.error("Erro ao buscar despesas:", error);
    return [];
  }
});

// Listener para ADICIONAR uma nova despesa
ipcMain.handle("add-expense", async (event, expenseData) => {
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

  // --- ALTERAÇÃO: Adiciona tipo_despesa ao SQL ---
  const sql = `
    INSERT INTO despesas 
    (descricao, data, categoria, tipo_despesa, km_rodados, preco_litro, consumo_medio, valor) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
  `;
  try {
    // --- ALTERAÇÃO: Passa tipo_despesa ---
    const [result] = await dbPool.query(sql, [
      descricao,
      data,
      categoria,
      tipo_despesa,
      km_rodados,
      preco_litro,
      consumo_medio,
      valor,
    ]);
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error("Erro ao adicionar despesa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR uma despesa existente
ipcMain.handle("update-expense", async (event, expenseData) => {
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

  // --- ALTERAÇÃO: Adiciona tipo_despesa ao SQL ---
  const sql = `
    UPDATE despesas SET 
    descricao = ?, data = ?, categoria = ?, tipo_despesa = ?,
    km_rodados = ?, preco_litro = ?, consumo_medio = ?, valor = ? 
    WHERE id = ?
  `;
  try {
    // --- ALTERAÇÃO: Passa tipo_despesa ---
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
  const sql = "DELETE FROM despesas WHERE id = ?";
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
    const formattedStartDate = `${startDate} 00:00:00`;
    const formattedEndDate = `${endDate} 23:59:59`;

    console.log(
      `[get-financial-summary] Buscando período: ${formattedStartDate} a ${formattedEndDate}`
    );

    try {
      // 1. Receita das OS
      const osRevenueSql = `SELECT SUM(valor_total) AS totalOSRevenue FROM ordens_servico WHERE status IN ('Finalizado', 'Entregue') AND data_saida IS NOT NULL AND data_saida >= ? AND data_saida <= ?`;
      const [osRevenueResult] = await dbPool.query(osRevenueSql, [
        formattedStartDate,
        formattedEndDate,
      ]);
      // --- CORREÇÃO: Garante que é número ---
      const totalOSRevenue = Number(osRevenueResult[0].totalOSRevenue) || 0;
      console.log(
        `[get-financial-summary] Resultado Receita OS (Numérico):`,
        totalOSRevenue
      );

      // 2. Receita Avulsa
      const miscRevenueSql = `SELECT SUM(valor) AS totalMiscRevenue FROM receitas_avulsas WHERE data BETWEEN ? AND ?`;
      const [miscRevenueResult] = await dbPool.query(miscRevenueSql, [
        startDate,
        endDate,
      ]);
      // --- CORREÇÃO: Garante que é número ---
      const totalMiscRevenue =
        Number(miscRevenueResult[0].totalMiscRevenue) || 0;
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
      const fixedExpenseSql = `SELECT SUM(valor) AS totalFixedExpenses FROM despesas WHERE tipo_despesa = 'Fixa' AND data BETWEEN ? AND ?`;
      const [fixedExpenseResult] = await dbPool.query(fixedExpenseSql, [
        startDate,
        endDate,
      ]);
      const totalFixedExpenses =
        Number(fixedExpenseResult[0].totalFixedExpenses) || 0; // Garante número

      const variableExpenseSql = `SELECT SUM(valor) AS totalVariableExpenses FROM despesas WHERE tipo_despesa = 'Variável' AND data BETWEEN ? AND ?`;
      const [variableExpenseResult] = await dbPool.query(variableExpenseSql, [
        startDate,
        endDate,
      ]);
      const totalVariableExpenses =
        Number(variableExpenseResult[0].totalVariableExpenses) || 0; // Garante número

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
    const osRevenueSql = `
      SELECT MONTH(data_saida) AS month, SUM(valor_total) AS monthlyRevenue 
      FROM ordens_servico 
      WHERE status IN ('Finalizado', 'Entregue') 
        AND data_saida IS NOT NULL 
        AND YEAR(data_saida) = ? 
      GROUP BY MONTH(data_saida)
    `;
    const [osRevenues] = await dbPool.query(osRevenueSql, [numericYear]);
    osRevenues.forEach((row) => {
      // Ajusta o índice (month - 1) pois o array é 0-indexado
      if (row.month >= 1 && row.month <= 12) {
        monthlyData[row.month - 1].totalRevenue +=
          Number(row.monthlyRevenue) || 0;
      }
    });

    // 2. Busca Receitas Avulsas agregadas por mês
    const miscRevenueSql = `
      SELECT MONTH(data) AS month, SUM(valor) AS monthlyRevenue 
      FROM receitas_avulsas 
      WHERE YEAR(data) = ? 
      GROUP BY MONTH(data)
    `;
    const [miscRevenues] = await dbPool.query(miscRevenueSql, [numericYear]);
    miscRevenues.forEach((row) => {
      if (row.month >= 1 && row.month <= 12) {
        monthlyData[row.month - 1].totalRevenue +=
          Number(row.monthlyRevenue) || 0;
      }
    });

    // 3. Busca Despesas agregadas por mês e tipo
    const expensesSql = `
      SELECT MONTH(data) AS month, tipo_despesa, SUM(valor) AS monthlyExpense 
      FROM despesas 
      WHERE YEAR(data) = ? 
      GROUP BY MONTH(data), tipo_despesa
    `;
    const [expenses] = await dbPool.query(expensesSql, [numericYear]);
    expenses.forEach((row) => {
      if (row.month >= 1 && row.month <= 12) {
        const monthIndex = row.month - 1;
        const value = Number(row.monthlyExpense) || 0;
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
    const formattedStartDate = `${startDate} 00:00:00`;
    const formattedEndDate = `${endDate} 23:59:59`;
    const dateOnlyStart = startDate;
    const dateOnlyEnd = endDate;

    console.log(
      `[export-report] Iniciando exportação para período: ${startDate} a ${endDate}`
    );

    try {
      // 1. Buscar Dados Detalhados
      const osRevenueSql = `
        SELECT os.id, os.data_saida AS data, c.nome AS nome_cliente, os.valor_total AS valor
        FROM ordens_servico os JOIN clientes c ON os.id_cliente = c.id
        WHERE os.status IN ('Finalizado', 'Entregue') AND os.data_saida IS NOT NULL
        AND os.data_saida >= ? AND os.data_saida <= ?`;
      const [osRevenues] = await dbPool.query(osRevenueSql, [
        formattedStartDate,
        formattedEndDate,
      ]);

      const miscRevenueSql = `SELECT id, data, descricao, valor FROM receitas_avulsas WHERE data BETWEEN ? AND ?`;
      const [miscRevenues] = await dbPool.query(miscRevenueSql, [
        dateOnlyStart,
        dateOnlyEnd,
      ]);

      const expensesSql = `SELECT id, data, descricao, categoria, tipo_despesa, valor FROM despesas WHERE data BETWEEN ? AND ?`;
      const [expenses] = await dbPool.query(expensesSql, [
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
  const sql = "SELECT * FROM receitas_avulsas ORDER BY data DESC, id DESC";
  try {
    const [rows] = await dbPool.query(sql);
    return rows;
  } catch (error) {
    console.error("Erro ao buscar receitas avulsas:", error);
    return [];
  }
});

// Listener para ADICIONAR uma nova receita avulsa
ipcMain.handle("add-misc-revenue", async (event, revenueData) => {
  const { descricao, valor, data } = revenueData;
  const sql =
    "INSERT INTO receitas_avulsas (descricao, valor, data) VALUES (?, ?, ?)";
  try {
    const [result] = await dbPool.query(sql, [
      descricao,
      parseFloat(valor) || 0,
      data,
    ]);
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error("Erro ao adicionar receita avulsa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR uma receita avulsa existente
ipcMain.handle("update-misc-revenue", async (event, revenueData) => {
  const { id, descricao, valor, data } = revenueData;
  const sql =
    "UPDATE receitas_avulsas SET descricao = ?, valor = ?, data = ? WHERE id = ?";
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
  const sql = "DELETE FROM receitas_avulsas WHERE id = ?";
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
  try {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4; // Pega os últimos 5 anos (incluindo o atual)

    // Inicializa um objeto para armazenar os dados anuais
    const annualData = {};
    for (let year = startYear; year <= currentYear; year++) {
      annualData[year] = { year: year, totalRevenue: 0, totalExpenses: 0 };
    }

    // 1. Busca Receitas de OS agregadas por ANO
    const osRevenueSql = `
      SELECT YEAR(data_saida) AS year, SUM(valor_total) AS annualRevenue 
      FROM ordens_servico 
      WHERE status IN ('Finalizado', 'Entregue') 
        AND data_saida IS NOT NULL 
        AND YEAR(data_saida) >= ? 
      GROUP BY YEAR(data_saida)
    `;
    const [osRevenues] = await dbPool.query(osRevenueSql, [startYear]);
    osRevenues.forEach((row) => {
      if (annualData[row.year]) {
        annualData[row.year].totalRevenue += Number(row.annualRevenue) || 0;
      }
    });

    // 2. Busca Receitas Avulsas agregadas por ANO
    const miscRevenueSql = `
      SELECT YEAR(data) AS year, SUM(valor) AS annualRevenue 
      FROM receitas_avulsas 
      WHERE YEAR(data) >= ? 
      GROUP BY YEAR(data)
    `;
    const [miscRevenues] = await dbPool.query(miscRevenueSql, [startYear]);
    miscRevenues.forEach((row) => {
      if (annualData[row.year]) {
        annualData[row.year].totalRevenue += Number(row.annualRevenue) || 0;
      }
    });

    // 3. Busca Despesas agregadas por ANO
    const expensesSql = `
      SELECT YEAR(data) AS year, SUM(valor) AS annualExpense 
      FROM despesas 
      WHERE YEAR(data) >= ? 
      GROUP BY YEAR(data)
    `;
    const [expenses] = await dbPool.query(expensesSql, [startYear]);
    expenses.forEach((row) => {
      if (annualData[row.year]) {
        annualData[row.year].totalExpenses += Number(row.annualExpense) || 0;
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
    const osRevenueSql = `
      SELECT 
        YEAR(data_saida) AS year, MONTH(data_saida) AS month, 
        SUM(valor_total) AS monthlyOsRevenue 
      FROM ordens_servico 
      WHERE status IN ('Finalizado', 'Entregue') AND data_saida IS NOT NULL 
        AND data_saida >= ? AND data_saida <= ? 
      GROUP BY YEAR(data_saida), MONTH(data_saida)
    `;
    const [osRevenues] = await dbPool.query(osRevenueSql, [
      `${formattedStartDate} 00:00:00`,
      `${formattedEndDate} 23:59:59`,
    ]);

    // 2. Busca Receitas Avulsas agrupadas por ANO e MÊS
    const miscRevenueSql = `
      SELECT 
        YEAR(data) AS year, MONTH(data) AS month, 
        SUM(valor) AS monthlyMiscRevenue 
      FROM receitas_avulsas 
      WHERE data >= ? AND data <= ? 
      GROUP BY YEAR(data), MONTH(data)
    `;
    const [miscRevenues] = await dbPool.query(miscRevenueSql, [
      formattedStartDate,
      formattedEndDate,
    ]);

    // 3. Busca Despesas agrupadas por ANO e MÊS
    const expensesSql = `
      SELECT 
        YEAR(data) AS year, MONTH(data) AS month, 
        SUM(valor) AS monthlyExpense 
      FROM despesas 
      WHERE data >= ? AND data <= ? 
      GROUP BY YEAR(data), MONTH(data)
    `;
    const [expenses] = await dbPool.query(expensesSql, [
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
      monthlyProfitsMap[key].revenue += Number(row.monthlyOsRevenue) || 0;
    });

    miscRevenues.forEach((row) => {
      const key = getMonthKey(row.year, row.month);
      monthlyProfitsMap[key] = monthlyProfitsMap[key] || {
        revenue: 0,
        expense: 0,
      };
      monthlyProfitsMap[key].revenue += Number(row.monthlyMiscRevenue) || 0;
    });

    expenses.forEach((row) => {
      const key = getMonthKey(row.year, row.month);
      monthlyProfitsMap[key] = monthlyProfitsMap[key] || {
        revenue: 0,
        expense: 0,
      };
      monthlyProfitsMap[key].expense += Number(row.monthlyExpense) || 0;
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
    const [rows] = await dbPool.query(sql, [id]);
    return { success: true, data: rows };
  } catch (error) {
    console.error(`Erro ao buscar OS para cliente ${id}:`, error);
    return { success: false, error: error.message };
  }
});

// Listener para buscar OS por Status
ipcMain.handle("get-os-by-status", async (event, status) => {
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
    const [rows] = await dbPool.query(sql, [status]);
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
      const [rows] = await dbPool.query(sql, [
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
    const [rows] = await dbPool.query(sql, [searchTerm]);
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
    const formattedStartDate = `${startDate} 00:00:00`;
    const formattedEndDate = `${endDate} 23:59:59`;
    const dateOnlyStart = startDate;
    const dateOnlyEnd = endDate;

    console.log(
      `[get-detailed-revenue] Buscando período: ${startDate} a ${endDate}`
    );

    try {
      // 1. Busca detalhes das Receitas de OS no período
      const osRevenueSql = `
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
        AND os.data_saida >= ? AND os.data_saida <= ?`;
      const [osRevenues] = await dbPool.query(osRevenueSql, [
        formattedStartDate,
        formattedEndDate,
      ]);

      // 2. Busca detalhes das Receitas Avulsas no período
      const miscRevenueSql = `
      SELECT 
        id, 
        data, 
        descricao, 
        valor,
        'Receita Avulsa' AS tipo
      FROM receitas_avulsas 
      WHERE data BETWEEN ? AND ?`;
      const [miscRevenues] = await dbPool.query(miscRevenueSql, [
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

// --- FUNÇÕES DA JANELA ---
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "renderer/dist/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
