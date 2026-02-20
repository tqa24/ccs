/**
 * Model ID normalization helpers.
 *
 * Handles provider-aware compatibility between dotted and hyphenated Claude
 * model version formats (e.g., 4.6 vs 4-6).
 */

import { CLIProxyProvider } from './types';

/** Env vars that carry model identifiers. */
export const MODEL_ENV_VAR_KEYS = [
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
] as const;

type ProviderLike = CLIProxyProvider | string | null | undefined;

const CLAUDE_DOTTED_VERSION_REGEX = /claude-(sonnet|opus|haiku)-(\d+)\.(\d+)(?=(?:$|-|\[|\(|\/))/gi;
const CLAUDE_DOTTED_THINKING_REGEX =
  /claude-(sonnet|opus|haiku)-(\d+)\.(\d+)-thinking(?=(?:$|-|\[|\(|\/))/gi;

/** Extract provider segment from /api/provider/{provider} paths. */
export function extractProviderFromPathname(pathname: string): string | null {
  const match = pathname.match(/\/api\/provider\/([^/]+)/i);
  if (!match?.[1]) return null;
  return match[1].toLowerCase();
}

/** Whether the provider uses Antigravity model routing conventions. */
export function isAntigravityProvider(provider: ProviderLike): boolean {
  if (typeof provider !== 'string') return false;
  const normalized = provider.trim().toLowerCase();
  return normalized === 'agy' || normalized === 'antigravity';
}

/** Normalize Claude dotted major.minor IDs to hyphenated format. */
export function normalizeClaudeDottedMajorMinor(model: string): string {
  return model.replace(
    CLAUDE_DOTTED_VERSION_REGEX,
    (_match: string, family: string, major: string, minor: string) =>
      `claude-${family.toLowerCase()}-${major}-${minor}`
  );
}

/**
 * Normalize only dotted Claude thinking IDs to hyphenated format.
 * Keeps non-thinking dotted IDs unchanged.
 */
export function normalizeClaudeDottedThinkingMajorMinor(model: string): string {
  return model.replace(
    CLAUDE_DOTTED_THINKING_REGEX,
    (_match: string, family: string, major: string, minor: string) =>
      `claude-${family.toLowerCase()}-${major}-${minor}-thinking`
  );
}

/**
 * Normalize model ID for a specific provider.
 * Antigravity requires hyphenated Claude major.minor model IDs.
 */
export function normalizeModelIdForProvider(model: string, provider: ProviderLike): string {
  if (!isAntigravityProvider(provider)) return model;
  return normalizeClaudeDottedMajorMinor(model);
}

/**
 * Normalize model ID for request routing.
 * - Antigravity routes: normalize all dotted Claude major.minor forms.
 * - Root/composite routes: normalize only thinking forms to avoid mutating
 *   valid non-thinking dotted IDs used by other providers.
 */
export function normalizeModelIdForRouting(model: string, provider: ProviderLike): string {
  if (isAntigravityProvider(provider)) {
    return normalizeClaudeDottedMajorMinor(model);
  }
  return normalizeClaudeDottedThinkingMajorMinor(model);
}

/**
 * Normalize model-related env vars for a provider.
 * Returns original object when no changes are required.
 */
export function normalizeModelEnvVarsForProvider(
  envVars: NodeJS.ProcessEnv,
  provider: ProviderLike,
  keys: readonly string[] = MODEL_ENV_VAR_KEYS
): NodeJS.ProcessEnv {
  let nextEnv: NodeJS.ProcessEnv | null = null;

  for (const key of keys) {
    const value = envVars[key];
    if (typeof value !== 'string' || value.trim().length === 0) continue;

    const normalizedValue = normalizeModelIdForProvider(value, provider);
    if (normalizedValue === value) continue;

    if (!nextEnv) nextEnv = { ...envVars };
    nextEnv[key] = normalizedValue;
  }

  return nextEnv ?? envVars;
}
