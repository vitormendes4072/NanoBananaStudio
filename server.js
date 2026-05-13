import { fileURLToPath } from 'url';
import path from 'path';
import { startServer as startAppServer } from './server/app.js';
import { port } from './server/config.js';
import { closeDb } from './server/db.js';
import { generatedDir, referencesDir, cutoutsDir, cropsDir } from './server/config.js';
import { createJob } from './server/queue.js';
import { persistQueueState, saveJob } from './server/state.js';
import { serializeJob } from './server/utils.js';

let activeServer = null;

export async function startServer(requestedPort = port) {
  if (activeServer) {
    return activeServer;
  }

  activeServer = await startAppServer(requestedPort);
  return activeServer;
}

export async function stopServer() {
  if (!activeServer) {
    closeDb();
    return;
  }

  await new Promise((resolve, reject) => {
    activeServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
  activeServer = null;
  closeDb();
}

export const __testUtils = {
  generatedDir,
  referencesDir,
  cutoutsDir,
  cropsDir,
  createJob,
  saveJob,
  persistQueueState,
  serializeJob,
};

async function main() {
  console.log('Iniciando Nano Banana Studio...');
  try {
    const server = await startServer(port);
    console.log(`Servidor rodando na porta ${port}`);
    
    // Configurar graceful shutdown
    const shutdown = () => {
      console.log('Encerrando servidor...');
      server.close(() => {
        console.log('Servidor encerrado.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === executedPath) {
  main();
}
