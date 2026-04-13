/**
 * Claude launch argument helpers for first-class Image Analysis.
 *
 * Uses the same prompt injection mode as the user to avoid mixing
 * `--append-system-prompt` and `--append-system-prompt-file` in one request.
 */

import {
  buildSteeringArg,
  hasManagedPromptFileArg,
  PROMPT_FLAG_INLINE,
} from '../prompt-injection-strategy';

const IMAGE_ANALYSIS_STEERING_PROMPT = {
  name: 'ccs-prompt-image-analysis-tool',
  content:
    'For local image or PDF files, prefer the CCS MCP tool ImageAnalysis instead of Read. Use Read for text, code, and other plain files. If the user asks a specific question about the visual, pass that question as the focus field when useful. If ImageAnalysis is unavailable or fails, you may fall back to Read.',
};

function splitArgsAtTerminator(args: string[]): { optionArgs: string[]; trailingArgs: string[] } {
  const terminatorIndex = args.indexOf('--');
  if (terminatorIndex === -1) {
    return { optionArgs: args, trailingArgs: [] };
  }

  return {
    optionArgs: args.slice(0, terminatorIndex),
    trailingArgs: args.slice(terminatorIndex),
  };
}

function getImmediateFlagValue(args: string[], index: number): string | null {
  const value = args[index + 1];
  if (value === undefined || value === '--' || value.startsWith('--')) {
    return null;
  }
  return value;
}

function hasExactFlagValue(params: {
  args: string[];
  flag: string;
  expectedValue: string;
}): boolean {
  const { args, flag, expectedValue } = params;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === flag) {
      const value = getImmediateFlagValue(args, index);

      if (value === expectedValue) {
        return true;
      }

      continue;
    }

    if (arg === `${flag}=${expectedValue}`) {
      return true;
    }

    if (arg.startsWith(`${flag}=`) && arg.slice(flag.length + 1) === expectedValue) {
      return true;
    }
  }

  return false;
}

function ensureImageAnalysisSteeringPrompt(args: string[]): string[] {
  const { optionArgs, trailingArgs } = splitArgsAtTerminator(args);

  if (
    hasExactFlagValue({
      args: optionArgs,
      flag: PROMPT_FLAG_INLINE,
      expectedValue: IMAGE_ANALYSIS_STEERING_PROMPT.content,
    })
  ) {
    return args;
  }

  if (
    hasManagedPromptFileArg({ args: optionArgs, promptName: IMAGE_ANALYSIS_STEERING_PROMPT.name })
  ) {
    return args;
  }

  const steeringArg = buildSteeringArg({
    args: optionArgs,
    promptName: IMAGE_ANALYSIS_STEERING_PROMPT.name,
    promptContent: IMAGE_ANALYSIS_STEERING_PROMPT.content,
  });

  return [...optionArgs, ...steeringArg, ...trailingArgs];
}

export function appendThirdPartyImageAnalysisToolArgs(args: string[]): string[] {
  return ensureImageAnalysisSteeringPrompt(args);
}

export function getImageAnalysisSteeringPrompt(): string {
  return IMAGE_ANALYSIS_STEERING_PROMPT.content;
}
