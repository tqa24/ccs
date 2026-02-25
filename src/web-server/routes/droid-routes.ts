import type { Request, Response } from 'express';
import { Router } from 'express';
import {
  getDroidDashboardDiagnostics,
  getDroidRawSettings,
} from '../services/droid-dashboard-service';

const router = Router();

/**
 * GET /api/droid/diagnostics
 * Dashboard-ready Droid installation + BYOK configuration diagnostics.
 */
router.get('/diagnostics', (_req: Request, res: Response): void => {
  try {
    res.json(getDroidDashboardDiagnostics());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/droid/settings/raw
 * Raw ~/.factory/settings.json payload for read-only viewer.
 */
router.get('/settings/raw', (_req: Request, res: Response): void => {
  try {
    res.json(getDroidRawSettings());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
