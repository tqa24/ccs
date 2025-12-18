/**
 * Copilot API Types
 *
 * Type definitions for GitHub Copilot proxy integration.
 */

/**
 * Copilot authentication status.
 */
export interface CopilotAuthStatus {
  authenticated: boolean;
  /** GitHub username if authenticated */
  username?: string;
  /** Error message if auth check failed */
  error?: string;
}

/**
 * Copilot daemon status.
 */
export interface CopilotDaemonStatus {
  running: boolean;
  port: number;
  /** Process ID if running */
  pid?: number;
  /** Version if available */
  version?: string;
}

/**
 * Combined copilot status.
 */
export interface CopilotStatus {
  auth: CopilotAuthStatus;
  daemon: CopilotDaemonStatus;
}

/**
 * Copilot plan tier for model availability.
 * Based on GitHub Copilot plans.
 */
export type CopilotPlanTier = 'free' | 'pro' | 'pro+' | 'business' | 'enterprise';

/**
 * Copilot model information.
 */
export interface CopilotModel {
  id: string;
  name: string;
  /** Provider: openai or anthropic */
  provider: 'openai' | 'anthropic';
  /** Whether this is the default model */
  isDefault?: boolean;
  /** Minimum plan tier required (free = available to all) */
  minPlan?: CopilotPlanTier;
  /** Premium request multiplier (0 = free, higher = more expensive) */
  multiplier?: number;
  /** Whether this model is in preview */
  preview?: boolean;
}

/**
 * Copilot debug info from `copilot-api debug --json`.
 */
export interface CopilotDebugInfo {
  version?: string;
  runtime?: string;
  authenticated?: boolean;
  tokenPath?: string;
}
