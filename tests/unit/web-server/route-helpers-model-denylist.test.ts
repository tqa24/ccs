import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createSettingsFile,
  updateSettingsFile,
} from '../../../src/web-server/routes/route-helpers';

describe('route-helpers AGY denylist', () => {
  let tempHome = '';
  let originalCcsHome: string | undefined;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-route-helpers-'));
    originalCcsHome = process.env.CCS_HOME;
    process.env.CCS_HOME = tempHome;
  });

  afterEach(() => {
    if (originalCcsHome === undefined) {
      delete process.env.CCS_HOME;
    } else {
      process.env.CCS_HOME = originalCcsHome;
    }

    if (tempHome && fs.existsSync(tempHome)) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('rejects denylisted AGY models on settings create', () => {
    expect(() =>
      createSettingsFile(
        'agy-denied',
        'http://127.0.0.1:8317/api/provider/agy',
        'test-token',
        {
          model: 'claude-sonnet-4.5',
          opusModel: 'claude-opus-4.5',
          sonnetModel: 'claude-sonnet-4.5',
          haikuModel: 'claude-haiku-4.5',
        }
      )
    ).toThrow(/denylist/i);
  });

  it('rejects denylisted AGY models on settings update', () => {
    const settingsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(settingsDir, { recursive: true });
    const settingsPath = path.join(settingsDir, 'agy-profile.settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          env: {
            ANTHROPIC_BASE_URL: 'http://127.0.0.1:8317/api/provider/agy',
            ANTHROPIC_AUTH_TOKEN: 'test-token',
            ANTHROPIC_MODEL: 'claude-sonnet-4-6',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6-thinking',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
          },
        },
        null,
        2
      ) + '\n'
    );

    expect(() => updateSettingsFile('agy-profile', { model: 'claude-opus-4.5' })).toThrow(
      /denylist/i
    );
  });
});
