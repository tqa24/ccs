import { describe, expect, it } from 'bun:test';
import { resolveThinkingProviderOverridesForSave } from '../../../src/web-server/routes/misc-routes';

describe('thinking routes logic', () => {
  it('clears provider overrides when clear flag is set', () => {
    const result = resolveThinkingProviderOverridesForSave(
      {
        codex: { opus: 'high' },
      },
      {
        gemini: { sonnet: 'medium' },
      },
      true
    );

    expect(result).toBeUndefined();
  });

  it('applies normalized updates when provided and clear flag is false', () => {
    const updates = {
      gemini: { sonnet: 'medium' },
    };
    const result = resolveThinkingProviderOverridesForSave(
      {
        codex: { opus: 'high' },
      },
      updates,
      false
    );

    expect(result).toEqual(updates);
  });

  it('preserves current overrides when no updates are provided', () => {
    const current = {
      codex: { opus: 'high' },
    };
    const result = resolveThinkingProviderOverridesForSave(current, undefined, false);

    expect(result).toEqual(current);
  });
});
