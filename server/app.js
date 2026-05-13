import express from 'express';
import { publicDir, generatedDir, dataDir } from './config.js';
import { loadState } from './state.js';
import routes from './routes.js';
import { processQueue as startQueue } from './queue.js';

const app = express();

app.use(express.json({ limit: '60mb' }));

app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(400).json({ error: 'O corpo da requisição passou do limite permitido.' });
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'O corpo da requisição não está em JSON válido.' });
  }

  return next(error);
});

app.use('/', routes);

// Static files
app.use('/generated', express.static(generatedDir));
app.use('/cutouts', express.static(dataDir + '/cutouts'));
app.use('/crops', express.static(dataDir + '/crops'));
app.use('/references', express.static(dataDir + '/references'));
app.use('/uploads', express.static(dataDir + '/uploads'));

app.use(express.static(publicDir));
app.use((req, res) => {
  res.sendFile(publicDir + '/index.html');
});

export async function startServer(port) {
  await loadState();
  startQueue();
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      resolve(server);
    });
  });
}

export default app;
