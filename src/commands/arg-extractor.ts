/**
 * Small helpers for consistent CLI option extraction.
 */

export interface ExtractedOption {
  found: boolean;
  value?: string;
  missingValue: boolean;
  remainingArgs: string[];
}

function findInlineOption(arg: string, flag: string): string | undefined {
  const prefix = `${flag}=`;
  return arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;
}

/**
 * Extract a single-value option and remove it from args.
 * Supports `--flag value` and `--flag=value` forms.
 */
export function extractOption(args: string[], flags: readonly string[]): ExtractedOption {
  const remaining = [...args];

  for (let i = 0; i < remaining.length; i++) {
    const token = remaining[i];

    for (const flag of flags) {
      if (token === flag) {
        const next = remaining[i + 1];
        if (!next || next.startsWith('-')) {
          remaining.splice(i, 1);
          return { found: true, missingValue: true, remainingArgs: remaining };
        }

        remaining.splice(i, 2);
        return {
          found: true,
          value: next,
          missingValue: false,
          remainingArgs: remaining,
        };
      }

      const inlineValue = findInlineOption(token, flag);
      if (inlineValue !== undefined) {
        remaining.splice(i, 1);
        if (!inlineValue.trim()) {
          return { found: true, missingValue: true, remainingArgs: remaining };
        }
        return {
          found: true,
          value: inlineValue,
          missingValue: false,
          remainingArgs: remaining,
        };
      }
    }
  }

  return { found: false, missingValue: false, remainingArgs: remaining };
}

/** Returns true if any of the provided boolean flags are present. */
export function hasAnyFlag(args: string[], flags: readonly string[]): boolean {
  return args.some((arg) => flags.includes(arg));
}
