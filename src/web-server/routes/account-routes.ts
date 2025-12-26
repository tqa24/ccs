/**
 * Account Routes - CRUD operations for Claude accounts
 *
 * Uses ProfileRegistry to read from both legacy (profiles.json)
 * and unified config (config.yaml) for consistent data with CLI.
 */

import { Router, Request, Response } from 'express';
import ProfileRegistry from '../../auth/profile-registry';
import { isUnifiedMode } from '../../config/unified-config-loader';

const router = Router();
const registry = new ProfileRegistry();

/**
 * GET /api/accounts - List accounts from both profiles.json and config.yaml
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    // Get profiles from both legacy and unified config (same logic as CLI)
    const legacyProfiles = registry.getAllProfiles();
    const unifiedAccounts = registry.getAllAccountsUnified();

    // Merge profiles: unified config takes precedence
    const merged: Record<string, { type: string; created: string; last_used: string | null }> = {};

    // Add legacy profiles first
    for (const [name, meta] of Object.entries(legacyProfiles)) {
      merged[name] = {
        type: meta.type || 'account',
        created: meta.created,
        last_used: meta.last_used || null,
      };
    }

    // Override with unified config accounts (takes precedence)
    for (const [name, account] of Object.entries(unifiedAccounts)) {
      merged[name] = {
        type: 'account',
        created: account.created,
        last_used: account.last_used,
      };
    }

    // Convert to array format
    const accounts = Object.entries(merged).map(([name, meta]) => ({
      name,
      ...meta,
    }));

    // Get default from unified config first, fallback to legacy
    const defaultProfile = registry.getDefaultUnified() ?? registry.getDefaultProfile() ?? null;

    res.json({ accounts, default: defaultProfile });
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

    // Use unified config if in unified mode, otherwise use legacy
    if (isUnifiedMode()) {
      registry.setDefaultUnified(name);
    } else {
      registry.setDefaultProfile(name);
    }

    res.json({ default: name });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
