// Preload da janela de setup — ponte IPC mínima e segura.
// contextIsolation:true + nodeIntegration:false: o renderer só enxerga
// o que for explicitamente exposto via contextBridge.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupApi', {
  /** Envia a chave para o main process gravar em userData/config.json. */
  saveApiKey: (key) => ipcRenderer.send('save-api-key', key),

  /** Recebe a chave atual (se já houver) para pré-preencher o campo. */
  onCurrentKey: (callback) => ipcRenderer.on('current-key', (_event, key) => callback(key)),
});
