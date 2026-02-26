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
  reasoningSourceDisplay?: string;
  duplicateReasoningDisplays: string[];
}

type DroidReasoningFlag = '--reasoning-effort' | '-r' | '--effort' | '--thinking';

export class DroidCommandRouterError extends Error {
  constructor(
    message: string,
    public readonly flag: DroidReasoningFlag
  ) {
    super(message);
    this.name = 'DroidCommandRouterError';
  }
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

const DROID_EXEC_ONLY_SHORT_FLAGS = new Set(['-o', '-f', '-s', '-m']);
const DROID_REASONING_EFFORT_VALUES = new Set([
  'none',
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'max',
  'xhigh',
  'auto',
]);

function getLongFlagToken(arg: string): string {
  const eqIndex = arg.indexOf('=');
  return eqIndex >= 0 ? arg.slice(0, eqIndex) : arg;
}

function isExplicitSubcommand(arg: string | undefined): boolean {
  return !!arg && DROID_SUBCOMMANDS.has(arg);
}

function isLikelyReasoningEffortValue(value: string | undefined): boolean {
  if (!value || value.startsWith('-')) return false;
  return DROID_REASONING_EFFORT_VALUES.has(value.toLowerCase());
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
    if (!arg.startsWith('--')) {
      // Short flags:
      // - `-r` is ambiguous (root resume vs exec reasoning-effort), so only route
      //   when value looks like a reasoning effort level.
      if (DROID_EXEC_ONLY_SHORT_FLAGS.has(arg)) {
        return true;
      }
      if (arg === '-r') {
        const value = args[i + 1];
        return isLikelyReasoningEffortValue(value);
      }
      continue;
    }

    const flagToken = getLongFlagToken(arg);
    if (DROID_EXEC_ONLY_LONG_FLAGS.has(flagToken)) {
      return true;
    }
  }

  return false;
}

interface ExecReasoningNormalizationResult {
  args: string[];
  sourceDisplay?: string;
  duplicateDisplays: string[];
}

function normalizeExecReasoningFlags(args: string[]): ExecReasoningNormalizationResult {
  const normalized: string[] = [];
  const duplicateDisplays: string[] = [];
  let sourceDisplay: string | undefined;
  let hasReasoning = false;

  const applyReasoning = (value: string, display: string): void => {
    if (!hasReasoning) {
      normalized.push('--reasoning-effort', value);
      hasReasoning = true;
      sourceDisplay = display;
      return;
    }

    duplicateDisplays.push(display);
  };

  const handleMissingValue = (
    flag: DroidReasoningFlag,
    missingDisplay: string
  ): never | undefined => {
    if (!hasReasoning) {
      throw new DroidCommandRouterError(`${flag} requires a value`, flag);
    }

    duplicateDisplays.push(missingDisplay);
    return undefined;
  };

  // Preserve leading command token for explicit auto-prepended command mode.
  const startsWithExec = args[0] === 'exec';
  let startIndex = 0;
  if (startsWithExec) {
    normalized.push('exec');
    startIndex = 1;
  }

  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--') {
      normalized.push(...args.slice(i));
      break;
    }

    if (
      arg === '--reasoning-effort' ||
      arg === '--effort' ||
      arg === '--thinking' ||
      arg === '-r'
    ) {
      const value = args[i + 1];
      if (!value || value.startsWith('-')) {
        handleMissingValue(arg as DroidReasoningFlag, `${arg} <missing-value>`);
        continue;
      }

      applyReasoning(value, `${arg} ${value}`);
      i += 1;
      continue;
    }

    if (arg.startsWith('--reasoning-effort=')) {
      const value = arg.slice('--reasoning-effort='.length);
      if (!value) {
        handleMissingValue('--reasoning-effort', '--reasoning-effort=<missing-value>');
        continue;
      }
      applyReasoning(value, `--reasoning-effort=${value}`);
      continue;
    }

    if (arg.startsWith('--effort=')) {
      const value = arg.slice('--effort='.length);
      if (!value) {
        handleMissingValue('--effort', '--effort=<missing-value>');
        continue;
      }
      applyReasoning(value, `--effort=${value}`);
      continue;
    }

    if (arg.startsWith('--thinking=')) {
      const value = arg.slice('--thinking='.length);
      if (!value) {
        handleMissingValue('--thinking', '--thinking=<missing-value>');
        continue;
      }
      applyReasoning(value, `--thinking=${value}`);
      continue;
    }

    normalized.push(arg);
  }

  return {
    args: normalized,
    sourceDisplay,
    duplicateDisplays,
  };
}

export function routeDroidCommandArgs(args: string[]): DroidCommandRoute {
  if (args.length === 0) {
    return {
      mode: 'interactive',
      argsForDroid: [],
      autoPrependedExec: false,
      duplicateReasoningDisplays: [],
    };
  }

  if (isExplicitSubcommand(args[0])) {
    const command = args[0];
    const normalized =
      command === 'exec'
        ? normalizeExecReasoningFlags(args)
        : {
            args: [...args],
            duplicateDisplays: [],
          };
    return {
      mode: 'command',
      command,
      argsForDroid: normalized.args,
      autoPrependedExec: false,
      reasoningSourceDisplay: normalized.sourceDisplay,
      duplicateReasoningDisplays: normalized.duplicateDisplays,
    };
  }

  if (hasExecOnlyFlagsAtFront(args)) {
    const argsWithExec = ['exec', ...args];
    const normalized = normalizeExecReasoningFlags(argsWithExec);
    return {
      mode: 'command',
      command: 'exec',
      argsForDroid: normalized.args,
      autoPrependedExec: true,
      reasoningSourceDisplay: normalized.sourceDisplay,
      duplicateReasoningDisplays: normalized.duplicateDisplays,
    };
  }

  return {
    mode: 'interactive',
    argsForDroid: [...args],
    autoPrependedExec: false,
    duplicateReasoningDisplays: [],
  };
}
