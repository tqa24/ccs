/**
 * Droid Adapter
 *
 * TargetAdapter implementation for Factory Droid CLI.
 * Writes credentials to ~/.factory/settings.json and spawns `droid -m custom:ccs-<profile>`.
 */

import { spawn, ChildProcess } from 'child_process';
import { TargetAdapter, TargetBinaryInfo, TargetCredentials, TargetType } from './target-adapter';
import { getDroidBinaryInfo, detectDroidCli, checkDroidVersion } from './droid-detector';
import { upsertCcsModel } from './droid-config-manager';
import { escapeShellArg } from '../utils/shell-executor';

export class DroidAdapter implements TargetAdapter {
  readonly type: TargetType = 'droid';
  readonly displayName = 'Factory Droid';

  detectBinary(): TargetBinaryInfo | null {
    const info = getDroidBinaryInfo();
    if (!info) return null;

    // Version compatibility check (non-blocking warning)
    checkDroidVersion(info.path);
    return info;
  }

  /**
   * Write CCS credentials to ~/.factory/settings.json as a custom model entry.
   * This is the key difference from Claude — Droid reads config files, not env vars.
   */
  async prepareCredentials(creds: TargetCredentials): Promise<void> {
    await upsertCcsModel(creds.profile, {
      model: creds.model || 'claude-opus-4-6',
      displayName: `CCS ${creds.profile}`,
      baseUrl: creds.baseUrl,
      apiKey: creds.apiKey,
      provider: creds.provider || 'anthropic',
    });
  }

  buildArgs(profile: string, userArgs: string[]): string[] {
    return ['-m', `custom:ccs-${profile}`, ...userArgs];
  }

  /**
   * Droid uses config file for credentials — minimal env needed.
   */
  buildEnv(_creds: TargetCredentials, _profileType: string): NodeJS.ProcessEnv {
    return { ...process.env };
  }

  exec(args: string[], env: NodeJS.ProcessEnv, _options?: { cwd?: string }): void {
    const droidPath = detectDroidCli();
    if (!droidPath) {
      console.error('[X] Droid CLI not found. Install: npm i -g @factory/cli');
      process.exit(1);
      return;
    }

    const isWindows = process.platform === 'win32';
    const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(droidPath);

    let child: ChildProcess;
    if (needsShell) {
      const cmdString = [droidPath, ...args].map(escapeShellArg).join(' ');
      child = spawn(cmdString, {
        stdio: 'inherit',
        windowsHide: true,
        shell: true,
        env,
      });
    } else {
      child = spawn(droidPath, args, {
        stdio: 'inherit',
        windowsHide: true,
        env,
      });
    }

    child.on('exit', (code, signal) => {
      if (signal) process.kill(process.pid, signal as NodeJS.Signals);
      else process.exit(code || 0);
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EACCES') {
        console.error('[X] Droid CLI not executable. Check file permissions.');
      } else if (err.code === 'ENOENT') {
        console.error('[X] Droid CLI not found. Install: npm i -g @factory/cli');
      } else {
        console.error('[X] Failed to start Droid CLI:', err.message);
      }
      process.exit(1);
    });
  }

  /**
   * Droid supports all profile types except account-based.
   * Account profiles use CLAUDE_CONFIG_DIR which is Claude-specific.
   */
  supportsProfileType(profileType: string): boolean {
    return profileType !== 'account';
  }
}
