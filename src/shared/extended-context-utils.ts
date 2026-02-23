/**
 * Shared extended context helpers used by CLI + UI.
 */

/** Extended context suffix recognized by Claude Code. */
export const EXTENDED_CONTEXT_SUFFIX = '[1m]';

/** Check if model is a native Gemini model (auto-enabled behavior). */
export function isNativeGeminiModel(modelId: string): boolean {
  return modelId.toLowerCase().startsWith('gemini-');
}

/** Check if model already has [1m] suffix. */
export function hasExtendedContextSuffix(model: string): boolean {
  return model.toLowerCase().endsWith(EXTENDED_CONTEXT_SUFFIX.toLowerCase());
}

/** Apply [1m] suffix to model if not already present. */
export function applyExtendedContextSuffix(model: string): string {
  if (!model) return model;
  if (hasExtendedContextSuffix(model)) return model;
  return `${model}${EXTENDED_CONTEXT_SUFFIX}`;
}

/** Strip [1m] suffix from model string. */
export function stripExtendedContextSuffix(model: string): string {
  if (!model) return model;
  return hasExtendedContextSuffix(model) ? model.slice(0, -EXTENDED_CONTEXT_SUFFIX.length) : model;
}
