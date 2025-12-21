/**
 * CLIProxy Stats Routes - Stats, status, models, error logs for CLIProxyAPI
 */

import { Router, Request, Response } from 'express';
import * as path from 'path';
import {
  fetchCliproxyStats,
  fetchCliproxyModels,
  isCliproxyRunning,
  fetchCliproxyErrorLogs,
  fetchCliproxyErrorLogContent,
} from '../../cliproxy/stats-fetcher';
import { getCliproxyWritablePath } from '../../cliproxy/config-generator';
import { getProxyStatus as getProxyProcessStatus, stopProxy } from '../../cliproxy/session-tracker';
import { ensureCliproxyService } from '../../cliproxy/service-manager';
import { checkCliproxyUpdate } from '../../cliproxy/binary-manager';

const router = Router();

/**
 * Shared handler for stats/usage endpoint
 */
const handleStatsRequest = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Check if proxy is running first
    const running = await isCliproxyRunning();
    if (!running) {
      res.status(503).json({
        error: 'CLIProxyAPI not running',
        message: 'Start a CLIProxy session (gemini, codex, agy) to collect stats',
      });
      return;
    }

    // Fetch stats from management API
    const stats = await fetchCliproxyStats();
    if (!stats) {
      res.status(503).json({
        error: 'Stats unavailable',
        message: 'CLIProxyAPI is running but stats endpoint not responding',
      });
      return;
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

/**
 * GET /api/cliproxy/stats - Get CLIProxyAPI usage statistics
 * Returns: CliproxyStats or error if proxy not running
 */
router.get('/stats', handleStatsRequest);

/**
 * GET /api/cliproxy/usage - Alias for /stats (frontend compatibility)
 */
router.get('/usage', handleStatsRequest);

/**
 * GET /api/cliproxy/status - Check CLIProxyAPI running status
 * Returns: { running: boolean }
 */
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const running = await isCliproxyRunning();
    res.json({ running });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/proxy-status - Get detailed proxy process status
 * Returns: { running, port?, pid?, sessionCount?, startedAt? }
 * Combines session tracker data with actual port check for accuracy
 */
router.get('/proxy-status', async (_req: Request, res: Response): Promise<void> => {
  try {
    // First check session tracker for detailed info
    const sessionStatus = getProxyProcessStatus();

    // If session tracker says running, trust it
    if (sessionStatus.running) {
      res.json(sessionStatus);
      return;
    }

    // Session tracker says not running, but proxy might be running without session tracking
    // (e.g., started before session persistence was implemented)
    const actuallyRunning = await isCliproxyRunning();

    if (actuallyRunning) {
      // Proxy running but no session lock - legacy/untracked instance
      res.json({
        running: true,
        port: 8317, // Default port
        sessionCount: 0, // Unknown sessions
        // No pid/startedAt since we don't have session lock
      });
    } else {
      res.json(sessionStatus);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/cliproxy/proxy-start - Start the CLIProxy service
 * Returns: { started, alreadyRunning, port, error? }
 * Starts proxy in background if not already running
 */
router.post('/proxy-start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await ensureCliproxyService();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/cliproxy/proxy-stop - Stop the CLIProxy service
 * Returns: { stopped, pid?, sessionCount?, error? }
 */
router.post('/proxy-stop', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await stopProxy();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/update-check - Check for CLIProxyAPI binary updates
 * Returns: { hasUpdate, currentVersion, latestVersion, fromCache }
 */
router.get('/update-check', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await checkCliproxyUpdate();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/models - Get available models from CLIProxyAPI
 * Returns: { models: CliproxyModel[], byCategory: Record<string, CliproxyModel[]>, totalCount: number }
 */
router.get('/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Check if proxy is running first
    const running = await isCliproxyRunning();
    if (!running) {
      res.status(503).json({
        error: 'CLIProxyAPI not running',
        message: 'Start a CLIProxy session (gemini, codex, agy) to fetch available models',
      });
      return;
    }

    // Fetch models from /v1/models endpoint
    const modelsResponse = await fetchCliproxyModels();
    if (!modelsResponse) {
      res.status(503).json({
        error: 'Models unavailable',
        message: 'CLIProxyAPI is running but /v1/models endpoint not responding',
      });
      return;
    }

    res.json(modelsResponse);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== Error Logs ====================

/**
 * GET /api/cliproxy/error-logs - Get list of error log files
 * Returns: { files: CliproxyErrorLog[] } or error if proxy not running
 */
router.get('/error-logs', async (_req: Request, res: Response): Promise<void> => {
  try {
    const running = await isCliproxyRunning();
    if (!running) {
      res.status(503).json({
        error: 'CLIProxyAPI not running',
        message: 'Start a CLIProxy session to view error logs',
      });
      return;
    }

    const files = await fetchCliproxyErrorLogs();
    if (files === null) {
      res.status(503).json({
        error: 'Error logs unavailable',
        message: 'CLIProxyAPI is running but error logs endpoint not responding',
      });
      return;
    }

    // Inject absolute paths into each file entry
    const logsDir = path.join(getCliproxyWritablePath(), 'logs');
    const filesWithPaths = files.map((file) => ({
      ...file,
      absolutePath: path.join(logsDir, file.name),
    }));

    res.json({ files: filesWithPaths });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/cliproxy/error-logs/:name - Get content of a specific error log
 * Returns: plain text log content
 */
router.get('/error-logs/:name', async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;

  // Validate filename format and prevent path traversal
  if (
    !name ||
    !name.startsWith('error-') ||
    !name.endsWith('.log') ||
    name.includes('..') ||
    name.includes('/') ||
    name.includes('\\')
  ) {
    res.status(400).json({ error: 'Invalid error log filename' });
    return;
  }

  try {
    const running = await isCliproxyRunning();
    if (!running) {
      res.status(503).json({ error: 'CLIProxyAPI not running' });
      return;
    }

    const content = await fetchCliproxyErrorLogContent(name);
    if (content === null) {
      res.status(404).json({ error: 'Error log not found' });
      return;
    }

    res.type('text/plain').send(content);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
