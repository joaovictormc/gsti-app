const { app, BrowserWindow } = require('electron');
const path = require('path');

// Verifica se estamos em ambiente de desenvolvimento
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200, // Aumentamos a largura para acomodar a interface
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Se estiver em desenvolvimento, carrega a URL do servidor do Vite.
  // Se não, carrega o arquivo HTML da build de produção.
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173'); // Porta padrão do Vite
    mainWindow.webContents.openDevTools(); // Abre o console do desenvolvedor automaticamente
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