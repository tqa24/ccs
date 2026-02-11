/**
 * Cursor CLI Command
 *
 * Handles `ccs cursor <subcommand>` commands.
 */

import {
  autoDetectTokens,
  saveCredentials,
  checkAuthStatus,
  startDaemon,
  stopDaemon,
  getDaemonStatus,
  getAvailableModels,
  DEFAULT_CURSOR_PORT,
  DEFAULT_CURSOR_MODEL,
} from '../cursor';
import { ok, fail, info, color } from '../utils/ui';

// Temporary default config until #521 adds cursor to unified config
const DEFAULT_CURSOR_CONFIG = {
  port: DEFAULT_CURSOR_PORT,
  model: DEFAULT_CURSOR_MODEL,
};

/**
 * Handle cursor subcommand.
 */
export async function handleCursorCommand(args: string[]): Promise<number> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'auth':
      return handleAuth();
    case 'status':
      return handleStatus();
    case 'models':
      return handleModels();
    case 'start':
      return handleStart();
    case 'stop':
      return handleStop();
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return handleHelp();
    default:
      console.error(fail(`Unknown subcommand: ${subcommand}`));
      console.error('');
      return handleHelp();
  }
}

/**
 * Show help for cursor commands.
 */
function handleHelp(): number {
  console.log('Cursor IDE Integration');
  console.log('');
  console.log('Usage: ccs cursor <subcommand>');
  console.log('');
  console.log('Subcommands:');
  console.log('  auth      Import Cursor IDE authentication token');
  console.log('  status    Show authentication and daemon status');
  console.log('  models    List available models');
  console.log('  start     Start cursor daemon');
  console.log('  stop      Stop cursor daemon');
  console.log('  help      Show this help message');
  console.log('');
  console.log('Quick start:');
  console.log('  1. ccs cursor auth     # Import Cursor IDE token');
  console.log('  2. ccs cursor start    # Start daemon');
  console.log('  3. Use cursor models   # Via daemon on configured port');
  console.log('');
  console.log('Or use the web UI: ccs config → Cursor tab');
  console.log('');
  return 0;
}

/**
 * Handle auth subcommand.
 */
async function handleAuth(): Promise<number> {
  console.log(info('Importing Cursor IDE authentication...'));
  console.log('');

  // Try auto-detection first
  console.log(info('Attempting auto-detection...'));
  const autoResult = autoDetectTokens();

  if (autoResult.found && autoResult.accessToken && autoResult.machineId) {
    saveCredentials({
      accessToken: autoResult.accessToken,
      machineId: autoResult.machineId,
      authMethod: 'auto-detect',
      importedAt: new Date().toISOString(),
    });
    console.log(ok('Auto-detected Cursor credentials'));
    console.log('');
    console.log('Next steps:');
    console.log('  1. Start daemon: ccs cursor start');
    console.log('  2. Check status: ccs cursor status');
    return 0;
  }

  // Fall back to manual import
  console.log('');
  console.log('Auto-detection failed. Please provide credentials manually.');
  console.log('');
  console.log('To find your Cursor credentials:');
  console.log('  1. Open Cursor IDE');
  console.log('  2. Check application data directory');
  console.log('  3. Look for access token and machine ID');
  console.log('');

  // For now, just show instructions
  // Manual import flow will be implemented when needed
  console.error(fail('Manual import not yet implemented'));
  console.error('');
  console.error('Use auto-detection for now or wait for manual import feature.');

  return 1;
}

/**
 * Handle status subcommand.
 */
async function handleStatus(): Promise<number> {
  // TODO: Load from unified config when #521 is complete
  const cursorConfig = DEFAULT_CURSOR_CONFIG;

  const authStatus = checkAuthStatus();
  const daemonStatus = await getDaemonStatus(cursorConfig.port);

  console.log('Cursor IDE Status');
  console.log('─────────────────');
  console.log('');

  // Auth status
  const authIcon = authStatus.authenticated ? color('[OK]', 'success') : color('[X]', 'error');
  const authText = authStatus.authenticated ? 'Authenticated' : 'Not authenticated';
  console.log(`Authentication: ${authIcon} ${authText}`);

  if (authStatus.authenticated && authStatus.tokenAge !== undefined) {
    console.log(`  Token age:    ${authStatus.tokenAge.toFixed(1)} hours`);
  }

  // Daemon status
  const daemonIcon = daemonStatus.running ? color('[OK]', 'success') : color('[X]', 'error');
  const daemonText = daemonStatus.running ? 'Running' : 'Not running';
  console.log(`Daemon:         ${daemonIcon} ${daemonText}`);

  if (daemonStatus.pid) {
    console.log(`  PID:          ${daemonStatus.pid}`);
  }

  console.log('');
  console.log('Configuration:');
  console.log(`  Port:         ${cursorConfig.port}`);
  console.log(`  Model:        ${cursorConfig.model}`);

  console.log('');

  // Show next steps if not fully configured
  if (!authStatus.authenticated || !daemonStatus.running) {
    console.log('Next steps:');
    if (!authStatus.authenticated) {
      console.log('  - Auth:        ccs cursor auth');
    }
    if (!daemonStatus.running) {
      console.log('  - Start:       ccs cursor start');
    }
  }

  return 0;
}

/**
 * Handle models subcommand.
 */
async function handleModels(): Promise<number> {
  // TODO: Load from unified config when #521 is complete
  const cursorConfig = DEFAULT_CURSOR_CONFIG;

  console.log('Available Cursor Models');
  console.log('───────────────────────');
  console.log('');

  const models = await getAvailableModels(cursorConfig.port);

  for (const model of models) {
    const current = model.id === cursorConfig.model ? ' [CURRENT]' : '';
    const defaultMark = model.isDefault ? ' (default)' : '';
    console.log(`  ${model.id}${current}${defaultMark}`);
    console.log(`    Provider: ${model.provider}`);
  }

  console.log('');
  console.log('To change model: ccs config (Cursor section)');

  return 0;
}

/**
 * Handle start subcommand.
 */
async function handleStart(): Promise<number> {
  // TODO: Load from unified config when #521 is complete
  const cursorConfig = DEFAULT_CURSOR_CONFIG;

  // Check auth first
  const authStatus = checkAuthStatus();
  if (!authStatus.authenticated) {
    console.error(fail('Not authenticated. Run: ccs cursor auth'));
    return 1;
  }

  console.log(info(`Starting cursor daemon on port ${cursorConfig.port}...`));

  const result = await startDaemon(cursorConfig);

  if (result.success) {
    console.log(ok(`Daemon started (PID: ${result.pid})`));
    return 0;
  } else {
    console.error(fail(result.error || 'Failed to start daemon'));
    return 1;
  }
}

/**
 * Handle stop subcommand.
 */
async function handleStop(): Promise<number> {
  console.log(info('Stopping cursor daemon...'));

  const result = await stopDaemon();

  if (result.success) {
    console.log(ok('Daemon stopped'));
    return 0;
  } else {
    console.error(fail(result.error || 'Failed to stop daemon'));
    return 1;
  }
}
