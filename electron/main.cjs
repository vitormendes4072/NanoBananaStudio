// Electron main process — D5 Fase 1 (shell rodável, Windows-first).
//
// Responsabilidades:
//   1. Ler/gravar a API key em userData/config.json (persistência in-app).
//   2. Injetar GEMINI_API_KEY no ambiente ANTES do bootstrap do servidor.
//   3. Spawnar o servidor Express (node server.js) como processo filho estável.
//   4. Abrir a BrowserWindow apontando para http://localhost:3000.
//
// O empacotamento (electron-builder) e a migração de dados para userData
// ficam para sub-tarefas posteriores — ver ROADMAP D5.

const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const PROJECT_ROOT = path.join(__dirname, '..');

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null;
/** @type {import('electron').BrowserWindow | null} */
let setupWindow = null;
/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
let quitting = false;

// --- Persistência da config (userData/config.json) ---

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

// --- Ciclo de vida do servidor Express ---

function startServerProcess(apiKey) {
  if (serverProcess) return;

  // Spawna o node do sistema para preservar o módulo nativo better-sqlite3
  // (compilado para o ABI do Node, não do Electron). Env injetada aqui.
  serverProcess = spawn('node', ['server.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      GEMINI_API_KEY: apiKey || '',
      PORT: String(SERVER_PORT),
    },
    stdio: 'inherit',
  });

  serverProcess.on('error', (err) => {
    dialog.showErrorBox(
      'Falha ao iniciar o servidor',
      `Não foi possível executar "node server.js".\n\n${err.message}\n\n` +
        'Confirme que o Node.js está instalado e disponível no PATH.'
    );
  });

  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (!quitting && code && code !== 0) {
      dialog.showErrorBox(
        'Servidor encerrado',
        `O servidor Express parou inesperadamente (código ${code}).`
      );
    }
  });
}

function stopServerProcess() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

async function restartServerProcess(apiKey) {
  stopServerProcess();
  startServerProcess(apiKey);
  await waitForServer();
}

/** Faz polling em /api/health até o servidor responder 200 (ou estourar o timeout). */
function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(`${SERVER_URL}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(2000, () => req.destroy());
    };

    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error('O servidor não respondeu dentro do tempo limite.'));
      } else {
        setTimeout(attempt, 400);
      }
    };

    attempt();
  });
}

// --- Janelas ---

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    title: 'Nano Banana Studio',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.loadURL(SERVER_URL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Abre a janela nativa de configuração da API key.
 * Resolve com a chave persistida (nova ou a existente, se o usuário fechar sem salvar).
 * @returns {Promise<string>}
 */
function openSetupWindow() {
  return new Promise((resolve) => {
    setupWindow = new BrowserWindow({
      width: 540,
      height: 440,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: 'Configurar API Key',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupWindow.setMenuBarVisibility(false);
    setupWindow.loadFile(path.join(__dirname, 'setup.html'));

    const existingKey = readConfig().geminiApiKey || '';
    setupWindow.webContents.on('did-finish-load', () => {
      setupWindow?.webContents.send('current-key', existingKey);
    });

    let saved = false;

    const onSave = (_event, key) => {
      saved = true;
      writeConfig({ geminiApiKey: String(key || '').trim() });
      const win = setupWindow;
      setupWindow = null;
      win?.close();
    };
    ipcMain.once('save-api-key', onSave);

    setupWindow.on('closed', () => {
      ipcMain.removeListener('save-api-key', onSave);
      setupWindow = null;
      resolve(saved ? readConfig().geminiApiKey || '' : existingKey);
    });
  });
}

// --- Menu da aplicação ---

function buildMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Configurar API Key…',
          accelerator: 'CmdOrCtrl+K',
          click: async () => {
            const key = await openSetupWindow();
            try {
              await restartServerProcess(key);
              mainWindow?.reload();
            } catch (err) {
              dialog.showErrorBox('Falha ao reiniciar o servidor', err.message);
            }
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom padrão' },
        { role: 'zoomIn', label: 'Aumentar zoom' },
        { role: 'zoomOut', label: 'Diminuir zoom' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Bootstrap ---

app.whenReady().then(async () => {
  buildMenu();

  let apiKey = readConfig().geminiApiKey;
  if (!apiKey) {
    // Primeira execução (ou chave ausente): pede a chave antes de subir o servidor.
    apiKey = await openSetupWindow();
  }

  startServerProcess(apiKey);

  try {
    await waitForServer();
  } catch (err) {
    dialog.showErrorBox('Falha ao iniciar', err.message);
    stopServerProcess();
    app.quit();
    return;
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  quitting = true;
  stopServerProcess();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
