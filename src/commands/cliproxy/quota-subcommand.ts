/**
 * CLIProxy Quota Management
 *
 * Handles:
 * - ccs cliproxy quota [--provider <name>]
 * - ccs cliproxy default <account>
 * - ccs cliproxy pause <account>
 * - ccs cliproxy resume <account>
 * - ccs cliproxy doctor
 */

import {
  getProviderAccounts,
  setDefaultAccount,
  pauseAccount,
  resumeAccount,
  findAccountByQuery,
} from '../../cliproxy/account-manager';
import { fetchAllProviderQuotas } from '../../cliproxy/quota-fetcher';
import { fetchAllCodexQuotas } from '../../cliproxy/quota-fetcher-codex';
import { fetchAllGeminiCliQuotas } from '../../cliproxy/quota-fetcher-gemini-cli';
import type { CodexQuotaResult, GeminiCliQuotaResult } from '../../cliproxy/quota-types';
import { isOnCooldown } from '../../cliproxy/quota-manager';
import { CLIProxyProvider } from '../../cliproxy/types';
import { initUI, header, subheader, color, dim, ok, fail, warn, info, table } from '../../utils/ui';

interface CliproxyProfileArgs {
  name?: string;
  provider?: string;
  model?: string;
  account?: string;
  force?: boolean;
  yes?: boolean;
}

function parseProfileArgs(args: string[]): CliproxyProfileArgs {
  const result: CliproxyProfileArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--provider' && args[i + 1]) {
      result.provider = args[++i];
    } else if (arg === '--model' && args[i + 1]) {
      result.model = args[++i];
    } else if (arg === '--account' && args[i + 1]) {
      result.account = args[++i];
    } else if (arg === '--force') {
      result.force = true;
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
    } else if (!arg.startsWith('-') && !result.name) {
      result.name = arg;
    }
  }
  return result;
}

function formatQuotaBar(percentage: number): string {
  const width = 20;
  const clampedPct = Math.max(0, Math.min(100, percentage));
  const filled = Math.round((clampedPct / 100) * width);
  const empty = width - filled;
  const filledChar = clampedPct > 50 ? '█' : clampedPct > 10 ? '▓' : '░';
  return `[${filledChar.repeat(filled)}${' '.repeat(empty)}]`;
}

function formatResetTime(seconds: number): string {
  if (seconds <= 0) return 'now';
  if (seconds < 60) return `in ${seconds}s`;
  if (seconds < 3600) return `in ${Math.round(seconds / 60)}m`;
  return `in ${Math.round(seconds / 3600)}h`;
}

function formatResetTimeISO(isoTime: string): string {
  if (!isoTime) return 'unknown';
  const resetDate = new Date(isoTime);
  if (isNaN(resetDate.getTime())) return 'unknown';
  const seconds = Math.max(0, Math.round((resetDate.getTime() - Date.now()) / 1000));
  return formatResetTime(seconds);
}

type CodexWindowKind =
  | 'usage-5h'
  | 'usage-weekly'
  | 'code-review-5h'
  | 'code-review-weekly'
  | 'code-review'
  | 'unknown';

function getCodexWindowKind(label: string): CodexWindowKind {
  const lower = (label || '').toLowerCase();
  const isCodeReview = lower.includes('code review') || lower.includes('code_review');
  const isPrimary = lower.includes('primary');
  const isSecondary = lower.includes('secondary');

  if (isCodeReview) {
    if (isPrimary) return 'code-review-5h';
    if (isSecondary) return 'code-review-weekly';
    return 'code-review';
  }

  if (isPrimary) return 'usage-5h';
  if (isSecondary) return 'usage-weekly';
  return 'unknown';
}

type CodexWindowSummary = Pick<CodexQuotaResult['windows'][number], 'label' | 'resetAfterSeconds'>;

function inferCodeReviewCadence(
  window: CodexWindowSummary,
  allWindows: CodexWindowSummary[]
): '5h' | 'weekly' | null {
  const kind = getCodexWindowKind(window.label);
  if (kind === 'code-review-weekly') return 'weekly';

  const reset = window.resetAfterSeconds;
  if (typeof reset !== 'number' || !isFinite(reset) || reset <= 0) return null;

  const usage5h = allWindows.find(
    (w) =>
      getCodexWindowKind(w.label) === 'usage-5h' &&
      typeof w.resetAfterSeconds === 'number' &&
      isFinite(w.resetAfterSeconds) &&
      w.resetAfterSeconds > 0
  );
  const usageWeekly = allWindows.find(
    (w) =>
      getCodexWindowKind(w.label) === 'usage-weekly' &&
      typeof w.resetAfterSeconds === 'number' &&
      isFinite(w.resetAfterSeconds) &&
      w.resetAfterSeconds > 0
  );

  if (!usage5h || !usageWeekly) return null;

  const diffTo5h = Math.abs(reset - (usage5h.resetAfterSeconds as number));
  const diffToWeekly = Math.abs(reset - (usageWeekly.resetAfterSeconds as number));
  return diffToWeekly <= diffTo5h ? 'weekly' : '5h';
}

function getCodexWindowDisplayLabel(
  window: CodexWindowSummary,
  allWindows: CodexWindowSummary[] = []
): string {
  const context = allWindows.length > 0 ? allWindows : [window];

  switch (getCodexWindowKind(window.label)) {
    case 'usage-5h':
      return '5h usage limit';
    case 'usage-weekly':
      return 'Weekly usage limit';
    case 'code-review-5h':
    case 'code-review-weekly':
    case 'code-review': {
      const inferred = inferCodeReviewCadence(window, context);
      if (inferred === '5h') return 'Code review (5h)';
      if (inferred === 'weekly') return 'Code review (weekly)';
      return 'Code review';
    }
    case 'unknown':
      return window.label;
  }
}

function getCodexCoreUsageWindows(windows: CodexQuotaResult['windows']): {
  fiveHourWindow: CodexQuotaResult['windows'][number] | null;
  weeklyWindow: CodexQuotaResult['windows'][number] | null;
} {
  let fiveHourWindow: CodexQuotaResult['windows'][number] | null = null;
  let weeklyWindow: CodexQuotaResult['windows'][number] | null = null;
  const nonCodeReviewWindows: CodexQuotaResult['windows'] = [];

  for (const window of windows) {
    const kind = getCodexWindowKind(window.label);
    if (kind === 'usage-5h') {
      if (!fiveHourWindow) fiveHourWindow = window;
      nonCodeReviewWindows.push(window);
      continue;
    }
    if (kind === 'usage-weekly') {
      if (!weeklyWindow) weeklyWindow = window;
      nonCodeReviewWindows.push(window);
      continue;
    }
    if (kind === 'unknown') {
      nonCodeReviewWindows.push(window);
    }
  }

  if ((!fiveHourWindow || !weeklyWindow) && nonCodeReviewWindows.length > 0) {
    const withReset = nonCodeReviewWindows
      .filter((w) => typeof w.resetAfterSeconds === 'number' && w.resetAfterSeconds >= 0)
      .sort((a, b) => (a.resetAfterSeconds || 0) - (b.resetAfterSeconds || 0));

    if (!fiveHourWindow) {
      fiveHourWindow = withReset[0] || nonCodeReviewWindows[0] || null;
    }

    if (!weeklyWindow) {
      weeklyWindow =
        withReset.length > 1
          ? withReset[withReset.length - 1]
          : nonCodeReviewWindows.find((w) => w !== fiveHourWindow) || null;
    }
  }

  return { fiveHourWindow, weeklyWindow };
}

function displayAntigravityQuotaSection(
  quotaResult: Awaited<ReturnType<typeof fetchAllProviderQuotas>>
): void {
  const provider: CLIProxyProvider = 'agy';
  const accounts = getProviderAccounts(provider);

  console.log(
    subheader(`Antigravity (${accounts.length} account${accounts.length !== 1 ? 's' : ''})`)
  );
  console.log('');

  const rows: string[][] = [];
  for (const account of accounts) {
    const quotaData = quotaResult.accounts.find((q) => q.account.id === account.id);
    const quota = quotaData?.quota;

    let avgQuota = 'N/A';
    if (quota?.success && quota.models.length > 0) {
      const avg = Math.round(
        quota.models.reduce((sum, m) => sum + m.percentage, 0) / quota.models.length
      );
      avgQuota = `${avg}%`;
    }

    const statusParts: string[] = [];
    if (account.paused) statusParts.push(color('PAUSED', 'warning'));
    if (isOnCooldown(provider, account.id)) statusParts.push(color('COOLDOWN', 'warning'));

    const defaultMark = account.isDefault ? color('*', 'success') : ' ';
    const tier = account.tier || 'unknown';
    const status = statusParts.join(', ');

    rows.push([
      defaultMark,
      account.nickname || account.email || account.id,
      tier,
      avgQuota,
      status,
    ]);
  }

  console.log(
    table(rows, {
      head: ['', 'Account', 'Tier', 'Quota', 'Status'],
      colWidths: [3, 30, 10, 10, 20],
    })
  );
  console.log('');
}

function displayCodexQuotaSection(results: { account: string; quota: CodexQuotaResult }[]): void {
  console.log(subheader(`Codex (${results.length} account${results.length !== 1 ? 's' : ''})`));
  console.log('');

  for (const { account, quota } of results) {
    const accountInfo = findAccountByQuery('codex', account);
    const defaultMark = accountInfo?.isDefault ? color(' (default)', 'info') : '';

    if (!quota.success) {
      console.log(`  ${fail(account)}${defaultMark}`);
      console.log(`    ${color(quota.error || 'Failed to fetch quota', 'error')}`);
      console.log('');
      continue;
    }

    const { fiveHourWindow, weeklyWindow } = getCodexCoreUsageWindows(quota.windows);
    const coreUsageWindows = [fiveHourWindow, weeklyWindow].filter(
      (w, index, arr): w is NonNullable<typeof w> => !!w && arr.indexOf(w) === index
    );
    const statusWindows = coreUsageWindows.length > 0 ? coreUsageWindows : quota.windows;

    const avgQuota =
      statusWindows.length > 0
        ? statusWindows.reduce((sum, w) => sum + w.remainingPercent, 0) / statusWindows.length
        : 0;
    const statusIcon = avgQuota > 50 ? ok('') : avgQuota > 10 ? warn('') : fail('');
    const planBadge = quota.planType ? color(` [${quota.planType}]`, 'info') : '';

    console.log(`  ${statusIcon}${account}${defaultMark}${planBadge}`);

    const orderedWindows = [fiveHourWindow, weeklyWindow, ...quota.windows].filter(
      (w, index, arr): w is NonNullable<typeof w> => !!w && arr.indexOf(w) === index
    );

    for (const window of orderedWindows) {
      const bar = formatQuotaBar(window.remainingPercent);
      const resetLabel = window.resetAfterSeconds
        ? dim(` Resets ${formatResetTime(window.resetAfterSeconds)}`)
        : '';
      console.log(
        `    ${getCodexWindowDisplayLabel(window, orderedWindows).padEnd(24)} ${bar} ${window.remainingPercent.toFixed(0)}%${resetLabel}`
      );
    }
    console.log('');
  }
}

function displayGeminiCliQuotaSection(
  results: { account: string; quota: GeminiCliQuotaResult }[]
): void {
  console.log(
    subheader(`Gemini CLI (${results.length} account${results.length !== 1 ? 's' : ''})`)
  );
  console.log('');

  for (const { account, quota } of results) {
    const accountInfo = findAccountByQuery('gemini', account);
    const defaultMark = accountInfo?.isDefault ? color(' (default)', 'info') : '';

    if (!quota.success) {
      console.log(`  ${fail(account)}${defaultMark}`);
      console.log(`    ${color(quota.error || 'Failed to fetch quota', 'error')}`);
      console.log('');
      continue;
    }

    const avgQuota =
      quota.buckets.length > 0
        ? quota.buckets.reduce((sum, b) => sum + b.remainingPercent, 0) / quota.buckets.length
        : 0;
    const statusIcon = avgQuota > 50 ? ok('') : avgQuota > 10 ? warn('') : fail('');

    console.log(`  ${statusIcon}${account}${defaultMark}`);
    if (quota.projectId) {
      console.log(`    Project: ${dim(quota.projectId)}`);
    }

    for (const bucket of quota.buckets) {
      const bar = formatQuotaBar(bucket.remainingPercent);
      const tokenLabel = bucket.tokenType ? dim(` (${bucket.tokenType})`) : '';
      const resetLabel = bucket.resetTime
        ? dim(` Resets ${formatResetTimeISO(bucket.resetTime)}`)
        : '';
      console.log(
        `    ${bucket.label.padEnd(24)} ${bar} ${bucket.remainingPercent.toFixed(0)}%${tokenLabel}${resetLabel}`
      );
    }
    console.log('');
  }
}

export async function handleQuotaStatus(
  verbose = false,
  providerFilter: 'agy' | 'codex' | 'gemini' | 'all' = 'all'
): Promise<void> {
  await initUI();
  console.log(header('Quota Status'));
  console.log('');

  const shouldFetch = {
    agy: providerFilter === 'all' || providerFilter === 'agy',
    codex: providerFilter === 'all' || providerFilter === 'codex',
    gemini: providerFilter === 'all' || providerFilter === 'gemini',
  };

  console.log(dim('Fetching quotas...'));

  const [agyResults, codexResults, geminiResults] = await Promise.all([
    shouldFetch.agy ? fetchAllProviderQuotas('agy', verbose) : null,
    shouldFetch.codex ? fetchAllCodexQuotas(verbose) : null,
    shouldFetch.gemini ? fetchAllGeminiCliQuotas(verbose) : null,
  ]);

  console.log('');

  if (agyResults && agyResults.accounts.length > 0) {
    displayAntigravityQuotaSection(agyResults);
  } else if (shouldFetch.agy) {
    console.log(subheader('Antigravity (0 accounts)'));
    console.log(info('No Antigravity accounts configured'));
    console.log(`  Run: ${color('ccs agy --auth', 'command')} to authenticate`);
    console.log('');
  }

  if (codexResults && codexResults.length > 0) {
    displayCodexQuotaSection(codexResults);
  } else if (shouldFetch.codex) {
    console.log(subheader('Codex (0 accounts)'));
    console.log(info('No Codex accounts configured'));
    console.log(`  Run: ${color('ccs codex --auth', 'command')} to authenticate`);
    console.log('');
  }

  if (geminiResults && geminiResults.length > 0) {
    displayGeminiCliQuotaSection(geminiResults);
  } else if (shouldFetch.gemini) {
    console.log(subheader('Gemini CLI (0 accounts)'));
    console.log(info('No Gemini CLI accounts configured'));
    console.log(`  Run: ${color('ccs gemini --auth', 'command')} to authenticate`);
    console.log('');
  }
}

export async function handleDoctor(verbose = false): Promise<void> {
  await initUI();
  console.log(header('CLIProxy Quota Diagnostics'));
  console.log('');

  const provider: CLIProxyProvider = 'agy';
  const accounts = getProviderAccounts(provider);

  if (accounts.length === 0) {
    console.log(info('No Antigravity accounts configured'));
    console.log(`    Run: ${color('ccs agy --auth', 'command')} to authenticate`);
    return;
  }

  console.log(subheader(`Antigravity Accounts (${accounts.length})`));
  console.log('');

  console.log(dim('Fetching quotas...'));
  const quotaResult = await fetchAllProviderQuotas(provider, verbose);

  for (const { account, quota } of quotaResult.accounts) {
    const accountLabel = account.email || account.id || 'Unknown Account';
    const defaultBadge = account.isDefault ? color(' (default)', 'info') : '';

    if (!quota.success) {
      console.log(`  ${fail(accountLabel)}${defaultBadge}`);
      console.log(`    ${color(quota.error || 'Failed to fetch quota', 'error')}`);
      if (quota.isUnprovisioned) {
        console.log(
          `    ${warn('Account not provisioned - open Gemini Code Assist in IDE first')}`
        );
      }
      console.log('');
      continue;
    }

    const avgQuota =
      quota.models.length > 0
        ? quota.models.reduce((sum, m) => sum + m.percentage, 0) / quota.models.length
        : 0;
    const statusIcon = avgQuota > 50 ? ok('') : avgQuota > 10 ? warn('') : fail('');

    console.log(`  ${statusIcon}${accountLabel}${defaultBadge}`);
    if (quota.projectId) {
      console.log(`    Project: ${dim(quota.projectId)}`);
    }

    for (const model of quota.models) {
      const bar = formatQuotaBar(model.percentage);
      console.log(`    ${model.name.padEnd(20)} ${bar} ${model.percentage.toFixed(0)}%`);
    }
    console.log('');
  }

  const sharedProjects = Object.entries(quotaResult.projectGroups).filter(
    ([, accountIds]) => accountIds.length > 1
  );

  if (sharedProjects.length > 0) {
    console.log('');
    console.log(subheader('Shared Project Warning'));
    console.log('');
    for (const [projectId, accountIds] of sharedProjects) {
      console.log(
        fail(`Project ${projectId.substring(0, 20)}... shared by ${accountIds.length} accounts:`)
      );
      for (const accountId of accountIds) {
        console.log(`    - ${accountId}`);
      }
      console.log('');
      console.log(warn('These accounts share the same quota pool!'));
      console.log(warn('Failover between them will NOT help when quota is exhausted.'));
      console.log(info('Solution: Use accounts from different GCP projects.'));
    }
  }

  console.log('');
  console.log(subheader('Summary'));
  const healthyAccounts = quotaResult.accounts.filter(
    ({ quota }) => quota.success && quota.models.some((m) => m.percentage > 5)
  );
  console.log(`  Accounts with quota: ${healthyAccounts.length}/${accounts.length}`);
  if (sharedProjects.length > 0) {
    console.log(`  ${fail(`Shared projects: ${sharedProjects.length} (failover limited)`)}`);
  } else if (accounts.length > 1) {
    console.log(`  ${ok('No shared projects (failover fully operational)')}`);
  }
  console.log('');
}

export async function handleSetDefault(args: string[]): Promise<void> {
  await initUI();
  const parsed = parseProfileArgs(args);

  if (!parsed.name) {
    console.log(fail('Usage: ccs cliproxy default <account> [--provider <provider>]'));
    console.log('');
    console.log('Examples:');
    console.log('  ccs cliproxy default ultra@gmail.com');
    console.log('  ccs cliproxy default john --provider agy');
    process.exit(1);
  }

  const provider = (parsed.provider || 'agy') as CLIProxyProvider;
  const account = findAccountByQuery(provider, parsed.name);

  if (!account) {
    console.log(fail(`Account not found: ${parsed.name}`));
    console.log('');
    const accounts = getProviderAccounts(provider);
    if (accounts.length > 0) {
      console.log('Available accounts:');
      for (const acc of accounts) {
        const badge = acc.isDefault ? color(' (current default)', 'info') : '';
        console.log(`  - ${acc.email || acc.id}${badge}`);
      }
    } else {
      console.log(`No accounts found for provider: ${provider}`);
      console.log(`Run: ccs ${provider} --auth`);
    }
    process.exit(1);
  }

  const success = setDefaultAccount(provider, account.id);

  if (success) {
    console.log(ok(`Default account set to: ${account.email || account.id}`));
    console.log(info(`Provider: ${provider}`));
  } else {
    console.log(fail('Failed to set default account'));
    process.exit(1);
  }
}

export async function handlePauseAccount(args: string[]): Promise<void> {
  await initUI();
  const parsed = parseProfileArgs(args);

  if (!parsed.name) {
    console.log(fail('Usage: ccs cliproxy pause <account> [--provider <provider>]'));
    console.log('');
    console.log('Pauses an account so it will be skipped in quota rotation.');
    process.exit(1);
  }

  const provider = (parsed.provider || 'agy') as CLIProxyProvider;
  const account = findAccountByQuery(provider, parsed.name);

  if (!account) {
    console.log(fail(`Account not found: ${parsed.name}`));
    process.exit(1);
  }

  if (account.paused) {
    console.log(warn(`Account already paused: ${account.email || account.id}`));
    console.log(info(`Paused at: ${account.pausedAt || 'unknown'}`));
    return;
  }

  const success = pauseAccount(provider, account.id);

  if (success) {
    console.log(ok(`Account paused: ${account.email || account.id}`));
    console.log(info('Account will be skipped in quota rotation'));
  } else {
    console.log(fail('Failed to pause account'));
    process.exit(1);
  }
}

export async function handleResumeAccount(args: string[]): Promise<void> {
  await initUI();
  const parsed = parseProfileArgs(args);

  if (!parsed.name) {
    console.log(fail('Usage: ccs cliproxy resume <account> [--provider <provider>]'));
    console.log('');
    console.log('Resumes a paused account for quota rotation.');
    process.exit(1);
  }

  const provider = (parsed.provider || 'agy') as CLIProxyProvider;
  const account = findAccountByQuery(provider, parsed.name);

  if (!account) {
    console.log(fail(`Account not found: ${parsed.name}`));
    process.exit(1);
  }

  if (!account.paused) {
    console.log(warn(`Account is not paused: ${account.email || account.id}`));
    return;
  }

  const success = resumeAccount(provider, account.id);

  if (success) {
    console.log(ok(`Account resumed: ${account.email || account.id}`));
    console.log(info('Account is now active in quota rotation'));
  } else {
    console.log(fail('Failed to resume account'));
    process.exit(1);
  }
}
