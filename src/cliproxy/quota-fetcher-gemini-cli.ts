/**
 * Quota Fetcher for Gemini CLI Accounts
 *
 * Fetches quota information from Google Cloud Code internal API.
 * Used for displaying bucket-based quotas grouped by model series.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAuthDir } from './config-generator';
import { getProviderAccounts, getPausedDir } from './account-manager';
import { sanitizeEmail, isTokenExpired } from './auth-utils';
import type { GeminiCliQuotaResult, GeminiCliBucket } from './quota-types';

/** Google Cloud Code API endpoints */
const GEMINI_CLI_API_BASE = 'https://cloudcode-pa.googleapis.com';
const GEMINI_CLI_API_VERSION = 'v1internal';

/**
 * Model groups for quota consolidation.
 * Update when Google releases new Gemini models to include them in quota display.
 */
const GEMINI_CLI_GROUPS: Record<
  string,
  {
    label: string;
    models: string[];
  }
> = {
  'gemini-flash-series': {
    label: 'Gemini Flash Series',
    models: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  },
  'gemini-pro-series': {
    label: 'Gemini Pro Series',
    models: ['gemini-3-pro-preview', 'gemini-2.5-pro'],
  },
};

/** Models to ignore in quota display (deprecated) */
const IGNORED_MODEL_PREFIXES = ['gemini-2.0-flash'];

/** Auth data extracted from Gemini CLI auth file */
interface GeminiCliAuthData {
  accessToken: string;
  projectId: string | null;
  isExpired: boolean;
  expiresAt: string | null;
}

/** Raw bucket from API response */
interface RawGeminiCliBucket {
  model_id?: string;
  modelId?: string;
  token_type?: string | null;
  tokenType?: string | null;
  remaining_fraction?: number;
  remainingFraction?: number;
  remaining_amount?: number;
  remainingAmount?: number;
  reset_time?: string | null;
  resetTime?: string | null;
}

/** Raw API response structure */
interface GeminiCliQuotaResponse {
  buckets?: RawGeminiCliBucket[];
}

/**
 * Extract project ID from account field
 * Input: "user@example.com (cloudaicompanion-abc-123)"
 * Output: "cloudaicompanion-abc-123"
 */
function resolveGeminiCliProjectId(accountField: string): string | null {
  const regex = /\(([^()]+)\)/g;
  let match: RegExpExecArray | null;
  let lastMatch: string | null = null;
  while ((match = regex.exec(accountField)) !== null) {
    lastMatch = match[1];
  }
  return lastMatch;
}

/**
 * Extract access token from Gemini auth file data
 * Handles both flat (access_token) and nested (token.access_token) structures
 */
function extractAccessToken(data: Record<string, unknown>): string | null {
  // Flat structure: { access_token: "..." }
  if (typeof data.access_token === 'string') {
    return data.access_token;
  }
  // Nested structure: { token: { access_token: "..." } }
  if (data.token && typeof data.token === 'object') {
    const token = data.token as Record<string, unknown>;
    if (typeof token.access_token === 'string') {
      return token.access_token;
    }
  }
  return null;
}

/**
 * Extract expiry from Gemini auth file data
 * Handles both flat (expired) and nested (token.expiry) structures
 */
function extractExpiry(data: Record<string, unknown>): string | null {
  // Flat structure: { expired: "..." }
  if (typeof data.expired === 'string') {
    return data.expired;
  }
  // Nested structure: { token: { expiry: "..." } }
  if (data.token && typeof data.token === 'object') {
    const token = data.token as Record<string, unknown>;
    if (typeof token.expiry === 'string') {
      return token.expiry;
    }
  }
  return null;
}

/**
 * Check if file matches Gemini CLI auth file patterns
 * Patterns: gemini-*.json OR *-gen-lang-client-*.json OR email@domain.com-*.json with type=gemini
 */
function isGeminiAuthFile(filename: string): boolean {
  if (!filename.endsWith('.json')) return false;
  // Legacy pattern: gemini-email.json
  if (filename.startsWith('gemini-')) return true;
  // New pattern: email-gen-lang-client-projectId.json
  if (filename.includes('-gen-lang-client-')) return true;
  // Check if contains @ (email pattern) - will verify type inside
  if (filename.includes('@')) return true;
  return false;
}

/**
 * Read auth data from Gemini CLI auth file
 * Supports multiple file naming conventions and JSON structures
 */
function readGeminiCliAuthData(accountId: string): GeminiCliAuthData | null {
  const authDirs = [getAuthDir(), getPausedDir()];
  const sanitizedId = sanitizeEmail(accountId);
  const expectedFiles = [
    `gemini-${sanitizedId}.json`, // Legacy format
    `${accountId}-gen-lang-client-`, // New format prefix (partial match)
  ];

  for (const authDir of authDirs) {
    if (!fs.existsSync(authDir)) continue;

    // Try exact legacy match first
    const legacyPath = path.join(authDir, expectedFiles[0]);
    if (fs.existsSync(legacyPath)) {
      try {
        const content = fs.readFileSync(legacyPath, 'utf-8');
        const data = JSON.parse(content) as Record<string, unknown>;
        const accessToken = extractAccessToken(data);
        if (accessToken) {
          const projectId =
            typeof data.project_id === 'string'
              ? data.project_id
              : resolveGeminiCliProjectId(String(data.account || ''));
          const expiry = extractExpiry(data);

          return {
            accessToken,
            projectId,
            isExpired: isTokenExpired(expiry ?? undefined),
            expiresAt: expiry,
          };
        }
      } catch {
        // Continue to fallback
      }
    }

    // Scan directory for matching files
    const files = fs.readdirSync(authDir);
    for (const file of files) {
      if (!isGeminiAuthFile(file)) continue;

      const candidatePath = path.join(authDir, file);
      try {
        const content = fs.readFileSync(candidatePath, 'utf-8');
        const data = JSON.parse(content) as Record<string, unknown>;

        // Check if this file matches our account
        const fileEmail = typeof data.email === 'string' ? data.email : null;
        const fileType = typeof data.type === 'string' ? data.type : null;
        const matchesEmail = fileEmail === accountId;
        const matchesFilename = file.startsWith(`${accountId}-`) || file.includes(sanitizedId);
        const isGeminiType = fileType === 'gemini' || fileType === 'gemini-cli';

        // Must match account AND be gemini type (or legacy gemini- prefix)
        if ((matchesEmail || matchesFilename) && (isGeminiType || file.startsWith('gemini-'))) {
          const accessToken = extractAccessToken(data);
          if (accessToken) {
            const projectId =
              typeof data.project_id === 'string'
                ? data.project_id
                : resolveGeminiCliProjectId(String(data.account || ''));
            const expiry = extractExpiry(data);

            return {
              accessToken,
              projectId,
              isExpired: isTokenExpired(expiry ?? undefined),
              expiresAt: expiry,
            };
          }
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Find which group a model belongs to
 */
function findModelGroup(modelId: string): { groupId: string; label: string } | null {
  for (const [groupId, group] of Object.entries(GEMINI_CLI_GROUPS)) {
    if (group.models.includes(modelId)) {
      return { groupId, label: group.label };
    }
  }
  return null;
}

/**
 * Check if model should be ignored
 */
function shouldIgnoreModel(modelId: string): boolean {
  return IGNORED_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}

/**
 * Build GeminiCliBucket array from API response
 * Groups buckets by model series and token type
 */
function buildGeminiCliBuckets(rawBuckets: RawGeminiCliBucket[]): GeminiCliBucket[] {
  // Group buckets by groupId::tokenType
  const grouped = new Map<
    string,
    {
      label: string;
      tokenType: string | null;
      remainingFraction: number;
      resetTime: string | null;
      modelIds: string[];
    }
  >();

  for (const bucket of rawBuckets) {
    const modelId = bucket.model_id || bucket.modelId || '';
    if (!modelId) continue;

    // Skip ignored models
    if (shouldIgnoreModel(modelId)) continue;

    const tokenType = bucket.token_type ?? bucket.tokenType ?? null;
    // Clamp remainingFraction to [0, 1] range
    const rawRemainingFraction = bucket.remaining_fraction ?? bucket.remainingFraction ?? 1;
    const remainingFraction = Math.max(0, Math.min(1, rawRemainingFraction));
    const resetTime = bucket.reset_time ?? bucket.resetTime ?? null;

    // Find group for this model
    const group = findModelGroup(modelId);
    const groupId = group?.groupId || 'other';
    const label = group?.label || 'Other Models';

    // Create compound key for grouping
    const key = `${groupId}::${tokenType || 'combined'}`;

    const existing = grouped.get(key);
    if (existing) {
      // Merge: take the minimum remaining fraction (most limiting)
      existing.remainingFraction = Math.min(existing.remainingFraction, remainingFraction);
      // Keep earliest reset time if available
      if (resetTime && (!existing.resetTime || resetTime < existing.resetTime)) {
        existing.resetTime = resetTime;
      }
      existing.modelIds.push(modelId);
    } else {
      grouped.set(key, {
        label,
        tokenType,
        remainingFraction,
        resetTime,
        modelIds: [modelId],
      });
    }
  }

  // Convert to array
  const buckets: GeminiCliBucket[] = [];
  for (const [key, data] of grouped.entries()) {
    buckets.push({
      id: key,
      label: data.label,
      tokenType: data.tokenType,
      remainingFraction: data.remainingFraction,
      remainingPercent: Math.round(data.remainingFraction * 100),
      resetTime: data.resetTime,
      modelIds: data.modelIds,
    });
  }

  // Sort by label then token type
  buckets.sort((a, b) => {
    const labelCompare = a.label.localeCompare(b.label);
    if (labelCompare !== 0) return labelCompare;
    return (a.tokenType || '').localeCompare(b.tokenType || '');
  });

  return buckets;
}

/**
 * Fetch quota for a single Gemini CLI account
 *
 * @param accountId - Account identifier (email)
 * @param verbose - Show detailed diagnostics
 * @returns Quota result with buckets and percentages
 */
export async function fetchGeminiCliQuota(
  accountId: string,
  verbose = false
): Promise<GeminiCliQuotaResult> {
  if (verbose) console.error(`[i] Fetching Gemini CLI quota for ${accountId}...`);

  const authData = readGeminiCliAuthData(accountId);
  if (!authData) {
    const error = 'Auth file not found for Gemini account';
    if (verbose) console.error(`[!] Error: ${error}`);
    return {
      success: false,
      buckets: [],
      projectId: null,
      lastUpdated: Date.now(),
      error,
      accountId,
    };
  }

  if (authData.isExpired) {
    const error = 'Token expired - re-authenticate with ccs cliproxy auth gemini';
    if (verbose) console.error(`[!] Error: ${error}`);
    return {
      success: false,
      buckets: [],
      projectId: null,
      lastUpdated: Date.now(),
      error,
      accountId,
      needsReauth: true,
    };
  }

  if (!authData.projectId) {
    const error = 'Cannot resolve project ID from auth file';
    if (verbose) console.error(`[!] Error: ${error}`);
    return {
      success: false,
      buckets: [],
      projectId: null,
      lastUpdated: Date.now(),
      error,
      accountId,
    };
  }

  const url = `${GEMINI_CLI_API_BASE}/${GEMINI_CLI_API_VERSION}:retrieveUserQuota`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${authData.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project: authData.projectId }),
    });

    clearTimeout(timeoutId);

    if (verbose) console.error(`[i] Gemini CLI API status: ${response.status}`);

    if (response.status === 401) {
      return {
        success: false,
        buckets: [],
        projectId: authData.projectId,
        lastUpdated: Date.now(),
        error: 'Token expired or invalid',
        accountId,
        needsReauth: true,
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        buckets: [],
        projectId: authData.projectId,
        lastUpdated: Date.now(),
        error: 'Quota access forbidden for this account',
        accountId,
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        buckets: [],
        projectId: authData.projectId,
        lastUpdated: Date.now(),
        error: 'Rate limited - try again later',
        accountId,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        buckets: [],
        projectId: authData.projectId,
        lastUpdated: Date.now(),
        error: `API error: ${response.status}`,
        accountId,
      };
    }

    const data = (await response.json()) as GeminiCliQuotaResponse;
    const rawBuckets = data.buckets || [];
    const buckets = buildGeminiCliBuckets(rawBuckets);

    if (verbose) console.error(`[i] Gemini CLI buckets found: ${buckets.length}`);

    return {
      success: true,
      buckets,
      projectId: authData.projectId,
      lastUpdated: Date.now(),
      accountId,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const errorMsg =
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timeout'
        : err instanceof Error
          ? err.message
          : 'Unknown error';

    if (verbose) console.error(`[!] Gemini CLI quota error: ${errorMsg}`);

    return {
      success: false,
      buckets: [],
      projectId: authData.projectId,
      lastUpdated: Date.now(),
      error: errorMsg,
      accountId,
    };
  }
}

/**
 * Fetch quota for all Gemini CLI accounts
 *
 * @param verbose - Show detailed diagnostics
 * @returns Array of account quotas
 */
export async function fetchAllGeminiCliQuotas(
  verbose = false
): Promise<{ account: string; quota: GeminiCliQuotaResult }[]> {
  const accounts = getProviderAccounts('gemini');

  if (accounts.length === 0) {
    return [];
  }

  const results = await Promise.all(
    accounts.map(async (account) => ({
      account: account.id,
      quota: await fetchGeminiCliQuota(account.id, verbose),
    }))
  );

  return results;
}

// Export for testing
export { resolveGeminiCliProjectId, buildGeminiCliBuckets };
