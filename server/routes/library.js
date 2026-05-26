import express from 'express';
import { state } from '../state.js';
import {
  upsertProductModel,
  upsertImageTemplate,
  deleteProductModel,
  deleteImageTemplate,
  assignLibraryFolder,
} from '../media.js';
import { deleteLibraryBulk } from '../queue.js';
import { libraryLimiter } from '../rateLimits.js';
import {
  serializeProductModel,
  serializeImageTemplate,
  normalizeIdList,
  normalizeLibraryFolder,
  evaluateProductModelQuality,
} from '../utils.js';

const router = express.Router();

router.get('/api/product-models', (req, res) => {
  res.json({ ok: true, productModels: state.productModels.map(serializeProductModel) });
});

router.post('/api/product-models', libraryLimiter, (req, res) => {
  const productModel = upsertProductModel(req.body);
  res.status(201).json({ ok: true, productModel: serializeProductModel(productModel) });
});

router.post('/api/product-models/:alias/evaluate', libraryLimiter, async (req, res) => {
  const productModel = await evaluateProductModelQuality(req.params.alias, req.body || {});
  res.json({
    ok: true,
    productModel: serializeProductModel(productModel),
    evaluation: productModel.evaluation,
  });
});

router.delete('/api/product-models/:alias', (req, res) => {
  const removed = deleteProductModel(req.params.alias);
  res.json({ ok: true, productModel: serializeProductModel(removed) });
});

router.get('/api/image-templates', (req, res) => {
  res.json({ ok: true, imageTemplates: state.imageTemplates.map(serializeImageTemplate) });
});

router.post('/api/image-templates', libraryLimiter, (req, res) => {
  const imageTemplate = upsertImageTemplate(req.body);
  res.status(201).json({ ok: true, imageTemplate: serializeImageTemplate(imageTemplate) });
});

router.delete('/api/image-templates/:alias', (req, res) => {
  const removed = deleteImageTemplate(req.params.alias);
  res.json({ ok: true, imageTemplate: serializeImageTemplate(removed) });
});

router.post('/api/library/folders/assign', libraryLimiter, (req, res) => {
  const folder = normalizeLibraryFolder(req.body.folder);
  const updated = assignLibraryFolder({
    folder,
    jobs: normalizeIdList(req.body.jobs),
    cutouts: normalizeIdList(req.body.cutouts),
    crops: normalizeIdList(req.body.crops),
  });
  res.json({ ok: true, folder, updated });
});

router.delete('/api/library/bulk', libraryLimiter, (req, res) => {
  const removed = deleteLibraryBulk({
    jobs: normalizeIdList(req.body.jobs),
    cutouts: normalizeIdList(req.body.cutouts),
    crops: normalizeIdList(req.body.crops),
  });
  res.json({ ok: true, removed });
});

export default router;
