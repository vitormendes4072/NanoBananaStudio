import express from 'express';
import { state, saveJob } from '../state.js';
import { createJob, deleteJob, deleteGalleryJobsBulk, processQueue } from '../queue.js';
import { createBranchReference } from '../media.js';
import { addClient, removeClient } from '../sse.js';
import { generationLimiter } from '../rateLimits.js';
import { allowedModels, defaultModel, maxVariationJobs } from '../config.js';
import { normalizeVariations, countVariations, expandVariations } from '../prompt-variations.js';
import {
  serializeJob,
  normalizeQuantity,
  normalizePromptOptions,
  normalizeReferenceImages,
  normalizeBranchReference,
  normalizeIdList,
  normalizeLibraryFolder,
  resolveProductModelsByAlias,
  resolveImageTemplatesByAlias,
  buildBatchId,
  buildComparisonId,
  pickAllowedValue,
  storeReferenceImages,
  buildJobProductModelMeta,
  buildJobImageTemplateMeta,
} from '../utils.js';

const router = express.Router();

router.get('/api/jobs/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  addClient(res);
  req.on('close', () => removeClient(res));
});

router.get('/api/jobs', (req, res) => {
  res.json({
    ok: true,
    activeJobIds: Array.from(state.activeJobIds),
    concurrency: state.concurrency,
    jobs: state.jobs.map(serializeJob),
  });
});

router.post('/api/jobs', generationLimiter, (req, res) => {
  const body = req.body;
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return res
      .status(400)
      .json({ error: 'Configure a GEMINI_API_KEY no arquivo .env antes de gerar imagens.' });
  }

  const prompt = String(body.prompt || '').trim();
  if (!prompt) {
    return res.status(400).json({ error: 'Informe um prompt para gerar a imagem.' });
  }

  const promptBase = String(body.promptBase || prompt).trim();
  const promptOptions = normalizePromptOptions(body.promptOptions);
  const quantity = normalizeQuantity(body.quantity || 1);
  const targetFolder = normalizeLibraryFolder(body.folder);
  const resolvedProductModels = resolveProductModelsByAlias(body.productModelAliases);
  const resolvedImageTemplates = resolveImageTemplatesByAlias(body.imageTemplateAliases);

  const uploadedReferenceImages = storeReferenceImages(
    normalizeReferenceImages(body.referenceImages)
  );
  const branchReferenceImage = createBranchReference(
    normalizeBranchReference(body.branchReference)
  );
  const referenceImages = branchReferenceImage
    ? [branchReferenceImage, ...uploadedReferenceImages]
    : uploadedReferenceImages;

  const mergedReferenceImages = [
    ...resolvedProductModels.flatMap((e) => e.referenceImages || []),
    ...resolvedImageTemplates.flatMap((e) => e.referenceImages || []),
    ...referenceImages,
  ];

  const compareModels = Boolean(body.compareModels);
  const normalizedVariations = normalizeVariations(body.variations);
  const variationCount = countVariations(normalizedVariations);

  const createdJobs = [];
  let capped = false;

  if (variationCount > 0) {
    // Auto-variation batch: expand the prompt across the selected axes (cartesian
    // product), one job per combination, sharing a batchId. Takes precedence over
    // compareModels and ignores body.quantity.
    const model = pickAllowedValue(body.model, allowedModels, defaultModel);
    let expandedPrompts = expandVariations(prompt, normalizedVariations);
    let expandedBases = expandVariations(promptBase, normalizedVariations);

    if (expandedPrompts.length > maxVariationJobs) {
      capped = true;
      expandedPrompts = expandedPrompts.slice(0, maxVariationJobs);
      expandedBases = expandedBases.slice(0, maxVariationJobs);
    }

    const total = expandedPrompts.length;
    const batchId = buildBatchId();
    for (let index = 0; index < total; index++) {
      createdJobs.push(
        createJob({
          prompt: expandedPrompts[index].prompt,
          promptBase: expandedBases[index].prompt,
          promptOptions,
          model,
          referenceImages: mergedReferenceImages,
          productModels: resolvedProductModels.map(buildJobProductModelMeta),
          imageTemplates: resolvedImageTemplates.map(buildJobImageTemplateMeta),
          targetFolder,
          batchId,
          batchIndex: index + 1,
          batchTotal: total,
        })
      );
    }
  } else if (compareModels) {
    // One job per allowed model, sharing a comparisonId. Ignores body.model and body.quantity.
    const comparisonId = buildComparisonId();
    for (const modelId of allowedModels) {
      createdJobs.push(
        createJob({
          prompt,
          promptBase,
          promptOptions,
          model: modelId,
          referenceImages: mergedReferenceImages,
          productModels: resolvedProductModels.map(buildJobProductModelMeta),
          imageTemplates: resolvedImageTemplates.map(buildJobImageTemplateMeta),
          targetFolder,
          batchId: null,
          batchIndex: null,
          batchTotal: null,
          comparisonId,
        })
      );
    }
  } else {
    const model = pickAllowedValue(body.model, allowedModels, defaultModel);
    const batchId = quantity > 1 ? buildBatchId() : null;

    for (let index = 0; index < quantity; index++) {
      createdJobs.push(
        createJob({
          prompt,
          promptBase,
          promptOptions,
          model,
          referenceImages: mergedReferenceImages,
          productModels: resolvedProductModels.map(buildJobProductModelMeta),
          imageTemplates: resolvedImageTemplates.map(buildJobImageTemplateMeta),
          targetFolder,
          batchId,
          batchIndex: quantity > 1 ? index + 1 : null,
          batchTotal: quantity > 1 ? quantity : null,
        })
      );
    }
  }
  processQueue();

  const response = {
    ok: true,
    quantity: createdJobs.length,
    jobs: createdJobs.map(serializeJob),
  };
  if (capped) {
    response.capped = true;
    response.note = `Limite de ${maxVariationJobs} variações por lote — geradas as primeiras ${createdJobs.length}.`;
  }

  res.status(202).json(response);
});

router.post('/api/jobs/:id/cancel', (req, res) => {
  const job = state.jobsById.get(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job não encontrado.' });
  }
  if (job.status !== 'queued') {
    return res
      .status(409)
      .json({ error: 'Apenas jobs na fila podem ser cancelados.', job: serializeJob(job) });
  }

  job.status = 'cancelled';
  job.finishedAt = new Date().toISOString();
  saveJob(job);

  res.json({ ok: true, job: serializeJob(job) });
});

router.delete('/api/jobs/bulk', (req, res) => {
  const removed = deleteGalleryJobsBulk(normalizeIdList(req.body.ids));
  res.json({ ok: true, removed });
});

router.delete('/api/jobs/:id', (req, res) => {
  const removedJob = deleteJob(req.params.id);
  res.json({ ok: true, job: serializeJob(removedJob) });
});

export default router;
