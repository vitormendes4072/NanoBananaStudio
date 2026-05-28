import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import express from 'express';
import { state } from '../state.js';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const router = express.Router();

router.post('/api/export', (req, res) => {
  const { jobs = [], cutouts = [], crops = [] } = req.body || {};

  // Collect valid file entries { filePath, name }
  const entries = [];

  const jobsById = state.jobsById;
  for (const id of jobs) {
    const job = jobsById.get(String(id));
    const filePath = job?.result?.localPath;
    if (filePath && fs.existsSync(filePath)) {
      entries.push({ filePath, name: path.basename(filePath) });
    }
  }

  const cutoutsById = state.cutoutsById;
  for (const id of cutouts) {
    const cutout = cutoutsById.get(String(id));
    const filePath = cutout?.localPath;
    if (filePath && fs.existsSync(filePath)) {
      entries.push({ filePath, name: path.basename(filePath) });
    }
  }

  const cropsById = state.cropsById;
  for (const id of crops) {
    const crop = cropsById.get(String(id));
    const filePath = crop?.localPath;
    if (filePath && fs.existsSync(filePath)) {
      entries.push({ filePath, name: path.basename(filePath) });
    }
  }

  if (!entries.length) {
    return res.status(400).json({ error: 'Nenhum arquivo válido encontrado para exportar.' });
  }

  const archive = archiver('zip', { zlib: { level: 6 } });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="nano-banana-export.zip"');

  archive.on('error', (err) => {
    console.error('Export archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Falha ao gerar o arquivo ZIP.' });
    }
  });

  archive.pipe(res);

  // Deduplicate filenames by appending index when needed
  const usedNames = new Map();
  for (const { filePath, name } of entries) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    const count = usedNames.get(name) ?? 0;
    const finalName = count === 0 ? name : `${base}_${count}${ext}`;
    usedNames.set(name, count + 1);
    archive.file(filePath, { name: finalName });
  }

  archive.finalize();
});

export default router;
