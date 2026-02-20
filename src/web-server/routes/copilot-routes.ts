/**
 * Copilot Routes - GitHub Copilot integration via copilot-api proxy
 */

import { Router, Request, Response } from 'express';
import {
  checkAuthStatus as checkCopilotAuth,
  startAuthFlow as startCopilotAuth,
  getCopilotStatus,
  getCopilotUsage,
  isDaemonRunning,
  startDaemon as startCopilotDaemon,
  stopDaemon as stopCopilotDaemon,
  getAvailableModels as getCopilotModels,
  isCopilotApiInstalled,
  ensureCopilotApi,
  installCopilotApiVersion,
  getCopilotApiInfo,
  getInstalledVersion as getCopilotInstalledVersion,
} from '../../copilot';
import { DEFAULT_COPILOT_CONFIG } from '../../config/unified-config-types';
import { loadOrCreateUnifiedConfig, saveUnifiedConfig } from '../../config/unified-config-loader';
import copilotSettingsRoutes from './copilot-settings-routes';

const router = Router();

// Mount settings sub-routes
router.use('/settings', copilotSettingsRoutes);

/**
 * GET /api/copilot/status - Get Copilot status (auth + daemon + install info)
 */
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;
    const status = await getCopilotStatus(copilotConfig);
    const installed = isCopilotApiInstalled();
    const version = getCopilotInstalledVersion();

    res.json({
      enabled: copilotConfig.enabled,
      installed,
      version,
      authenticated: status.auth.authenticated,
      daemon_running: status.daemon.running,
      port: copilotConfig.port,
      model: copilotConfig.model,
      account_type: copilotConfig.account_type,
      auto_start: copilotConfig.auto_start,
      rate_limit: copilotConfig.rate_limit,
      wait_on_limit: copilotConfig.wait_on_limit,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/config - Get Copilot configuration
 */
router.get('/config', (_req: Request, res: Response): void => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;
    res.json(copilotConfig);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/copilot/config - Update Copilot configuration
 */
router.put('/config', (req: Request, res: Response): void => {
  try {
    const updates = req.body;
    const config = loadOrCreateUnifiedConfig();

    // Merge updates with existing config
    config.copilot = {
      enabled: updates.enabled ?? config.copilot?.enabled ?? DEFAULT_COPILOT_CONFIG.enabled,
      auto_start:
        updates.auto_start ?? config.copilot?.auto_start ?? DEFAULT_COPILOT_CONFIG.auto_start,
      port: updates.port ?? config.copilot?.port ?? DEFAULT_COPILOT_CONFIG.port,
      account_type:
        updates.account_type ?? config.copilot?.account_type ?? DEFAULT_COPILOT_CONFIG.account_type,
      rate_limit:
        updates.rate_limit !== undefined
          ? updates.rate_limit
          : (config.copilot?.rate_limit ?? DEFAULT_COPILOT_CONFIG.rate_limit),
      wait_on_limit:
        updates.wait_on_limit ??
        config.copilot?.wait_on_limit ??
        DEFAULT_COPILOT_CONFIG.wait_on_limit,
      model: updates.model ?? config.copilot?.model ?? DEFAULT_COPILOT_CONFIG.model,
      opus_model:
        updates.opus_model !== undefined ? updates.opus_model : config.copilot?.opus_model,
      sonnet_model:
        updates.sonnet_model !== undefined ? updates.sonnet_model : config.copilot?.sonnet_model,
      haiku_model:
        updates.haiku_model !== undefined ? updates.haiku_model : config.copilot?.haiku_model,
    };

    saveUnifiedConfig(config);
    res.json({ success: true, copilot: config.copilot });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/auth/start - Start GitHub OAuth flow
 */
router.post('/auth/start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await startCopilotAuth();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/auth/status - Get auth status only
 */
router.get('/auth/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await checkCopilotAuth();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/models - Get available models
 */
router.get('/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const port = config.copilot?.port ?? DEFAULT_COPILOT_CONFIG.port;
    const currentModel = config.copilot?.model ?? DEFAULT_COPILOT_CONFIG.model;
    const models = await getCopilotModels(port);

    const modelsWithCurrent = models.map((m) => ({
      ...m,
      isCurrent: m.id === currentModel,
    }));

    res.json({ models: modelsWithCurrent, current: currentModel });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/usage - Get Copilot quota usage from copilot-api /usage endpoint
 */
router.get('/usage', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const port = config.copilot?.port ?? DEFAULT_COPILOT_CONFIG.port;
    const daemonRunning = await isDaemonRunning(port);

    if (!daemonRunning) {
      res.status(503).json({
        error: 'copilot-api daemon is not running',
        message: 'Start daemon first: ccs copilot start',
      });
      return;
    }

    const usage = await getCopilotUsage(port);
    if (!usage) {
      res.status(503).json({
        error: 'Failed to fetch Copilot usage',
        message: 'copilot-api /usage endpoint is unavailable',
      });
      return;
    }

    res.json(usage);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/daemon/start - Start copilot-api daemon
 */
router.post('/daemon/start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;
    const result = await startCopilotDaemon(copilotConfig);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/daemon/stop - Stop copilot-api daemon
 */
router.post('/daemon/stop', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await stopCopilotDaemon();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/install - Install copilot-api
 */
router.post('/install', async (req: Request, res: Response): Promise<void> => {
  try {
    const { version } = req.body || {};

    if (version) {
      await installCopilotApiVersion(version);
    } else {
      await ensureCopilotApi();
    }

    const info = getCopilotApiInfo();
    res.json({
      success: true,
      installed: info.installed,
      version: info.version,
      path: info.path,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/info - Get copilot-api installation info
 */
router.get('/info', (_req: Request, res: Response): void => {
  try {
    const info = getCopilotApiInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
