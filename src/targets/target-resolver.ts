/**
 * Target Resolver
 *
 * Resolves which CLI target to use based on:
 * 1. --target flag (highest priority)
 * 2. Per-profile config
 * 3. argv[0] detection (busybox/symlink pattern)
 * 4. Default: 'claude'
 */

import * as path from 'path';
import { TargetType } from './target-adapter';

/**
 * Map of binary names to target types (busybox pattern).
 * When CCS is invoked as `ccsd`, it auto-selects the droid target.
 */
const ARGV0_TARGET_MAP: Record<string, TargetType> = {
  ccsd: 'droid',
};

/**
 * Valid target types for --target flag validation.
 */
const VALID_TARGETS: ReadonlySet<string> = new Set<TargetType>(['claude', 'droid']);

/**
 * Resolve target type from multiple sources with priority ordering.
 *
 * @param args - CLI arguments (may contain --target flag)
 * @param profileConfig - Per-profile config with optional target field
 * @returns Resolved target type
 */
export function resolveTargetType(
  args: string[],
  profileConfig?: { target?: TargetType }
): TargetType {
  // 1. Check --target flag (highest priority)
  const targetIdx = args.indexOf('--target');
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    const flagValue = args[targetIdx + 1];
    if (VALID_TARGETS.has(flagValue)) {
      return flagValue as TargetType;
    }
    const available = Array.from(VALID_TARGETS).join(', ');
    throw new Error(`Unknown target "${flagValue}". Available: ${available}`);
  }

  // 2. Check per-profile config
  if (profileConfig?.target) {
    return profileConfig.target;
  }

  // 3. Check argv[0] (busybox pattern)
  // Strip .cmd/.bat extension for Windows npm shims
  const rawBin = path.basename(process.argv[1] || '');
  const binName = rawBin.replace(/\.(cmd|bat)$/i, '');
  const argv0Target = ARGV0_TARGET_MAP[binName];
  if (argv0Target) {
    return argv0Target;
  }

  // 4. Default
  return 'claude';
}

/**
 * Strip --target flag and its value from args array.
 * Returns new array without the flag (so it's not passed to target CLI).
 */
export function stripTargetFlag(args: string[]): string[] {
  const targetIdx = args.indexOf('--target');
  if (targetIdx === -1) return args;

  const result = [...args];
  // Remove --target and its value
  result.splice(targetIdx, 2);
  return result;
}
