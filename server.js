import { startServer } from './server/app.js';
import { port } from './server/config.js';

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

main();
