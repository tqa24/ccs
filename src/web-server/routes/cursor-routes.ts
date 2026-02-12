/**
 * Cursor Routes - Cursor IDE integration via cursor proxy daemon
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import {
  checkAuthStatus,
  autoDetectTokens,
  saveCredentials,
  validateToken,
} from '../../cursor/cursor-auth';
import { getCursorConfig } from '../../config/unified-config-loader';
import cursorSettingsRoutes from './cursor-settings-routes';

const router = Router();

// Mount settings sub-routes
router.use('/settings', cursorSettingsRoutes);

/**
 * Get daemon status
 * TODO: Implement in cursor-executor.ts (#520)
 */
async function getDaemonStatus(port: number): Promise<{ running: boolean; port?: number }> {
  // Stub - will be implemented in #520
  return { running: false, port };
}

/**
 * Get available models
 * TODO: Implement in cursor-executor.ts (#520)
 */
async function getAvailableModels(): Promise<string[]> {
  // Stub - will be implemented in #520
  return []; // TODO: populated by cursor-models.ts (#520)
}

/**
 * Start daemon
 * TODO: Implement in cursor-executor.ts (#520)
 */
async function startDaemon(
  port: number,
  ghostMode: boolean
): Promise<{ success: boolean; message: string }> {
  // Stub - will be implemented in #520
  return {
    success: false,
    message: `Daemon start not implemented (port: ${port}, ghost: ${ghostMode})`,
  };
}

/**
 * Stop daemon
 * TODO: Implement in cursor-executor.ts (#520)
 */
async function stopDaemon(): Promise<{ success: boolean; message: string }> {
  // Stub - will be implemented in #520
  return { success: false, message: 'Daemon stop not implemented' };
}

/**
 * GET /api/cursor/status - Get Cursor status (auth + daemon)
 */
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const cursorConfig = getCursorConfig();
    const authStatus = checkAuthStatus();
    const daemonStatus = await getDaemonStatus(cursorConfig.port);

    res.json({
      enabled: cursorConfig.enabled,
      authenticated: authStatus.authenticated,
      daemon_running: daemonStatus.running,
      port: cursorConfig.port,
      auto_start: cursorConfig.auto_start,
      ghost_mode: cursorConfig.ghost_mode,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/cursor/auth/import - Import Cursor token manually
 */
router.post('/auth/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const { accessToken, machineId } = req.body;
    if (!accessToken || !machineId) {
      res.status(400).json({ error: 'Missing accessToken or machineId' });
      return;
    }

    // Validate token format
    if (!validateToken(accessToken, machineId)) {
      res.status(400).json({ error: 'Invalid token or machine ID format' });
      return;
    }

    // Save credentials
    saveCredentials({
      accessToken,
      machineId,
      authMethod: 'manual',
      importedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Token imported successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/cursor/auth/auto-detect - Auto-detect token from SQLite
 */
router.post('/auth/auto-detect', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = autoDetectTokens();

    if (!result.found || !result.accessToken || !result.machineId) {
      res.status(404).json({ error: result.error ?? 'Token not found' });
      return;
    }

    // Save credentials
    saveCredentials({
      accessToken: result.accessToken,
      machineId: result.machineId,
      authMethod: 'auto-detect',
      importedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Token auto-detected and imported' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cursor/models - List available models
 */
router.get('/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    const models = await getAvailableModels();
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/cursor/daemon/start - Start cursor proxy daemon
 * Path matches copilot convention: /api/{provider}/daemon/{action}
 */
router.post('/daemon/start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const cursorConfig = getCursorConfig();
    const result = await startDaemon(cursorConfig.port, cursorConfig.ghost_mode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/cursor/daemon/stop - Stop cursor proxy daemon
 * Path matches copilot convention: /api/{provider}/daemon/{action}
 */
router.post('/daemon/stop', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await stopDaemon();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
