/**
 * Cursor Settings Routes - Settings editor and raw settings for Cursor IDE
 */

import type { Router, Request, Response } from 'express';
import { Router as ExpressRouter } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../../utils/config-manager';
import { DEFAULT_CURSOR_CONFIG } from '../../config/unified-config-types';
import { loadOrCreateUnifiedConfig, saveUnifiedConfig } from '../../config/unified-config-loader';

const router: Router = ExpressRouter();

/**
 * GET /api/cursor/settings - Get cursor config (port, auto_start, ghost_mode)
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const cursorConfig = config.cursor ?? DEFAULT_CURSOR_CONFIG;
    res.json(cursorConfig);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/cursor/settings - Update cursor config
 */
router.put('/', (req: Request, res: Response): void => {
  try {
    const updates = req.body;

    // Reject non-object bodies
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    // Validate input types
    if (updates && typeof updates === 'object') {
      if ('port' in updates) {
        if (typeof updates.port !== 'number' || !Number.isInteger(updates.port)) {
          res.status(400).json({ error: 'port must be an integer' });
          return;
        }
        if (updates.port < 1 || updates.port > 65535) {
          res.status(400).json({ error: 'port must be between 1 and 65535' });
          return;
        }
      }
      if ('auto_start' in updates && typeof updates.auto_start !== 'boolean') {
        res.status(400).json({ error: 'auto_start must be a boolean' });
        return;
      }
      if ('ghost_mode' in updates && typeof updates.ghost_mode !== 'boolean') {
        res.status(400).json({ error: 'ghost_mode must be a boolean' });
        return;
      }
    }

    const config = loadOrCreateUnifiedConfig();

    // Merge updates with existing config
    config.cursor = {
      port: updates.port ?? config.cursor?.port ?? DEFAULT_CURSOR_CONFIG.port,
      auto_start:
        updates.auto_start ?? config.cursor?.auto_start ?? DEFAULT_CURSOR_CONFIG.auto_start,
      ghost_mode:
        updates.ghost_mode ?? config.cursor?.ghost_mode ?? DEFAULT_CURSOR_CONFIG.ghost_mode,
    };

    saveUnifiedConfig(config);
    res.json({ success: true, cursor: config.cursor });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cursor/settings/raw - Get raw cursor.settings.json
 * Returns the raw JSON content for editing in the code editor
 */
router.get('/raw', (_req: Request, res: Response): void => {
  try {
    const settingsPath = path.join(getCcsDir(), 'cursor.settings.json');
    const config = loadOrCreateUnifiedConfig();
    const cursorConfig = config.cursor ?? DEFAULT_CURSOR_CONFIG;

    // If file doesn't exist, return default structure
    if (!fs.existsSync(settingsPath)) {
      // Create settings structure matching Cursor pattern
      // Use 127.0.0.1 instead of localhost for more reliable local connections
      const defaultSettings = {
        env: {
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${cursorConfig.port}`,
          ANTHROPIC_AUTH_TOKEN: 'cursor-managed',
        },
      };

      res.json({
        settings: defaultSettings,
        mtime: Date.now(),
        path: settingsPath,
        exists: false,
      });
      return;
    }

    const content = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    const stat = fs.statSync(settingsPath);

    res.json({
      settings,
      mtime: stat.mtimeMs,
      path: settingsPath,
      exists: true,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/cursor/settings/raw - Save raw cursor.settings.json
 * Saves the raw JSON content from the code editor
 */
router.put('/raw', (req: Request, res: Response): void => {
  try {
    const { settings, expectedMtime } = req.body;

    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'settings must be a JSON object' });
      return;
    }

    const settingsPath = path.join(getCcsDir(), 'cursor.settings.json');

    // Check for conflict if file exists and expectedMtime provided
    if (fs.existsSync(settingsPath) && expectedMtime) {
      const stat = fs.statSync(settingsPath);
      if (Math.abs(stat.mtimeMs - expectedMtime) > 1000) {
        res.status(409).json({ error: 'File modified externally', mtime: stat.mtimeMs });
        return;
      }
    }

    // Write settings file atomically
    const tempPath = settingsPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2) + '\n');
    fs.renameSync(tempPath, settingsPath);

    const stat = fs.statSync(settingsPath);
    res.json({ success: true, mtime: stat.mtimeMs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
