/**
 * Unit tests for target registry and adapters
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import {
  registerTarget,
  getTarget,
  getDefaultTarget,
  hasTarget,
  getRegisteredTargets,
  ClaudeAdapter,
  DroidAdapter,
} from '../../../src/targets';

describe('target-registry', () => {
  beforeEach(() => {
    // Re-register adapters (registry is module-scoped singleton)
    registerTarget(new ClaudeAdapter());
    registerTarget(new DroidAdapter());
  });

  it('should register and retrieve claude adapter', () => {
    const adapter = getTarget('claude');
    expect(adapter.type).toBe('claude');
    expect(adapter.displayName).toBe('Claude Code');
  });

  it('should register and retrieve droid adapter', () => {
    const adapter = getTarget('droid');
    expect(adapter.type).toBe('droid');
    expect(adapter.displayName).toBe('Factory Droid');
  });

  it('should return claude as default target', () => {
    const adapter = getDefaultTarget();
    expect(adapter.type).toBe('claude');
  });

  it('should throw for unknown target', () => {
    expect(() => getTarget('unknown' as never)).toThrow(/Unknown target "unknown"/);
  });

  it('should check target existence', () => {
    expect(hasTarget('claude')).toBe(true);
    expect(hasTarget('droid')).toBe(true);
    expect(hasTarget('unknown' as never)).toBe(false);
  });

  it('should list registered targets', () => {
    const targets = getRegisteredTargets();
    expect(targets).toContain('claude');
    expect(targets).toContain('droid');
  });
});

describe('ClaudeAdapter', () => {
  const adapter = new ClaudeAdapter();

  it('should have correct type and displayName', () => {
    expect(adapter.type).toBe('claude');
    expect(adapter.displayName).toBe('Claude Code');
  });

  it('should support all profile types', () => {
    expect(adapter.supportsProfileType('account')).toBe(true);
    expect(adapter.supportsProfileType('settings')).toBe(true);
    expect(adapter.supportsProfileType('cliproxy')).toBe(true);
    expect(adapter.supportsProfileType('default')).toBe(true);
    expect(adapter.supportsProfileType('copilot')).toBe(true);
  });

  it('should build env with credentials', () => {
    const env = adapter.buildEnv(
      {
        profile: 'gemini',
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'claude-opus-4-6',
      },
      'settings'
    );

    expect(env['ANTHROPIC_BASE_URL']).toBe('https://api.example.com');
    expect(env['ANTHROPIC_AUTH_TOKEN']).toBe('test-key');
    expect(env['ANTHROPIC_MODEL']).toBe('claude-opus-4-6');
  });

  it('should pass through args unchanged', () => {
    const args = adapter.buildArgs('gemini', ['-p', 'hello', '--verbose']);
    expect(args).toEqual(['-p', 'hello', '--verbose']);
  });

  it('prepareCredentials should be no-op', async () => {
    // Should not throw
    await adapter.prepareCredentials({
      profile: 'test',
      baseUrl: 'x',
      apiKey: 'y',
    });
  });
});

describe('DroidAdapter', () => {
  const adapter = new DroidAdapter();

  it('should have correct type and displayName', () => {
    expect(adapter.type).toBe('droid');
    expect(adapter.displayName).toBe('Factory Droid');
  });

  it('should NOT support account profile type', () => {
    expect(adapter.supportsProfileType('account')).toBe(false);
  });

  it('should support non-account profile types', () => {
    expect(adapter.supportsProfileType('settings')).toBe(true);
    expect(adapter.supportsProfileType('cliproxy')).toBe(true);
    expect(adapter.supportsProfileType('default')).toBe(true);
    expect(adapter.supportsProfileType('copilot')).toBe(true);
  });

  it('should build args with -m custom:ccs- prefix', () => {
    const args = adapter.buildArgs('gemini', ['--verbose']);
    expect(args).toEqual(['-m', 'custom:ccs-gemini', '--verbose']);
  });

  it('should build minimal env (no ANTHROPIC_ vars)', () => {
    const env = adapter.buildEnv(
      {
        baseUrl: 'http://localhost:8317',
        apiKey: 'dummy',
      },
      'cliproxy'
    );

    // Droid uses config file, not env vars
    expect(env['ANTHROPIC_BASE_URL']).toBeUndefined();
    expect(env['ANTHROPIC_AUTH_TOKEN']).toBeUndefined();
  });
});
