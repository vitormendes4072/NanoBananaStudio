import express from 'express';
import systemRouter from './system.js';
import jobsRouter from './jobs.js';
import mediaRouter from './media.js';
import libraryRouter from './library.js';
import analyticsRouter from './analytics.js';
import exportRouter from './export.js';

const router = express.Router();

router.use(systemRouter);
router.use(jobsRouter);
router.use(mediaRouter);
router.use(libraryRouter);
router.use(analyticsRouter);
router.use(exportRouter);

router.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

export default router;
