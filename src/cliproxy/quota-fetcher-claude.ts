/**
 * Quota Fetcher for Claude (Anthropic) Accounts
 *
 * Fetches policy limits from Claude API and normalizes 5h + weekly windows.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAuthDir } from './config-generator';
import { getPausedDir, getProviderAccounts } from './account-manager';
import { sanitizeEmail, isTokenExpired } from './auth-utils';
import type { ClaudeQuotaResult, ClaudeQuotaWindow, ClaudeCoreUsageSummary } from './quota-types';
import { clampPercent } from '../utils/percentage';

const CLAUDE_POLICY_LIMITS_URL = 'https://api.anthropic.com/api/claude_code/policy_limits';
const CLAUDE_QUOTA_TIMEOUT_MS = 10000;
const CLAUDE_QUOTA_MAX_ATTEMPTS = 2;
const CLAUDE_USER_AGENT = 'ccs-cli/claude-quota';

interface ClaudeAuthData {
  accessToken: string;
  isExpired: boolean;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return undefined;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTimestamp(value: unknown): string | null {
  const asNum = asNumber(value);
  if (asNum !== null) {
    const millis = asNum > 1e12 ? asNum : asNum * 1000;
    const date = new Date(millis);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  const str = asString(value);
  if (!str) return null;

  // Numeric strings can be either epoch seconds or epoch milliseconds.
  if (/^\d+$/.test(str)) {
    const numeric = Number(str);
    if (isFinite(numeric)) {
      const millis = numeric > 1e12 ? numeric : numeric * 1000;
      const date = new Date(millis);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }
  }

  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function getClaudeWindowLabel(rateLimitType: string): string {
  switch (rateLimitType) {
    case 'five_hour':
      return 'Session limit';
    case 'seven_day':
      return 'Weekly limit';
    case 'seven_day_opus':
      return 'Opus limit';
    case 'seven_day_sonnet':
      return 'Sonnet limit';
    case 'overage':
      return 'Extra usage';
    default:
      return rateLimitType || 'Unknown limit';
  }
}

function normalizeUtilization(raw: Record<string, unknown>): {
  utilization: number | null;
  usedPercent: number;
  remainingPercent: number;
} {
  const utilizationRaw = asNumber(raw['utilization']);
  const usedPercentRaw = asNumber(raw['usedPercent'] ?? raw['used_percent']);
  const remainingPercentRaw = asNumber(raw['remainingPercent'] ?? raw['remaining_percent']);

  if (utilizationRaw !== null) {
    const ratio = utilizationRaw <= 1 ? utilizationRaw : utilizationRaw / 100;
    const usedPercent = clampPercent(ratio * 100);
    return {
      utilization: ratio,
      usedPercent,
      remainingPercent: clampPercent(100 - usedPercent),
    };
  }

  if (usedPercentRaw !== null) {
    const usedPercent = clampPercent(usedPercentRaw);
    return {
      utilization: usedPercent / 100,
      usedPercent,
      remainingPercent: clampPercent(100 - usedPercent),
    };
  }

  if (remainingPercentRaw !== null) {
    const remainingPercent = clampPercent(remainingPercentRaw);
    const usedPercent = clampPercent(100 - remainingPercent);
    return {
      utilization: usedPercent / 100,
      usedPercent,
      remainingPercent,
    };
  }

  return {
    utilization: null,
    usedPercent: 0,
    remainingPercent: 100,
  };
}

function normalizeRateLimitType(value: unknown, fallbackKey?: string): string {
  const direct = asString(value);
  if (direct) return direct;
  if (fallbackKey) return fallbackKey;
  return 'unknown';
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeRestriction(
  raw: Record<string, unknown>,
  fallbackKey?: string
): ClaudeQuotaWindow | null {
  const rateLimitType = normalizeRateLimitType(
    raw['rateLimitType'] ?? raw['rate_limit_type'] ?? raw['claim'] ?? raw['claimAbbrev'],
    fallbackKey
  );
  if (!rateLimitType || rateLimitType === 'unknown') return null;

  const status = asString(raw['status']) || 'unknown';
  const resetAt =
    normalizeTimestamp(raw['resetsAt'] ?? raw['resets_at'] ?? raw['resetAt'] ?? raw['reset_at']) ||
    null;
  const overageResetsAt =
    normalizeTimestamp(
      raw['overageResetsAt'] ??
        raw['overage_resets_at'] ??
        raw['overageResetAt'] ??
        raw['overage_reset_at']
    ) || null;

  const { utilization, usedPercent, remainingPercent } = normalizeUtilization(raw);

  return {
    rateLimitType,
    label: getClaudeWindowLabel(rateLimitType),
    status,
    utilization,
    usedPercent,
    remainingPercent,
    resetAt,
    surpassedThreshold: asBoolean(raw['surpassedThreshold'] ?? raw['surpassed_threshold']),
    severity: asString(raw['severity']) || undefined,
    overageStatus: asString(raw['overageStatus'] ?? raw['overage_status']) || undefined,
    overageResetsAt,
    overageDisabledReason:
      asString(raw['overageDisabledReason'] ?? raw['overage_disabled_reason']) || undefined,
    isUsingOverage: asBoolean(raw['isUsingOverage'] ?? raw['is_using_overage']),
    hasExtraUsageEnabled: asBoolean(raw['hasExtraUsageEnabled'] ?? raw['has_extra_usage_enabled']),
  };
}

/**
 * Parse raw policy limits response into normalized windows.
 * Supports both array and object-map `restrictions` shapes.
 */
export function buildClaudeQuotaWindows(payload: Record<string, unknown>): ClaudeQuotaWindow[] {
  const rawRestrictions = payload['restrictions'];
  const windows: ClaudeQuotaWindow[] = [];

  if (Array.isArray(rawRestrictions)) {
    for (const item of rawRestrictions) {
      const raw = toObject(item);
      if (!raw) continue;
      const window = normalizeRestriction(raw);
      if (window) windows.push(window);
    }
  } else if (toObject(rawRestrictions)) {
    for (const [key, value] of Object.entries(rawRestrictions as Record<string, unknown>)) {
      const raw = toObject(value);
      if (!raw) continue;
      const window = normalizeRestriction(raw, key);
      if (window) windows.push(window);
    }
  } else if (toObject(payload)) {
    // Some responses may contain a single restriction object directly.
    const direct = normalizeRestriction(payload);
    if (direct) windows.push(direct);
  }

  const seen = new Set<string>();
  const unique: ClaudeQuotaWindow[] = [];
  for (const window of windows) {
    const key = `${window.rateLimitType}:${window.resetAt ?? ''}:${window.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(window);
  }

  return unique.sort((a, b) => a.rateLimitType.localeCompare(b.rateLimitType));
}

function toEpochMs(iso: string | null): number | null {
  if (!iso) return null;
  const value = new Date(iso).getTime();
  return isNaN(value) ? null : value;
}

function pickMostRestrictiveWeekly(windows: ClaudeQuotaWindow[]): ClaudeQuotaWindow | null {
  if (windows.length === 0) return null;
  return [...windows].sort((a, b) => {
    if (a.remainingPercent !== b.remainingPercent) {
      return a.remainingPercent - b.remainingPercent;
    }
    const aReset = toEpochMs(a.resetAt);
    const bReset = toEpochMs(b.resetAt);
    if (aReset === null && bReset === null) return 0;
    if (aReset === null) return 1;
    if (bReset === null) return -1;
    return aReset - bReset;
  })[0];
}

function mapCoreWindow(window: ClaudeQuotaWindow | null): ClaudeCoreUsageSummary['fiveHour'] {
  if (!window) return null;
  return {
    rateLimitType: window.rateLimitType,
    label: window.label,
    remainingPercent: window.remainingPercent,
    resetAt: window.resetAt,
    status: window.status,
  };
}

/**
 * Build explicit 5h + weekly usage summary from Claude policy windows.
 */
export function buildClaudeCoreUsageSummary(windows: ClaudeQuotaWindow[]): ClaudeCoreUsageSummary {
  if (!windows || windows.length === 0) {
    return { fiveHour: null, weekly: null };
  }

  const fiveHourWindow = windows.find((window) => window.rateLimitType === 'five_hour') || null;
  const weeklyCandidates = windows.filter((window) =>
    ['seven_day', 'seven_day_opus', 'seven_day_sonnet'].includes(window.rateLimitType)
  );
  const weeklyWindow = pickMostRestrictiveWeekly(weeklyCandidates);

  // Fallback: infer shortest/longest reset windows from non-overage limits.
  if (!fiveHourWindow || !weeklyWindow) {
    const nonOverage = windows.filter((window) => window.rateLimitType !== 'overage');
    const withReset = nonOverage
      .map((window) => ({
        window,
        resetMs: toEpochMs(window.resetAt),
      }))
      .filter((entry) => entry.resetMs !== null)
      .sort((a, b) => (a.resetMs as number) - (b.resetMs as number));

    const inferredFiveHour =
      fiveHourWindow ||
      (withReset.length > 0
        ? withReset[0].window
        : nonOverage.length > 0
          ? pickMostRestrictiveWeekly(nonOverage)
          : null);
    const inferredWeekly =
      weeklyWindow ||
      (withReset.length > 1
        ? withReset[withReset.length - 1].window
        : nonOverage.find((window) => window !== inferredFiveHour) || null);

    return {
      fiveHour: mapCoreWindow(inferredFiveHour),
      weekly: mapCoreWindow(inferredWeekly),
    };
  }

  return {
    fiveHour: mapCoreWindow(fiveHourWindow),
    weekly: mapCoreWindow(weeklyWindow),
  };
}

function extractAccessToken(data: Record<string, unknown>): string | null {
  const direct = asString(data['access_token']);
  if (direct) return direct;

  const nested = toObject(data['token']);
  if (nested) {
    const nestedToken = asString(nested['access_token']);
    if (nestedToken) return nestedToken;
  }

  return null;
}

function extractExpiry(data: Record<string, unknown>): string | null {
  const direct = asString(data['expired']);
  if (direct) return direct;

  const nested = toObject(data['token']);
  if (nested) {
    return asString(nested['expiry']);
  }

  return null;
}

function readClaudeAuthData(accountId: string): ClaudeAuthData | null {
  const authDirs = [getAuthDir(), getPausedDir()];
  const sanitizedId = sanitizeEmail(accountId);
  const expectedFiles = [`claude-${sanitizedId}.json`, `anthropic-${sanitizedId}.json`];

  for (const authDir of authDirs) {
    if (!fs.existsSync(authDir)) continue;

    for (const expectedFile of expectedFiles) {
      const filePath = path.join(authDir, expectedFile);
      if (!fs.existsSync(filePath)) continue;

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
        const accessToken = extractAccessToken(data);
        if (!accessToken) continue;

        const expiry = extractExpiry(data);
        return {
          accessToken,
          isExpired: isTokenExpired(expiry ?? undefined),
        };
      } catch {
        continue;
      }
    }

    const files = fs.readdirSync(authDir);
    for (const file of files) {
      if (
        !file.endsWith('.json') ||
        (!file.startsWith('claude-') && !file.startsWith('anthropic-'))
      ) {
        continue;
      }

      const filePath = path.join(authDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
        const accessToken = extractAccessToken(data);
        if (!accessToken) continue;

        const fileEmail = asString(data['email']);
        const typeValue = asString(data['type']);
        const isClaudeType =
          typeValue === null || typeValue === 'claude' || typeValue === 'anthropic';
        const matchesEmail = fileEmail === accountId;
        const matchesFile = file.includes(sanitizedId);

        if ((matchesEmail || matchesFile) && isClaudeType) {
          const expiry = extractExpiry(data);
          return {
            accessToken,
            isExpired: isTokenExpired(expiry ?? undefined),
          };
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function buildEmptyResult(
  error: string,
  accountId: string,
  needsReauth = false
): ClaudeQuotaResult {
  return {
    success: false,
    windows: [],
    coreUsage: { fiveHour: null, weekly: null },
    lastUpdated: Date.now(),
    error,
    accountId,
    needsReauth,
  };
}

/**
 * Fetch quota for a single Claude account.
 */
export async function fetchClaudeQuota(
  accountId: string,
  verbose = false
): Promise<ClaudeQuotaResult> {
  const authData = readClaudeAuthData(accountId);
  if (!authData) {
    return buildEmptyResult('Auth file not found for Claude account', accountId);
  }

  if (authData.isExpired) {
    return buildEmptyResult(
      'Token expired - re-authenticate with ccs cliproxy auth claude',
      accountId,
      true
    );
  }

  let lastError = 'Unknown error';

  for (let attempt = 1; attempt <= CLAUDE_QUOTA_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLAUDE_QUOTA_TIMEOUT_MS);

    try {
      const response = await fetch(CLAUDE_POLICY_LIMITS_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${authData.accessToken}`,
          Accept: 'application/json',
          'User-Agent': CLAUDE_USER_AGENT,
        },
      });

      clearTimeout(timeoutId);
      if (verbose) {
        console.error(`[i] Claude policy limits status: ${response.status} (attempt ${attempt})`);
      }

      if (response.status === 401) {
        return buildEmptyResult('Authentication required for policy limits', accountId, true);
      }

      if (response.status === 404) {
        // Some accounts may not expose policy limits; treat as empty but successful.
        return {
          success: true,
          windows: [],
          coreUsage: { fiveHour: null, weekly: null },
          lastUpdated: Date.now(),
          accountId,
        };
      }

      if (response.status === 403) {
        return buildEmptyResult('Not authorized for policy limits', accountId);
      }

      if (!response.ok) {
        lastError = `Policy limits API error: ${response.status}`;
        if (
          attempt < CLAUDE_QUOTA_MAX_ATTEMPTS &&
          (response.status === 429 || response.status >= 500)
        ) {
          continue;
        }
        return buildEmptyResult(lastError, accountId);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return buildEmptyResult('Invalid policy limits format', accountId);
      }

      if (!toObject(payload)) {
        return buildEmptyResult('Invalid policy limits format', accountId);
      }

      const windows = buildClaudeQuotaWindows(payload as Record<string, unknown>);
      const coreUsage = buildClaudeCoreUsageSummary(windows);

      return {
        success: true,
        windows,
        coreUsage,
        lastUpdated: Date.now(),
        accountId,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? 'Policy limits request timeout'
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      if (verbose) {
        console.error(`[!] Claude policy limits failed (attempt ${attempt}): ${lastError}`);
      }

      if (attempt >= CLAUDE_QUOTA_MAX_ATTEMPTS) {
        return buildEmptyResult(lastError, accountId);
      }
    }
  }

  return buildEmptyResult(lastError, accountId);
}

/**
 * Fetch quota for all Claude accounts.
 */
export async function fetchAllClaudeQuotas(
  verbose = false
): Promise<{ account: string; quota: ClaudeQuotaResult }[]> {
  const accounts = getProviderAccounts('claude');
  const results = await Promise.all(
    accounts.map(async (account) => ({
      account: account.id,
      quota: await fetchClaudeQuota(account.id, verbose),
    }))
  );
  return results;
}
