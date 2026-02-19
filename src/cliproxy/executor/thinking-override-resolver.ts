import type { ThinkingConfig } from '../../config/unified-config-types';
import {
  isThinkingOffValue,
  THINKING_BUDGET_MAX,
  THINKING_BUDGET_MIN,
  VALID_THINKING_LEVELS,
} from '../thinking-validator';

export type RuntimeThinkingSource = 'flag' | 'env' | 'config' | undefined;

/**
 * Parse CCS_THINKING env value using same rules as CLI parsing:
 * integer string => number, known level/off aliases => normalized string.
 * Unknown/invalid values are ignored to preserve config fallback behavior.
 */
export function parseEnvThinkingOverride(raw: string | undefined): string | number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    if (parsed < THINKING_BUDGET_MIN || parsed > THINKING_BUDGET_MAX) {
      return undefined;
    }
    return parsed;
  }

  const normalized = trimmed.toLowerCase();
  if (isThinkingOffValue(normalized)) {
    return 'off';
  }
  if ((VALID_THINKING_LEVELS as readonly string[]).includes(normalized)) {
    return normalized;
  }
  return undefined;
}

/**
 * Runtime precedence: CLI flag > CCS_THINKING env var.
 * Config is handled later during model/env resolution.
 */
export function resolveRuntimeThinkingOverride(
  flagOverride: string | number | undefined,
  envValue: string | undefined
): { thinkingOverride: string | number | undefined; thinkingSource: RuntimeThinkingSource } {
  if (flagOverride !== undefined) {
    return { thinkingOverride: flagOverride, thinkingSource: 'flag' };
  }
  const envOverride = parseEnvThinkingOverride(envValue);
  if (envOverride !== undefined) {
    return { thinkingOverride: envOverride, thinkingSource: 'env' };
  }
  return { thinkingOverride: undefined, thinkingSource: undefined };
}

/**
 * Effective off logic for codex reasoning proxy wiring.
 */
export function shouldDisableCodexReasoning(
  thinkingConfig: ThinkingConfig,
  thinkingOverride: string | number | undefined
): boolean {
  return (
    (thinkingConfig.mode === 'off' && thinkingOverride === undefined) ||
    isThinkingOffValue(thinkingOverride) ||
    (thinkingOverride === undefined &&
      thinkingConfig.mode === 'manual' &&
      isThinkingOffValue(thinkingConfig.override))
  );
}

/**
 * Build user-facing startup feedback label/source based on effective precedence.
 */
export function buildThinkingStartupStatus(
  thinkingConfig: ThinkingConfig,
  thinkingOverride: string | number | undefined,
  thinkingSource: RuntimeThinkingSource,
  sourceDisplay?: string
): { thinkingLabel: string; sourceLabel: string } {
  const overrideDisablesThinking = isThinkingOffValue(thinkingOverride);
  const configDisablesThinking =
    thinkingOverride === undefined &&
    (thinkingConfig.mode === 'off' ||
      (thinkingConfig.mode === 'manual' && isThinkingOffValue(thinkingConfig.override)));

  if (overrideDisablesThinking || configDisablesThinking) {
    if (thinkingSource === 'flag') {
      return {
        thinkingLabel: 'off',
        sourceLabel: `flag: ${sourceDisplay ?? '--thinking off'}`,
      };
    }
    if (thinkingSource === 'env') {
      return {
        thinkingLabel: 'off',
        sourceLabel: 'env: CCS_THINKING',
      };
    }
    return {
      thinkingLabel: 'off',
      sourceLabel: thinkingConfig.mode === 'manual' ? 'config: manual' : 'config: off',
    };
  }

  if (thinkingSource === 'flag') {
    return {
      thinkingLabel: String(thinkingOverride),
      sourceLabel: `flag: ${sourceDisplay ?? '--thinking'}`,
    };
  }
  if (thinkingSource === 'env') {
    return {
      thinkingLabel: String(thinkingOverride),
      sourceLabel: 'env: CCS_THINKING',
    };
  }
  if (thinkingConfig.mode === 'manual' && thinkingConfig.override !== undefined) {
    return {
      thinkingLabel: String(thinkingConfig.override),
      sourceLabel: 'config: manual',
    };
  }
  return {
    thinkingLabel: thinkingConfig.mode === 'auto' ? 'auto' : 'default',
    sourceLabel: 'config: auto',
  };
}
