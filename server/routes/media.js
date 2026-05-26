import express from 'express';
import { state } from '../state.js';
import { createCutout, createCrop, deleteCutout, deleteCrop } from '../media.js';
import { deleteCutoutsBulk, deleteCropsBulk } from '../queue.js';
import { removeBackgroundFromReferenceImage } from '../backgroundRemoval.js';
import { heavyComputeLimiter, libraryLimiter } from '../rateLimits.js';
import {
  normalizeIdList,
  normalizeCutoutSource,
  normalizeCropSource,
  normalizeReferenceUploadForProcessing,
} from '../utils.js';

const router = express.Router();

router.get('/api/cutouts', (req, res) => {
  res.json({
    ok: true,
    processing: state.backgroundRemovalInFlight,
    processingJobId: state.backgroundRemovalSourceJobId,
    cutouts: state.cutouts,
  });
});

router.post('/api/cutouts', heavyComputeLimiter, async (req, res) => {
  const createdCutout = await createCutout(normalizeCutoutSource(req.body));
  res.status(201).json({ ok: true, cutout: createdCutout });
});

router.delete('/api/cutouts/bulk', libraryLimiter, (req, res) => {
  const removed = deleteCutoutsBulk(normalizeIdList(req.body.ids));
  res.json({ ok: true, removed });
});

router.delete('/api/cutouts/:id', (req, res) => {
  const removedCutout = deleteCutout(req.params.id);
  res.json({ ok: true, cutout: removedCutout });
});

router.get('/api/crops', (req, res) => {
  res.json({ ok: true, crops: state.crops });
});

router.post('/api/crops', libraryLimiter, (req, res) => {
  const crop = createCrop(normalizeCropSource(req.body));
  res.status(201).json({ ok: true, crop });
});

router.delete('/api/crops/bulk', libraryLimiter, (req, res) => {
  const removed = deleteCropsBulk(normalizeIdList(req.body.ids));
  res.json({ ok: true, removed });
});

router.delete('/api/crops/:id', (req, res) => {
  const removedCrop = deleteCrop(req.params.id);
  res.json({ ok: true, crop: removedCrop });
});

router.post('/api/reference-images/remove-background', heavyComputeLimiter, async (req, res) => {
  const processedReference = await removeBackgroundFromReferenceImage(
    normalizeReferenceUploadForProcessing(req.body)
  );
  res.json({ ok: true, referenceImage: processedReference });
});

export default router;
