/**
 * Droid CLI Detector
 *
 * Detects Factory Droid CLI binary in PATH.
 * Mirrors claude-detector.ts pattern.
 */

import * as fs from 'fs';
import { execSync } from 'child_process';
import { expandPath } from '../utils/helpers';
import { TargetBinaryInfo } from './target-adapter';

/**
 * Detect Droid CLI executable.
 *
 * Priority:
 * 1. CCS_DROID_PATH env var (user override)
 * 2. PATH lookup via which/where.exe
 */
export function detectDroidCli(): string | null {
  // Priority 1: CCS_DROID_PATH environment variable
  if (process.env.CCS_DROID_PATH) {
    const customPath = expandPath(process.env.CCS_DROID_PATH);
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    console.warn('[!] Warning: CCS_DROID_PATH is set but file not found:', customPath);
    console.warn('    Falling back to system PATH lookup...');
  }

  // Priority 2: Resolve 'droid' from PATH
  const isWindows = process.platform === 'win32';

  try {
    const cmd = isWindows ? 'where.exe droid' : 'which droid';
    const result = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();

    const matches = result
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p);

    if (isWindows) {
      const withExtension = matches.find((p) => /\.(exe|cmd|bat|ps1)$/i.test(p));
      const droidPath = withExtension || matches[0];
      if (droidPath && fs.existsSync(droidPath)) {
        return droidPath;
      }
    } else {
      const droidPath = matches[0];
      if (droidPath && fs.existsSync(droidPath)) {
        return droidPath;
      }
    }
  } catch {
    // droid not in PATH
  }

  return null;
}

/**
 * Get Droid CLI binary info for target adapter.
 */
export function getDroidBinaryInfo(): TargetBinaryInfo | null {
  const droidPath = detectDroidCli();
  if (!droidPath) return null;

  const isWindows = process.platform === 'win32';
  const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(droidPath);

  return { path: droidPath, needsShell };
}

/**
 * Check Droid CLI version for compatibility warnings.
 * Non-blocking — logs warning and continues.
 */
export function checkDroidVersion(droidPath: string): void {
  try {
    const version = execSync(`"${droidPath}" --version`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();

    // Parse semver major version
    const match = version.match(/(\d+)\.\d+\.\d+/);
    if (match) {
      const major = parseInt(match[1]);
      if (major >= 2) {
        console.warn(
          `[!] Droid version ${version} not verified with CCS. Config format may differ.`
        );
      }
    }
  } catch {
    // Version check is best-effort — don't block execution
  }
}
