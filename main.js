// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2');

const isDev = process.env.NODE_ENV !== 'production';

// Configuração da Pool de Conexão com o MySQL
// Lembre-se de usar os dados que você configurou (usuário e senha do BD)
const dbPool = mysql.createPool({
  host: 'localhost', // ou o IP do seu servidor caseiro
  user: 'admin',
  password: 'gstiapp', // <<-- SUA SENHA AQUI
  database: 'gsti_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise(); // Usar a versão com Promises para código mais limpo

// Listener para buscar os clientes
ipcMain.handle('get-customers', async () => {
  try {
    const [rows] = await dbPool.query("SELECT * FROM clientes");
    return rows;
  } catch (error) {
    console.error(error);
    return []; // Retorna um array vazio em caso de erro
  }
});

// Listener para adicionar um novo cliente
ipcMain.handle('add-customer', async (event, customerData) => {
  const { nome, telefone, email } = customerData;
  const sql = "INSERT INTO clientes (nome, telefone, email) VALUES (?, ?, ?)";

  try {
    const [result] = await dbPool.query(sql, [nome, telefone, email]);
    console.log('Cliente adicionado com sucesso, ID:', result.insertId);
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('Erro ao adicionar cliente:', error);
    return { success: false, error: error.message };
  }
});


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});