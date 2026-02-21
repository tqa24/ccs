import { afterEach, describe, expect, it, mock } from 'bun:test';
import { parseProviderArg } from '../../../src/commands/cliproxy';

const originalConsoleError = console.error;

afterEach(() => {
  console.error = originalConsoleError;
});

describe('parseProviderArg', () => {
  it('defaults to all when --provider is not specified', () => {
    const result = parseProviderArg(['--verbose']);

    expect(result.provider).toBe('all');
    expect(result.invalid).toBe(false);
    expect(result.remainingArgs).toEqual(['--verbose']);
  });

  it('accepts canonical providers', () => {
    const result = parseProviderArg(['--provider', 'claude']);

    expect(result.provider).toBe('claude');
    expect(result.invalid).toBe(false);
  });

  it('accepts external aliases', () => {
    const result = parseProviderArg(['--provider', 'anthropic']);

    expect(result.provider).toBe('claude');
    expect(result.invalid).toBe(false);
  });

  it('marks invalid when provider value is unsupported', () => {
    const errorSpy = mock(() => {});
    console.error = errorSpy as typeof console.error;

    const result = parseProviderArg(['--provider', 'nope']);

    expect(result.provider).toBe('all');
    expect(result.invalid).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('marks invalid when --provider value is missing', () => {
    const errorSpy = mock(() => {});
    console.error = errorSpy as typeof console.error;

    const result = parseProviderArg(['--provider']);

    expect(result.provider).toBe('all');
    expect(result.invalid).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });
});
