import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createApiProfile } from '../../../src/api/services/profile-writer';

describe('profile-writer AGY denylist', () => {
  let tempHome = '';
  let originalCcsHome: string | undefined;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-profile-writer-'));
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

  it('rejects denylisted AGY 4.5 models on profile create', () => {
    const result = createApiProfile(
      'agy-denied',
      'http://127.0.0.1:8317/api/provider/agy',
      'test-token',
      {
        default: 'claude-opus-4.5',
        opus: 'claude-opus-4.5',
        sonnet: 'claude-sonnet-4.5',
        haiku: 'claude-haiku-4.5',
      },
      'claude'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('denylist');
    const settingsPath = path.join(tempHome, '.ccs', 'agy-denied.settings.json');
    expect(fs.existsSync(settingsPath)).toBe(false);
  });
});
