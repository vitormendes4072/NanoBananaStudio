import express from 'express';
import db from '../db.js';
import { buildUsageSummary, buildAnalytics } from '../utils.js';

const router = express.Router();

router.get('/api/usage', (req, res) => {
  res.json(buildUsageSummary());
});

const ALLOWED_PERIOD_DAYS = new Set([7, 30, 90]);

router.get('/api/analytics', (req, res) => {
  const raw = parseInt(req.query.days, 10);
  // 0 means "all time" (null); any non-allowed value falls back to 30
  const periodDays = raw === 0 ? null : ALLOWED_PERIOD_DAYS.has(raw) ? raw : 30;
  res.json(buildAnalytics(db, periodDays));
});

export default router;
