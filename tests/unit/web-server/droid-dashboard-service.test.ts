import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getDroidRawSettings,
  maskApiKeyPreview,
  resolveDroidConfigPaths,
  summarizeDroidCustomModels,
} from '../../../src/web-server/services/droid-dashboard-service';

const testRoot = path.join(os.tmpdir(), `ccs-droid-dashboard-test-${Date.now()}`);

beforeEach(() => {
  fs.mkdirSync(testRoot, { recursive: true });
  process.env.CCS_HOME = testRoot;
});

afterEach(() => {
  delete process.env.CCS_HOME;
  if (fs.existsSync(testRoot)) {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
});

describe('droid-dashboard-service', () => {
  it('resolves droid config paths on unix-like platforms', () => {
    const resolved = resolveDroidConfigPaths({
      platform: 'darwin',
      env: {
        CCS_HOME: '/tmp/ccs-home',
        XDG_CONFIG_HOME: '/tmp/xdg',
      } as NodeJS.ProcessEnv,
      homeDir: '/Users/tester',
    });

    expect(resolved.settingsPath).toBe('/tmp/ccs-home/.factory/settings.json');
    expect(resolved.globalConfigPath).toBe('/tmp/xdg/factory/config.json');
    expect(resolved.settingsDisplayPath).toBe('~/.factory/settings.json');
    expect(resolved.globalConfigDisplayPath).toBe('~/.config/factory/config.json');
  });

  it('resolves droid config paths on windows platforms', () => {
    const resolved = resolveDroidConfigPaths({
      platform: 'win32',
      env: {
        APPDATA: 'C:/Users/test/AppData/Roaming',
      } as NodeJS.ProcessEnv,
      homeDir: 'C:/Users/test',
    });

    expect(resolved.settingsPath).toBe(path.join('C:/Users/test', '.factory', 'settings.json'));
    expect(resolved.globalConfigPath).toBe(
      path.join('C:/Users/test/AppData/Roaming', 'factory', 'config.json')
    );
    expect(resolved.globalConfigDisplayPath).toBe('%APPDATA%/factory/config.json');
  });

  it('masks api key preview with only suffix', () => {
    expect(maskApiKeyPreview('sk-abcdefghijklmnop')).toBe('***mnop');
  });

  it('summarizes custom model entries with provider breakdown and ownership', () => {
    const summary = summarizeDroidCustomModels([
      {
        displayName: 'CCS codex',
        model: 'gpt-5-codex',
        baseUrl: 'http://127.0.0.1:8317/v1',
        apiKey: 'secret-token-1234',
        provider: 'openai',
      },
      {
        displayName: 'Factory team profile',
        model: 'claude-sonnet-4-5',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'another-token-9999',
        provider: 'anthropic',
      },
      {
        displayName: 'bad entry',
      },
    ]);

    expect(summary.customModelCount).toBe(2);
    expect(summary.ccsManagedCount).toBe(1);
    expect(summary.userManagedCount).toBe(1);
    expect(summary.invalidModelEntryCount).toBe(1);
    expect(summary.providerBreakdown.openai).toBe(1);
    expect(summary.providerBreakdown.anthropic).toBe(1);
    expect(summary.customModels[0].apiKeyPreview).toBe('***1234');
  });

  it('returns raw settings payload for missing settings file', () => {
    const raw = getDroidRawSettings();

    expect(raw.exists).toBe(false);
    expect(raw.path).toBe('~/.factory/settings.json');
    expect(raw.rawText).toBe('{}');
    expect(raw.settings).toBeNull();
  });

  it('returns parseError when settings.json is invalid JSON', () => {
    const settingsDir = path.join(testRoot, '.factory');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(path.join(settingsDir, 'settings.json'), '{ invalid-json');

    const raw = getDroidRawSettings();

    expect(raw.exists).toBe(true);
    expect(raw.parseError).toBeString();
    expect(raw.settings).toBeNull();
    expect(raw.rawText).toContain('invalid-json');
  });
});
