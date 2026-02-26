import { parseThinkingOverride, type ThinkingFlag } from '../cliproxy/executor/thinking-arg-parser';
import { resolveRuntimeThinkingOverride } from '../cliproxy/executor/thinking-override-resolver';

export class DroidReasoningFlagError extends Error {
  constructor(
    message: string,
    public readonly flag: ThinkingFlag
  ) {
    super(message);
    this.name = 'DroidReasoningFlagError';
  }
}

export interface DroidReasoningRuntime {
  argsWithoutReasoningFlags: string[];
  reasoningOverride: string | number | undefined;
  sourceFlag: ThinkingFlag | undefined;
  sourceDisplay: string | undefined;
  duplicateDisplays: string[];
}

function stripReasoningFlags(args: string[]): string[] {
  return args.filter((arg, idx) => {
    if (arg === '--thinking' || arg === '--effort') return false;
    if (arg.startsWith('--thinking=')) return false;
    if (arg.startsWith('--effort=')) return false;
    if (args[idx - 1] === '--thinking' || args[idx - 1] === '--effort') return false;
    return true;
  });
}

export function resolveDroidReasoningRuntime(
  args: string[],
  envThinkingValue: string | undefined
): DroidReasoningRuntime {
  const parseResult = parseThinkingOverride(args);
  if (parseResult.error) {
    throw new DroidReasoningFlagError(
      `${parseResult.error.flag} requires a value`,
      parseResult.error.flag
    );
  }

  const { thinkingOverride, thinkingSource } = resolveRuntimeThinkingOverride(
    parseResult.value,
    envThinkingValue
  );

  return {
    argsWithoutReasoningFlags: stripReasoningFlags(args),
    reasoningOverride: thinkingOverride,
    sourceFlag: thinkingSource === 'flag' ? parseResult.sourceFlag : undefined,
    sourceDisplay: parseResult.sourceDisplay,
    duplicateDisplays: parseResult.duplicateDisplays,
  };
}
