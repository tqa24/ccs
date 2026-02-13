import { describe, expect, it } from 'bun:test';
import {
  CLIPROXY_PROVIDER_IDS,
  getOAuthCallbackPort,
  getProviderDisplayName,
  getProvidersByOAuthFlow,
  isCLIProxyProvider,
  mapExternalProviderName,
} from '../../../src/cliproxy/provider-capabilities';

describe('provider-capabilities', () => {
  it('keeps canonical provider IDs backward-compatible', () => {
    expect(CLIPROXY_PROVIDER_IDS).toEqual([
      'gemini',
      'codex',
      'agy',
      'qwen',
      'iflow',
      'kiro',
      'ghcp',
      'claude',
    ]);
  });

  it('validates provider IDs', () => {
    expect(isCLIProxyProvider('gemini')).toBe(true);
    expect(isCLIProxyProvider('ghcp')).toBe(true);
    expect(isCLIProxyProvider('not-a-provider')).toBe(false);
    expect(isCLIProxyProvider('Gemini')).toBe(false);
  });

  it('returns providers by OAuth flow capability', () => {
    expect(getProvidersByOAuthFlow('device_code')).toEqual(['qwen', 'kiro', 'ghcp']);
    expect(getProvidersByOAuthFlow('authorization_code')).toEqual([
      'gemini',
      'codex',
      'agy',
      'iflow',
      'claude',
    ]);
  });

  it('maps external provider aliases to canonical IDs', () => {
    expect(mapExternalProviderName('gemini-cli')).toBe('gemini');
    expect(mapExternalProviderName('antigravity')).toBe('agy');
    expect(mapExternalProviderName('codewhisperer')).toBe('kiro');
    expect(mapExternalProviderName('github-copilot')).toBe('ghcp');
    expect(mapExternalProviderName('copilot')).toBe('ghcp');
    expect(mapExternalProviderName('anthropic')).toBe('claude');
    expect(mapExternalProviderName('unknown-provider')).toBeNull();
  });

  it('exposes callback port and display name capabilities', () => {
    expect(getOAuthCallbackPort('qwen')).toBeNull();
    expect(getOAuthCallbackPort('kiro')).toBeNull();
    expect(getOAuthCallbackPort('gemini')).toBe(8085);
    expect(getProviderDisplayName('agy')).toBe('AntiGravity');
  });
});
