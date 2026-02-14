/**
 * Parse CLI thinking/effort override flags.
 *
 * Supported aliases:
 * - --thinking <value>
 * - --thinking=<value>
 * - --effort <value>
 * - --effort=<value>
 */

export type ThinkingFlag = '--thinking' | '--effort';

export interface ThinkingParseError {
  flag: ThinkingFlag;
  form: 'inline' | 'separate';
}

export interface ThinkingParseResult {
  value?: string | number;
  sourceFlag?: ThinkingFlag;
  sourceDisplay?: string;
  duplicateDisplays: string[];
  error?: ThinkingParseError;
}

function parseThinkingValue(raw: string): string | number {
  const trimmed = raw.trim();

  // Keep strict integer parsing for legacy compatibility with --thinking numeric budgets.
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  return trimmed;
}

/**
 * Parse first thinking/effort value from args.
 * If multiple flags are provided, first occurrence wins and later ones are reported as duplicates.
 */
export function parseThinkingOverride(args: string[]): ThinkingParseResult {
  let value: string | number | undefined;
  let sourceFlag: ThinkingFlag | undefined;
  let sourceDisplay: string | undefined;
  const duplicateDisplays: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    let flag: ThinkingFlag | null = null;
    let rawValue: string | undefined;
    let display = '';
    let form: 'inline' | 'separate' = 'separate';

    if (arg === '--thinking' || arg === '--effort') {
      flag = arg;
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith('-')) {
        if (value === undefined) {
          return { value, sourceFlag, sourceDisplay, duplicateDisplays, error: { flag, form } };
        }
        duplicateDisplays.push(`${flag} <missing-value>`);
        continue;
      }
      rawValue = nextArg;
      display = `${flag} ${rawValue}`;
      i += 1; // Consume value
    } else if (arg.startsWith('--thinking=') || arg.startsWith('--effort=')) {
      const [rawFlag, ...rest] = arg.split('=');
      const joined = rest.join('=');
      flag = rawFlag as ThinkingFlag;
      rawValue = joined;
      form = 'inline';
      if (!rawValue || rawValue.trim() === '') {
        if (value === undefined) {
          return { value, sourceFlag, sourceDisplay, duplicateDisplays, error: { flag, form } };
        }
        duplicateDisplays.push(`${flag}=<missing-value>`);
        continue;
      }
      display = `${flag}=${rawValue}`;
    }

    if (!flag || rawValue === undefined) {
      continue;
    }

    if (value === undefined) {
      value = parseThinkingValue(rawValue);
      sourceFlag = flag;
      sourceDisplay = display;
    } else {
      duplicateDisplays.push(display);
    }
  }

  return { value, sourceFlag, sourceDisplay, duplicateDisplays };
}
