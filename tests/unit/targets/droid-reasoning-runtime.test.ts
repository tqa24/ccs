import { describe, expect, it } from 'bun:test';
import {
  DroidReasoningFlagError,
  resolveDroidReasoningRuntime,
} from '../../../src/targets/droid-reasoning-runtime';

describe('droid-reasoning-runtime', () => {
  it('extracts --thinking and strips CCS reasoning flags from args', () => {
    const runtime = resolveDroidReasoningRuntime(['--thinking', 'high', '--verbose'], undefined);

    expect(runtime.reasoningOverride).toBe('high');
    expect(runtime.sourceFlag).toBe('--thinking');
    expect(runtime.argsWithoutReasoningFlags).toEqual(['--verbose']);
  });

  it('extracts --effort alias and strips inline value', () => {
    const runtime = resolveDroidReasoningRuntime(['--effort=xhigh', '--help'], undefined);

    expect(runtime.reasoningOverride).toBe('xhigh');
    expect(runtime.sourceFlag).toBe('--effort');
    expect(runtime.argsWithoutReasoningFlags).toEqual(['--help']);
  });

  it('uses CCS_THINKING env fallback when no flag is provided', () => {
    const runtime = resolveDroidReasoningRuntime(['--verbose'], 'medium');

    expect(runtime.reasoningOverride).toBe('medium');
    expect(runtime.sourceFlag).toBeUndefined();
    expect(runtime.argsWithoutReasoningFlags).toEqual(['--verbose']);
  });

  it('throws on missing reasoning flag value', () => {
    expect(() => resolveDroidReasoningRuntime(['--thinking'], undefined)).toThrow(
      DroidReasoningFlagError
    );
  });
});
