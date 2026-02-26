/**
 * Droid command router
 *
 * Determines whether profile args should launch Droid interactive mode
 * (`droid [prompt...]`) or command mode (`droid <subcommand> ...`).
 *
 * Also normalizes CCS legacy reasoning aliases for `droid exec`:
 * - --effort / --thinking -> --reasoning-effort
 */

export type DroidCommandMode = 'interactive' | 'command';

export interface DroidCommandRoute {
  mode: DroidCommandMode;
  argsForDroid: string[];
  command?: string;
  autoPrependedExec: boolean;
}

const DROID_SUBCOMMANDS = new Set([
  'exec',
  'mcp',
  'plugin',
  'daemon',
  'search',
  'find',
  'ssh',
  'computer',
  'update',
  'help',
]);

// Exec-only long flags from Factory Droid CLI help.
const DROID_EXEC_ONLY_LONG_FLAGS = new Set([
  '--output-format',
  '--input-format',
  '--file',
  '--auto',
  '--skip-permissions-unsafe',
  '--session-id',
  '--model',
  '--reasoning-effort',
  '--enabled-tools',
  '--disabled-tools',
  '--cwd',
  '--tag',
  '--log-group-id',
  '--list-tools',
]);

function getLongFlagToken(arg: string): string {
  const eqIndex = arg.indexOf('=');
  return eqIndex >= 0 ? arg.slice(0, eqIndex) : arg;
}

function isExplicitSubcommand(arg: string | undefined): boolean {
  return !!arg && DROID_SUBCOMMANDS.has(arg);
}

function hasExecOnlyFlagsAtFront(args: string[]): boolean {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') return false;

    // CCS legacy aliases may appear before exec-only flags; skip their values when present.
    if (arg === '--effort' || arg === '--thinking') {
      const possibleValue = args[i + 1];
      if (possibleValue && !possibleValue.startsWith('-')) {
        i += 1;
      }
      continue;
    }
    if (arg.startsWith('--effort=') || arg.startsWith('--thinking=')) {
      continue;
    }

    if (!arg.startsWith('-')) return false;
    if (!arg.startsWith('--')) continue; // short flags are ambiguous at root (`-r` is resume)

    const flagToken = getLongFlagToken(arg);
    if (DROID_EXEC_ONLY_LONG_FLAGS.has(flagToken)) {
      return true;
    }
  }

  return false;
}

function normalizeLegacyReasoningAliasesForExec(args: string[]): string[] {
  const normalized: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--effort' || arg === '--thinking') {
      const value = args[i + 1];
      if (value && !value.startsWith('-')) {
        normalized.push('--reasoning-effort', value);
        i += 1;
      } else {
        // Keep invalid/missing-value form so Droid can surface native validation.
        normalized.push(arg);
      }
      continue;
    }

    if (arg.startsWith('--effort=')) {
      normalized.push(`--reasoning-effort=${arg.slice('--effort='.length)}`);
      continue;
    }

    if (arg.startsWith('--thinking=')) {
      normalized.push(`--reasoning-effort=${arg.slice('--thinking='.length)}`);
      continue;
    }

    normalized.push(arg);
  }

  return normalized;
}

export function routeDroidCommandArgs(args: string[]): DroidCommandRoute {
  if (args.length === 0) {
    return {
      mode: 'interactive',
      argsForDroid: [],
      autoPrependedExec: false,
    };
  }

  if (isExplicitSubcommand(args[0])) {
    const command = args[0];
    const argsForDroid =
      command === 'exec' ? normalizeLegacyReasoningAliasesForExec(args) : [...args];
    return {
      mode: 'command',
      command,
      argsForDroid,
      autoPrependedExec: false,
    };
  }

  if (hasExecOnlyFlagsAtFront(args)) {
    const argsWithExec = ['exec', ...args];
    return {
      mode: 'command',
      command: 'exec',
      argsForDroid: normalizeLegacyReasoningAliasesForExec(argsWithExec),
      autoPrependedExec: true,
    };
  }

  return {
    mode: 'interactive',
    argsForDroid: [...args],
    autoPrependedExec: false,
  };
}
