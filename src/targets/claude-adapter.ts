/**
 * Claude Adapter
 *
 * TargetAdapter implementation for Claude Code CLI.
 * Wraps existing detection, spawning, and execution logic.
 */

import { spawn, ChildProcess } from 'child_process';
import { TargetAdapter, TargetBinaryInfo, TargetCredentials, TargetType } from './target-adapter';
import { detectClaudeCli, getClaudeCliInfo } from '../utils/claude-detector';
import { escapeShellArg, stripAnthropicEnv } from '../utils/shell-executor';
import { ErrorManager } from '../utils/error-manager';
import { getWebSearchHookEnv } from '../utils/websearch-manager';

export class ClaudeAdapter implements TargetAdapter {
  readonly type: TargetType = 'claude';
  readonly displayName = 'Claude Code';

  detectBinary(): TargetBinaryInfo | null {
    const info = getClaudeCliInfo();
    if (!info) return null;
    return { path: info.path, needsShell: info.needsShell };
  }

  /**
   * Claude uses env vars for credential delivery — no config file writes needed.
   */
  async prepareCredentials(_creds: TargetCredentials): Promise<void> {
    // No-op: Claude receives credentials via environment variables
  }

  buildArgs(_profile: string, userArgs: string[]): string[] {
    return userArgs;
  }

  buildEnv(creds: TargetCredentials, profileType: string): NodeJS.ProcessEnv {
    const webSearchEnv = getWebSearchHookEnv();

    // For account/default profiles, strip ANTHROPIC_* from parent env to prevent
    // stale proxy config from interfering with native Claude API routing.
    const baseEnv =
      profileType === 'account' || profileType === 'default'
        ? stripAnthropicEnv(process.env)
        : process.env;

    const env: NodeJS.ProcessEnv = { ...baseEnv, ...webSearchEnv };

    if (creds.envVars) {
      Object.assign(env, creds.envVars);
    }

    if (creds.baseUrl) env['ANTHROPIC_BASE_URL'] = creds.baseUrl;
    if (creds.apiKey) env['ANTHROPIC_AUTH_TOKEN'] = creds.apiKey;
    if (creds.model) env['ANTHROPIC_MODEL'] = creds.model;

    return env;
  }

  exec(args: string[], env: NodeJS.ProcessEnv, _options?: { cwd?: string }): void {
    const claudeCli = detectClaudeCli();
    if (!claudeCli) {
      void ErrorManager.showClaudeNotFound();
      process.exit(1);
      return;
    }

    const isWindows = process.platform === 'win32';
    const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudeCli);

    let child: ChildProcess;
    if (needsShell) {
      const cmdString = [claudeCli, ...args].map(escapeShellArg).join(' ');
      child = spawn(cmdString, {
        stdio: 'inherit',
        windowsHide: true,
        shell: true,
        env,
      });
    } else {
      child = spawn(claudeCli, args, {
        stdio: 'inherit',
        windowsHide: true,
        env,
      });
    }

    child.on('exit', (code, signal) => {
      if (signal) process.kill(process.pid, signal as NodeJS.Signals);
      else process.exit(code || 0);
    });

    child.on('error', async () => {
      await ErrorManager.showClaudeNotFound();
      process.exit(1);
    });
  }

  /**
   * Claude supports all CCS profile types.
   */
  supportsProfileType(_profileType: string): boolean {
    return true;
  }
}
