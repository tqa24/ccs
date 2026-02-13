/**
 * Composite environment routing tests.
 */

import { describe, it, expect } from 'bun:test';
import { buildClaudeEnvironment } from '../../../src/cliproxy/executor/env-resolver';

const tiers = {
  opus: { provider: 'agy' as const, model: 'claude-opus-4-6-thinking' },
  sonnet: { provider: 'gemini' as const, model: 'gemini-2.5-pro' },
  haiku: { provider: 'codex' as const, model: 'gpt-5.1-codex-mini' },
};

describe('buildClaudeEnvironment - composite remote routing', () => {
  it('uses remote base URL and auth token for direct remote composite mode', () => {
    const env = buildClaudeEnvironment({
      provider: 'agy',
      useRemoteProxy: true,
      remoteConfig: {
        host: 'remote.example.com',
        port: 9443,
        protocol: 'https',
        authToken: 'remote-auth-token',
      },
      localPort: 8318,
      verbose: false,
      isComposite: true,
      compositeTiers: tiers,
      compositeDefaultTier: 'sonnet',
    });

    expect(env.ANTHROPIC_BASE_URL).toBe('https://remote.example.com:9443');
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('remote-auth-token');
    expect(env.ANTHROPIC_BASE_URL).not.toContain('/api/provider/');
  });

  it('uses local tunnel endpoint for HTTPS remote composite mode', () => {
    const env = buildClaudeEnvironment({
      provider: 'agy',
      useRemoteProxy: true,
      remoteConfig: {
        host: 'remote.example.com',
        port: 9443,
        protocol: 'https',
        authToken: 'remote-auth-token',
      },
      httpsTunnel: {} as never,
      tunnelPort: 9911,
      localPort: 8318,
      verbose: false,
      isComposite: true,
      compositeTiers: tiers,
      compositeDefaultTier: 'sonnet',
    });

    expect(env.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:9911');
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('remote-auth-token');
    expect(env.ANTHROPIC_BASE_URL).not.toContain('/api/provider/');
  });
});
