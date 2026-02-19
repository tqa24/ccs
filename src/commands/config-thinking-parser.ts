import {
  isThinkingOffValue,
  THINKING_BUDGET_MAX,
  THINKING_BUDGET_MIN,
  VALID_THINKING_LEVELS,
} from '../cliproxy/thinking-validator';

interface ThinkingCommandOptions {
  mode?: string;
  override?: string;
  clearOverride?: boolean;
  tier?: { tier: string; level: string };
  providerOverride?: { provider: string; tier: string; level: string };
  clearProviderOverride?: { provider: string; tier?: string };
  help?: boolean;
}

type ThinkingTier = 'opus' | 'sonnet' | 'haiku';
export type ThinkingTierOverrideMap = Partial<Record<ThinkingTier, string>>;
export type ThinkingProviderOverrides = Record<string, ThinkingTierOverrideMap>;

export interface ParseResult {
  options: ThinkingCommandOptions;
  error?: string;
}

export function parseThinkingCommandArgs(args: string[]): ParseResult {
  const options: ThinkingCommandOptions = {};
  const requireValue = (index: number): string | undefined => {
    const value = args[index];
    if (!value || value.startsWith('-')) {
      return undefined;
    }
    return value;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--mode') {
      const value = requireValue(i + 1);
      if (!value) return { options, error: `${arg} requires a value` };
      options.mode = value;
      i += 1;
    } else if (arg === '--override') {
      const value = requireValue(i + 1);
      if (!value) return { options, error: `${arg} requires a value` };
      options.override = value;
      i += 1;
    } else if (arg === '--clear-override') {
      options.clearOverride = true;
    } else if (arg === '--tier') {
      const tier = requireValue(i + 1);
      const level = requireValue(i + 2);
      if (!tier || !level) return { options, error: `${arg} requires 2 values: <tier> <level>` };
      options.tier = { tier, level };
      i += 2;
    } else if (arg === '--provider-override') {
      const provider = requireValue(i + 1);
      const tier = requireValue(i + 2);
      const level = requireValue(i + 3);
      if (!provider || !tier || !level) {
        return { options, error: `${arg} requires 3 values: <provider> <tier> <level>` };
      }
      options.providerOverride = {
        provider,
        tier,
        level,
      };
      i += 3;
    } else if (arg === '--clear-provider-override') {
      const provider = requireValue(i + 1);
      if (!provider)
        return { options, error: `${arg} requires at least 1 value: <provider> [tier]` };
      const tier = requireValue(i + 2);
      options.clearProviderOverride = { provider, tier };
      i += tier ? 2 : 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('-')) {
      return { options, error: `Unknown option: ${arg}` };
    } else {
      return { options, error: `Unexpected argument: ${arg}` };
    }
  }

  return { options };
}

export function parseThinkingOverrideInput(rawOverride: string): {
  value?: string | number;
  error?: string;
} {
  const normalized = rawOverride.toLowerCase().trim();
  if (isThinkingOffValue(normalized)) {
    return { value: 'off' };
  }
  if ((VALID_THINKING_LEVELS as readonly string[]).includes(normalized)) {
    return { value: normalized };
  }
  if (/^\d+$/.test(normalized)) {
    const budget = Number.parseInt(normalized, 10);
    if (budget < THINKING_BUDGET_MIN || budget > THINKING_BUDGET_MAX) {
      return {
        error: `Invalid override: numeric budget must be between ${THINKING_BUDGET_MIN} and ${THINKING_BUDGET_MAX}`,
      };
    }
    return { value: budget };
  }
  return {
    error: `Invalid override: ${rawOverride}`,
  };
}

export function clearProviderOverride(
  currentOverrides: ThinkingProviderOverrides | undefined,
  provider: string,
  tier?: ThinkingTier
): { nextOverrides: ThinkingProviderOverrides | undefined; changed: boolean } {
  const current = currentOverrides ?? {};
  const nextOverrides: ThinkingProviderOverrides = { ...current };

  const providerEntry = nextOverrides[provider];
  if (!providerEntry) {
    return {
      nextOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
      changed: false,
    };
  }

  if (!tier) {
    delete nextOverrides[provider];
    return {
      nextOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
      changed: true,
    };
  }

  if (providerEntry[tier] === undefined) {
    return {
      nextOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
      changed: false,
    };
  }

  const nextProviderEntry = { ...providerEntry };
  delete nextProviderEntry[tier];
  if (Object.keys(nextProviderEntry).length === 0) {
    delete nextOverrides[provider];
  } else {
    nextOverrides[provider] = nextProviderEntry;
  }

  return {
    nextOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
    changed: true,
  };
}
