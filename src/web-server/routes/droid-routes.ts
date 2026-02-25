import type { Request, Response } from 'express';
import { Router } from 'express';
import {
  DroidRawSettingsConflictError,
  DroidRawSettingsValidationError,
  getDroidDashboardDiagnostics,
  getDroidRawSettings,
  saveDroidRawSettings,
} from '../services/droid-dashboard-service';

const router = Router();

/**
 * GET /api/droid/diagnostics
 * Dashboard-ready Droid installation + BYOK configuration diagnostics.
 */
router.get('/diagnostics', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await getDroidDashboardDiagnostics());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/droid/settings/raw
 * Raw ~/.factory/settings.json payload for editor.
 */
router.get('/settings/raw', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await getDroidRawSettings());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/droid/settings/raw
 * Save raw ~/.factory/settings.json payload from dashboard editor.
 */
router.put('/settings/raw', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawText, expectedMtime } = req.body ?? {};

    if (typeof rawText !== 'string') {
      res.status(400).json({ error: 'rawText must be a string.' });
      return;
    }
    if (
      expectedMtime !== undefined &&
      (typeof expectedMtime !== 'number' || !Number.isFinite(expectedMtime))
    ) {
      res.status(400).json({ error: 'expectedMtime must be a finite number when provided.' });
      return;
    }

    res.json(await saveDroidRawSettings({ rawText, expectedMtime }));
  } catch (error) {
    if (error instanceof DroidRawSettingsValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof DroidRawSettingsConflictError) {
      res.status(409).json({ error: error.message, mtime: error.mtime });
      return;
    }
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
