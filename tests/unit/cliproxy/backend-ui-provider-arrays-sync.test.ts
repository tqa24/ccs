/**
 * Provider Sync Test
 *
 * Validates that backend CLIPROXY_PROFILES and UI CLIPROXY_PROVIDERS stay in sync.
 * This test catches mismatches when adding new providers.
 */

import { describe, expect, test } from 'bun:test';
import { CLIPROXY_PROFILES } from '../../../src/auth/profile-detector';

// UI providers (must manually sync - this test validates the sync)
const UI_CLIPROXY_PROVIDERS = [
  'gemini',
  'codex',
  'agy',
  'qwen',
  'iflow',
  'kiro',
  'ghcp',
  'claude',
] as const;

describe('Provider Sync', () => {
  test('backend CLIPROXY_PROFILES matches UI CLIPROXY_PROVIDERS', () => {
    const backend = [...CLIPROXY_PROFILES].sort();
    const ui = [...UI_CLIPROXY_PROVIDERS].sort();

    expect(backend).toEqual(ui);
  });

  test('both arrays have same length', () => {
    expect(CLIPROXY_PROFILES.length).toBe(UI_CLIPROXY_PROVIDERS.length);
  });

  test('UI array contains all backend providers', () => {
    for (const provider of CLIPROXY_PROFILES) {
      expect(UI_CLIPROXY_PROVIDERS).toContain(provider);
    }
  });
});
