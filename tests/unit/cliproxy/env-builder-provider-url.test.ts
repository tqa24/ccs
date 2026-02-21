import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { getEffectiveEnvVars } from '../../../src/cliproxy/config/env-builder';

interface EnvSettings {
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_AUTH_TOKEN: string;
  ANTHROPIC_MODEL: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
}

function writeSettings(settingsPath: string, env: EnvSettings): void {
  fs.writeFileSync(settingsPath, JSON.stringify({ env }, null, 2));
}

describe('getEffectiveEnvVars local provider URL normalization', () => {
  let tempHome: string;
  let settingsPath: string;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-env-url-'));
    settingsPath = path.join(tempHome, 'codex.settings.json');
  });

  afterEach(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('rewrites local root URL to provider endpoint', () => {
    writeSettings(settingsPath, {
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:8317',
      ANTHROPIC_AUTH_TOKEN: 'ccs-internal-managed',
      ANTHROPIC_MODEL: 'gpt-5.3-codex-xhigh',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'gpt-5.3-codex-xhigh',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'gpt-5.3-codex-high',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'gpt-5-mini-medium',
    });

    const env = getEffectiveEnvVars('codex', 8317, settingsPath);
    expect(env.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:8317/api/provider/codex');
  });

  it('rewrites wrong local provider path to the requested provider', () => {
    writeSettings(settingsPath, {
      ANTHROPIC_BASE_URL: 'http://localhost:8317/api/provider/my-codex-variant?debug=1',
      ANTHROPIC_AUTH_TOKEN: 'ccs-internal-managed',
      ANTHROPIC_MODEL: 'gpt-5.3-codex-xhigh',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'gpt-5.3-codex-xhigh',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'gpt-5.3-codex-high',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'gpt-5-mini-medium',
    });

    const env = getEffectiveEnvVars('codex', 8317, settingsPath);
    expect(env.ANTHROPIC_BASE_URL).toBe('http://localhost:8317/api/provider/codex');
  });

  it('does not rewrite localhost URLs targeting non-cliproxy ports', () => {
    writeSettings(settingsPath, {
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:11434',
      ANTHROPIC_AUTH_TOKEN: 'ccs-internal-managed',
      ANTHROPIC_MODEL: 'gpt-5.3-codex-xhigh',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'gpt-5.3-codex-xhigh',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'gpt-5.3-codex-high',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'gpt-5-mini-medium',
    });

    const env = getEffectiveEnvVars('codex', 8317, settingsPath);
    expect(env.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:11434');
  });

  it('normalizes dotted Claude major.minor IDs for agy provider settings', () => {
    writeSettings(settingsPath, {
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:8317/api/provider/agy',
      ANTHROPIC_AUTH_TOKEN: 'ccs-internal-managed',
      ANTHROPIC_MODEL: 'claude-sonnet-4.6-thinking',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4.6-thinking',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4.6-thinking',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4.5',
    });

    const env = getEffectiveEnvVars('agy', 8317, settingsPath);
    expect(env.ANTHROPIC_MODEL).toBe('claude-sonnet-4-6-thinking');
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('claude-opus-4-6-thinking');
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('claude-sonnet-4-6-thinking');
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('claude-haiku-4-5');
  });
});
