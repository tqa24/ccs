/**
 * Account Routes - CRUD operations for Claude accounts (profiles.json)
 *
 * Separated from profile-routes.ts to avoid dual-mounting conflicts.
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../../utils/config-manager';

const router = Router();

/**
 * GET /api/accounts - List accounts from profiles.json
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    const profilesPath = path.join(getCcsDir(), 'profiles.json');

    if (!fs.existsSync(profilesPath)) {
      res.json({ accounts: [], default: null });
      return;
    }

    const data = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
    const accounts = Object.entries(data.profiles || {}).map(([name, meta]) => {
      const metadata = meta as Record<string, unknown>;
      return {
        name,
        ...metadata,
      };
    });

    res.json({ accounts, default: data.default || null });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/accounts/default - Set default account
 */
router.post('/default', (req: Request, res: Response): void => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Missing required field: name' });
      return;
    }

    const profilesPath = path.join(getCcsDir(), 'profiles.json');

    const data = fs.existsSync(profilesPath)
      ? JSON.parse(fs.readFileSync(profilesPath, 'utf8'))
      : { profiles: {} };

    data.default = name;
    fs.writeFileSync(profilesPath, JSON.stringify(data, null, 2) + '\n');

    res.json({ default: name });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
