/**
 * Unit tests for shared composite variant validation.
 */

import { describe, it, expect } from 'bun:test';
import {
  validateCompositeDefaultTier,
  validateCompositeTiers,
} from '../../../src/cliproxy/composite-validator';

const validTier = {
  provider: 'agy',
  model: 'claude-sonnet-4-5-thinking',
};

describe('validateCompositeDefaultTier', () => {
  it('accepts valid tier names', () => {
    expect(validateCompositeDefaultTier('opus')).toBeNull();
    expect(validateCompositeDefaultTier('sonnet')).toBeNull();
    expect(validateCompositeDefaultTier('haiku')).toBeNull();
  });

  it('rejects invalid tier names', () => {
    const error = validateCompositeDefaultTier('invalid-tier');
    expect(error).toContain("Invalid default_tier 'invalid-tier'");
  });
});

describe('validateCompositeTiers', () => {
  it('rejects missing required tiers in create mode', () => {
    const error = validateCompositeTiers(
      {
        opus: validTier,
        sonnet: validTier,
      },
      { defaultTier: 'sonnet', requireAllTiers: true }
    );

    expect(error).toContain("Missing required tier 'haiku'");
  });

  it('rejects null tier objects', () => {
    const error = validateCompositeTiers(
      {
        opus: null,
        sonnet: validTier,
        haiku: validTier,
      },
      { defaultTier: 'sonnet', requireAllTiers: true }
    );

    expect(error).toContain("Invalid tier config for 'opus'");
  });

  it('accepts partial updates in update mode', () => {
    const error = validateCompositeTiers(
      {
        opus: { provider: 'gemini', model: 'gemini-2.5-pro' },
      },
      { defaultTier: 'sonnet' }
    );

    expect(error).toBeNull();
  });

  it('rejects circular fallback definitions', () => {
    const error = validateCompositeTiers(
      {
        opus: {
          provider: 'gemini',
          model: 'gemini-2.5-pro',
          fallback: { provider: 'gemini', model: 'gemini-2.5-pro' },
        },
      },
      { defaultTier: 'opus' }
    );

    expect(error).toContain("Circular fallback in tier 'opus'");
  });
});
