import express from 'express';
import db from '../db.js';
import { buildUsageSummary, buildAnalytics } from '../utils.js';

const router = express.Router();

router.get('/api/usage', (req, res) => {
  res.json(buildUsageSummary());
});

router.get('/api/analytics', (req, res) => {
  res.json(buildAnalytics(db));
});

export default router;
