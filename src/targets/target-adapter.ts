/**
 * Target Adapter Interface
 *
 * Abstraction layer for different CLI targets (Claude, Droid, etc.).
 * Profile resolution is target-agnostic — only the "last mile" execution differs.
 */

/**
 * Supported CLI target types.
 * 'claude' is the default; additional targets register via target-registry.
 */
export type TargetType = 'claude' | 'droid';

/**
 * Credentials resolved by CCS profile system, ready for delivery to target CLI.
 */
export interface TargetCredentials {
  /** CCS profile name (e.g., 'gemini', 'codex', 'glm') */
  profile: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
  provider?: 'anthropic' | 'openai' | 'generic-chat-completion-api';
  /** Additional env vars from profile resolution (websearch, hooks, etc.) */
  envVars?: NodeJS.ProcessEnv;
}

/**
 * Result of detecting a target CLI binary on the system.
 */
export interface TargetBinaryInfo {
  path: string;
  needsShell: boolean; // Windows .cmd/.bat/.ps1
}

/**
 * Target adapter contract.
 *
 * Each target CLI implements this interface to handle:
 * - Binary detection (is the CLI installed?)
 * - Credential delivery (env vars vs config file writes)
 * - Argument building (target-specific flags)
 * - Process spawning (cross-platform execution)
 */
export interface TargetAdapter {
  readonly type: TargetType;
  readonly displayName: string;

  /** Detect if the target CLI binary exists on system */
  detectBinary(): TargetBinaryInfo | null;

  /** Prepare credentials for delivery to target CLI */
  prepareCredentials(creds: TargetCredentials): Promise<void>;

  /** Build spawn arguments for the target CLI */
  buildArgs(profile: string, userArgs: string[]): string[];

  /** Build environment variables for the target CLI */
  buildEnv(creds: TargetCredentials, profileType: string): NodeJS.ProcessEnv;

  /** Spawn the target CLI process (replaces current process flow) */
  exec(args: string[], env: NodeJS.ProcessEnv, options?: { cwd?: string }): void;

  /** Check if a profile type is supported by this target */
  supportsProfileType(profileType: string): boolean;
}
