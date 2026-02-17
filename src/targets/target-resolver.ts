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
const ALIAS_NAME_REGEX = /^[a-z0-9._-]+$/;

function buildArgv0TargetMap(): Record<string, TargetType> {
  const map: Record<string, TargetType> = { ...ARGV0_TARGET_MAP };
  const envAliases = process.env['CCS_DROID_ALIASES'];
  if (!envAliases) {
    return map;
  }

  for (const rawAlias of envAliases.split(',')) {
    const alias = rawAlias.trim().toLowerCase();
    if (!alias || !ALIAS_NAME_REGEX.test(alias)) {
      continue;
    }
    map[alias] = 'droid';
  }

  return map;
}

/**
 * Valid target types for --target flag validation.
 */
const VALID_TARGETS: ReadonlySet<string> = new Set<TargetType>(['claude', 'droid']);

interface ParsedTargetFlags {
  targetOverride?: TargetType;
  cleanedArgs: string[];
}

function normalizeTargetValue(value: string): TargetType {
  const normalized = value.toLowerCase();
  if (VALID_TARGETS.has(normalized)) {
    return normalized as TargetType;
  }

  const available = Array.from(VALID_TARGETS).join(', ');
  throw new Error(`Unknown target "${value}". Available: ${available}`);
}

/**
 * Parse and strip all --target flags from args.
 * Supports both "--target value" and "--target=value" forms.
 * For repeated flags, last one wins (common CLI precedence behavior).
 */
function parseTargetFlags(args: string[]): ParsedTargetFlags {
  const cleanedArgs: string[] = [];
  let targetOverride: TargetType | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // POSIX option terminator: everything after `--` is positional.
    if (arg === '--') {
      cleanedArgs.push(...args.slice(i));
      break;
    }

    if (arg === '--target') {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('--target requires a value (claude or droid)');
      }
      targetOverride = normalizeTargetValue(value);
      i += 1; // Skip value
      continue;
    }

    if (arg.startsWith('--target=')) {
      const value = arg.slice('--target='.length).trim();
      if (!value) {
        throw new Error('--target requires a value (claude or droid)');
      }
      targetOverride = normalizeTargetValue(value);
      continue;
    }

    cleanedArgs.push(arg);
  }

  return { targetOverride, cleanedArgs };
}

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
  const parsed = parseTargetFlags(args);

  // 1. Check --target flag (highest priority)
  if (parsed.targetOverride) {
    return parsed.targetOverride;
  }

  // 2. Check per-profile config
  if (profileConfig?.target) {
    return profileConfig.target;
  }

  // 3. Check argv[0] (busybox pattern)
  // Strip common wrapper extensions for Windows shims/wrappers
  const rawBin = path.basename(process.argv[1] || process.argv0 || '');
  const binName = rawBin.replace(/\.(cmd|bat|ps1|exe)$/i, '').toLowerCase();
  const argv0TargetMap = buildArgv0TargetMap();
  const argv0Target = argv0TargetMap[binName];
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
  return parseTargetFlags(args).cleanedArgs;
}
