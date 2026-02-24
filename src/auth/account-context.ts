/**
 * Account context policy helpers.
 *
 * Controls whether account instances keep project context isolated, or share
 * project workspace context with other accounts in the same context group.
 */

export type AccountContextMode = 'isolated' | 'shared';

export interface AccountContextMetadata {
  context_mode?: AccountContextMode;
  context_group?: string;
}

export interface AccountContextPolicy {
  mode: AccountContextMode;
  group?: string;
}

export interface CreateAccountContextInput {
  shareContext: boolean;
  contextGroup?: string;
}

export interface ResolvedCreateAccountContext {
  policy: AccountContextPolicy;
  error?: string;
}

export const DEFAULT_ACCOUNT_CONTEXT_MODE: AccountContextMode = 'isolated';
export const DEFAULT_ACCOUNT_CONTEXT_GROUP = 'default';

const CONTEXT_GROUP_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Normalize context group names so paths and config stay consistent.
 */
export function normalizeContextGroupName(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Validate context group naming constraints.
 */
export function isValidContextGroupName(value: string): boolean {
  return CONTEXT_GROUP_PATTERN.test(value);
}

/**
 * Runtime type guard for account context metadata payloads.
 */
export function isAccountContextMetadata(value: unknown): value is AccountContextMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const mode = candidate['context_mode'];
  const group = candidate['context_group'];

  const modeValid = mode === undefined || mode === 'isolated' || mode === 'shared';
  const groupValid = group === undefined || typeof group === 'string';

  return modeValid && groupValid;
}

/**
 * Resolve create-command flags into a valid context policy.
 */
export function resolveCreateAccountContext(
  input: CreateAccountContextInput
): ResolvedCreateAccountContext {
  const hasGroupFlag = input.contextGroup !== undefined;

  if (hasGroupFlag) {
    if (!input.contextGroup || input.contextGroup.trim().length === 0) {
      return {
        policy: { mode: 'isolated' },
        error: 'Context group name is required after --context-group',
      };
    }

    const normalizedGroup = normalizeContextGroupName(input.contextGroup);
    if (!isValidContextGroupName(normalizedGroup)) {
      return {
        policy: { mode: 'isolated' },
        error:
          'Invalid context group. Use letters/numbers/dash/underscore and start with a letter.',
      };
    }

    return {
      policy: {
        mode: 'shared',
        group: normalizedGroup,
      },
    };
  }

  if (input.shareContext) {
    return {
      policy: {
        mode: 'shared',
        group: DEFAULT_ACCOUNT_CONTEXT_GROUP,
      },
    };
  }

  return {
    policy: { mode: DEFAULT_ACCOUNT_CONTEXT_MODE },
  };
}

/**
 * Resolve persisted metadata into runtime policy with safe defaults.
 */
export function resolveAccountContextPolicy(
  metadata?: AccountContextMetadata | null
): AccountContextPolicy {
  const mode: AccountContextMode = metadata?.context_mode === 'shared' ? 'shared' : 'isolated';

  if (mode === 'shared') {
    const rawGroup = metadata?.context_group;
    if (rawGroup && rawGroup.trim().length > 0) {
      const normalized = normalizeContextGroupName(rawGroup);
      if (isValidContextGroupName(normalized)) {
        return { mode: 'shared', group: normalized };
      }
    }

    return { mode: 'shared', group: DEFAULT_ACCOUNT_CONTEXT_GROUP };
  }

  return { mode: 'isolated' };
}

/**
 * Convert runtime policy back to persisted metadata.
 */
export function policyToAccountContextMetadata(
  policy: AccountContextPolicy
): AccountContextMetadata {
  if (policy.mode === 'shared') {
    return {
      context_mode: 'shared',
      context_group: policy.group || DEFAULT_ACCOUNT_CONTEXT_GROUP,
    };
  }

  return {
    context_mode: 'isolated',
  };
}

/**
 * User-facing summary for display/help output.
 */
export function formatAccountContextPolicy(policy: AccountContextPolicy): string {
  if (policy.mode === 'shared') {
    return `shared (${policy.group || DEFAULT_ACCOUNT_CONTEXT_GROUP})`;
  }

  return 'isolated';
}
