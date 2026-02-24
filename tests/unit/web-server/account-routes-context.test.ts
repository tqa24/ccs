import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Server } from 'http';
import accountRoutes from '../../../src/web-server/routes/account-routes';

async function getJson<T>(baseUrl: string, routePath: string): Promise<T> {
  const response = await fetch(`${baseUrl}${routePath}`);
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

describe('web-server account-routes context normalization', () => {
  let server: Server;
  let baseUrl = '';
  let tempHome = '';
  let originalCcsHome: string | undefined;
  let originalCcsUnified: string | undefined;

  beforeAll(async () => {
    const app = express();
    app.use('/api/accounts', accountRoutes);

    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1');
      const handleError = (error: Error) => reject(error);
      server.once('error', handleError);
      server.once('listening', () => {
        server.off('error', handleError);
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to resolve test server port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-account-routes-context-'));
    originalCcsHome = process.env.CCS_HOME;
    originalCcsUnified = process.env.CCS_UNIFIED_CONFIG;

    process.env.CCS_HOME = tempHome;
    process.env.CCS_UNIFIED_CONFIG = '1';
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) process.env.CCS_HOME = originalCcsHome;
    else delete process.env.CCS_HOME;

    if (originalCcsUnified !== undefined) process.env.CCS_UNIFIED_CONFIG = originalCcsUnified;
    else delete process.env.CCS_UNIFIED_CONFIG;

    if (tempHome && fs.existsSync(tempHome)) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('normalizes invalid persisted account context metadata in API response', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });

    fs.writeFileSync(
      path.join(ccsDir, 'config.yaml'),
      [
        'version: 8',
        'accounts:',
        '  work:',
        '    created: "2026-02-01T00:00:00.000Z"',
        '    last_used: null',
        '    context_mode: weird',
        '    context_group: "###"',
        'profiles: {}',
        'cliproxy:',
        '  oauth_accounts: {}',
        '  providers: {}',
        '  variants: {}',
      ].join('\n'),
      'utf8'
    );

    const payload = await getJson<{
      accounts: Array<{ name: string; context_mode?: string; context_group?: string }>;
    }>(baseUrl, '/api/accounts');

    const work = payload.accounts.find((account) => account.name === 'work');
    expect(work).toBeTruthy();
    expect(work?.context_mode).toBe('isolated');
    expect(work && 'context_group' in work).toBe(false);
  });

  it('falls back shared accounts with invalid groups to default shared group', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });

    fs.writeFileSync(
      path.join(ccsDir, 'config.yaml'),
      [
        'version: 8',
        'accounts:',
        '  work:',
        '    created: "2026-02-01T00:00:00.000Z"',
        '    last_used: null',
        '    context_mode: shared',
        '    context_group: "###"',
        'profiles: {}',
        'cliproxy:',
        '  oauth_accounts: {}',
        '  providers: {}',
        '  variants: {}',
      ].join('\n'),
      'utf8'
    );

    const payload = await getJson<{
      accounts: Array<{ name: string; context_mode?: string; context_group?: string }>;
    }>(baseUrl, '/api/accounts');

    const work = payload.accounts.find((account) => account.name === 'work');
    expect(work).toBeTruthy();
    expect(work?.context_mode).toBe('shared');
    expect(work?.context_group).toBe('default');
  });
});
