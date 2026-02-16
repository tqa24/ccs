/**
 * Droid Adapter
 *
 * TargetAdapter implementation for Factory Droid CLI.
 * Writes credentials to ~/.factory/settings.json and spawns `droid -m custom:ccs-<profile>`.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import { TargetAdapter, TargetBinaryInfo, TargetCredentials, TargetType } from './target-adapter';
import { getDroidBinaryInfo, detectDroidCli, checkDroidVersion } from './droid-detector';
import { upsertCcsModel } from './droid-config-manager';
import { escapeShellArg } from '../utils/shell-executor';
import { forwardSignals } from '../utils/signal-forwarder';

export class DroidAdapter implements TargetAdapter {
  readonly type: TargetType = 'droid';
  readonly displayName = 'Factory Droid';

  private validateCredentials(creds: TargetCredentials): void {
    if (!creds.baseUrl?.trim()) {
      throw new Error('Droid target requires ANTHROPIC_BASE_URL');
    }
    if (!creds.apiKey?.trim()) {
      throw new Error('Droid target requires ANTHROPIC_AUTH_TOKEN');
    }
  }

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
    this.validateCredentials(creds);
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

  exec(
    args: string[],
    env: NodeJS.ProcessEnv,
    options?: { cwd?: string; binaryInfo?: TargetBinaryInfo }
  ): void {
    const droidPath = options?.binaryInfo?.path || detectDroidCli();
    if (!droidPath) {
      console.error('[X] Droid CLI not found. Install: npm i -g @factory/cli');
      process.exit(1);
      return;
    }
    try {
      const stat = fs.statSync(droidPath);
      if (!stat.isFile()) {
        console.error(`[X] Droid CLI path is not a file: ${droidPath}`);
        process.exit(1);
        return;
      }
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      console.error(
        `[X] Droid CLI path is not accessible (${error.code || 'unknown'}): ${droidPath}`
      );
      process.exit(1);
      return;
    }

    const isWindows = process.platform === 'win32';
    const isPowerShellScript = isWindows && /\.ps1$/i.test(droidPath);
    const needsShell = isWindows && /\.(cmd|bat)$/i.test(droidPath);

    let child: ChildProcess;
    if (isPowerShellScript) {
      child = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', droidPath, ...args],
        {
          stdio: 'inherit',
          windowsHide: true,
          env,
        }
      );
    } else if (needsShell) {
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

    const cleanupSignalHandlers = forwardSignals(child);

    child.on('exit', (code, signal) => {
      cleanupSignalHandlers();
      if (signal) process.kill(process.pid, signal as NodeJS.Signals);
      else process.exit(code || 0);
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      cleanupSignalHandlers();
      if (err.code === 'EACCES') {
        console.error(`[X] Droid CLI is not executable: ${droidPath}`);
        console.error('    Check file permissions and executable bit.');
      } else if (err.code === 'ENOENT') {
        if (isPowerShellScript) {
          console.error('[X] PowerShell executable not found (required for .ps1 wrapper launch).');
          console.error('    Ensure powershell.exe is available in PATH.');
        } else if (needsShell) {
          console.error('[X] Windows command shell not found for Droid wrapper launch.');
          console.error('    Ensure cmd.exe is available and accessible.');
        } else {
          console.error(`[X] Droid CLI not found: ${droidPath}`);
          console.error('    Install: npm i -g @factory/cli');
        }
      } else {
        console.error(`[X] Failed to start Droid CLI (${droidPath}):`, err.message);
      }
      process.exit(1);
    });
  }

  /**
   * Droid currently supports direct settings-based and default flows only.
   */
  supportsProfileType(profileType: string): boolean {
    return profileType === 'settings' || profileType === 'default';
  }
}
