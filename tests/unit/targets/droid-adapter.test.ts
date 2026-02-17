/**
 * Unit tests for Droid adapter argument building.
 */
import { describe, it, expect } from 'bun:test';
import { DroidAdapter } from '../../../src/targets/droid-adapter';

describe('DroidAdapter.buildArgs', () => {
  it('builds droid model args for valid profile names', () => {
    const adapter = new DroidAdapter();
    expect(adapter.buildArgs('gemini_01', ['--help'])).toEqual(['-m', 'custom:ccs-gemini_01', '--help']);
  });

  it('rejects unsafe profile names', () => {
    const adapter = new DroidAdapter();
    expect(() => adapter.buildArgs('bad profile', [])).toThrow(/Invalid profile name/);
  });
});
