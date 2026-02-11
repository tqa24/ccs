/**
 * Cursor Module Index
 *
 * Central exports for Cursor IDE integration.
 */

// Types
export * from './types';

// Auth
export { autoDetectTokens, saveCredentials, loadCredentials, checkAuthStatus } from './cursor-auth';

// Daemon
export { isDaemonRunning, getDaemonStatus, startDaemon, stopDaemon } from './cursor-daemon';

// Models
export {
  DEFAULT_CURSOR_MODELS,
  fetchModelsFromDaemon,
  getAvailableModels,
  getDefaultModel,
} from './cursor-models';

// Executor
export { CursorExecutor } from './cursor-executor';
