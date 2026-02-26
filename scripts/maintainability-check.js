#!/usr/bin/env node

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join('docs', 'metrics', 'maintainability-baseline.json');
const BASELINE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'maintainability-baseline.js');

const PROTECTED_BRANCHES = new Set(['main', 'dev']);
const HOTFIX_PREFIXES = ['hotfix/', 'kai/hotfix-'];

function hasFlag(name) {
  return process.argv.slice(2).includes(name);
}

function detectBranchName() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function isProtectedBranch(branchName) {
  if (!branchName) {
    return false;
  }

  if (PROTECTED_BRANCHES.has(branchName)) {
    return true;
  }

  return HOTFIX_PREFIXES.some(prefix => branchName.startsWith(prefix));
}

function detectMode() {
  if (hasFlag('--strict')) {
    return 'strict';
  }

  if (hasFlag('--warn')) {
    return 'warn';
  }

  if (hasFlag('--off')) {
    return 'off';
  }

  const explicitMode = (process.env.CCS_MAINTAINABILITY_MODE || '').toLowerCase().trim();
  if (explicitMode === 'strict' || explicitMode === 'warn' || explicitMode === 'off') {
    return explicitMode;
  }

  const eventName = process.env.GITHUB_EVENT_NAME || '';
  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    return 'warn';
  }

  const gitHubRef = process.env.GITHUB_REF || '';
  if (gitHubRef.startsWith('refs/heads/')) {
    const branchFromRef = gitHubRef.slice('refs/heads/'.length);
    if (isProtectedBranch(branchFromRef)) {
      return 'strict';
    }
  }

  return isProtectedBranch(detectBranchName()) ? 'strict' : 'warn';
}

function runBaselineCheck() {
  return spawnSync('node', [BASELINE_SCRIPT, '--check', BASELINE_FILE], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeStreams(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function tryParseJson(stdout) {
  if (!stdout) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function formatViolations(violations) {
  if (!Array.isArray(violations) || violations.length === 0) {
    return [];
  }

  return violations.map(violation => {
    if (!violation || typeof violation !== 'object') {
      return '- unknown violation';
    }

    const metric = violation.metric || 'unknown';
    const baseline = typeof violation.baseline === 'number' ? violation.baseline : 'n/a';
    const current = typeof violation.current === 'number' ? violation.current : 'n/a';
    return `- ${metric}: baseline=${baseline}, current=${current}`;
  });
}

function main() {
  const mode = detectMode();

  if (mode === 'off') {
    console.log('[i] Maintainability gate disabled (mode=off).');
    process.exit(0);
  }

  const result = runBaselineCheck();
  if (mode === 'strict') {
    writeStreams(result);
    process.exit(result.status === null ? 1 : result.status);
  }

  if (result.status === 0) {
    writeStreams(result);
    process.exit(0);
  }

  const parsed = tryParseJson(result.stdout);
  const branchName = detectBranchName();

  console.log('[!] Maintainability regression detected (warning-only mode).');
  if (branchName) {
    console.log(`[i] Branch: ${branchName}`);
  }

  if (parsed && Array.isArray(parsed.violations) && parsed.violations.length > 0) {
    console.log('[i] Violations:');
    for (const line of formatViolations(parsed.violations)) {
      console.log(line);
    }
  } else {
    writeStreams(result);
  }

  console.log('[i] This is non-blocking on PR/feature branches to support parallel workflow.');
  console.log(
    '[i] Use strict mode when needed: bun run maintainability:check:strict'
  );
}

main();
