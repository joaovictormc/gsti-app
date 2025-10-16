const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const mysql = require("mysql2");
const axios = require("axios");

const isDev = process.env.NODE_ENV !== "production";

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
  const { nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco } = customerData;
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

ipcMain.handle('update-customer', async (event, customerData) => {
  const { id, nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco } = customerData;
  const sql = "UPDATE clientes SET nome = ?, tipo_pessoa = ?, cpf_cnpj = ?, telefone = ?, email = ?, endereco = ? WHERE id = ?";
  
  try {
    await dbPool.query(sql, [nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco, id]);
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR um cliente
ipcMain.handle('delete-customer', async (event, customerId) => {
  const sql = "DELETE FROM clientes WHERE id = ?";
  
  try {
    await dbPool.query(sql, [customerId]);
    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar cliente:', error);
    return { success: false, error: error.message };
  }
});


// Listener para buscar todos os produtos e serviços
ipcMain.handle('get-products', async () => {
  try {
    const [rows] = await dbPool.query("SELECT * FROM produtos_servicos");
    return rows;
  } catch (error) {
    console.error("Erro ao buscar produtos/serviços:", error);
    return [];
  }
});

// Listener para adicionar um novo produto/serviço
ipcMain.handle('add-product', async (event, productData) => {
  const { descricao, valor, tipo } = productData;
  const sql = "INSERT INTO produtos_servicos (descricao, valor, tipo) VALUES (?, ?, ?)";
  try {
    const [result] = await dbPool.query(sql, [descricao, valor, tipo]);
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('Erro ao adicionar produto/serviço:', error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR um produto/serviço existente
ipcMain.handle('update-product', async (event, productData) => {
  const { id, descricao, valor, tipo } = productData;
  const sql = "UPDATE produtos_servicos SET descricao = ?, valor = ?, tipo = ? WHERE id = ?";
  
  try {
    await dbPool.query(sql, [descricao, valor, tipo, id]);
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar produto/serviço:', error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR um produto/serviço
ipcMain.handle('delete-product', async (event, productId) => {
  const sql = "DELETE FROM produtos_servicos WHERE id = ?";
  
  try {
    await dbPool.query(sql, [productId]);
    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar produto/serviço:', error);
    return { success: false, error: error.message };
  }
});


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
