import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import url from 'url';
import express from 'express';
import { state } from '../state.js';
import { processQueue } from '../queue.js';
import { persistQueueState } from '../state.js';
import {
  generatedDir,
  cutoutsDir,
  cropsDir,
  referencesDir,
  legacyUploadsDir,
  thumbsDir,
  defaultModel,
  maxJobs,
  maxCutouts,
  maxCrops,
  allowedModels,
  pricingTable,
  pricingUpdatedAt,
} from '../config.js';
import { normalizeConcurrency } from '../utils.js';
import { VARIATION_AXES } from '../prompt-variations.js';
import { maxVariationJobs } from '../config.js';

const _require = createRequire(import.meta.url);
const sharpPath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../..',
  'node_modules',
  '@imgly',
  'background-removal-node',
  'node_modules',
  'sharp'
);
let sharp = null;
function getSharp() {
  if (!sharp) sharp = _require(sharpPath);
  return sharp;
}

const router = express.Router();

router.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    model: defaultModel,
    activeJobIds: Array.from(state.activeJobIds),
    queueSize: state.jobs.filter((job) => job.status === 'queued').length,
    concurrency: state.concurrency,
    limits: { jobs: maxJobs, cutouts: maxCutouts, crops: maxCrops },
  });
});

/**
 * Verifica se filePath está contido dentro de baseDir após resolução pelo OS.
 * Protege contra path traversal independente de separadores ou encoding.
 */
function isContainedIn(filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);
  const rel = path.relative(base, resolved);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

router.get('/api/thumb', async (req, res) => {
  const src = req.query.src;
  if (!src || typeof src !== 'string') {
    return res.status(400).json({ error: 'Invalid src parameter' });
  }

  let targetPath = null;
  let baseDir = null;
  if (src.startsWith('/generated/')) {
    baseDir = generatedDir;
    targetPath = path.join(generatedDir, src.replace('/generated/', ''));
  } else if (src.startsWith('/cutouts/')) {
    baseDir = cutoutsDir;
    targetPath = path.join(cutoutsDir, src.replace('/cutouts/', ''));
  } else if (src.startsWith('/crops/')) {
    baseDir = cropsDir;
    targetPath = path.join(cropsDir, src.replace('/crops/', ''));
  } else if (src.startsWith('/references/')) {
    baseDir = referencesDir;
    targetPath = path.join(referencesDir, src.replace('/references/', ''));
  } else if (src.startsWith('/uploads/')) {
    baseDir = legacyUploadsDir;
    targetPath = path.join(legacyUploadsDir, src.replace('/uploads/', ''));
  }

  if (!targetPath || !isContainedIn(targetPath, baseDir)) {
    return res.status(400).json({ error: 'Invalid src parameter' });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).send('Not found');
  }

  const cacheKey = createHash('sha256').update(`${src}:256:256`).digest('hex');
  const cachePath = path.join(thumbsDir, `${cacheKey}.webp`);

  if (fs.existsSync(cachePath)) {
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Thumb-Cache', 'HIT');
    return fs.createReadStream(cachePath).pipe(res);
  }

  try {
    const thumbBuffer = await getSharp()(targetPath)
      .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    fs.mkdirSync(thumbsDir, { recursive: true });
    fs.writeFileSync(cachePath, thumbBuffer);

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Thumb-Cache', 'MISS');
    return res.status(200).send(thumbBuffer);
  } catch (err) {
    console.error('Thumbnail generation error:', err);
    return res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

router.get('/api/pricing', (req, res) => {
  const models = {};
  for (const modelId of allowedModels) {
    models[modelId] = pricingTable[modelId] ?? 0;
  }
  res.json({ ok: true, currency: 'USD', models, updatedAt: pricingUpdatedAt });
});

router.get('/api/variations', (req, res) => {
  // Expose only what the UI needs (id + label per option) — the prompt phrases
  // stay server-side as the single source of truth for expansion.
  const axes = VARIATION_AXES.map((axis) => ({
    id: axis.id,
    label: axis.label,
    options: axis.options.map((opt) => ({ id: opt.id, label: opt.label })),
  }));
  res.json({ ok: true, axes, maxJobs: maxVariationJobs });
});

router.post('/api/settings', (req, res) => {
  state.concurrency = normalizeConcurrency(req.body.concurrency || state.concurrency);
  persistQueueState();
  processQueue();
  res.json({ ok: true, concurrency: state.concurrency });
});

export default router;
